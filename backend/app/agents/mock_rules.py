"""MockModel behavior tables — deterministic offline 'brains' per agent.

Each specialist gets the behaviors for the tools it owns. The orchestrator gets
routing rules (keywords → sub-agent tool). Nirmata gets a 2-turn interview.
All tools return a `reply` field, so generic_reply produces natural answers.
"""
from __future__ import annotations

import re

from strands.types.content import Messages

from ..models import MockRule

# ---- tiny text parsers for mock args ----

_CITY_RE = re.compile(r"\b(ludhiana|delhi|jaipur|agra|meerut|chandigarh|amritsar)\b", re.I)
_NUM_RE = re.compile(r"(\d+(?:\.\d+)?)")


def _to_arg(text: str) -> dict:
    m = _CITY_RE.search(text)
    return {"to": m.group(1).title()} if m else {}


def _weight_arg(text: str) -> dict:
    args = _to_arg(text)
    m = re.search(r"(\d+)\s*(?:kg|kilos)", text, re.I)
    args["weight_kg"] = int(m.group(1)) if m else 500
    return args


def _order_args(text: str) -> dict:
    nums = _NUM_RE.findall(text.replace(",", ""))
    return {"order_amount": float(nums[0])} if nums else {"order_amount": 50000}


# ---- per-tool behaviors (keywords → args). Reply comes from the tool's own `reply` field. ----

TOOL_BEHAVIORS: dict[str, dict] = {
    # invoices
    "list_overdue": {"keywords": ["overdue", "pending", "payment", "invoice", "vasool", "udhaar", "paisa", "baaki", "list"], "args": lambda t: {}},
    "aging_report": {"keywords": ["aging", "ageing", "report", "bucket", "how old"], "args": lambda t: {}},
    "create_invoice": {"keywords": ["create invoice", "new invoice", "add invoice", "bill banao"], "args": lambda t: {"buyer": "New Buyer", "amount": 10000, "due_date": "2026-10-19"}},
    "draft_reminder": {"keywords": ["remind", "reminder", "chase", "yaad", "draft"], "args": lambda t: {}},
    # suppliers
    "search_catalog": {"keywords": ["supplier", "vendor", "catalog", "find", "kahan", "steel", "raw material"], "args": lambda t: {}},
    "check_stock": {"keywords": ["stock", "available", "inventory", "maal"], "args": lambda t: {}},
    "compare_prices": {"keywords": ["price", "cheap", "compare", "rate", "sasta", "daam"], "args": lambda t: {}},
    "trust_score": {"keywords": ["trust", "reliable", "score", "verified", "bharosa", "rating"], "args": lambda t: {}},
    "suggest_moq_pool": {"keywords": ["moq", "minimum", "pool", "quantity", "small order"], "args": lambda t: {"qty": 300}},
    # cashflow
    "timeline": {"keywords": ["cashflow", "cash flow", "timeline", "money in", "money out"], "args": lambda t: {}},
    "term_gap_analysis": {"keywords": ["gap", "terms", "90 day", "working capital", "shortage", "kasrat"], "args": lambda t: {}},
    "order_advisor": {"keywords": ["order", "should i", "take this", "worth it", "margin"], "args": _order_args},
    # logistics
    "list_carriers": {"keywords": ["carrier", "transport", "truck", "logistics", "delivery", "pickup", "ludhiana", "bhejna"], "args": _to_arg},
    "quote_pickup": {"keywords": ["quote", "cost", "charge", "kitna", "rate"], "args": _weight_arg},
    "book_pickup": {"keywords": ["book", "confirm", "schedule pickup"], "args": _weight_arg},
    # comms
    "send_reminder": {"keywords": ["send", "bhejo", "dispatch"], "args": lambda t: {}},
    "schedule_alert": {"keywords": ["schedule", "alert", "remind me", "notify"], "args": lambda t: {"title": "Check overdue payments"}},
    "list_alerts": {"keywords": ["alerts", "notifications", "scheduled"], "args": lambda t: {}},
}


def rules_for_tools(tool_names: list[str]) -> list[MockRule]:
    """Build MockRules for any subset of registry tools (works for factory agents too)."""
    rules = []
    for name in tool_names:
        b = TOOL_BEHAVIORS.get(name)
        if b:
            rules.append(MockRule(keywords=b["keywords"], tool=name, args=b["args"]))
    return rules


# ---- orchestrator routing (tools = sub-agents) ----

ORCHESTRATOR_RULES: list[MockRule] = [
    # create-intent FIRST — "transporter ditched me" should hire, not just answer
    MockRule(
        keywords=["transporter", "ditch", "didn't show", "nahi aaya", "no show",
                  "new agent", "build an agent", "create an agent", "hire", "make an agent",
                  "stranded", "delivery guy", "specialist", "create it", "banao",
                  "go ahead", "haan", "agent", "logistics"],
        tool="nirmata",
        args=lambda t: {"input": t},
    ),
    MockRule(
        keywords=["invoice", "overdue", "payment", "reminder", "remind", "vasool",
                  "udhaar", "paisa", "pending", "bill", "collect", "aging", "ageing",
                  "report", "dikhao"],
        tool="vasool",
        args=lambda t: {"input": t},
    ),
    MockRule(
        keywords=["supplier", "vendor", "stock", "price", "moq", "raw material",
                  "kharid", "purchase", "steel", "sasta", "trustworth", "reliab",
                  "verified", "score", "bharosa"],
        tool="sourcer",
        args=lambda t: {"input": t},
    ),
    MockRule(
        keywords=["cashflow", "cash flow", "cash", "gap", "terms", "working capital",
                  "should i take", "order", "margin", "loan"],
        tool="khata",
        args=lambda t: {"input": t},
    ),
    MockRule(
        keywords=["carrier", "pickup", "transport", "truck", "ludhiana", "deliver"],
        tool="nirmata",   # logistics intent → factory handles/creates logistics agent
        args=lambda t: {"input": t},
    ),
]

# ---- Nirmata interview (2-turn) ----

def _already_previewed(messages: Messages) -> bool:
    return any(
        "toolUse" in c and c["toolUse"]["name"] == "preview_spec"
        for m in messages for c in m.get("content", [])
    )


def _not_yet_previewed(messages: Messages) -> bool:
    return not _already_previewed(messages)


NIRMATA_RULES: list[MockRule] = [
    # turn 2 — owner confirms → actually create
    MockRule(
        keywords=["yes", "haan", "ok", "sure", "create", "do it", "banao", "hire", "confirm", "go ahead"],
        tool="create_agent",
        args=lambda t: {
            "name": "Logistics Agent",
            "goal": "Find backup transport and book pickups when scheduled carriers fail",
            "tools": ["list_carriers", "quote_pickup", "book_pickup", "send_reminder", "list_alerts"],
            "hindi_tagline": "सामान पहुँचाने वाला",
        },
        when=_already_previewed,
    ),
    # turn 1 — problem stated → draft the spec
    MockRule(
        keywords=["transporter", "ditch", "didn't show", "nahi aaya", "no show", "stranded",
                  "agent", "build", "create", "hire", "logistics", "delivery", "pickup", "truck"],
        tool="preview_spec",
        args=lambda t: {
            "name": "Logistics Agent",
            "goal": "Find backup transport and book pickups when scheduled carriers fail",
            "tools": ["list_carriers", "quote_pickup", "book_pickup", "send_reminder", "list_alerts"],
        },
        when=_not_yet_previewed,
    ),
    MockRule(
        keywords=["tools", "what can", "available", "list tools"],
        tool="list_available_tools",
        args=lambda t: {},
    ),
]
