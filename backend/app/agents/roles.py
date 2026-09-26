"""A2 — data-driven role registry: what the agent factory can hire.

Before this, the "catalog" of hireable specialists was an if-chain inside the
offline mock (`_preview_args`) and a few hand-written template specs, and every
hire was a free-form {name, goal, tools}. Now each role is data:

- `default_tools`  — what a fresh hire of this role gets
- `allowed_tools`  — the ceiling: a hire request can pick from these, never beyond
- `tool_limit`     — max tools a single agent of this role may hold (least privilege)
- `max_action`     — guardrail written into the spec + Cedar policy
- `extras`         — which always-on capability groups (artifact / memory /
                     web_search) the role gets; also Cedar-gated per agent
- `intent_keywords`— drives offline routing (mock) and multi-role matching

`registry.create_spec(role_id=…)` clamps to this, `registry.hire_roles([...])`
hires several at once with a single orchestrator rebuild, and Nirmata sees the
catalog through `list_roles` / `preview_team` / `hire_team`.

Named RoleDef/role_id on purpose: "role" already means the RBAC session role
(auth.py) and the model tier (make_model(role=…)).
"""
from __future__ import annotations

from pydantic import BaseModel, field_validator

from .specs import ALL_TOOL_NAMES, TOOL_REGISTRY

EXTRA_GROUPS = ("artifact", "memory", "web_search")


class RoleDef(BaseModel):
    id: str
    name: str
    hindi_tagline: str = ""
    category: str
    icon: str = "sparkles"
    description: str
    goal: str
    default_tools: list[str]
    allowed_tools: list[str]
    tool_limit: int
    max_action: str = "draft_only"
    extras: list[str] = list(EXTRA_GROUPS)
    intent_keywords: list[str] = []

    @field_validator("default_tools", "allowed_tools")
    @classmethod
    def _known(cls, v: list[str]) -> list[str]:
        bad = [t for t in v if t not in ALL_TOOL_NAMES]
        if bad:
            raise ValueError(f"unknown tools {bad}")
        return v

    def resolve_tools(self, requested: list[str] | None) -> tuple[list[str], list[str]]:
        """→ (granted, refused). Empty request = defaults. Requested tools outside
        `allowed_tools` are refused; the rest are clamped to `tool_limit`, keeping
        the role's defaults first (they're what the role is for)."""
        want = list(dict.fromkeys(requested or self.default_tools))
        refused = [t for t in want if t not in self.allowed_tools]
        ok = [t for t in want if t in self.allowed_tools]
        ranked = [t for t in self.default_tools if t in ok] + [t for t in ok if t not in self.default_tools]
        granted = ranked[: self.tool_limit]
        refused += ranked[self.tool_limit:]
        return granted, refused


_T = TOOL_REGISTRY

