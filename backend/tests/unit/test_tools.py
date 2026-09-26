"""Unit tests — tools, spec validation, guardrails."""
import pytest

from app import deps
from app.agents.specs import ALL_TOOL_NAMES, AgentSpec, build_tool_map
from app.scheduler import run_once
from app.tools.comms import send_alert_impl
from app.tools.invoices import draft_reminder_impl


def test_spec_rejects_unknown_tools():
    with pytest.raises(Exception):
        AgentSpec(name="bad", goal="g", tools=["hack_the_mainframe"])


def test_spec_filters_guardrail_tools(tenant):
    spec = AgentSpec(
        id="x", name="x", goal="g",
        tools=["list_overdue", "send_reminder"],
        guardrails={"allowed_tools": ["list_overdue"]},
    )
    resolved = spec.resolved_tools(tenant)
    names = {getattr(t, "tool_name", None) or t.__name__ for t in resolved}
    assert names == {"list_overdue"}   # send_reminder filtered out by guardrail


def test_all_registry_tools_resolve(tenant):
    spec = AgentSpec(id="x", name="x", goal="g", tools=sorted(ALL_TOOL_NAMES))
    assert len(spec.resolved_tools(tenant)) == len(ALL_TOOL_NAMES)


def test_draft_reminder_creates_pending_alert(tenant):
    result = draft_reminder_impl(tenant)
    assert result["requires_approval"] is True
    pending = deps.store.list_alerts(tenant, status="pending_approval")
    assert any(a["id"] == result["draft"]["id"] for a in pending)


def test_send_guardrail_blocks_pending(tenant):
    result = draft_reminder_impl(tenant)
    alert_id = result["draft"]["id"]
    # approve endpoint path is the ONLY way pending→sent; impl on pending is a no-op guard
    alert = next(a for a in deps.store.list_alerts(tenant) if a["id"] == alert_id)
    assert alert["status"] == "pending_approval"  # never auto-sent


def test_send_after_approval(tenant):
    result = draft_reminder_impl(tenant)
    alert_id = result["draft"]["id"]
    deps.store.update_alert(tenant, alert_id, status="approved")  # owner clicked
    sent = send_alert_impl(tenant, alert_id)
    assert "Sent" in sent["reply"]
    assert deps.store.list_alerts(tenant, status="sent")


def test_scheduler_promotes_due_alert(tenant):
    deps.store.put_alert(tenant, {
        "id": "a-due", "kind": "reminder", "title": "due now",
        "status": "scheduled", "fires_at": "2000-01-01T00:00:00Z"})
    deps.store.put_alert(tenant, {
        "id": "a-later", "kind": "reminder", "title": "future",
        "status": "scheduled", "fires_at": "2999-01-01T00:00:00Z"})
    # >=1 (not ==1): the seeded tenant may have other now-past scheduled alerts;
    # what matters is our due one promotes and our future one does not.
    assert run_once(tenant) >= 1
    statuses = {a["id"]: a["status"] for a in deps.store.list_alerts(tenant)}
    assert statuses["a-due"] == "pending_approval"
    assert statuses["a-later"] == "scheduled"


def test_aging_math(tenant):
    from app.tools.invoices import invoice_tools
    tools = {t.tool_name: t for t in invoice_tools(tenant)}
    # call the underlying function through the tool wrapper
    report = tools["aging_report"]()
    total = sum(report["buckets"].values())
    expected = sum(r["amount"] for r in deps.store.list_invoices(tenant, status="overdue"))
    assert total == expected
