"""Cedar guardrail — the per-agent tool allowlist is a real, default-deny policy."""
from app.agents.policy import tool_allowed
from app.agents.specs import AgentSpec, TOOL_REGISTRY


def _spec(tools):
    return AgentSpec(id="a-test", name="T", goal="g", tools=tools,
                     guardrails={"allowed_tools": tools, "max_action": "draft_only"})


def test_allowed_tool_permitted():
    spec = _spec(["list_overdue", "draft_reminder"])
    assert tool_allowed(spec, "list_overdue") is True
    assert tool_allowed(spec, "draft_reminder") is True


def test_unlisted_tool_denied():
    spec = _spec(["list_overdue"])
    assert tool_allowed(spec, "book_pickup") is False   # never granted
    assert tool_allowed(spec, "draft_reminder") is False


def test_default_deny_when_no_tools():
    spec = _spec([])
    assert tool_allowed(spec, "list_overdue") is False


def test_resolved_tools_respects_policy():
    spec = _spec(["list_overdue", "aging_report"])
    names = {getattr(f, "tool_name", None) or f.__name__ for f in spec.resolved_tools("ramesh_auto")}
    assert "list_overdue" in names and "aging_report" in names
    assert "book_pickup" not in names and "quote_pickup" not in names
