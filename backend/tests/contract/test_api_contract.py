"""Contract tests — API responses must match frontend/mocks/contract.json shapes.

If the backend drifts from the contract, this fails before the frontend does.
"""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

CONTRACT = json.loads(
    (Path(__file__).resolve().parents[3] / "frontend" / "mocks" / "contract.json").read_text()
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _keys(obj):
    return set(obj.keys()) if isinstance(obj, dict) else set()


def _ep(name: str) -> dict:
    """contract keys carry a ' [EXISTS]'/' [TODO]' tag — strip it for lookup."""
    eps = CONTRACT["endpoints"]
    key = next((k for k in eps if k == name or k.startswith(name + " ")), None)
    assert key, f"endpoint {name} not in contract.json"
    return eps[key]


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert _keys(r.json()) >= _keys(_ep("GET /health")["response"])


def test_agents_shape(client):
    r = client.get("/agents", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list) and len(body) >= 3
    expected = _keys(_ep("GET /agents")["response"][0])
    assert _keys(body[0]) >= expected


def test_chat_shape(client):
    r = client.post("/chat", json={"tenant_id": "ramesh_auto", "text": "show overdue invoices"})
    assert r.status_code == 200
    expected = _keys(_ep("POST /chat")["response"])
    assert _keys(r.json()) >= expected


def test_invoices_shape(client):
    r = client.get("/invoices", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert "amount" in r.json()[0] and "status" in r.json()[0]


def test_alerts_shape(client):
    r = client.get("/alerts", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    assert all("status" in a and "title" in a for a in r.json())


def test_cashflow_shape(client):
    r = client.get("/cashflow", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    assert _keys(r.json()) >= {"receivables", "payables", "gaps"}


def test_upload_parse(client):
    r = client.post(
        "/upload",
        files={"file": ("invoice.jpg", b"\xff\xd8\xff\xe0fakejpeg", "image/jpeg")},
        data={"tenant_id": "ramesh_auto"},
    )
    assert r.status_code == 200
    body = r.json()
    assert _keys(body) >= {"file_id", "filename", "parsed"}
    assert _keys(body["parsed"]) >= {"invoice_no", "buyer", "amount", "due_date"}


def test_agents_preview_and_create(client):
    req = {"tenant_id": "ramesh_auto", "name": "T Agent", "goal": "g",
           "tools": ["list_carriers", "bogus_tool"]}
    prev = client.post("/agents/preview", json=req)
    assert prev.status_code == 200 and prev.json()["valid"] is True
    assert prev.json()["spec"]["tools"] == ["list_carriers"]  # bogus dropped

    created = client.post("/agents", json=req)
    assert created.status_code == 200
    assert created.json()["created_by"] == "factory"
    # and it shows up in /agents
    ids = [a["id"] for a in client.get("/agents").json()]
    assert created.json()["id"] in ids


def test_reminder_requires_approval(client):
    invs = client.get("/invoices", params={"status": "overdue"}).json()
    r = client.post(f"/invoices/{invs[0]['id']}/reminder")
    assert r.status_code == 200
    assert r.json()["requires_approval"] is True
    draft_id = r.json()["draft_id"]
    # approve → sent
    r2 = client.post(f"/alerts/{draft_id}/approve")
    assert r2.status_code == 200 and r2.json()["status"] == "sent"


# ---------- [TODO] endpoints ----------

def test_login(client):
    r = client.post("/auth/login", json={"name": "Ramesh Gupta", "business": "Ramesh Auto Components"})
    assert r.status_code == 200
    assert _keys(r.json()) >= _keys(_ep("POST /auth/login")["response"])


def test_dashboard_summary(client):
    r = client.get("/dashboard/summary", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    assert _keys(r.json()) >= _keys(_ep("GET /dashboard/summary")["response"])
    assert _keys(r.json()["receivables"]) >= {"total", "overdue_count", "overdue_total", "due_soon_total"}


def test_notifications_lifecycle(client):
    r = client.get("/notifications", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 1
    assert _keys(rows[0]) >= _keys(_ep("GET /notifications")["response"][0])
    n = next(n for n in rows if n["status"] == "unread")
    r2 = client.post(f"/notifications/{n['id']}/read", params={"tenant_id": "ramesh_auto"})
    assert r2.status_code == 200 and r2.json()["status"] == "read"


def test_tasks_lifecycle(client):
    r = client.get("/tasks", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200 and isinstance(r.json(), list)
    assert _keys(r.json()[0]) >= _keys(_ep("GET /tasks")["response"][0])
    c = client.post("/tasks", json={"tenant_id": "ramesh_auto", "title": "List overdue invoices",
                                    "agent_id": "vasool", "due": "2026-09-22"})
    assert c.status_code == 200
    tid = c.json()["id"]
    run = client.post(f"/tasks/{tid}/run", params={"tenant_id": "ramesh_auto"})
    assert run.status_code == 200
    assert _keys(run.json()) >= _keys(_ep("POST /tasks/{id}/run")["response"])
    assert run.json()["status"] == "done" and run.json()["agent_name"] == "vasool"


def test_agent_detail_and_context(client):
    d = client.get("/agents/vasool", params={"tenant_id": "ramesh_auto"})
    assert d.status_code == 200
    assert _keys(d.json()) >= _keys(_ep("GET /agents/{id}")["response"])
    ctx = client.get("/agents/vasool/context", params={"tenant_id": "ramesh_auto"})
    assert ctx.status_code == 200
    assert "invoice_summary" in ctx.json() and "top_defaulters" in ctx.json()


def test_calendar_events(client):
    r = client.get("/calendar/events", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 1
    assert _keys(rows[0]) >= _keys(_ep("GET /calendar/events?from=&to=")["response"][0])
    assert {e["kind"] for e in rows} >= {"invoice_due", "alert", "task"}


def test_connectors_flow(client):
    r = client.get("/connectors", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    rows = r.json()
    assert _keys(rows[0]) >= _keys(_ep("GET /connectors")["response"][0])
    c = client.post("/connectors/google_calendar/connect", params={"tenant_id": "ramesh_auto"})
    assert c.status_code == 200 and c.json()["status"] == "connected"
    s = client.get("/connectors/airtable/sync", params={"tenant_id": "ramesh_auto"})
    assert s.status_code == 200 and s.json()["state"] == "ok"
    d = client.post("/connectors/google_calendar/disconnect", params={"tenant_id": "ramesh_auto"})
    assert d.status_code == 200 and d.json()["status"] == "available"


def test_settings_roundtrip(client):
    g = client.get("/settings", params={"tenant_id": "ramesh_auto"})
    assert g.status_code == 200
    assert _keys(g.json()) >= _keys(_ep("GET /settings")["response"])
    p = client.patch("/settings", json={"tenant_id": "ramesh_auto",
                                        "prefs": {"reminder_cadence_days": 5}})
    assert p.status_code == 200 and p.json()["status"] == "saved"
    g2 = client.get("/settings", params={"tenant_id": "ramesh_auto"})
    assert g2.json()["prefs"]["reminder_cadence_days"] == 5
