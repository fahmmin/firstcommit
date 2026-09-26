"""Hardening tests — every inconsistency found in the demo audit gets a lock.

Covers: wrong-customer reminder guard, send_reminder guardrails, agent
attribution, scope filtering, report PDFs, context file/preview, scheduler
idempotency, factory-agent routing, and the empty-tools rejection.
"""
import io

import pytest
from fastapi.testclient import TestClient

from app import deps
from app.main import app
from app.scheduler import run_once
from app.tools.comms import comms_tools
from app.agents import mock_rules


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


T = {"tenant_id": "ramesh_auto"}


# ---- reminders must never hit the wrong customer ----

def test_reminder_unknown_invoice_404s(client):
    """A bad invoice id used to silently draft for the oldest overdue invoice —
    a typo would have emailed a real customer."""
    r = client.post("/invoices/NOPE-404/reminder", params=T)
    assert r.status_code == 404


def test_reminder_accepts_invoice_no(client):
    """Agents and humans pass INV-1026 (the number), not inv-006 (the row id)."""
    invs = client.get("/invoices", params={**T, "status": "overdue"}).json()
    no = invs[0]["invoice_no"]
    r = client.post(f"/invoices/{no}/reminder", params=T)
    assert r.status_code == 200
    assert r.json()["requires_approval"] is True


def test_send_reminder_refuses_scheduled(client):
    """send_reminder may only act on owner-approved alerts — a scheduled future
    alert is neither due nor approved, so the tool must refuse it."""
    sched = next(a for a in client.get("/alerts", params=T).json()
                 if a["status"] == "scheduled")
    tools = {getattr(t, "tool_name", t.__name__): t for t in comms_tools("ramesh_auto")}
    out = tools["send_reminder"](alert_id=sched["id"])
    assert out.get("blocked") is True
    assert "scheduled" in out["reply"]
    # and the alert must still be scheduled — nothing went out
    still = next(a for a in client.get("/alerts", params=T).json() if a["id"] == sched["id"])
    assert still["status"] == "scheduled"


# ---- chat: attribution + scope ----

def test_chat_attribution_is_a_spec(client):
    """agent_name must be a real spec id — never a utility tool's name."""
    r = client.post("/chat", json={**T, "text": "show my overdue invoices"})
    assert r.status_code == 200
    name = r.json()["agent_name"]
    specs = {s["id"] for s in client.get("/agents", params=T).json()}
    assert name in specs | {"sahayak"}


def test_chat_scope_restricts_to_named_agent(client):
    """The scope tabs send real capability picks — scoping to vasool must not
    invoke any other specialist."""
    r = client.post("/chat", json={**T, "text": "how is my cash flow", "scope": ["vasool"]})
    assert r.status_code == 200
    assert r.json()["agent_name"] in ("vasool", "sahayak")


def test_chat_scope_unknown_is_tolerated(client):
    r = client.post("/chat", json={**T, "text": "hello", "scope": ["no-such-tool"]})
    assert r.status_code == 200


def test_create_agent_rejects_empty_tools(client):
    r = client.post("/agents", json={**T, "name": "Bad", "goal": "x", "tools": ["nope", "fake"]})
    assert r.status_code == 400


# ---- factory hires are routable ----

def test_orchestrator_reaches_factory_agents(client):
    """A hired agent must appear in the router — previously the orchestrator
    hardcoded vasool/sourcer/khata and could never reach hires."""
    created = client.post("/agents", json={**T, "name": "Festive Stock Agent",
        "goal": "Watch seasonal stock", "tools": ["check_stock", "list_carriers"]})
    assert created.status_code == 200
    sid = created.json()["id"]
    specs = client.get("/agents", params=T).json()
    rules = mock_rules.orchestrator_rules(specs)
    assert any(r.tool == sid for r in rules), "no routing rule generated for hired agent"


def test_nirmata_create_mirrors_preview():
    """The confirm turn must create exactly the spec that was previewed."""
    messages = [
        {"role": "user", "content": [{"text": "hire an agent for gst"}]},
        {"role": "assistant", "content": [
            {"toolUse": {"toolUseId": "t1", "name": "preview_spec",
                         "input": {"name": "Compliance Agent", "goal": "GST",
                                   "tools": ["list_alerts"], "hindi_tagline": "x"}}}]},
        {"role": "user", "content": [{"text": "yes"}]},
    ]
    args = mock_rules._create_args_from_preview(messages)
    assert args["name"] == "Compliance Agent"
    assert args["tools"] == ["list_alerts"]


