"""A2 — data-driven role registry: tool ceilings, limits, Cedar-gated extras, multi-hire."""
import pytest

from app import deps
from app.agents import mock_rules, roles
from app.agents import registry as reg
from app.agents.policy import tool_allowed
from app.agents.specs import ALL_TOOL_NAMES


def test_every_role_is_well_formed():
    for r in roles.ROLE_REGISTRY.values():
        assert set(r.default_tools) <= set(r.allowed_tools) <= ALL_TOOL_NAMES
        assert 0 < len(r.default_tools) <= r.tool_limit
        assert r.intent_keywords, r.id


def test_resolve_refuses_outside_ceiling_and_clamps_to_limit():
    comp = roles.get_role("compliance")          # limit 4, no presence tools
    granted, refused = comp.resolve_tools(["publish_listing", "list_alerts"])
    assert granted == ["list_alerts"] and refused == ["publish_listing"]
    many = comp.allowed_tools                    # 5 allowed, limit 4
    granted, refused = comp.resolve_tools(many)
    assert len(granted) == comp.tool_limit and refused
    assert granted[: len(comp.default_tools)] == comp.default_tools   # defaults win the clamp


def test_match_roles_multi_intent():
    got = roles.match_roles("I need someone for GST filing and to sell online on IndiaMART")
    assert got[:2] == ["digital_presence", "compliance"]
    assert roles.match_roles("transporter nahi aaya") == ["logistics"]
    assert roles.match_roles("hello there") == []


def test_create_spec_with_role_clamps_and_records(tenant):
    r = reg.get_registry(tenant)
    spec = r.create_spec(role_id="compliance", tools=["publish_listing", "schedule_alert"])
    assert spec["role_id"] == "compliance" and spec["tools"] == ["schedule_alert"]
    assert spec["refused_tools"] == ["publish_listing"]
    assert spec["guardrails"]["extra_tools"] == ["create_artifact", "recall_context"]
    assert deps.store.get_spec(tenant, spec["id"])["role_id"] == "compliance"


def test_extras_are_cedar_gated_per_role(tenant):
    r = reg.get_registry(tenant)
    spec = r.create_spec(role_id="customer_support")      # extras = memory only
    assert tool_allowed(spec, "recall_context")
    assert not tool_allowed(spec, "web_search") and not tool_allowed(spec, "create_artifact")
    agent = r.get_agent(spec["id"])
    names = set(agent.tool_names)
    assert "recall_context" in names and "web_search" not in names and "create_artifact" not in names
    # legacy/builtin specs (no extra_tools) keep every extra
    assert tool_allowed({"id": "vasool", "tools": ["list_overdue"], "guardrails": {}}, "web_search")


def test_hire_roles_batch_one_rebuild_partial_failure(tenant):
    r = reg.get_registry(tenant)
    r.orchestrator()                                       # build once
    res = r.hire_roles([{"role_id": "logistics"}, {"role_id": "nope"}, {"role_id": "reporting"}])
    assert [s["role_id"] for s in res["hired"]] == ["logistics", "reporting"]
    assert res["errors"] and res["errors"][0]["role_id"] == "nope"
    assert r._orchestrator is None                         # rebuilt lazily once
    ids = {s["id"] for s in r.specs()}
    assert all(s["id"] in ids for s in res["hired"])


def test_unknown_role_raises(tenant):
    with pytest.raises(ValueError):
        reg.get_registry(tenant).create_spec(role_id="astronaut")


def test_mock_factory_previews_a_team_and_hires_it():
    args = mock_rules._preview_team_args("need help with gst and selling online")
    assert args["role_ids"][:2] == ["digital_presence", "compliance"]
    msgs = [{"role": "assistant", "content": [{"toolUse": {"toolUseId": "t", "name": "preview_team",
                                                           "input": {"role_ids": ["compliance"]}}}]}]
    assert mock_rules._hire_args_from_preview(msgs) == {"role_ids": ["compliance"]}
    assert mock_rules._team_previewed(msgs) and not mock_rules._spec_previewed(msgs)
