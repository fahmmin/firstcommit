"""A3 — MCP end to end, dogfooded: Sahayak's MCP client talks to Sahayak's own
MCP server over real HTTP (uvicorn in a thread). Covers the server's auth +
role checks + approval-gated writes, the client's handshake/test endpoint,
token masking, and an agent actually calling an MCP tool in chat.
"""
import socket
import threading
import time

import pytest
import uvicorn
from fastapi.testclient import TestClient

from app import auth, deps
from app.main import app
from app.mcp import client as mcpc

T = "ramesh_auto"


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


@pytest.fixture(scope="module")
def live_url():
    port = _free_port()
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port,
                                           log_level="warning", lifespan="off"))
    th = threading.Thread(target=server.run, daemon=True)
    th.start()
    for _ in range(100):
        if server.started:
            break
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}/mcp"
    server.should_exit = True
    th.join(timeout=5)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _mcp(url, role="owner", scope="mcp"):
    return mcpc.build_client({"name": "sahayak", "url": url, "transport": "streamable-http",
                              "auth_token": auth.issue(T, role, role, scope=scope)})


def _call(c, name, args=None):
    res = c.call_tool_sync("t1", name, args or {})
    text = " ".join(x.get("text", "") for x in res.get("content") or [])
    return res.get("status"), text


# ---- Sahayak as an MCP server ----

def test_server_lists_tools_with_annotations(live_url):
    with _mcp(live_url) as c:
        tools = {t.mcp_tool.name: t.mcp_tool for t in c.list_tools_sync()}
    assert {"list_overdue_invoices", "aging_report", "search_documents",
            "create_invoice", "draft_reminder"} <= set(tools)
    assert mcpc._read_only(tools["list_overdue_invoices"]) is True
    assert mcpc._read_only(tools["create_invoice"]) is False


def test_server_read_tool_returns_live_tenant_data(live_url):
    overdue = [i for i in deps.store.list_invoices(T) if i.get("status") == "overdue"]
    with _mcp(live_url, role="viewer") as c:          # reads: any valid token
        status, text = _call(c, "list_overdue_invoices")
    assert status == "success" and f'"count":{len(overdue)}' in text.replace(" ", "")


def test_server_write_is_queued_not_forced(live_url):
    before = len(deps.store.list_invoices(T))
    with _mcp(live_url, role="manager") as c:
        status, text = _call(c, "create_invoice", {"buyer": "MCP Buyer", "amount": 999, "due_date": "2026-12-01"})
    assert status == "success" and "approval" in text.lower()
    assert len(deps.store.list_invoices(T)) == before              # nothing written
    pend = [a for a in deps.store.list_approvals(T) if a["status"] == "pending"]
    assert any(a["agent"] == "mcp-client" and a["tool"] == "create_invoice" for a in pend)


def test_server_viewer_cannot_write(live_url):
    with _mcp(live_url, role="viewer") as c:
        status, text = _call(c, "create_invoice", {"buyer": "X", "amount": 1, "due_date": "2026-12-01"})
    assert status == "error" and "needs approve" in text


def test_server_rejects_missing_or_bad_token(live_url):
    import httpx
    body = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
    hdr = {"Accept": "application/json, text/event-stream"}
    assert httpx.post(live_url, json=body, headers=hdr).status_code == 401
    bad = {**hdr, "Authorization": "Bearer nope.nope"}
    assert httpx.post(live_url, json=body, headers=bad).status_code == 401


# ---- Sahayak as an MCP client ----

def _add_server(client, url, **kw):
    srv = {"id": "mcp-self", "name": "sahayak", "url": url,
           "auth_token": auth.issue(T, "manager", "manager", scope="mcp"), **kw}
    assert client.patch("/settings", json={"tenant_id": T, "mcp_servers": [srv]}).json()["status"] == "saved"
    return srv


def test_token_is_write_only_and_kept_on_masked_patch(client, live_url):
    srv = _add_server(client, live_url)
    shown = client.get("/settings", params={"tenant_id": T}).json()["mcp_servers"][0]
    assert shown["auth_token"] == mcpc.MASK and shown["has_token"] is True
    # echoing the masked value back must NOT wipe the stored secret
    client.patch("/settings", json={"tenant_id": T, "mcp_servers": [shown]})
    stored = deps.store.get_settings(T)["mcp_servers"][0]
    assert stored["auth_token"] == srv["auth_token"]


