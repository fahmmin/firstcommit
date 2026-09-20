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
    # buyer-statement fields (agent vocabulary)
    buyer: str = ""
    total_outstanding: float = 0
    invoices: list = []
    oldest_overdue_days: int = 0
    note: str = ""
    # single-invoice card fields (frontend renderer vocabulary)
    invoice_no: str = ""
    amount: float = 0
    gst: float | None = None
    due_date: str = ""
    status: str = ""
    items: str = ""


class SupplierCompare(BaseModel):
    category: str = ""          # backend name for what's being compared
    item: str = ""              # frontend renderer reads `item` — normalized below
    suppliers: list = []        # backend name for the quote rows
    quotes: list = []           # frontend renderer reads `quotes` — normalized below
    recommendation: str = ""


class PaymentCard(BaseModel):
    payer: str = ""
    business: str = ""          # frontend renderer reads `business` — normalized below
    buyer: str = ""
    amount: float
    invoice_no: str = ""
    due_date: str = ""
    pay_link: str = ""
    upi: str = ""               # frontend renderer reads `upi` — normalized below


class FinancialReport(BaseModel):
    """Shareable financial projection report — the 'send to investors/landlord' artifact."""
    business: str = ""
    period: str = ""                     # e.g. "FY2026-27 projection"
    revenue: float = 0
    expenses: float = 0
    net_margin_pct: float = 0
    cash_on_hand: float = 0
    projections: list = []               # [{month, revenue, expenses}]
    highlights: list = []                # ["Revenue up 18% QoQ", ...]
    ask: str = ""                        # e.g. "Seeking ₹15L working-capital line"


class Storefront(BaseModel):
    """Public product-catalog page — the digital-presence agent's shareable storefront."""
    business: str = ""
    tagline: str = ""
    contact: str = ""
    products: list = []                # [{title, price, unit, category, desc}]
    marketplaces: list = []            # ["facebook_marketplace", "indiamart", ...]
    note: str = ""


TEMPLATES: dict[str, type[BaseModel]] = {
    "tracking_page": TrackingPage,
    "invoice_summary": InvoiceSummary,
    "supplier_compare": SupplierCompare,
    "payment_card": PaymentCard,
    "financial_report": FinancialReport,
    "storefront": Storefront,
}


def create_artifact_impl(tenant_id: str, title: str, template: str, data: dict,
                         created_by: str = "agent", visibility: str = "private") -> dict:
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
    # dual-vocabulary normalization — the frontend renderer and the model's tool
    # schema use different names for the same fields; fill both so either works
    elif template == "supplier_compare":
        clean["quotes"] = clean.get("quotes") or clean.get("suppliers") or []
        clean["item"] = clean.get("item") or clean.get("category") or "Suppliers"
        if not clean["quotes"]:
            raise ValueError("template 'supplier_compare' needs: ['suppliers']")
    elif template == "payment_card":
        clean["upi"] = clean.get("upi") or clean.get("pay_link") or ""
        clean["business"] = clean.get("business") or clean.get("buyer") or clean.get("payer") or ""
    elif template == "invoice_summary":
        if not clean.get("amount"):
            clean["amount"] = clean.get("total_outstanding") or 0
        if not clean.get("items") and clean.get("invoices"):
            clean["items"] = ", ".join(
                str(i.get("invoice_no", i)) if isinstance(i, dict) else str(i)
                for i in clean["invoices"])

    art_id = f"art-{uuid.uuid4().hex[:6]}"
    row = {
        "id": art_id, "title": title, "template": template, "data": clean,
        "created_by": created_by,
        "visibility": "public" if visibility == "public" else "private",
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
        payment_card (payer, amount, invoice_no, due_date, pay_link),
        financial_report (business, period, revenue, expenses, net_margin_pct,
        cash_on_hand, projections[{month,revenue,expenses}], highlights[], ask),
        storefront (business, tagline, contact, products[{title,price,unit,category,desc}],
        marketplaces[], note).
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
