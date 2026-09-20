"""Invoice/receivables tools + the document-parse pipeline.

parse_invoice_file: USE_AWS=1 → Nova Lite vision via bedrock-runtime converse;
local → deterministic fixture (the 'crumpled invoice' demo asset).
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import date, datetime, timezone

from strands import tool

from .. import deps

PARSE_FIXTURE = {
    "invoice_no": "INV-0045",
    "buyer": "Sharma Motors",
    "amount": 45200,
    "gst": 8136,
    "issue_date": "2026-09-12",
    "due_date": "2026-10-12",
    "items": "Brake pads x200",
    "confidence": 0.93,
    "low_confidence_fields": [],
}


def _days_overdue(due: str) -> int:
    try:
        return max(0, (date.today() - date.fromisoformat(due)).days)
    except ValueError:
        return 0


def parse_invoice_file(file_path: str) -> dict:
    """Vision-parse an invoice photo/PDF into structured fields."""
    if os.getenv("USE_AWS", "0") == "1":
        try:
            return _parse_via_bedrock(file_path)
        except Exception as e:  # Bedrock hiccup must never kill the demo
            print(f"[invoices] bedrock parse failed ({type(e).__name__}): {e} — using fixture")
            return dict(PARSE_FIXTURE)
    return dict(PARSE_FIXTURE)


def _sniff_image_format(b: bytes) -> str | None:
    """Magic-byte sniffing — extension/content-type can lie (octet-stream uploads)."""
    if b[:3] == b"\xff\xd8\xff": return "jpeg"
    if b[:8] == b"\x89PNG\r\n\x1a\n": return "png"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP": return "webp"
    if b[:6] in (b"GIF87a", b"GIF89a"): return "gif"
    return None


def _parse_via_bedrock(file_path: str) -> dict:
    import boto3
    session = boto3.Session(
        profile_name=os.getenv("AWS_PROFILE") or None,
        region_name=os.getenv("AWS_REGION", "us-east-1"),
    )
    client = session.client("bedrock-runtime")
    with open(file_path, "rb") as f:
        img_bytes = f.read()
    fmt = _sniff_image_format(img_bytes)
    if fmt is None:
        raise ValueError("not a real image (no jpeg/png/webp/gif magic bytes)")
    resp = client.converse(
        modelId=os.getenv("WORKER_MODEL", "apac.amazon.nova-lite-v1:0"),
        messages=[{
            "role": "user",
            "content": [
                {"image": {"format": fmt, "source": {"bytes": img_bytes}}},
                {"text": (
                    "Extract this invoice as strict JSON with keys: invoice_no, buyer, "
                    "amount (number, INR), gst (number), issue_date (YYYY-MM-DD), "
                    "due_date (YYYY-MM-DD), items (short string), confidence (0-1), "
                    "low_confidence_fields (list of field names). JSON only."
                )},
            ],
        }],
    )
    text = resp["output"]["message"]["content"][0]["text"]
    start, end = text.find("{"), text.rfind("}")
    data = json.loads(text[start:end + 1])
    data.setdefault("low_confidence_fields", [])
    return data


def draft_reminder_impl(tenant_id: str, invoice_id: str = "", buyer: str = "") -> dict:
    """Shared reminder logic — used by the draft_reminder tool AND the API."""
    inv = None
    if invoice_id:
        inv = deps.store.get_invoice(tenant_id, invoice_id)
    if not inv:
        overdue = deps.store.list_invoices(tenant_id, status="overdue")
        if buyer:
            overdue = [o for o in overdue if buyer.lower() in o["buyer"].lower()]
        inv = max(overdue, key=lambda r: r.get("days_overdue", 0), default=None)
    if not inv:
        return {"reply": "No overdue invoice found to remind about."}
    business = (deps.store.get_settings(tenant_id) or {}).get("business", {}).get("name") \
        or "Ramesh Hardware & Electricals"
    body = (
        f"Namaste {inv['buyer']} ji,\n\n"
        f"This is a gentle reminder that invoice {inv['invoice_no']} for "
        f"₹{inv['amount']:,} was due on {inv['due_date']} "
        f"({inv.get('days_overdue', 0)} days ago).\n\n"
        f"Kindly release the payment at your earliest convenience.\n"
        f"— {business}"
    )
    alert = deps.store.put_alert(tenant_id, {
        "id": f"alert-{uuid.uuid4().hex[:6]}", "kind": "reminder",
        "title": f"Reminder: {inv['invoice_no']} ({inv['buyer']})",
        "status": "pending_approval", "invoice_id": inv["id"],
        "channel": "email", "to": f"accounts@{inv['buyer'].lower().replace(' ', '')}.in",
        "subject": f"Payment reminder — {inv['invoice_no']}", "body": body,
        "fires_at": datetime.now(timezone.utc).isoformat(),
    })
    deps.record_action("reminder_drafted", {"alert_id": alert["id"], "invoice_id": inv["id"]})
    deps.log_activity(tenant_id, "reminder_drafted", f"Reminder drafted for {inv['buyer']} ({inv['invoice_no']}, ₹{inv['amount']:,})")
    deps.notify(tenant_id, "action_required", f"Reminder ready to send: {inv['invoice_no']}",
                body=f"{inv['buyer']} — ₹{inv['amount']:,} overdue {inv.get('days_overdue', 0)} days",
                ref_id=alert["id"])
    return {
        "draft": alert, "invoice": inv, "requires_approval": True,
        "reply": f"Drafted a reminder for {inv['invoice_no']} ({inv['buyer']}, ₹{inv['amount']:,}). "
                 "It's in Alerts — approve it and I'll send it.",
    }


def create_invoice_impl(tenant_id: str, buyer: str, amount: float, due_date: str,
                        items: str = "", invoice_no: str = "", gst: float | None = None) -> dict:
    inv = {
        "id": f"inv-{uuid.uuid4().hex[:6]}",
        "invoice_no": invoice_no or f"INV-{uuid.uuid4().hex[:4].upper()}",
        "buyer": buyer, "amount": amount, "items": items,
        "issue_date": date.today().isoformat(), "due_date": due_date,
        "status": "sent", "days_overdue": 0,
    }
    if gst is not None:
        inv["gst"] = gst
    deps.store.put_invoice(tenant_id, inv)
    deps.record_action("invoice_created", inv)
    return inv


def invoice_tools(tenant_id: str) -> list:
    """Bind invoice tools to a tenant. Tools write real store rows + record UI actions."""

    @tool
    def list_overdue() -> dict:
        """List all overdue invoices: buyer, invoice number, amount, days overdue."""
        rows = deps.store.list_invoices(tenant_id, status="overdue")
        rows.sort(key=lambda r: r.get("days_overdue", 0), reverse=True)
        total = sum(r.get("amount", 0) for r in rows)
        deps.record_action("invoices_listed", {"count": len(rows), "total": total})
        return {
            "overdue": rows,
            "count": len(rows),
            "total": total,
            "reply": f"You have {len(rows)} overdue invoices totalling ₹{total:,}. "
                     + (f"Oldest: {rows[0]['invoice_no']} from {rows[0]['buyer']} — {rows[0]['days_overdue']} days overdue." if rows else ""),
        }

    @tool
    def aging_report() -> dict:
        """Receivables aging buckets: 0-30, 31-60, 61-90, 90+ days overdue."""
        buckets = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
        detail = []
        for r in deps.store.list_invoices(tenant_id, status="overdue"):
            d = r.get("days_overdue", 0) or _days_overdue(r.get("due_date", ""))
            amt = r.get("amount", 0)
            if d <= 30: buckets["0-30"] += amt
            elif d <= 60: buckets["31-60"] += amt
            elif d <= 90: buckets["61-90"] += amt
            else: buckets["90+"] += amt
            detail.append({"buyer": r["buyer"], "amount": amt, "days_overdue": d})
        deps.record_action("invoices_listed", {"buckets": buckets})
        return {"buckets": buckets, "detail": detail,
                "reply": "Aging: " + ", ".join(f"{k}d: ₹{int(v):,}" for k, v in buckets.items())}

    @tool
    def create_invoice(buyer: str, amount: float, due_date: str, items: str = "", invoice_no: str = "") -> dict:
        """Create an invoice row in the ledger."""
        inv = create_invoice_impl(tenant_id, buyer, amount, due_date, items, invoice_no)
        return {"invoice": inv, "reply": f"Invoice {inv['invoice_no']} for {buyer} (₹{amount:,}) added to the ledger."}

    @tool
    def draft_reminder(invoice_id: str = "", buyer: str = "") -> dict:
        """Draft a payment reminder for an overdue invoice. DRAFT ONLY — owner approves before sending."""
        inv = None
        if invoice_id:
            inv = deps.store.get_invoice(tenant_id, invoice_id)
        if not inv:
            overdue = deps.store.list_invoices(tenant_id, status="overdue")
            if buyer:
                overdue = [o for o in overdue if buyer.lower() in o["buyer"].lower()]
            inv = max(overdue, key=lambda r: r.get("days_overdue", 0), default=None)
        return draft_reminder_impl(tenant_id, invoice_id, buyer)

    return [list_overdue, aging_report, create_invoice, draft_reminder]
