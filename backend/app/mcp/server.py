"""A3 (server) — Sahayak's business tools, exposed over MCP.

Any MCP client (Claude Desktop/Code, Cursor, another agent — or Sahayak's own
MCP client, see tests) can connect to `/mcp` with a workspace token minted by
the owner (POST /mcp/token). The token is the Phase-1 HMAC session token
(auth.py) with scope "mcp", so the tenant and role come from the signature:

- read tools (annotated readOnlyHint) need any valid token;
- write tools need manager+ ("approve") and still go through the approvals
  ledger — an external client can queue an invoice, never force one through.

Transport: streamable HTTP, stateless + JSON responses (a Lambda Function URL
buffers responses, so no SSE streams). A fresh session manager handles each
request, which sidesteps the "run() once per instance" rule under Mangum's
per-invocation lifespan — identical behaviour under uvicorn and on Lambda.
"""
from __future__ import annotations

import json

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations

from .. import auth, deps

READ = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)
WRITE = ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=False)

mcp_server = MCPServer(
    "sahayak",
    instructions=("Sahayak — an Indian SMB's AI back office. Read tools return live ledger data "
                  "for the token's workspace. Write tools queue actions for the owner's approval."),
)


def _claims() -> dict:
    c = auth.current_principal.get()
    if not c:
        raise ToolError("missing Sahayak token")
    return c


def _tid() -> str:
    return _claims()["tid"]


def _need(perm: str) -> str:
    c = _claims()
    if not auth.perm_ok(c["role"], perm):
        # ToolError (not a crash) → the client sees the reason, the server logs INFO
        raise ToolError(f"role {c['role']} can't use this tool (needs {perm})")
    return c["tid"]


# ---------------- read tools ----------------

@mcp_server.tool(annotations=READ)
def list_overdue_invoices() -> dict:
    """Overdue invoices for this workspace: buyer, amount, days overdue, total."""
    rows = [i for i in deps.store.list_invoices(_tid()) if i.get("status") == "overdue"]
    rows.sort(key=lambda r: r.get("days_overdue", 0), reverse=True)
    return {"count": len(rows), "total": sum(r["amount"] for r in rows),
            "invoices": [{"invoice_no": r.get("invoice_no"), "buyer": r.get("buyer"),
                          "amount": r["amount"], "days_overdue": r.get("days_overdue", 0),
                          "due_date": r.get("due_date")} for r in rows]}


@mcp_server.tool(annotations=READ)
def aging_report() -> dict:
    """Receivables aging buckets (0-30, 31-60, 61-90, 90+ days)."""
    buckets = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
    for r in deps.store.list_invoices(_tid()):
        if r.get("status") not in ("overdue", "due_soon", "sent"):
            continue
        d = r.get("days_overdue", 0)
        key = "0-30" if d <= 30 else "31-60" if d <= 60 else "61-90" if d <= 90 else "90+"
        buckets[key] += r["amount"]
    return {"buckets": buckets}


@mcp_server.tool(annotations=READ)
def cashflow_summary() -> dict:
    """Money expected in (open receivables) vs owed out (payables)."""
    tid = _tid()
    total_in = sum(r["amount"] for r in deps.store.list_invoices(tid)
                   if r.get("status") in ("sent", "due_soon", "overdue"))
    total_out = sum(p["amount"] for p in deps.store.list_payables(tid))
    return {"expected_in": total_in, "owed_out": total_out, "net": total_in - total_out}


@mcp_server.tool(annotations=READ)
def list_suppliers(query: str = "") -> dict:
    """Suppliers (optionally filtered by name/category) with price, MOQ, trust score."""
    rows = deps.store.list_suppliers(_tid(), q=query or None)
    return {"suppliers": [{k: r.get(k) for k in ("name", "category", "price_per_unit", "moq",
                                                   "trust_score", "city")} for r in rows]}


@mcp_server.tool(annotations=READ)
def search_documents(query: str) -> dict:
    """Hybrid search over the workspace's business documents; returns cited passages."""
    from ..tools.retrieval import search_documents as _search
    hits = _search(_tid(), query, k=5)
    return {"results": [{"doc": h.get("filename") or h.get("doc_id"), "score": round(h.get("score", 0), 3),
                         "passage": h.get("snippet", ""), "summary": h.get("summary", "")} for h in hits]}


@mcp_server.tool(annotations=READ)
def list_approvals(status: str = "pending") -> dict:
    """The approvals ledger — agent actions waiting for (or decided by) the owner."""
    rows = [a for a in deps.store.list_approvals(_tid()) if not status or a.get("status") == status]
    return {"approvals": [{k: a.get(k) for k in ("id", "tool", "title", "summary", "status", "created_at")}
                          for a in rows]}


# ---------------- write tools (queued for approval) ----------------

@mcp_server.tool(annotations=WRITE)
def create_invoice(buyer: str, amount: float, due_date: str, items: str = "") -> dict:
    """Add an invoice to the ledger. Queued for the owner's approval unless auto-approved."""
    tid = _need("approve")
    from ..agents.approvals import gate
    from ..tools.invoices import create_invoice_impl
    args = {"buyer": buyer, "amount": amount, "due_date": due_date, "items": items}
    q = gate(tid, "create_invoice", args, f"Add invoice for {buyer} (₹{amount:,.0f})", agent="mcp-client")
    if q:
        return q
    inv = create_invoice_impl(tid, buyer, amount, due_date, items)
    return {"invoice": {"id": inv["id"], "invoice_no": inv["invoice_no"]}, "reply": "Invoice added."}


@mcp_server.tool(annotations=WRITE)
def draft_reminder(invoice_id: str = "", buyer: str = "") -> dict:
    """Draft a payment reminder. Draft only — the owner approves before anything is sent."""
    tid = _need("approve")
    from ..tools.invoices import draft_reminder_impl
    r = draft_reminder_impl(tid, invoice_id, buyer)
    return {k: v for k, v in r.items() if k in ("reply", "draft_id", "requires_approval", "error")}


# ---------------- ASGI entry (mounted at /mcp) ----------------

_SECURITY = TransportSecuritySettings(enable_dns_rebinding_protection=False)  # bearer auth instead


async def _reject(send, status: int, detail: str):
    body = json.dumps({"error": detail}).encode()
    await send({"type": "http.response.start", "status": status, "headers": [
        (b"content-type", b"application/json"), (b"www-authenticate", b'Bearer realm="sahayak"'),
        (b"access-control-allow-origin", b"*"), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


async def mcp_asgi(scope, receive, send):
    if scope["type"] != "http":
        return
    headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
    raw = headers.get("authorization", "")
    claims = auth.verify(raw[7:]) if raw.lower().startswith("bearer ") else None
    if not claims or claims.get("scope") not in ("mcp", "app"):
        return await _reject(send, 401, "a Sahayak MCP token is required (Settings → Connect your AI tools)")
    mgr = StreamableHTTPSessionManager(app=mcp_server._lowlevel_server, json_response=True,
                                       stateless=True, security_settings=_SECURITY)
    ctx = auth.current_principal.set(claims)
    try:
        async with mgr.run():
            await mgr.handle_request(scope, receive, send)
    finally:
        auth.current_principal.reset(ctx)
