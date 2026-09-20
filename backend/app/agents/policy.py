"""Cedar-backed tool authorization — the per-agent allowlist as a real policy.

Every agent may only invoke tools its spec permits. Previously this was a plain
Python `in` filter (specs.py); Cedar turns it into an auditable, default-deny
authorization decision: we generate one `permit` per allowed tool and ask Cedar
`is_authorized` at tool-resolution time. Cedar runs locally (no AWS), so this
works identically in USE_AWS=0 and =1. `max_action: draft_only` is expressed as
a forbid policy for documentation/verifiability (outbound sending stays gated by
human approval in the tools themselves).
"""
from __future__ import annotations

import cedarpy

_ACTION = 'action == Action::"invoke_tool"'


def build_policy_text(spec) -> str:
    """One permit per allowed tool + a forbid expressing draft-only guardrail."""
    guardrails = getattr(spec, "guardrails", None) or (
        spec.get("guardrails") if isinstance(spec, dict) else {}) or {}
    tools = getattr(spec, "tools", None) if not isinstance(spec, dict) else spec.get("tools")
    allowed = guardrails.get("allowed_tools") or tools or []
    agent_id = (getattr(spec, "id", None) if not isinstance(spec, dict) else spec.get("id")) or ""
    lines = [
        f'permit(principal == Agent::"{agent_id}", {_ACTION}, resource == Tool::"{t}");'
        for t in allowed
    ]
    if guardrails.get("max_action") == "draft_only":
        # outbound "send" without approval is never permitted by policy
        lines.append(
            f'forbid(principal == Agent::"{agent_id}", '
            f'action == Action::"send_without_approval", resource);'
        )
    return "\n".join(lines) or "// no tools permitted"


def tool_allowed(spec, tool_name: str) -> bool:
    """Cedar decision: may this agent invoke this tool? Default-deny."""
    agent_id = (getattr(spec, "id", None) if not isinstance(spec, dict) else spec.get("id")) or ""
    request = {
        "principal": {"type": "Agent", "id": agent_id},
        "action": {"type": "Action", "id": "invoke_tool"},
        "resource": {"type": "Tool", "id": tool_name},
        "context": {},
    }
    try:
        result = cedarpy.is_authorized(request, build_policy_text(spec), [])
        return result.decision == cedarpy.Decision.Allow
    except Exception:
        # never let a policy-engine hiccup break the demo — fall back to the
        # spec's own allowlist (same guarantee, minus the audit trail)
        guardrails = getattr(spec, "guardrails", None) or (
            spec.get("guardrails") if isinstance(spec, dict) else {}) or {}
        tools = getattr(spec, "tools", None) if not isinstance(spec, dict) else spec.get("tools")
        allowed = guardrails.get("allowed_tools") or tools or []
        return tool_name in allowed
