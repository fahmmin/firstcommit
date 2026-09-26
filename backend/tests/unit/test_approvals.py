"""A1 approval engine — risk policy, session grants, queue→execute."""
from app import deps
from app.agents import approvals as appr


def test_risk_policy():
    assert appr.risk_for("list_overdue") == appr.AUTO       # reads auto
    assert appr.risk_for("create_invoice") == appr.ASK      # writes ask
    assert appr.risk_for("create_artifact") == appr.ASK


def test_decide_and_session_grant(tenant):
    appr.revoke_session(tenant, "create_invoice")
    assert appr.decide(tenant, "list_overdue") == appr.AUTO
    assert appr.decide(tenant, "create_invoice") == appr.ASK
    appr.grant_session(tenant, "create_invoice")            # owner grants for session
    assert appr.decide(tenant, "create_invoice") == appr.AUTO
    appr.revoke_session(tenant, "create_invoice")
    assert appr.decide(tenant, "create_invoice") == appr.ASK


def test_gate_queues_then_execute(tenant):
    appr.revoke_session(tenant, "create_invoice")
    before = len(deps.store.list_invoices(tenant))
    q = appr.gate(tenant, "create_invoice",
                  {"buyer": "Gate Test Co", "amount": 5000, "due_date": "2026-12-01"},
                  "Add invoice for Gate Test Co")
    assert q and q["queued"] and "approval" in q["reply"].lower()
    # nothing written yet
    assert len(deps.store.list_invoices(tenant)) == before
    ap = deps.store.get_approval(tenant, q["approval_id"])
    assert ap["status"] == "pending" and ap["tool"] == "create_invoice"
    # owner approves → executes
    res = appr.execute_action(tenant, q["approval_id"])
    assert res["status"] == "executed"
    assert len(deps.store.list_invoices(tenant)) == before + 1
    assert deps.store.get_approval(tenant, q["approval_id"])["status"] == "executed"
    # idempotent
    assert appr.execute_action(tenant, q["approval_id"])["status"] == "executed"


def test_gate_auto_when_granted(tenant):
    appr.grant_session(tenant, "create_invoice")
    q = appr.gate(tenant, "create_invoice", {"buyer": "X", "amount": 1}, "x")
    assert q is None   # auto-approved → proceed, no queue
    appr.revoke_session(tenant, "create_invoice")


# ---- Round 5 / Phase 2 — every gated tool really executes on approve ----

def _tool(tenant, factory, name):
    return next(t for t in factory(tenant) if t.tool_name == name)


def test_every_ask_tool_has_an_executor():
    for tool in appr.TOOL_RISK:
        assert appr._executor(tool) is not None, f"{tool} would be approved but never run"


def test_no_executor_reports_failed_not_executed(tenant):
    ap = deps.store.put_approval(tenant, {"id": "apr-ghost", "tool": "made_up_tool", "args": {},
                                          "title": "ghost", "status": "pending"})
    res = appr.execute_action(tenant, ap["id"])
    assert res["status"] == "failed" and "no executor" in res["error"]
    assert deps.store.get_approval(tenant, "apr-ghost")["status"] == "failed"


def test_schedule_alert_queues_then_runs(tenant):
    from app.tools.comms import comms_tools
    before = len(deps.store.list_alerts(tenant))
    q = _tool(tenant, comms_tools, "schedule_alert")(title="Chase Om Sai", fires_at="2026-12-01")
    assert q["queued"] and len(deps.store.list_alerts(tenant)) == before
    ap = deps.store.get_approval(tenant, q["approval_id"])
    assert "Chase Om Sai" in ap["summary"]
    res = appr.execute_action(tenant, q["approval_id"])
    assert res["status"] == "executed" and res["result_ref"]["kind"] == "alert"
    assert len(deps.store.list_alerts(tenant)) == before + 1


def test_sync_catalog_and_publish_are_gated(tenant):
    from app.tools.presence import presence_tools
    before = len(deps.store.list_listings(tenant))
    q = _tool(tenant, presence_tools, "sync_catalog")()
    assert q["queued"] and len(deps.store.list_listings(tenant)) == before
    assert appr.execute_action(tenant, q["approval_id"])["status"] == "executed"
    assert len(deps.store.list_listings(tenant)) >= before
    q2 = _tool(tenant, presence_tools, "publish_listing")(title="all")
    assert q2["queued"]
    res = appr.execute_action(tenant, q2["approval_id"])
    # marketplaces are coming_soon → honest "blocked", nothing marked live
    assert res["status"] == "executed" and res["result"]["published"] == 0


def test_approval_by_draft_tools_are_not_double_gated(tenant):
    # book_pickup/draft_reminder create a pending_approval draft — that IS the approval
    for t in ("book_pickup", "draft_reminder", "send_reminder"):
        assert appr.risk_for(t) == appr.AUTO


def test_grants_persist_in_settings(tenant):
    appr.grant_session(tenant, "sync_catalog")
    assert "sync_catalog" in deps.store.get_settings(tenant)["prefs"]["approval_grants"]
    assert appr.list_grants(tenant) == ["sync_catalog"]
    appr.revoke_session(tenant, "sync_catalog")
    assert appr.list_grants(tenant) == []


def test_mcp_writes_always_ask():
    assert appr.risk_for("mcp:any-server:delete_everything") == appr.ASK
