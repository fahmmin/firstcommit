"""Model factory — Bedrock Nova when AWS creds exist, deterministic MockModel otherwise.

MockModel runs the REAL Strands agentic loop (it emits genuine toolUse stream
events), so offline mode exercises the exact same agents/tools/data path as
Bedrock — the only mocked thing is the LLM. Verified against strands 1.56:
StreamEvents use the Converse shape (messageStart / contentBlock{Start,Delta,Stop}
/ messageStop with stopReason "tool_use"|"end_turn").
"""
from __future__ import annotations

import json
import os
import re
import uuid
from collections.abc import AsyncIterable
from dataclasses import dataclass, field
from typing import Any, Callable

from strands.models import Model
from strands.types.content import Messages
from strands.types.streaming import StreamEvent
from strands.types.tools import ToolSpec

ArgsFn = Callable[[str], dict]
ReplyFn = Callable[[Any], str]


@dataclass
class MockRule:
    """Match user text → emit a toolUse for `tool` with `args`, then answer with `reply`."""
    keywords: list[str]
    tool: str | None = None          # None = no tool call, just reply
    args: dict | ArgsFn = field(default_factory=dict)
    reply: str | ReplyFn = ""
    when: Callable[[Messages], bool] | None = None   # extra gate, e.g. interview-turn detection


def _last_user_text(messages: Messages) -> str:
    for msg in reversed(messages):
        if msg.get("role") != "user":
            break
        for c in msg.get("content", []):
            if "text" in c:
                return c["text"]
    return ""


def _tool_result_payload(messages: Messages) -> tuple[str | None, Any]:
    """Return (tool_name, parsed_payload) of the latest toolResult."""
    last = messages[-1]
    tr = next((c["toolResult"] for c in last.get("content", []) if "toolResult" in c), None)
    if not tr:
        return None, None
    name = None
    for msg in reversed(messages[:-1]):
        for c in msg.get("content", []):
            if "toolUse" in c and c["toolUse"].get("toolUseId") == tr.get("toolUseId"):
                name = c["toolUse"]["name"]
                break
        if name:
            break
    payload = None
    for c in tr.get("content", []):
        if "json" in c:
            payload = c["json"]
            break
        if "text" in c:
            try:
                payload = json.loads(c["text"])
            except (json.JSONDecodeError, TypeError):
                payload = c["text"]
            break
    return name, payload


def _fmt_rupee(n) -> str:
    try:
        return f"₹{int(n):,}"
    except (TypeError, ValueError):
        return f"₹{n}"


def generic_reply(tool_name: str | None, payload: Any) -> str:
    """Fallback renderer so ANY tool (incl. factory-created agents') gets a sane answer."""
    if payload is None:
        return "Done."
    if isinstance(payload, str):
        return payload
    if isinstance(payload, list):
        if not payload:
            return "No records found."
        return json.dumps(payload, indent=2, default=str)
    if isinstance(payload, dict):
        if "reply" in payload:
            return payload["reply"]
        return json.dumps(payload, indent=2, default=str)
    return str(payload)


class MockModel(Model):
    """Deterministic rules-driven model that drives the real Strands loop."""

    def __init__(self, rules: list[MockRule], fallback: str | None = None):
        self.rules = rules
        self.fallback = fallback or "Samajh nahi aaya — can you rephrase? I can help with invoices, suppliers, cash flow, or building a new agent."
        self.config = {"model_id": "sahayak-mock"}

    def update_config(self, **model_config) -> None:
        self.config.update(model_config)

    def get_config(self):
        return self.config

    async def structured_output(self, output_model, prompt, system_prompt=None, **kwargs):
        raise NotImplementedError("MockModel does not support structured_output")
        yield {}

    def _emit_text(self, text: str) -> list[StreamEvent]:
        return [
            {"messageStart": {"role": "assistant"}},
            {"contentBlockStart": {"start": {}}},
            {"contentBlockDelta": {"delta": {"text": text}}},
            {"contentBlockStop": {}},
            {"messageStop": {"stopReason": "end_turn"}},
        ]

    def _emit_tool_use(self, name: str, tool_input: dict) -> list[StreamEvent]:
        return [
            {"messageStart": {"role": "assistant"}},
            {"contentBlockStart": {"start": {"toolUse": {"toolUseId": f"tu-{uuid.uuid4().hex[:8]}", "name": name}}}},
            {"contentBlockDelta": {"delta": {"toolUse": {"input": json.dumps(tool_input)}}}},
            {"contentBlockStop": {}},
            {"messageStop": {"stopReason": "tool_use"}},
        ]

    async def stream(
        self,
        messages: Messages,
        tool_specs: list[ToolSpec] | None = None,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> AsyncIterable[StreamEvent]:
        tool_names = {t["name"] for t in tool_specs or []}

        # Turn N+1: a tool just returned → render the reply
        tool_name, payload = _tool_result_payload(messages)
        if tool_name is not None:
            rule = next((r for r in self.rules if r.tool == tool_name), None)
            text = rule.reply(payload) if rule and callable(rule.reply) else (
                rule.reply if rule and isinstance(rule.reply, str) and rule.reply else generic_reply(tool_name, payload)
            )
            for ev in self._emit_text(text):
                yield ev
            return

        # Turn N: match a rule → maybe emit a tool call
        text = _last_user_text(messages).lower()
        for rule in self.rules:
            if rule.tool and rule.tool not in tool_names:
                continue
            if rule.when and not rule.when(messages):
                continue
            if any(re.search(r"\b" + re.escape(k), text) for k in rule.keywords):
                if rule.tool:
                    args = rule.args(text) if callable(rule.args) else dict(rule.args)
                    for ev in self._emit_tool_use(rule.tool, args):
                        yield ev
                else:
                    reply = rule.reply if isinstance(rule.reply, str) else self.fallback
                    for ev in self._emit_text(reply):
                        yield ev
                return

        for ev in self._emit_text(self.fallback):
            yield ev


def _aws_creds_available() -> bool:
    try:
        import boto3
        session = boto3.Session(profile_name=os.getenv("AWS_PROFILE") or None)
        return session.get_credentials() is not None
    except Exception:
        return False


def make_model(rules: list[MockRule] | None = None, *, role: str = "worker", fallback: str | None = None):
    """Bedrock Nova if creds + USE_AWS, else deterministic MockModel."""
    if os.getenv("USE_AWS", "0") == "1" and _aws_creds_available():
        from strands.models import BedrockModel
        model_id = os.getenv(
            "ORCHESTRATOR_MODEL" if role in ("orchestrator", "factory") else "WORKER_MODEL",
            "apac.amazon.nova-lite-v1:0",
        )
        return BedrockModel(model_id=model_id, temperature=0)
    return MockModel(rules or [], fallback=fallback)
