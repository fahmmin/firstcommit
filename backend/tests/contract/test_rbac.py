"""Phase 1 — real server-side RBAC: signed, tenant-bound tokens + Cedar role policy.

These tests send their OWN Authorization header (HarnessAuth steps aside), so they
exercise the actual enforcement a browser client hits.
"""
import time

import pytest
from fastapi.testclient import TestClient

from app import auth
from app.main import app

T = "ramesh_auto"


@pytest.fixture
def client():
    with TestClient(app) as c:
        c.post("/demo/reset", params={"tenant_id": T})
        yield c


def H(role="owner", base=None, tid=T, **kw):
    return {"Authorization": f"Bearer {auth.issue(tid, role, base or role, **kw)}"}


def _pending_alert(c):
    return next(a["id"] for a in c.get("/alerts", params={"tenant_id": T}).json()
                if a["status"] == "pending_approval")


# ---- tokens ----

def test_login_issues_verifiable_owner_token(client):
    r = client.post("/auth/login", json={"provider": "guest"}).json()
    claims = auth.verify(r["token"])
    assert claims["tid"] == T and claims["base"] == "owner" and r["base_role"] == "owner"


def test_no_token_is_401(client):
    client.auth = None
    assert client.get("/invoices", params={"tenant_id": T}).status_code == 401
    assert client.get("/health").status_code == 200            # public
    assert client.post("/auth/login", json={"provider": "guest"}).status_code == 200


def test_tampered_and_expired_tokens_are_401(client):
    good = auth.issue(T, "viewer", "viewer")
    body, sig = good.split(".")
    import base64, json
    forged = json.loads(base64.urlsafe_b64decode(body + "=="))
    forged["role"] = forged["base"] = "owner"
    fb = base64.urlsafe_b64encode(json.dumps(forged).encode()).rstrip(b"=").decode()
    assert client.get("/invoices", headers={"Authorization": f"Bearer {fb}.{sig}"}).status_code == 401
    expired = auth.issue(T, "owner", "owner", ttl=-5)
    assert client.get("/invoices", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


# ---- tenant binding ----

def test_cross_tenant_token_is_403(client):
    other = H(tid="someone_else")
    assert client.get("/invoices", params={"tenant_id": T}, headers=other).status_code == 403
    assert client.post("/chat", json={"tenant_id": T, "text": "hi"}, headers=other).status_code == 403


def test_missing_tenant_is_bound_to_token_not_showcase(client):
    # a fresh tenant's token without tenant_id must NOT read the seeded showcase
    rows = client.get("/invoices", headers=H(tid="fresh_rbac_tenant")).json()
    assert rows == []
    assert client.get("/invoices", headers=H()).json()  # own tenant has data


# ---- role permissions (server-side, not greyed buttons) ----

def test_viewer_can_read_and_chat_but_not_act(client):
    v = H("viewer")
    assert client.get("/invoices", params={"tenant_id": T}, headers=v).status_code == 200
    assert client.post("/chat", json={"tenant_id": T, "text": "overdue invoices"}, headers=v).status_code == 200
    aid = _pending_alert(client)
    assert client.post(f"/alerts/{aid}/approve", params={"tenant_id": T}, headers=v).status_code == 403
    assert client.post("/agents", json={"tenant_id": T, "name": "X", "goal": "g", "tools": ["list_overdue"]},
                       headers=v).status_code == 403
    assert client.patch("/settings", json={"tenant_id": T, "role": "owner"}, headers=v).status_code == 403


def test_manager_can_approve_and_hire_but_not_owner_actions(client):
    m = H("manager")
    aid = _pending_alert(client)
    assert client.post(f"/alerts/{aid}/approve", params={"tenant_id": T}, headers=m).status_code == 200
    assert client.post("/templates/hire-logistics/install", json={"tenant_id": T},
                       headers=m).status_code == 200
    for method, path, kw in [
        ("patch", "/settings", {"json": {"tenant_id": T, "mcp_servers": []}}),
        ("post", "/demo/reset", {"params": {"tenant_id": T}}),
        ("post", "/connectors/web/connect", {"params": {"tenant_id": T}}),
        ("get", "/connectors/web/sync", {"params": {"tenant_id": T}}),   # GET w/ side effects
        ("delete", "/memories/mem-1", {"params": {"tenant_id": T}}),
    ]:
        r = getattr(client, method)(path, headers=m, **kw)
        assert r.status_code == 403, f"{method} {path} → {r.status_code}"


def test_unlisted_writes_default_to_owner_only():
    assert auth.required_perm("POST", "/some/new/endpoint") == "*"
    assert auth.required_perm("GET", "/some/new/endpoint") is None


# ---- view-as / invite ----

def test_owner_view_as_and_back(client):
    r = client.post("/auth/role", json={"role": "viewer"}, headers=H("owner", "owner")).json()
    vtok = {"Authorization": f"Bearer {r['token']}"}
    aid = _pending_alert(client)
    assert client.post(f"/alerts/{aid}/approve", params={"tenant_id": T}, headers=vtok).status_code == 403
    back = client.post("/auth/role", json={"role": "owner"}, headers=vtok)
    assert back.status_code == 200 and auth.verify(back.json()["token"])["role"] == "owner"


def test_invited_manager_cannot_escalate(client):
    inv = client.post("/auth/invite", json={"role": "manager"}, headers=H()).json()
    mtok = {"Authorization": f"Bearer {inv['token']}"}
    assert client.get("/auth/me", headers=mtok).json()["base_role"] == "manager"
    assert client.post("/auth/role", json={"role": "owner"}, headers=mtok).status_code == 403
    assert client.post("/auth/role", json={"role": "viewer"}, headers=mtok).status_code == 200
    # only owners mint invites
    assert client.post("/auth/invite", json={"role": "viewer"}, headers=mtok).status_code == 403


# ---- Cedar role policy ----

@pytest.mark.parametrize("role,perm,ok", [
    ("owner", "connect", True), ("owner", "approve", True),
    ("manager", "approve", True), ("manager", "hire", True), ("manager", "connect", False),
    ("viewer", "chat", True), ("viewer", "approve", False), ("viewer", "artifacts", False),
])
def test_cedar_role_policy(role, perm, ok):
    assert auth.role_allowed(role, perm) is ok


def test_issue_clamps_role_to_base():
    c = auth.verify(auth.issue(T, role="owner", base="viewer"))
    assert c["role"] == "viewer"
    assert c["exp"] > time.time()
