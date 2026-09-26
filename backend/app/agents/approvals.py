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
# Not listed ON PURPOSE — approval-by-draft: book_pickup and draft_reminder only
# create a `pending_approval` alert (the owner's Approve tap on that draft is the
# approval), and send_reminder refuses anything the owner hasn't approved.
# Queuing them here too would make the owner approve the same thing twice.
TOOL_RISK: dict[str, str] = {
    "create_invoice": ASK,
    "create_artifact": ASK,
    "schedule_alert": ASK,
    "publish_listing": ASK,
    "sync_catalog": ASK,
}

# session grants — "approve all of this tool for now". Persisted in the tenant's
# settings (prefs.approval_grants) so a Lambda cold start doesn't forget them.


def _load_grants(tenant_id: str) -> set[str]:
    prefs = ((deps.store.get_settings(tenant_id) or {}).get("prefs") or {})
    return set(prefs.get("approval_grants") or [])


def _save_grants(tenant_id: str, grants: set[str]) -> None:
    cur = deps.store.get_settings(tenant_id) or {}
    prefs = {**(cur.get("prefs") or {}), "approval_grants": sorted(grants)}
    deps.store.put_settings(tenant_id, {**cur, "prefs": prefs})


def list_grants(tenant_id: str) -> list[str]:
    return sorted(_load_grants(tenant_id))


def summarize(tool: str, args: dict) -> str:
    """Human one-liner of what the queued action will do (shown on the card)."""
    a = args or {}
    if tool == "create_invoice":
        amt = a.get("amount") or 0
        return f"Invoice ₹{float(amt):,.0f} to {a.get('buyer', '?')}, due {a.get('due_date', '?')}" + \
               (f" — {a['items']}" if a.get("items") else "")
    if tool == "create_artifact":
        return f"{a.get('template', 'page')} “{a.get('title', '')}” ({a.get('visibility', 'private')})"
    if tool == "schedule_alert":
        return f"{a.get('kind', 'reminder')} “{a.get('title', '')}”" + \
               (f" on {str(a.get('fires_at'))[:10]}" if a.get("fires_at") else " now")
    if tool == "publish_listing":
        return f"Publish {a.get('title') or 'all draft listings'} → {a.get('marketplaces') or 'connected marketplaces'}"
    if tool == "sync_catalog":
        return "Rebuild draft listings + prices from supplier rates"
    if tool.startswith("mcp:"):
        _, server, name = (tool.split(":", 2) + ["", ""])[:3]
        return f"{server} → {name}(" + ", ".join(f"{k}={v!r}" for k, v in list(a.items())[:4]) + ")"
    return ", ".join(f"{k}={v}" for k, v in list(a.items())[:4])


def risk_for(tool: str) -> str:
    return TOOL_RISK.get(tool, AUTO)


def grant_session(tenant_id: str, tool: str) -> None:
    g = _load_grants(tenant_id)
    g.add(tool)
    _save_grants(tenant_id, g)
    deps.log_activity(tenant_id, "approval_granted", f"Auto-approve on for {tool.replace('_', ' ')}")


def revoke_session(tenant_id: str, tool: str) -> None:
    g = _load_grants(tenant_id)
    g.discard(tool)
    _save_grants(tenant_id, g)
    deps.log_activity(tenant_id, "approval_revoked", f"Auto-approve off for {tool.replace('_', ' ')}")


def is_granted(tenant_id: str, tool: str) -> bool:
    return tool in _load_grants(tenant_id)


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
        "title": title, "summary": summarize(tool, args), "agent": agent,
        "risk": ASK, "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    deps.record_action("action_queued", {"approval_id": ap["id"], "tool": tool, "title": title,
                                         "summary": ap.get("summary", "")})
    deps.log_activity(tenant_id, "action_queued", f"Queued for approval: {title}")
    deps.notify(tenant_id, "action_required", f"Approval needed: {title}",
                body=f"{agent or 'An agent'} wants to {tool.replace('_', ' ')}.", ref_id=ap["id"])
    return {"queued": True, "approval_id": ap["id"],
            "reply": f"⏳ Queued for your approval: {title}. "
                     "Approve it in Approvals and I'll carry it out."}


def _executor(tool: str):
    """Lazy tool→callable(tenant, args)->dict map (avoids import cycles).
    Every ASK tool MUST be here — an approval with no executor fails loudly."""
    if tool == "create_invoice":
        from ..tools.invoices import create_invoice_impl
        return lambda t, a: create_invoice_impl(t, **a)
    if tool == "create_artifact":
        from ..tools.artifacts import create_artifact_impl
        return lambda t, a: create_artifact_impl(t, **a)
    if tool == "schedule_alert":
        from ..tools.comms import schedule_alert_impl
        return lambda t, a: schedule_alert_impl(t, **a)
    if tool == "sync_catalog":
        from ..tools.presence import sync_catalog_impl
        return lambda t, a: sync_catalog_impl(t)
    if tool == "publish_listing":
        from ..tools.presence import publish_listing_impl
        return lambda t, a: publish_listing_impl(t, **a)
    if tool.startswith("mcp:"):
        from ..mcp.client import call_tool_for_approval
        return lambda t, a: call_tool_for_approval(t, tool, a)
    return None


def _result_ref(tool: str, result) -> dict:
    """Pointer to what the approved action produced (for the UI's result link)."""
    if not isinstance(result, dict):
        return {}
    if tool == "create_invoice":
        return {"kind": "invoice", "id": result.get("id"), "label": result.get("invoice_no")}
    if tool == "create_artifact":
        return {"kind": "artifact", "id": result.get("id"), "label": result.get("title"),
                "share_path": result.get("share_path")}
    if tool == "schedule_alert" and result.get("alert"):
        return {"kind": "alert", "id": result["alert"]["id"], "label": result["alert"]["title"]}
    return {"kind": "result", "label": (result.get("reply") or "")[:160]}


def execute_action(tenant_id: str, approval_id: str) -> dict:
    """Run a previously-queued action after owner approval."""
    ap = deps.store.get_approval(tenant_id, approval_id)
    if not ap:
        return {"status": "not_found"}
    if ap.get("status") != "pending":
        return {"status": ap.get("status"), "note": "already decided"}
    now = datetime.now(timezone.utc).isoformat()
    ex = _executor(ap["tool"])
    if not ex:  # never report "executed" for something that didn't run
        err = f"no executor registered for {ap['tool']}"
        deps.store.update_approval(tenant_id, approval_id, status="failed", error=err, decided_at=now)
        return {"status": "failed", "error": err}
    try:
        result = ex(tenant_id, ap.get("args") or {})
    except Exception as e:  # never let a bad arg set poison the ledger
        deps.store.update_approval(tenant_id, approval_id, status="failed", error=str(e), decided_at=now)
        deps.log_activity(tenant_id, "action_failed", f"Approved but failed: {ap.get('title', ap['tool'])} — {e}")
        return {"status": "failed", "error": str(e)}
    ref = _result_ref(ap["tool"], result)
    deps.store.update_approval(tenant_id, approval_id, status="executed", decided_at=now,
                              via="owner_approved", result_ref=ref)
    deps.record_action("action_approved", {"approval_id": approval_id, "tool": ap["tool"]})
    deps.log_activity(tenant_id, "action_approved", f"Approved + done: {ap.get('title', ap['tool'])}")
    return {"status": "executed", "result": result, "result_ref": ref}
