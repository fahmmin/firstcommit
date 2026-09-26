"""Edge-case / negative-path robustness — graceful failures, honest empty states.

Every error path must return a clean 4xx (never 500), empty states must be honest,
and the security/visibility gates must hold.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

T = "ramesh_auto"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        c.post("/demo/reset", params={"tenant_id": T})
        yield c


@pytest.mark.parametrize("method,path", [
    ("get", "/agents/nope"),
    ("get", "/agents/nope/context"),
    ("post", "/invoices/BAD/reminder"),
    ("post", "/alerts/BAD/approve"),
    ("post", "/approvals/BAD/approve"),
    ("post", "/approvals/BAD/deny"),
    ("delete", "/memories/BAD"),
    ("delete", "/context/BAD"),
    ("get", "/artifacts/BAD"),
    ("post", "/tasks/BAD/run"),
    ("post", "/connectors/BAD/connect"),
])
def test_unknown_ids_404(client, method, path):
    r = getattr(client, method)(path, params={"tenant_id": T})
    assert r.status_code == 404, f"{method} {path} → {r.status_code}"


def test_chat_unknown_agent_404(client):
    assert client.post("/chat", json={"tenant_id": T, "text": "hi", "agent_id": "nope"}).status_code == 404


def test_patch_task_unknown_404(client):
    assert client.patch("/tasks/BAD", json={"tenant_id": T, "col": "done"}).status_code == 404


def test_bad_inputs_are_4xx_not_500(client):
    assert client.post("/context/upload", data={"tenant_id": T}).status_code == 400  # no file/text
    r = client.post("/import/excel", files={"file": ("x.xlsx", b"not xlsx", "application/octet-stream")},
                    data={"tenant_id": T})
    assert r.status_code == 400  # unreadable spreadsheet, not a crash
    assert client.post("/artifacts", json={"tenant_id": T, "title": "x", "template": "tracking_page",
                                           "data": {"carrier": "X"}}).status_code == 422  # missing required
    assert client.post("/artifacts", json={"tenant_id": T, "title": "x", "template": "bogus",
                                           "data": {}}).status_code == 400  # unknown template


def test_connector_classes(client):
    assert client.post("/connectors/whatsapp/connect", params={"tenant_id": T}).json()["status"] == "coming_soon"
    assert client.post("/connectors/google_drive/connect", params={"tenant_id": T}).json()["status"] == "unconfigured"
    assert client.post("/connectors/web/connect", params={"tenant_id": T}).json()["status"] == "needs_url"


def test_honest_empty_states(client):
    assert client.get("/search", params={"q": "", "tenant_id": T}).json()["results"]["invoices"] == []
    assert client.get("/search", params={"q": "zzqqxx9999", "tenant_id": T}).json()["results"]["documents"] == []
    assert client.get("/metrics", params={"tenant_id": "empty_t"}).json()["runs"] == 0
    assert client.get("/invoices", params={"tenant_id": "ghost"}).json() == []
    assert client.get("/settings", params={"tenant_id": "ghost"}).json()["onboarded"] is False


def test_approval_deny_then_approve_is_noop(client):
    from app.agents import approvals as appr
    appr.revoke_session(T, "create_invoice")
    client.post("/chat", json={"tenant_id": T, "agent_id": "vasool", "text": "bill banao for Edge Co"})
    pend = [a for a in client.get("/approvals", params={"tenant_id": T, "status": "pending"}).json()
            if a["tool"] == "create_invoice"]
    assert pend, "expected a queued approval"
    aid = pend[0]["id"]
    assert client.post(f"/approvals/{aid}/deny", params={"tenant_id": T}).json()["status"] == "denied"
    # approving a denied one must NOT execute
    assert client.post(f"/approvals/{aid}/approve", params={"tenant_id": T}).json().get("status") != "executed"


def test_private_artifact_gate(client):
    art = client.post("/artifacts", json={"tenant_id": T, "title": "Priv", "template": "payment_card",
                                          "data": {"payer": "X", "amount": 100}}).json()
    assert client.get(f"/public/artifacts/{art['id']}").status_code == 404  # private → not public


# ---- Round 5 / Phase 0 — honesty: every UI number comes from the server ----

def test_logs_since_returns_only_newer(client):
    rows = client.get("/logs", params={"tenant_id": T, "limit": 200}).json()
    assert rows, "seed has activity"
    newest = rows[0]["ts"]
    assert client.get("/logs", params={"tenant_id": T, "since": newest}).json() == []
    older = rows[-1]["ts"]
    newer = client.get("/logs", params={"tenant_id": T, "limit": 200, "since": older}).json()
    assert all(r["ts"] > older for r in newer)


def test_connectors_catalog_is_server_side_for_new_tenant(client):
    # a brand-new tenant must see the real catalog (not client-side filler rows)
    rows = client.get("/connectors", params={"tenant_id": "fresh_tenant_p0"}).json()
    ids = {c["id"] for c in rows}
    assert {"google_drive", "web", "whatsapp", "tally"} <= ids
    by = {c["id"]: c for c in rows}
    assert by["whatsapp"]["status"] == "coming_soon"
    assert by["google_drive"]["status"] == "available"
    assert all(c["items_synced"] == 0 for c in rows)
    # idempotent — the backfill is persisted, not duplicated
    again = client.get("/connectors", params={"tenant_id": "fresh_tenant_p0"}).json()
    assert len(again) == len(rows)


def test_web_search_unconfigured_records_honest_action(monkeypatch):
    from app import deps
    from app.tools.websearch import web_search_tools
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    tok = deps.current_actions.set([])
    try:
        web_search_tools(T)[0](query="steel price", deep=True)
        acts = deps.current_actions.get()
    finally:
        deps.current_actions.reset(tok)
    ws = [a for a in acts if a["type"] == "web_searched"]
    assert ws and ws[0]["data"]["configured"] is False and ws[0]["data"]["n_results"] == 0


# ---- Phase 2 — approvals ledger endpoints ----

def _queue(tenant="ramesh_auto"):
    from app.agents import approvals as appr
    return appr.gate(tenant, "create_invoice",
                     {"buyer": "Ledger Co", "amount": 1200, "due_date": "2026-12-01"}, "Add invoice for Ledger Co")


def test_dashboard_counts_ledger_and_drafts(client):
    client.post("/demo/reset", params={"tenant_id": T})
    d0 = client.get("/dashboard/summary", params={"tenant_id": T}).json()
    q = _queue()
    d1 = client.get("/dashboard/summary", params={"tenant_id": T}).json()
    assert d1["pending_approvals"] == d0["pending_approvals"] + 1
    assert d1["pending_breakdown"]["agent_actions"] >= 1
    assert any(b["kind"] == "agent_action" for b in d1["brief"])
    client.post(f"/approvals/{q['approval_id']}/deny", params={"tenant_id": T})


def test_deny_only_pending(client):
    q = _queue()
    ok = client.post(f"/approvals/{q['approval_id']}/approve", params={"tenant_id": T}).json()
    assert ok["status"] == "executed" and ok["result_ref"]["kind"] == "invoice"
    assert client.post(f"/approvals/{q['approval_id']}/deny", params={"tenant_id": T}).status_code == 409


def test_dismiss_alert_persists(client):
    client.post("/demo/reset", params={"tenant_id": T})
    aid = next(a["id"] for a in client.get("/alerts", params={"tenant_id": T}).json()
               if a["status"] == "pending_approval")
    assert client.post(f"/alerts/{aid}/dismiss", params={"tenant_id": T}).json()["status"] == "dismissed"
    st = next(a for a in client.get("/alerts", params={"tenant_id": T}).json() if a["id"] == aid)["status"]
    assert st == "dismissed"
    assert client.post("/alerts/BAD/dismiss", params={"tenant_id": T}).status_code == 404


def test_grants_endpoint(client):
    r = client.post("/approvals/grant", json={"tenant_id": T, "tool": "schedule_alert", "on": True}).json()
    assert "schedule_alert" in r["grants"]
    g = client.get("/approvals/grants", params={"tenant_id": T}).json()
    assert "schedule_alert" in g["grants"] and "create_invoice" in g["gated_tools"]
    client.post("/approvals/grant", json={"tenant_id": T, "tool": "schedule_alert", "on": False})
    assert client.post("/approvals/grant", json={"tenant_id": T, "tool": "list_overdue"}).status_code == 400
