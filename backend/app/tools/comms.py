"""Comms tools — send approved messages, schedule alerts, list alerts.

Guardrail: send_reminder only sends alerts in pending_approval status —
an agent cannot self-approve; the owner clicks approve in the UI.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from strands import tool

from .. import deps


def send_alert_impl(tenant_id: str, alert_id: str) -> dict:
    """Shared send logic — used by the send_reminder tool AND the approve endpoint."""
    a = next((x for x in deps.store.list_alerts(tenant_id) if x["id"] == alert_id), None)
    if not a:
        return {"reply": "No such alert.", "error": True}
    if a["status"] == "sent":
        return {"reply": "Already sent."}
    msg = deps.notifier.send(a.get("to", ""), a.get("subject", a["title"]), a.get("body", ""), a.get("channel", "email"))
    deps.store.update_alert(tenant_id, a["id"], status="sent", sent_at=msg["sent_at"], via=msg["via"])
    return {"reply": f"Sent to {a.get('to', '')} via {msg['via']}.", "message": msg}


def comms_tools(tenant_id: str) -> list:

    @tool
    def send_reminder(alert_id: str = "") -> dict:
        """Send an APPROVED reminder alert. Refuses pending ones — owner must approve in UI."""
        targets = [a for a in deps.store.list_alerts(tenant_id)
                   if (not alert_id or a["id"] == alert_id) and a.get("kind") in ("reminder", "booking")]
        if not targets:
            return {"reply": "No such alert."}
        a = targets[0]
        if a["status"] == "pending_approval":
            return {"reply": f"'{a['title']}' is still a draft — approve it in the Alerts panel first.",
                    "blocked": True}
        return send_alert_impl(tenant_id, a["id"])

    @tool
    def schedule_alert(title: str, fires_at: str = "", kind: str = "reminder") -> dict:
        """Schedule a future alert (due-date reminder, payment chase, etc.)."""
        alert = deps.store.put_alert(tenant_id, {
            "id": f"alert-{uuid.uuid4().hex[:6]}", "kind": kind, "title": title,
            "status": "scheduled",
            "fires_at": fires_at or datetime.now(timezone.utc).isoformat(),
        })
        deps.record_action("alert_scheduled", {"alert_id": alert["id"], "title": title})
        return {"alert": alert, "reply": f"Scheduled: '{title}' → fires {alert['fires_at']}."}

    @tool
    def list_alerts() -> dict:
        """List all alerts: scheduled, pending approval, sent."""
        rows = deps.store.list_alerts(tenant_id)
        by_status = {}
        for r in rows:
            by_status[r["status"]] = by_status.get(r["status"], 0) + 1
        return {"alerts": rows, "counts": by_status,
                "reply": f"{len(rows)} alerts — " + ", ".join(f"{k}: {v}" for k, v in by_status.items())}

    return [send_reminder, schedule_alert, list_alerts]