def test_settings_rejects_bad_urls(client):
    for url in ("ftp://x", "http://evil.example.com/mcp", "not a url"):
        r = client.patch("/settings", json={"tenant_id": T, "mcp_servers": [{"name": "x", "url": url}]})
        assert r.status_code == 422, url


def test_handshake_endpoint_persists_status_and_logs(client, live_url):
    _add_server(client, live_url)
    r = client.post("/integrations/mcp/mcp-self/test", params={"tenant_id": T}).json()
    assert r["status"] == "connected" and len(r["tools"]) >= 7
    saved = client.get("/settings", params={"tenant_id": T}).json()["mcp_servers"][0]
    assert saved["status"] == "connected" and saved["last_checked"]
    kinds = [a["kind"] for a in client.get("/logs", params={"tenant_id": T}).json()]
    assert "mcp_connected" in kinds
    assert client.post("/integrations/mcp/nope/test", params={"tenant_id": T}).status_code == 404


def test_handshake_failure_is_honest(client):
    client.patch("/settings", json={"tenant_id": T, "mcp_servers": [
        {"id": "mcp-dead", "name": "dead", "url": f"http://127.0.0.1:{_free_port()}/mcp"}]})
    r = client.post("/integrations/mcp/mcp-dead/test", params={"tenant_id": T}).json()
    assert r["status"] == "error" and r["error"]


def test_agent_uses_mcp_tool_in_chat(client, live_url):
    _add_server(client, live_url)
    r = client.post("/chat", json={"tenant_id": T, "agent_id": "vasool",
                                   "text": "use mcp_sahayak_list_overdue_invoices"}).json()
    assert "mcp_sahayak_list_overdue_invoices" in r["usage"]["tools"]
    assert any(a["type"] == "mcp_called" for a in r["actions"])


def test_agent_mcp_write_goes_through_ledger_then_executes(client, live_url):
    _add_server(client, live_url)
    from app.mcp.client import mcp_tools_for
    with mcp_tools_for(T, "vasool") as tools:
        write = next(t for t in tools if t.tool_name == "mcp_sahayak_create_invoice")
        assert write.read_only is False
    # queue as the agent would, then approve → the executor reconnects and calls the server
    from app.agents import approvals as appr
    q = appr.gate(T, "mcp:mcp-self:create_invoice",
                  {"buyer": "Via MCP", "amount": 500, "due_date": "2026-12-01"}, "sahayak: create_invoice")
    assert q["queued"]
    res = appr.execute_action(T, q["approval_id"])
    assert res["status"] == "executed"
    # the remote side applies ITS OWN approval policy → a second, remote-side queue entry
    assert any(a["agent"] == "mcp-client" for a in deps.store.list_approvals(T))


def test_mcp_token_scope_is_mcp_only(client):
    tok = client.post("/integrations/mcp/token", params={"tenant_id": T}).json()["token"]
    assert auth.verify(tok)["scope"] == "mcp"
    # an MCP token can't be used against the app API
    assert client.get("/invoices", headers={"Authorization": f"Bearer {tok}"}).status_code == 403


def test_marketplace_has_no_counts_or_invented_urls(client):
    m = client.get("/marketplace", params={"tenant_id": T}).json()
    assert m["mcp"] and all("installs" not in x and "url" not in x for x in m["mcp"])
    assert "list_overdue_invoices" in m["sahayak_mcp_tools"]


def test_server_aging_separates_current_from_overdue(live_url):
    import json as _j
    with _mcp(live_url) as c:
        status, text = _call(c, "aging_report")
    data = _j.loads(text)
    overdue = sum(i["amount"] for i in deps.store.list_invoices(T, status="overdue"))
    assert data["overdue_total"] == overdue          # not-yet-due never lands in a bucket
    assert data["current_not_yet_due"] > 0


def test_invoice_aging_is_live_not_frozen(monkeypatch):
    from app.store import age_invoice
    row = {"status": "sent", "due_date": "2026-09-22", "days_overdue": 0}
    monkeypatch.setenv("SAHAYAK_TODAY", "2026-09-26")
    assert age_invoice(row)["status"] == "overdue" and age_invoice(row)["days_overdue"] == 4
    monkeypatch.setenv("SAHAYAK_TODAY", "2026-09-20")
    assert age_invoice(row)["status"] == "sent" and age_invoice(row)["days_overdue"] == 0
    assert age_invoice({"status": "paid", "due_date": "2020-01-01"})["status"] == "paid"
