"""A3 (client) — agents use tools from the owner's MCP servers.

Servers live in `settings.mcp_servers` (Settings → MCP / Marketplace):
    {id, name, url, transport: "streamable-http"|"sse", auth_token?, enabled,
     agents: "all" | [agent_id…], trusted, status, last_checked, tools, error?}

Lambda-safe lifecycle: a Strands `MCPClient` runs its session on a background
thread, so clients are opened PER REQUEST (`mcp_tools_for` context manager) and
closed when the reply is done — nothing outlives the invocation. URL servers
only (a Lambda zip has no Node/npx for stdio servers).

Safety: every MCP tool is wrapped in `GatedMCPTool`. A tool the server marks
`readOnlyHint` runs immediately; anything else goes through the SAME approvals
ledger as native side effects (tool = "mcp:{server_id}:{tool}") unless the
owner marked the server trusted or granted that tool. On approve,
`call_tool_for_approval` reconnects and makes the call.
"""
from __future__ import annotations

import re
import uuid
from contextlib import ExitStack, contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator
from urllib.parse import urlparse

from .. import deps

MASK = "••••"
_LOCAL = {"localhost", "127.0.0.1", "::1"}


# ---------------- config ----------------

def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (s or "").lower()).strip("_")[:24] or "mcp"


def validate_url(url: str) -> str | None:
    """Error message, or None if the URL is acceptable (https, or http on localhost)."""
    try:
        u = urlparse(url or "")
    except Exception:
        return "invalid URL"
    if u.scheme not in ("http", "https") or not u.hostname:
        return "URL must start with https://"
    if u.scheme == "http" and u.hostname not in _LOCAL:
        return "plain http is only allowed for localhost — use https://"
    return None


def normalize(server: dict, previous: dict | None = None) -> dict:
    """Fill defaults; keep a stored auth token when the client echoes the mask."""
    prev = previous or {}
    url = (server.get("url") or "").strip()
    token = server.get("auth_token")
    if token in (None, "", MASK):
        token = prev.get("auth_token") if token == MASK or token is None else None
    transport = server.get("transport") or ("sse" if url.rstrip("/").endswith("/sse") else "streamable-http")
    out = {
        "id": server.get("id") or f"mcp-{uuid.uuid4().hex[:6]}",
        "name": server.get("name") or (urlparse(url).hostname or "mcp"),
        "url": url, "transport": transport,
        "enabled": server.get("enabled", prev.get("enabled", True)),
        "agents": server.get("agents", prev.get("agents", "all")),
        "trusted": bool(server.get("trusted", prev.get("trusted", False))),
        "status": prev.get("status", "untested") if prev.get("url") == url else "untested",
        "last_checked": prev.get("last_checked") if prev.get("url") == url else None,
        "tools": prev.get("tools", []) if prev.get("url") == url else [],
    }
    if prev.get("error") and prev.get("url") == url:
        out["error"] = prev["error"]
    if token:
        out["auth_token"] = token
    return out


def public_view(server: dict) -> dict:
    """What the API returns — tokens never leave the backend."""
    s = {k: v for k, v in server.items() if k != "auth_token"}
    s["has_token"] = bool(server.get("auth_token"))
    if server.get("auth_token"):
        s["auth_token"] = MASK
    return s


def servers(tenant_id: str) -> list[dict]:
    return list((deps.store.get_settings(tenant_id) or {}).get("mcp_servers") or [])


def get_server(tenant_id: str, server_id: str) -> dict | None:
    return next((s for s in servers(tenant_id) if s.get("id") == server_id), None)


def _update_server(tenant_id: str, server_id: str, **fields) -> None:
    cur = deps.store.get_settings(tenant_id) or {}
    rows = [({**s, **fields} if s.get("id") == server_id else s) for s in cur.get("mcp_servers") or []]
    deps.store.put_settings(tenant_id, {**cur, "mcp_servers": rows})


def applies(server: dict, agent_id: str | None) -> bool:
    if not server.get("enabled", True) or not server.get("url"):
        return False
    who = server.get("agents", "all")
    if who == "all" or who is None:
        return True
    return agent_id in (who or []) or (agent_id is None and "sahayak" in (who or []))


# ---------------- connections ----------------

def build_client(server: dict, startup_timeout: int = 8):
    from strands.tools.mcp import MCPClient
    headers = {"Authorization": f"Bearer {server['auth_token']}"} if server.get("auth_token") else None
    prefix = f"mcp_{_slug(server.get('name', ''))}"
    if server.get("transport") == "sse":
        from mcp.client.sse import sse_client
        url = server["url"]
        return MCPClient(lambda: sse_client(url, headers=headers), prefix=prefix,
                         startup_timeout=startup_timeout, application_name="sahayak")
    return MCPClient(url=server["url"], headers=headers, prefix=prefix,
                     startup_timeout=startup_timeout, application_name="sahayak")


def _read_only(mcp_tool) -> bool:
    """MCP readOnlyHint (mcp 2.x exposes it as read_only_hint; 1.x as readOnlyHint)."""
    ann = getattr(mcp_tool, "annotations", None)
    if not ann:
        return False
    return bool(getattr(ann, "read_only_hint", None) or getattr(ann, "readOnlyHint", None))