def test_nirmata_preview_derives_from_intent():
    gst = mock_rules._preview_args("hire an agent to watch gst filings")
    assert "Compliance" in gst["name"]
    online = mock_rules._preview_args("i want to sell online")
    assert "Presence" in online["name"]
    default = mock_rules._preview_args("transporter ditched me")
    assert "Logistics" in default["name"]


# ---- reports ----

def test_report_types(client):
    r = client.get("/reports/types")
    assert r.status_code == 200
    assert {t["id"] for t in r.json()} >= {"business_overview", "receivables_aging",
                                         "cashflow_forecast", "gst_summary", "ops_digest"}


@pytest.mark.parametrize("rtype", ["business_overview", "receivables_aging",
                                   "cashflow_forecast", "gst_summary", "ops_digest"])
def test_report_generate_and_pdf(client, rtype):
    r = client.post("/reports/generate",
                    json={**T, "report_type": rtype, "visibility": "private"})
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    assert r.json()["template"] == "business_report"
    pdf = client.get(f"/reports/{aid}/pdf", params=T)
    assert pdf.status_code == 200
    assert pdf.content[:5] == b"%PDF-"
    # private reports must NOT be public-downloadable
    pub = client.get(f"/public/artifacts/{aid}/pdf")
    assert pub.status_code == 404


def test_public_report_pdf_after_share(client):
    r = client.post("/reports/generate",
                    json={**T, "report_type": "business_overview", "visibility": "public"})
    aid = r.json()["id"]
    pdf = client.get(f"/public/artifacts/{aid}/pdf")
    assert pdf.status_code == 200 and pdf.content[:5] == b"%PDF-"


def test_report_unknown_type_400(client):
    r = client.post("/reports/generate", json={**T, "report_type": "nope"})
    assert r.status_code == 400


# ---- context file/preview ----

def test_context_file_and_preview(client):
    up = client.post("/context/upload",
                     files={"file": ("gst-note.txt", io.BytesIO(b"GSTR-3B due 20th"), "text/plain")},
                     data=T)
    assert up.status_code == 200
    did = up.json()["id"]
    f = client.get(f"/context/{did}/file", params=T)
    assert f.status_code == 200 and b"GSTR-3B" in f.content
    p = client.get(f"/context/{did}/preview", params=T)
    assert p.status_code == 200 and p.json()["has_file"] is True


def test_context_note_has_no_file(client):
    up = client.post("/context/upload", data={**T, "text": "rent is 40k due on 5th"})
    assert up.status_code == 200
    did = up.json()["id"]
    p = client.get(f"/context/{did}/preview", params=T)
    assert p.status_code == 200 and p.json()["has_file"] is False
    f = client.get(f"/context/{did}/file", params=T)
    assert f.status_code == 404


def test_context_404s(client):
    assert client.get("/context/nope/file", params=T).status_code == 404
    assert client.get("/context/nope/preview", params=T).status_code == 404
    assert client.delete("/context/nope", params=T).status_code == 404


# ---- scheduler idempotency ----

def test_scheduler_run_once_idempotent(client):
    """Double-running (daemon + EventBridge race) must not duplicate alerts."""
    moved1 = run_once("ramesh_auto")
    moved2 = run_once("ramesh_auto")
    assert moved1 >= 0
    assert moved2 == 0  # second pass finds nothing left to promote


def test_scheduler_promotes_due_alert(client):
    deps.store.put_alert("ramesh_auto", {
        "id": "alert-test-due", "kind": "reminder", "title": "due now",
        "status": "scheduled", "fires_at": "2000-01-01T00:00:00Z"})
    moved = run_once("ramesh_auto")
    assert moved >= 1
    a = next(x for x in client.get("/alerts", params=T).json() if x["id"] == "alert-test-due")
    assert a["status"] == "pending_approval"
    assert run_once("ramesh_auto") == 0  # and never re-fires


# ---- templates install ----

def test_template_install_creates_agent(client):
    tmpl = next(t for t in client.get("/templates", params=T).json() if t.get("agent_spec"))
    r = client.post(f"/templates/{tmpl['id']}/install", json=T)
    assert r.status_code == 200
    assert r.json().get("id", "").startswith("agent-")
