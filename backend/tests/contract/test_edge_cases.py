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
