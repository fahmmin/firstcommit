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
    if not nums:
        return {"order_amount": 50000}
    amt = float(nums[0])
    # "2 lakh order" / "₹1.5L" — the first number isn't the amount
    if re.search(r"lakh|\bl\b", text, re.I):
        amt *= 100000
    return {"order_amount": amt}


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
    # presence (digital-presence agent)
    "sync_catalog": {"keywords": ["catalog", "sync", "products", "product list", "stock list"], "args": lambda t: {}},
    "publish_listing": {"keywords": ["publish", "listing", "marketplace", "indiamart", "facebook",
                                     "sell online", "bechna", "online bech"], "args": lambda t: {"title": "all"}},
    "seo_audit": {"keywords": ["seo", "audit", "optimize", "ranking", "search rank"], "args": lambda t: {}},
    "storefront_builder": {"keywords": ["storefront", "web store", "shopify", "website",
                                        "online store", "store page", "shop page"], "args": lambda t: {}},
}


# Memory recall + artifact building — every agent gets these tools, so their
# mock behaviors live here (outside TOOL_REGISTRY, which is factory-facing).
EXTRA_RULES: list[MockRule] = [
    MockRule(
        keywords=["remember", "memory", "recall", "know about", "told you",
                  "context", "note about", "what do you know", "taught you"],
        tool="recall_context",
        args=lambda t: {"query": t},
    ),
    MockRule(
        keywords=["web search", "deep research", "search the web", "search online",
                  "look up online", "latest price", "market price", "find online"],
        tool="web_search",
        args=lambda t: {"query": t, "deep": "deep research" in t or "deep=true" in t},
    ),
    MockRule(
        keywords=["tracking page", "tracking link", "build a tracker", "share a page",
                  "make a page", "artifact", "mini app", "shareable"],
        tool="create_artifact",
        args=lambda t: {
            "title": "Tracking — latest order",
            "template": "tracking_page",
            "data": {"order_id": "ORD-1042", "carrier": "SafeRoad Carriers",
                     "from": "Ludhiana", "to": "Faridabad", "eta": "tomorrow 11am",
                     "status": "in_transit", "progress_pct": 62},
        },
    ),
]


def rules_for_tools(tool_names: list[str]) -> list[MockRule]:
    """Build MockRules for any subset of registry tools (works for factory agents too)."""
    rules = []
    for name in tool_names:
        b = TOOL_BEHAVIORS.get(name)
        if b:
            rules.append(MockRule(keywords=b["keywords"], tool=name, args=b["args"]))
    return rules + EXTRA_RULES


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


def orchestrator_rules(specs: list[dict]) -> list[MockRule]:
    """Base routing rules + one per non-builtin spec (factory hires / seeded
    specialists) so the offline router can reach agents the static table doesn't
    know. Hired specs sit right after the create-intent rule — a specialist who
    already exists answers before Nirmata considers hiring a new one."""
    dynamic: list[MockRule] = []
    for s in specs:
        sid = s.get("id", "")
        if sid in ("vasool", "sourcer", "khata", "nirmata") or not sid:
            continue
        kws = [w for w in re.split(r"[^a-z]+", (s.get("name") or "").lower()) if len(w) > 3]
        for t in s.get("tools", []):
            kws += TOOL_BEHAVIORS.get(t, {}).get("keywords", [])
        kws = list(dict.fromkeys(kws))
        if kws:
            dynamic.append(MockRule(keywords=kws, tool=sid, args=lambda t: {"input": t}))
    return ORCHESTRATOR_RULES[:1] + dynamic + ORCHESTRATOR_RULES[1:]

# ---- Nirmata interview (2-turn) ----

_PREVIEWS = ("preview_spec", "preview_team")


def _last_preview(messages: Messages) -> str | None:
    """Name of the most recent preview tool call in the transcript, if any."""
    for m in reversed(messages):
        for c in m.get("content", []):
            tu = c.get("toolUse")
            if tu and tu.get("name") in _PREVIEWS:
                return tu["name"]
    return None


def _already_previewed(messages: Messages) -> bool:
    return _last_preview(messages) is not None


