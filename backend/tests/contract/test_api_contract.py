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


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert _keys(r.json()) >= _keys(CONTRACT["endpoints"]["GET /health"]["response"])


def test_agents_shape(client):
    r = client.get("/agents", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list) and len(body) >= 3
    expected = _keys(CONTRACT["endpoints"]["GET /agents"]["response"][0])
    assert _keys(body[0]) >= expected


def test_chat_shape(client):
    r = client.post("/chat", json={"tenant_id": "ramesh_auto", "text": "show overdue invoices"})
    assert r.status_code == 200
    expected = _keys(CONTRACT["endpoints"]["POST /chat"]["response"])
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
