"""A1 — per-action approval engine + durable ledger + session grants.

Approval-by-default is Sahayak's core promise. Reads auto-approve; side-effecting
tools an agent invokes are QUEUED to a durable `approvals` ledger and executed only
on the owner's tap (or a session-grant for that tool). Modelled on Onyx's
EndpointPolicy(ALWAYS/ASK/DENY) + ActionApproval ledger and PipesHub's risk tiers.

Note: this gates the AGENT path. Owner-initiated API calls (upload, POST /artifacts)
are the human already acting, so they are not gated.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from .. import deps

# Risk tiers
AUTO = "auto"    # low-risk reads → run immediately
ASK = "ask"      # side-effecting → queue for owner approval
DENY = "deny"    # never allowed

# Side-effecting agent tools that require owner approval by default.
# Everything not listed (list_overdue, aging_report, search_catalog, timeline,
# quote_pickup, recall_context, web_search, …) is AUTO.
TOOL_RISK: dict[str, str] = {
    "create_invoice": ASK,
    "create_artifact": ASK,
    "book_pickup": ASK,
    "schedule_alert": ASK,
    "send_reminder": ASK,
    "publish_listing": ASK,
    "sync_catalog": ASK,
}

# session grants: {(tenant, tool)} — "approve all of this tool for now"
_GRANTS: set[tuple[str, str]] = set()


def risk_for(tool: str) -> str:
    return TOOL_RISK.get(tool, AUTO)


def grant_session(tenant_id: str, tool: str) -> None:
    _GRANTS.add((tenant_id, tool))


def revoke_session(tenant_id: str, tool: str) -> None:
    _GRANTS.discard((tenant_id, tool))


def is_granted(tenant_id: str, tool: str) -> bool:
    return (tenant_id, tool) in _GRANTS


def decide(tenant_id: str, tool: str) -> str:
    """auto | ask | deny — honoring session grants."""
    r = risk_for(tool)
    if r == ASK and is_granted(tenant_id, tool):
        return AUTO
    return r


def gate(tenant_id: str, tool: str, args: dict, title: str, agent: str = "") -> dict | None:
    """Called at the start of a side-effecting agent tool.
    Returns None to proceed (AUTO), or a 'queued'/'denied' reply dict to short-circuit."""
    d = decide(tenant_id, tool)
    if d == AUTO:
        return None
    if d == DENY:
        return {"denied": True, "reply": f"That action isn't permitted: {title}."}
    ap = deps.store.put_approval(tenant_id, {
        "id": f"apr-{uuid.uuid4().hex[:6]}", "tool": tool, "args": args,
        "title": title, "agent": agent, "risk": ASK, "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    deps.record_action("action_queued", {"approval_id": ap["id"], "tool": tool, "title": title})
    deps.log_activity(tenant_id, "action_queued", f"Queued for approval: {title}")
    deps.notify(tenant_id, "action_required", f"Approval needed: {title}",
                body=f"{agent or 'An agent'} wants to {tool.replace('_', ' ')}.", ref_id=ap["id"])
    return {"queued": True, "approval_id": ap["id"],
            "reply": f"⏳ Queued for your approval: {title}. "
                     "Approve it in Approvals and I'll carry it out."}


def _executor(tool: str):
    """Lazy tool→callable(tenant, args)->dict map (avoids import cycles)."""
    if tool == "create_invoice":
        from ..tools.invoices import create_invoice_impl
        return lambda t, a: create_invoice_impl(t, **a)
    if tool == "create_artifact":
        from ..tools.artifacts import create_artifact_impl
        return lambda t, a: create_artifact_impl(t, **a)
    return None


def execute_action(tenant_id: str, approval_id: str) -> dict:
    """Run a previously-queued action after owner approval."""
    ap = deps.store.get_approval(tenant_id, approval_id)
    if not ap:
        return {"status": "not_found"}
    if ap.get("status") != "pending":
        return {"status": ap.get("status"), "note": "already decided"}
    ex = _executor(ap["tool"])
    result = None
    if ex:
        try:
            result = ex(tenant_id, ap.get("args") or {})
        except Exception as e:  # never let a bad arg set poison the ledger
            deps.store.update_approval(tenant_id, approval_id, status="failed", error=str(e))
            return {"status": "failed", "error": str(e)}
    deps.store.update_approval(tenant_id, approval_id, status="executed",
                              decided_at=datetime.now(timezone.utc).isoformat(),
                              via="owner_approved")
    deps.record_action("action_approved", {"approval_id": approval_id, "tool": ap["tool"]})
    deps.log_activity(tenant_id, "action_approved", f"Approved + done: {ap.get('title', ap['tool'])}")
    return {"status": "executed", "result": result}