def _not_yet_previewed(messages: Messages) -> bool:
    return not _already_previewed(messages)


def _team_previewed(messages: Messages) -> bool:
    return _last_preview(messages) == "preview_team"


def _spec_previewed(messages: Messages) -> bool:
    return _last_preview(messages) == "preview_spec"


def _preview_team_args(text: str) -> dict:
    """Roles drafted from the owner's own words — data-driven (roles.py), and
    several problems in one message preview several hires. Logistics is the
    factory's default when nothing specific matches."""
    from .roles import match_roles
    return {"role_ids": match_roles(text) or ["logistics"]}


def _preview_args(text: str) -> dict:
    """Single-spec view of the best-matching role (legacy preview_spec shape)."""
    from .roles import get_role
    r = get_role(_preview_team_args(text)["role_ids"][0])
    return {"name": r.name, "goal": r.goal, "tools": r.default_tools, "hindi_tagline": r.hindi_tagline}


def _create_args_from_preview(messages: Messages) -> dict:
    """create_agent receives exactly the spec the owner approved in the preview —
    the confirm turn reads the preview_spec toolUse back out of the transcript."""
    for m in reversed(messages):
        for c in m.get("content", []):
            tu = c.get("toolUse")
            if tu and tu.get("name") == "preview_spec":
                i = tu.get("input", {})
                return {"name": i.get("name", "Specialist Agent"),
                        "goal": i.get("goal", ""),
                        "tools": i.get("tools", []),
                        "hindi_tagline": i.get("hindi_tagline", "")}
    return _preview_args("")  # no preview on record → default specialist


_create_args_from_preview._wants_messages = True


def _hire_args_from_preview(messages: Messages) -> dict:
    """hire_team hires exactly the roles the owner saw in preview_team."""
    for m in reversed(messages):
        for c in m.get("content", []):
            tu = c.get("toolUse")
            if tu and tu.get("name") == "preview_team":
                return {"role_ids": tu.get("input", {}).get("role_ids", [])}
    return {"role_ids": ["logistics"]}


_hire_args_from_preview._wants_messages = True


NIRMATA_RULES: list[MockRule] = [
    # turn 2 — owner confirms → actually create (spec = the preview they saw).
    # Keywords stay pure affirmatives: a NEW request carrying "hire"/"agent"
    # must re-preview below, not fire create on a stale pending spec.
    MockRule(
        keywords=["yes", "haan", "ok", "sure", "do it", "confirm", "go ahead",
                  "sounds good", "looks good", "perfect", "theek hai"],
        tool="hire_team",
        args=_hire_args_from_preview,
        when=_team_previewed,
    ),
    MockRule(
        keywords=["yes", "haan", "ok", "sure", "do it", "confirm", "go ahead",
                  "sounds good", "looks good", "perfect", "theek hai"],
        tool="create_agent",
        args=_create_args_from_preview,
        when=_spec_previewed,
    ),
    # turn 1 — problem stated → draft the spec. Always eligible: a fresh request
    # re-previews even while an older preview is still pending.
    MockRule(
        keywords=["transporter", "ditch", "didn't show", "nahi aaya", "no show", "stranded",
                  "agent", "build", "create", "hire", "logistics", "delivery", "pickup", "truck",
                  "sell online", "online", "storefront", "website", "marketplace", "gst",
                  "compliance", "filing", "supplier", "collections", "specialist", "problem",
                  "customer support", "reporting", "report agent", "team"],
        tool="preview_team",
        args=_preview_team_args,
    ),
    MockRule(
        keywords=["tools", "what can", "available", "list tools"],
        tool="list_available_tools",
        args=lambda t: {},
    ),
]


def rules_for_mcp(tool_names: list[str]) -> list[MockRule]:
    """Offline routing for live MCP tools: naming the tool (its prefixed name,
    or its words) calls it. Real Nova picks MCP tools from their descriptions."""
    out = []
    for name in tool_names:
        if not name:
            continue
        words = name.split("_", 2)[-1].replace("_", " ") if name.startswith("mcp_") else name
        out.append(MockRule(keywords=[name, f"mcp {words}"], tool=name, args=lambda t: {}))
    return out
