"""AgentSpec — the unit the Factory creates and the registry instantiates.

Guardrail: a spec may only reference tools present in TOOL_REGISTRY; factory
output is filtered to registry ∩ requested, so generated agents can never
gain capabilities we didn't build.
"""
from __future__ import annotations

from pydantic import BaseModel, field_validator

from ..tools.cashflow import cashflow_tools
from ..tools.comms import comms_tools
from ..tools.invoices import invoice_tools
from ..tools.logistics import logistics_tools
from ..tools.suppliers import supplier_tools

TOOL_REGISTRY = {
    "invoices": ["list_overdue", "aging_report", "create_invoice", "draft_reminder"],
    "suppliers": ["search_catalog", "check_stock", "compare_prices", "trust_score", "suggest_moq_pool"],
    "cashflow": ["timeline", "term_gap_analysis", "order_advisor"],
    "logistics": ["list_carriers", "quote_pickup", "book_pickup"],
    "comms": ["send_reminder", "schedule_alert", "list_alerts"],
}
ALL_TOOL_NAMES = {t for group in TOOL_REGISTRY.values() for t in group}


def build_tool_map(tenant_id: str) -> dict:
    """Instantiate every registry tool bound to a tenant, keyed by tool name."""
    funcs = (
        invoice_tools(tenant_id) + supplier_tools(tenant_id) + cashflow_tools(tenant_id)
        + logistics_tools(tenant_id) + comms_tools(tenant_id)
    )
    return {getattr(f, "tool_name", None) or f.__name__: f for f in funcs}


class AgentSpec(BaseModel):
    id: str = ""
    name: str
    hindi_tagline: str = ""
    description: str = ""
    goal: str
    persona_prompt: str = ""
    tools: list[str]
    alerts: list[dict] = []
    schedule: str | None = None
    created_by: str = "factory"
    status: str = "active"
    icon: str = "bot"
    guardrails: dict = {}

    @field_validator("tools")
    @classmethod
    def tools_in_registry(cls, v: list[str]) -> list[str]:
        bad = [t for t in v if t not in ALL_TOOL_NAMES]
        if bad:
            raise ValueError(f"unknown tools: {bad}. Allowed: {sorted(ALL_TOOL_NAMES)}")
        return v

    def resolved_tools(self, tenant_id: str) -> list:
        tool_map = build_tool_map(tenant_id)
        allowed = self.guardrails.get("allowed_tools") or self.tools
        return [tool_map[t] for t in self.tools if t in allowed and t in tool_map]


BUILTIN_SPECS: list[dict] = [
    {
        "id": "vasool", "name": "Vasool", "hindi_tagline": "पैसा वसूलने वाला",
        "description": "Tracks invoices and chases payments",
        "goal": "Keep the owner's receivables tight — track invoices, flag overdue payments, draft reminders.",
        "persona_prompt": (
            "You are Vasool, the receivables specialist for a small Indian manufacturer. "
            "You speak plainly (Hinglish-friendly), you are direct about money, and you "
            "ALWAYS use your tools for real numbers — never invent figures. You draft "
            "reminders but never send without owner approval."
        ),
        "tools": TOOL_REGISTRY["invoices"] + ["schedule_alert"],
        "created_by": "builtin", "icon": "receipt",
        "guardrails": {"allowed_tools": TOOL_REGISTRY["invoices"] + ["schedule_alert"], "max_action": "draft_only"},
    },
    {
        "id": "sourcer", "name": "Sourcer", "hindi_tagline": "सही दाम पे सामान",
        "description": "Finds suppliers, compares prices, checks trust",
        "goal": "Help the owner buy raw material smart — right supplier, right price, right MOQ.",
        "persona_prompt": (
            "You are Sourcer, the procurement specialist for a small Indian manufacturer. "
            "You compare prices, check trust scores, warn about unverified vendors, and "
            "suggest MOQ pooling when minimums are too high. Always use tools for real data."
        ),
        "tools": TOOL_REGISTRY["suppliers"],
        "created_by": "builtin", "icon": "package",
        "guardrails": {"allowed_tools": TOOL_REGISTRY["suppliers"], "max_action": "draft_only"},
    },
    {
        "id": "khata", "name": "Khata", "hindi_tagline": "कैश का हिसाब",
        "description": "Watches cash flow and payment-term gaps",
        "goal": "Keep the owner out of working-capital traps — track receivables vs payables and term gaps.",
        "persona_prompt": (
            "You are Khata, the cash-flow advisor for a small Indian manufacturer. "
            "You explain the 90-day-terms trap in plain words, compute gaps with real data, "
            "and give actionable options. Always use tools for real numbers."
        ),
        "tools": TOOL_REGISTRY["cashflow"],
        "created_by": "builtin", "icon": "wallet",
        "guardrails": {"allowed_tools": TOOL_REGISTRY["cashflow"], "max_action": "draft_only"},
    },
]
