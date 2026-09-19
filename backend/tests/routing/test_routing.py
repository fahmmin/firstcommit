"""Routing evals — utterance → expected specialist.

In mock mode this is deterministic (pass-rate should be 100%).
On Bedrock it's a real eval — run it, report the rate.
"""
import pytest

from app.agents import registry as reg

UTTERANCES = [
    ("show my overdue invoices", "vasool"),
    ("sharma motors ka payment aaya kya", "vasool"),
    ("draft a reminder for the pending bill", "vasool"),
    ("aging report dikhao", "vasool"),
    ("find me steel suppliers", "sourcer"),
    ("compare prices of raw material", "sourcer"),
    ("is apex alloys trustworthy", "sourcer"),
    ("moq bahut zyada hai, kya karun", "sourcer"),
    ("how's my cashflow looking", "khata"),
    ("buyer gives 90 day terms, should i take the order", "khata"),
    ("working capital gap batao", "khata"),
    ("mera transporter nahi aaya", "nirmata"),
    ("build me an agent that handles logistics", "nirmata"),
    ("i need a new specialist", "nirmata"),
    ("my delivery guy ditched the pickup", "nirmata"),
]


@pytest.mark.parametrize("text,expected", UTTERANCES)
def test_routing(text, expected, tenant):
    registry = reg.get_registry(tenant)
    result = registry.orchestrator()(text)
    used = list(result.metrics.tool_metrics.keys()) if result.metrics else []
    assert used, f"no agent was routed for: {text}"
    assert used[-1] == expected, f"{text!r} → {used[-1]}, expected {expected}"
