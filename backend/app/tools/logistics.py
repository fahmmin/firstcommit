"""Logistics tools — carriers, quotes, pickup booking (used by factory-created agents too)."""
from __future__ import annotations

import uuid

from strands import tool

from .. import deps


def logistics_tools(tenant_id: str) -> list:

    @tool
    def list_carriers(to: str = "") -> dict:
        """List carriers serving a destination route with rates, next slot, reliability."""
        rows = deps.store.list_carriers(tenant_id, to=to or None)
        deps.record_action("carriers_listed", {"count": len(rows), "to": to})
        if not rows:
            return {"carriers": [], "reply": f"No carriers found{f' for {to}' if to else ''}."}
        lines = [f"• {r['name']} — ₹{r['rate_per_kg']}/kg, next slot {r['next_slot']}, "
                 f"reliability {r['reliability']}/5 ({r['route']})" for r in rows]
        return {"carriers": rows, "reply": f"Carriers to {to or 'your routes'}:\n" + "\n".join(lines)}

    @tool
    def quote_pickup(to: str = "", weight_kg: int = 500) -> dict:
        """Quote a pickup: cheapest reliable carrier for a weight to a destination."""
        rows = deps.store.list_carriers(tenant_id, to=to or None)
        rows = [r for r in rows if r.get("capacity_kg", 0) >= weight_kg]
        if not rows:
            return {"reply": f"No carrier can take {weight_kg} kg{f' to {to}' if to else ''} right now."}
        best = min(rows, key=lambda r: r["rate_per_kg"])
        cost = best["rate_per_kg"] * weight_kg
        return {
            "carrier": best, "weight_kg": weight_kg, "est_cost": cost,
            "reply": f"Cheapest reliable option: {best['name']} at ₹{best['rate_per_kg']}/kg "
                     f"→ ~₹{cost:,.0f} for {weight_kg} kg, pickup {best['next_slot']} "
                     f"(reliability {best['reliability']}/5).",
        }

    @tool
    def book_pickup(carrier: str = "", to: str = "", weight_kg: int = 500) -> dict:
        """Book a pickup with a carrier. Creates a pending-approval booking alert."""
        rows = deps.store.list_carriers(tenant_id, to=to or None)
        r = next((x for x in rows if carrier and carrier.lower() in x["name"].lower()), None) or \
            (min(rows, key=lambda x: x["rate_per_kg"]) if rows else None)
        if not r:
            return {"reply": "Couldn't find that carrier. Try list_carriers first."}
        booking = deps.store.put_alert(tenant_id, {
            "id": f"alert-{uuid.uuid4().hex[:6]}", "kind": "booking",
            "title": f"Pickup: {r['name']} → {to or 'delivery'} ({weight_kg} kg, {r['next_slot']})",
            "status": "pending_approval", "channel": "email",
            "to": "ops@" + r["name"].lower().replace(" ", "") + ".in",
            "subject": f"Pickup request — {weight_kg} kg",
            "body": f"Please confirm pickup of {weight_kg} kg, slot {r['next_slot']}, route {r['route']}.",
            "carrier_id": r["id"],
        })
        deps.record_action("alert_scheduled", {"alert_id": booking["id"], "carrier": r["name"]})
        return {
            "booking": booking, "carrier": r, "requires_approval": True,
            "reply": f"Pickup drafted with {r['name']} ({r['next_slot']}, ₹{r['rate_per_kg']}/kg). "
                     "Approve it in Alerts and it's booked.",
        }

    return [list_carriers, quote_pickup, book_pickup]
