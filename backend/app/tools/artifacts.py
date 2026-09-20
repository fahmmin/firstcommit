"""create_artifact tool + template-bound mini-apps agents build from chat.

Template-bound, never raw HTML (AYUSH.md §5.3): the agent picks a template and
fills `data`; a per-template pydantic schema validates it (lenient — optional
fields may be missing; a missing REQUIRED field returns a tool error so the model
retries rather than persisting a broken artifact). On success the tool records an
`artifact_created` action (same path as `reminder_drafted`) carrying the share_path.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ValidationError
from strands import tool

from .. import deps


class TrackingPage(BaseModel):
    order_id: str
    carrier: str
    to: str
    status: str
    from_: str = ""          # `from` is reserved; accept via alias below
    eta: str = ""
    progress_pct: int = 0

    model_config = {"populate_by_name": True}


class InvoiceSummary(BaseModel):
    buyer: str
    total_outstanding: float
    invoices: list = []
    oldest_overdue_days: int = 0
    note: str = ""


class SupplierCompare(BaseModel):
    category: str
    suppliers: list  # required — the whole point is a comparison
    recommendation: str = ""


class PaymentCard(BaseModel):
    payer: str
    amount: float
    invoice_no: str = ""
    due_date: str = ""
    pay_link: str = ""


TEMPLATES: dict[str, type[BaseModel]] = {
    "tracking_page": TrackingPage,
    "invoice_summary": InvoiceSummary,
    "supplier_compare": SupplierCompare,
    "payment_card": PaymentCard,
}


def create_artifact_impl(tenant_id: str, title: str, template: str, data: dict,
                         created_by: str = "agent") -> dict:
    """Validate `data` against the template schema, persist, return the stored row.

    Raises ValueError on unknown template or schema-invalid data (caller turns
    this into a tool error `reply` so the model can retry).
    """
    schema = TEMPLATES.get(template)
    if schema is None:
        raise ValueError(f"unknown template '{template}'. Allowed: {sorted(TEMPLATES)}")
    payload = dict(data or {})
    if "from" in payload and "from_" not in payload:  # tracking_page reserved-word alias
        payload["from_"] = payload["from"]
    try:
        validated = schema(**payload)
    except ValidationError as e:
        missing = [".".join(str(p) for p in err["loc"]) for err in e.errors()
                   if err["type"] in ("missing", "value_error")]
        raise ValueError(f"template '{template}' needs: {missing or 'valid fields'}") from e
    clean = validated.model_dump()
    if template == "tracking_page":  # restore public `from` key
        clean["from"] = clean.pop("from_", "")

    art_id = f"art-{uuid.uuid4().hex[:6]}"
    row = {
        "id": art_id, "title": title, "template": template, "data": clean,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "share_path": f"/a/{art_id}",
    }
    deps.store.put_artifact(tenant_id, row)
    deps.record_action("artifact_created", {"id": art_id, "title": title,
                                            "template": template, "share_path": row["share_path"]})
    deps.log_activity(tenant_id, "artifact_created", f"Built artifact '{title}' ({template})")
    return row


def artifact_tools(tenant_id: str, created_by: str = "agent") -> list:
    """Bind the create_artifact tool to a tenant. Given to ALL agents."""

    @tool
    def create_artifact(title: str, template: str, data: dict) -> dict:
        """Build a shareable mini-app for the owner. template must be one of:
        tracking_page (order_id, carrier, from, to, status, eta, progress_pct),
        invoice_summary (buyer, total_outstanding, invoices, oldest_overdue_days),
        supplier_compare (category, suppliers[], recommendation),
        payment_card (payer, amount, invoice_no, due_date, pay_link).
        Fill `data` for the chosen template; returns a share link."""
        try:
            row = create_artifact_impl(tenant_id, title, template, data, created_by=created_by)
        except ValueError as e:
            return {"error": str(e), "reply": f"Couldn't build that artifact — {e}"}
        return {
            "artifact": row,
            "reply": f"Built **{row['title']}** — open it at {row['share_path']} "
                     "(shareable link, no login needed).",
        }

    return [create_artifact]