def test_server(tenant_id: str, server_id: str) -> dict:
    """Real handshake: connect, list tools, persist status — the Logs page's
    'MCP handshake' lines come from here."""
    s = get_server(tenant_id, server_id)
    if not s:
        return {"status": "not_found"}
    now = datetime.now(timezone.utc).isoformat()
    err = validate_url(s.get("url", ""))
    if err:
        _update_server(tenant_id, server_id, status="error", error=err, last_checked=now)
        return {"id": server_id, "status": "error", "error": err}
    try:
        with build_client(s) as c:
            tools = [{"name": t.mcp_tool.name, "read_only": _read_only(t.mcp_tool),
                      "description": (t.mcp_tool.description or "")[:140]}
                     for t in c.list_tools_sync()]
    except Exception as e:
        msg = _clean_error(e)
        _update_server(tenant_id, server_id, status="error", error=msg, last_checked=now, tools=[])
        deps.log_activity(tenant_id, "mcp_error", f"MCP {s['name']} handshake failed — {msg}")
        return {"id": server_id, "status": "error", "error": msg}
    _update_server(tenant_id, server_id, status="connected", last_checked=now, tools=tools, error=None)
    deps.log_activity(tenant_id, "mcp_connected",
                      f"MCP {s['name']} handshake ok → tools/list ({len(tools)} tools)")
    return {"id": server_id, "status": "connected", "tools": tools, "last_checked": now}


def _clean_error(e: Exception) -> str:
    msg = str(e) or type(e).__name__
    cause = e.__cause__ or e.__context__
    if cause and str(cause) and str(cause) not in msg:
        msg = f"{msg} ({cause})"
    return msg[:240]


# ---------------- gated tool ----------------

def _gated_tool_class():
    from strands.tools.mcp.mcp_agent_tool import MCPAgentTool
    from strands.types._events import ToolResultEvent

    class GatedMCPTool(MCPAgentTool):
        """An MCP tool behind Sahayak's approval policy."""

        def __init__(self, base, *, tenant_id: str, server: dict):
            super().__init__(base.mcp_tool, base.mcp_client, name_override=base.tool_name,
                             timeout=base.timeout)
            self.tenant_id, self.server = tenant_id, server
            self.read_only = _read_only(base.mcp_tool)

        async def stream(self, tool_use, invocation_state, **kwargs):
            ledger_tool = f"mcp:{self.server['id']}:{self.mcp_tool.name}"
            if not self.read_only and not self.server.get("trusted"):
                from ..agents.approvals import gate
                q = gate(self.tenant_id, ledger_tool, dict(tool_use.get("input") or {}),
                         f"{self.server['name']}: {self.mcp_tool.name}", agent="mcp")
                if q:
                    yield ToolResultEvent({"toolUseId": tool_use["toolUseId"], "status": "success",
                                           "content": [{"text": q["reply"]}]})
                    return
            deps.record_action("mcp_called", {"server": self.server["name"], "tool": self.mcp_tool.name})
            deps.log_activity(self.tenant_id, "mcp_tool_called",
                              f"MCP {self.server['name']} → {self.mcp_tool.name}")
            async for ev in super().stream(tool_use, invocation_state, **kwargs):
                yield ev

    return GatedMCPTool


@contextmanager
def mcp_tools_for(tenant_id: str, agent_id: str | None = None) -> Iterator[list]:
    """Open every enabled server that applies to this agent for ONE request and
    yield its (gated) tools. A server that fails to connect is skipped and
    marked error — one bad server never breaks the chat."""
    targets = [s for s in servers(tenant_id) if applies(s, agent_id) and not validate_url(s["url"])]
    if not targets:
        yield []
        return
    Gated = _gated_tool_class()
    with ExitStack() as stack:
        tools: list[Any] = []
        for s in targets:
            try:
                c = stack.enter_context(build_client(s))
                tools += [Gated(t, tenant_id=tenant_id, server=s) for t in c.list_tools_sync()]
            except Exception as e:
                msg = _clean_error(e)
                _update_server(tenant_id, s["id"], status="error", error=msg,
                               last_checked=datetime.now(timezone.utc).isoformat())
                deps.log_activity(tenant_id, "mcp_error", f"MCP {s['name']} unavailable — {msg}")
        yield tools


def call_tool_for_approval(tenant_id: str, ledger_tool: str, args: dict) -> dict:
    """Approvals executor for a queued MCP call: reconnect and run it now."""
    _, server_id, name = (ledger_tool.split(":", 2) + ["", ""])[:3]
    s = get_server(tenant_id, server_id)
    if not s:
        raise RuntimeError(f"MCP server {server_id} was removed")
    with build_client(s) as c:
        res = c.call_tool_sync(f"apr-{uuid.uuid4().hex[:6]}", name, args or {})
    text = " ".join(x.get("text", "") for x in (res.get("content") or []) if isinstance(x, dict))
    if res.get("status") == "error":
        raise RuntimeError(text or "MCP tool returned an error")
    deps.log_activity(tenant_id, "mcp_tool_called", f"MCP {s['name']} → {name} (approved)")
    return {"reply": text[:500] or "done", "server": s["name"], "tool": name}