ROLE_REGISTRY: dict[str, RoleDef] = {r.id: r for r in [
    RoleDef(
        id="logistics", name="Logistics Agent", hindi_tagline="सामान पहुँचाने वाला",
        category="logistics", icon="truck",
        description="Finds backup transport, quotes and drafts pickups",
        goal="Find backup transport and book pickups when scheduled carriers fail",
        default_tools=["list_carriers", "quote_pickup", "book_pickup", "send_reminder", "list_alerts"],
        allowed_tools=_T["logistics"] + _T["comms"],
        tool_limit=6,
        intent_keywords=["transport", "transporter", "carrier", "pickup", "truck", "delivery",
                         "deliver", "logistics", "shipment", "stranded", "nahi aaya", "ditch", "no show"],
    ),
    RoleDef(
        id="collections", name="Collections Agent", hindi_tagline="पैसा वसूलने वाला",
        category="money", icon="receipt",
        description="Chases overdue invoices and drafts reminders",
        goal="Chase overdue invoices and draft payment reminders",
        default_tools=["list_overdue", "aging_report", "draft_reminder", "schedule_alert", "list_alerts"],
        allowed_tools=_T["invoices"] + _T["comms"],
        tool_limit=6,
        intent_keywords=["payment", "invoice", "overdue", "collect", "collections", "udhaar",
                         "reminder", "receivable", "dues"],
    ),
    RoleDef(
        id="procurement", name="Procurement Agent", hindi_tagline="सही दाम पे सामान",
        category="procurement", icon="package",
        description="Tracks suppliers, compares prices, watches reorder points",
        goal="Track suppliers, compare prices and watch reorder points",
        default_tools=["search_catalog", "check_stock", "compare_prices", "trust_score", "suggest_moq_pool"],
        allowed_tools=_T["suppliers"] + ["list_alerts", "schedule_alert"],
        tool_limit=6,
        intent_keywords=["supplier", "vendor", "purchase", "stock", "moq", "price", "sourcing",
                         "procure", "reorder", "raw material"],
    ),
    RoleDef(
        id="working_capital", name="Working Capital Agent", hindi_tagline="कैश का हिसाब",
        category="money", icon="wallet",
        description="Guards against cash-flow gaps and bad payment terms",
        goal="Guard against cash-flow gaps and bad payment terms",
        default_tools=["timeline", "term_gap_analysis", "order_advisor"],
        allowed_tools=_T["cashflow"] + ["aging_report", "list_overdue"],
        tool_limit=5,
        intent_keywords=["cash", "working capital", "terms", "margin", "loan", "90 day", "cash flow"],
    ),
    RoleDef(
        id="compliance", name="Compliance Agent", hindi_tagline="कानून का ख्याल",
        category="compliance", icon="shield",
        description="Watches GST/TDS deadlines and schedules filing reminders",
        goal="Track GST/TDS filing deadlines and remind before due dates",
        default_tools=["list_alerts", "schedule_alert", "aging_report", "timeline"],
        allowed_tools=["list_alerts", "schedule_alert", "aging_report", "timeline", "list_overdue"],
        tool_limit=4,
        extras=["artifact", "memory"],
        intent_keywords=["gst", "tax", "tds", "filing", "compliance", "deadline", "return"],
    ),
    RoleDef(
        id="digital_presence", name="Digital Presence Agent", hindi_tagline="ऑनलाइन दुकान",
        category="presence", icon="store",
        description="Builds the online catalogue, listings, storefront and SEO",
        goal="Put the catalogue online — storefront, marketplace listings, SEO",
        default_tools=["sync_catalog", "publish_listing", "seo_audit", "storefront_builder"],
        allowed_tools=_T["presence"] + ["search_catalog"],
        tool_limit=5,
        intent_keywords=["online", "storefront", "website", "marketplace", "indiamart", "shopify",
                         "instagram", "facebook", "listing", "seo", "sell online", "ecommerce"],
    ),
    RoleDef(
        id="customer_support", name="Customer Support Agent", hindi_tagline="ग्राहक सेवा",
        category="sales", icon="message",
        description="Answers buyer questions on dues and stock, drafts replies",
        goal="Answer customer questions about their dues and product availability, draft replies for approval",
        default_tools=["list_overdue", "check_stock", "search_catalog", "draft_reminder"],
        allowed_tools=["list_overdue", "check_stock", "search_catalog", "draft_reminder", "list_alerts"],
        tool_limit=4,
        extras=["memory"],
        intent_keywords=["customer", "support", "query", "buyer question", "faq", "complaint", "whatsapp"],
    ),
    RoleDef(
        id="reporting", name="Reporting Agent", hindi_tagline="हिसाब की रिपोर्ट",
        category="money", icon="chart",
        description="Builds owner reports — aging, cash timeline, collections",
        goal="Prepare clear owner reports on receivables aging, cash timeline and collections",
        default_tools=["aging_report", "timeline", "term_gap_analysis", "list_overdue"],
        allowed_tools=["aging_report", "timeline", "term_gap_analysis", "list_overdue", "list_alerts"],
        tool_limit=4,
        extras=["artifact", "memory"],
        intent_keywords=["report", "summary", "accountant", "mis", "dashboard", "investor"],
    ),
]}

# offline precedence (mirrors the old _preview_args chain) — the most specific
# roles win ties; logistics is the factory's default hire
_MATCH_ORDER = ["digital_presence", "compliance", "procurement", "working_capital",
                "customer_support", "reporting", "collections", "logistics"]


def get_role(role_id: str) -> RoleDef:
    r = ROLE_REGISTRY.get(role_id)
    if not r:
        raise ValueError(f"unknown role '{role_id}'. Roles: {', '.join(ROLE_REGISTRY)}")
    return r


def match_roles(text: str) -> list[str]:
    """Every role whose intent keywords appear in the text, best-first."""
    t = (text or "").lower()
    scored = []
    for rid in _MATCH_ORDER:
        hits = sum(1 for k in ROLE_REGISTRY[rid].intent_keywords if k in t)
        if hits:
            scored.append((rid, hits))
    return [rid for rid, _ in scored]


def catalog() -> list[dict]:
    """Public shape for GET /roles and Nirmata's list_roles."""
    return [r.model_dump() for r in ROLE_REGISTRY.values()]
