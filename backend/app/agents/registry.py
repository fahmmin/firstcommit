"""Agent registry — specs (builtin + factory-created) → live Strands agents.

Instantiation is lazy + cached. Sessions persist via FileSessionManager
(locally) / S3SessionManager (USE_AWS=1) — 'the agent remembers' is real, not faked.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from strands import Agent
from strands.session.file_session_manager import FileSessionManager

from .. import deps
from ..models import MockModel, make_model
from ..store import DATA_DIR
from ..tools.artifacts import artifact_tools
from ..tools.context import build_memory_suffix, memory_tools
from ..tools.websearch import web_search_tools
from . import mock_rules
from .specs import ALL_TOOL_NAMES, TOOL_REGISTRY, AgentSpec, BUILTIN_SPECS, build_tool_map


def _session_manager(session_id: str):
    if os.getenv("USE_AWS", "0") == "1":
        from strands.session.s3_session_manager import S3SessionManager
        return S3SessionManager(
            session_id=session_id,
            bucket=os.getenv("S3_BUCKET", "sahayak-sessions"),
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
    return FileSessionManager(session_id=session_id, storage_dir=str(DATA_DIR / "sessions"))


class AgentRegistry:
    """Per-tenant: loads specs, instantiates+caches agents, builds orchestrator."""

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self._agents: dict[str, Agent] = {}
        self._orchestrator: Agent | None = None

    # ---- specs ----

    def specs(self) -> list[dict]:
        tasks = deps.store.list_tasks(self.tenant_id)

        def _stats(s: dict) -> dict:
            done_runs = sum(1 for t in tasks if t.get("agent_id") == s["id"] and t.get("status") == "done")
            base = s.get("stats") or {}
            return {"runs": base.get("runs", 0) + done_runs,
                    "actions_taken": base.get("actions_taken", 0) + done_runs,
                    "last_active": base.get("last_active") or s.get("created_at", "")}

        builtin = [{**s, "status": s.get("status", "active"),
                    "created_at": s.get("created_at", ""), "stats": _stats(s)} for s in BUILTIN_SPECS]
        stored = [{**s, "stats": _stats(s)} for s in deps.store.list_specs(self.tenant_id)]
        return builtin + stored

    def bump_stats(self, spec_id: str) -> None:
        """Increment runs/last_active on a stored spec (factory agents only — builtins aren't persisted)."""
        raw = deps.store.get_spec(self.tenant_id, spec_id)
        if not raw:
            return
        stats = raw.get("stats") or {}
        stats["runs"] = stats.get("runs", 0) + 1
        stats["actions_taken"] = stats.get("actions_taken", 0) + 1
        stats["last_active"] = datetime.now(timezone.utc).isoformat()
        deps.store.put_spec(self.tenant_id, {**raw, "stats": stats})

    def get_spec(self, spec_id: str) -> dict | None:
        return next((s for s in self.specs() if s["id"] == spec_id), None)

    def reset_agents(self) -> None:
        """Drop cached agents so they re-instantiate with fresh memory/context."""
        self._agents.clear()
        self._orchestrator = None

    def create_spec(self, name: str, goal: str, tools: list[str],
                    hindi_tagline: str = "", persona_prompt: str = "") -> dict:
        """Validate → persist → warm the agent. This IS the Factory's output artifact."""
        tools = [t for t in tools if t in ALL_TOOL_NAMES]
        spec = AgentSpec(
            id=f"agent-{uuid.uuid4().hex[:6]}",
            name=name, goal=goal, tools=tools,
            hindi_tagline=hindi_tagline,
            persona_prompt=persona_prompt or (
                f"You are {name}, a specialist agent hired by a small Indian business owner. "
                f"Your job: {goal}. Speak plainly (Hinglish-friendly). ALWAYS call your tools "
                "FIRST — before answering or asking anything. Answer only from tool results, "
                "never invent figures. Ask a question only when no tool can help."
            ),
            created_by="factory",
            created_at=datetime.now(timezone.utc).isoformat(),
            icon="sparkles",
            guardrails={"allowed_tools": tools, "max_action": "draft_only"},
        )
        stored = deps.store.put_spec(self.tenant_id, spec.model_dump())
        self.get_agent(spec.id)  # warm
        self._orchestrator = None  # rebuild the routing table — the new hire must be reachable
        deps.log_activity(self.tenant_id, "agent_created", f"Nirmata hired '{spec.name}' for you")
        deps.notify(self.tenant_id, "info", f"{spec.name} hired",
                    body="Nirmata created this specialist from your description",
                    ref_id=spec.id)
        return stored

    # ---- agent instantiation ----

    def _build_agent(self, raw: dict, only_tools: set[str] | None = None) -> Agent:
        spec = AgentSpec(**raw)
        resolved = spec.resolved_tools(self.tenant_id)
        extra = (artifact_tools(self.tenant_id, created_by=spec.id)
                 + memory_tools(self.tenant_id) + web_search_tools(self.tenant_id))
        if only_tools is not None:
            name_of = lambda t: getattr(t, "tool_name", None) or t.__name__
            resolved = [t for t in resolved if name_of(t) in only_tools]
            extra = [t for t in extra if name_of(t) in only_tools]
        return Agent(
            name=spec.name,
            model=make_model(rules=mock_rules.rules_for_tools(spec.tools), role="worker"),
            system_prompt=f"{spec.persona_prompt}\nYour goal: {spec.goal}"
                          + build_memory_suffix(self.tenant_id),
            tools=resolved + extra,
            session_manager=_session_manager(f"{self.tenant_id}-{spec.id}"),
            callback_handler=None,
        )

    def get_agent(self, spec_id: str, only_tools: list[str] | None = None) -> Agent | None:
        """only_tools=None → cached full agent. A scope list builds an uncached
        variant restricted to the named tools (owner's per-reply capability pick)."""
        raw = self.get_spec(spec_id)
        if not raw:
            return None
        if only_tools is not None:
            return self._build_agent(raw, only_tools=set(only_tools))
        if spec_id not in self._agents:
            self._agents[spec_id] = self._build_agent(raw)
        return self._agents[spec_id]

    # ---- nirmata (the factory) ----

    def nirmata(self) -> Agent:
        if "nirmata" in self._agents:
            return self._agents["nirmata"]

        registry = self

        from strands import tool

        @tool
        def list_available_tools() -> dict:
            """List the pre-built tool capabilities a new agent can be given."""
            return {"tool_groups": TOOL_REGISTRY, "all_tools": sorted(ALL_TOOL_NAMES),
                    "reply": "Available capability groups: " + ", ".join(
                        f"{g} ({len(t)})" for g, t in TOOL_REGISTRY.items())}

        @tool
        def preview_spec(name: str, goal: str, tools: list[str], hindi_tagline: str = "") -> dict:
            """Draft an AgentSpec for the owner to approve. Does NOT create the agent yet."""
            tools = [t for t in tools if t in ALL_TOOL_NAMES]
            spec = {
                "name": name, "goal": goal, "tools": tools,
                "hindi_tagline": hindi_tagline,
                "guardrails": {"allowed_tools": tools, "max_action": "draft_only"},
            }
            return {
                "valid": bool(tools), "spec": spec,
                "reply": (
                    f"Here's the specialist I'd hire:\n\n"
                    f"**{name}** {hindi_tagline}\n"
                    f"Job: {goal}\n"
                    f"Capabilities: {', '.join(t.replace('_',' ') for t in tools)}\n"
                    f"Guardrails: drafts only, needs your approval to act.\n\n"
                    f"Say 'haan' or 'yes' and I'll hire it."
                ),
            }

        @tool
        def create_agent(name: str, goal: str, tools: list[str], hindi_tagline: str = "") -> dict:
            """Actually hire the agent: persist spec + make it live in the dashboard."""
            spec = registry.create_spec(name=name, goal=goal, tools=tools, hindi_tagline=hindi_tagline)
            deps.record_action("agent_created", {"spec": spec})
            return {
                "spec": spec,
                "reply": f"Done — **{spec['name']}** {spec.get('hindi_tagline','')} is live on your "
                         f"dashboard and ready to work. Try asking it something!",
            }

        self._agents["nirmata"] = Agent(
            name="Nirmata",
            model=make_model(rules=mock_rules.NIRMATA_RULES, role="factory"),
            system_prompt=(
                "You are Nirmata (निर्माता — 'the maker'), the agent who hires other agents.\n"
                "Flow — follow it exactly:\n"
                "1. When the owner describes a recurring problem, call preview_spec IMMEDIATELY "
                "in your first reply — pick name, goal, and tools (list_available_tools shows the "
                "menu). You may add ONE short clarifying question in the same message, but your "
                "reply MUST show the preview and ask for confirmation.\n"
                "2. Only if the request is so vague you cannot name a goal (e.g. just 'I need help'), "
                "ask at most ONE question — then preview_spec next turn. NEVER call create_agent "
                "in the same turn as a preview_spec.\n"
                "3. When the owner says anything affirmative (haan/yes/ok/do it/create/sounds good), "
                "call create_agent in THAT SAME turn — no more questions.\n"
                "Never create before showing a preview. Never claim an agent is live unless "
                "create_agent succeeded. Only tools from list_available_tools. Draft-only "
                "guardrails always apply."
                + build_memory_suffix(self.tenant_id)
            ),
            tools=[list_available_tools, preview_spec, create_agent],
            session_manager=_session_manager(f"{self.tenant_id}-nirmata"),
            callback_handler=None,
        )
        return self._agents["nirmata"]

    # ---- orchestrator ----

    def _build_orchestrator(self, only: set[str] | None = None) -> Agent:
        """Routing table = every spec in the registry (builtins + factory hires)
        + Nirmata + web search. `only` scopes the reply to named sub-tools."""
        subs = []
        for s in self.specs():
            sid = s["id"]
            if only is not None and sid not in only:
                continue
            a = self.get_agent(sid)
            if not a:
                continue
            subs.append(a.as_tool(
                name=sid,
                description=s.get("description") or s.get("goal", ""),
                preserve_context=True,
            ))
        # live roster of the specialists actually in this router (drives routing)
        roster = "\n".join(
            f"- {s['id']} — {s.get('description') or s.get('goal', '')}"
            for s in self.specs()
            if (only is None or s["id"] in only) and self.get_agent(s["id"]))
        has_logistics = any("list_carriers" in (s.get("tools") or []) for s in self.specs())
        transport_example = ("- 'mera transporter nahi aaya, order stranded' → "
                             + ("the logistics specialist above"
                                if has_logistics else "nirmata (no logistics specialist exists yet — hire one)"))
        if only is None or "nirmata" in only:
            subs.append(self.nirmata().as_tool(
                name="nirmata",
                description=(
                    "The HIRING agent (the factory). Call it whenever the owner describes a "
                    "problem NONE of your current specialists cover — e.g. transport/logistics/"
                    "delivery ('transporter nahi aaya', book a pickup), selling online / digital "
                    "presence, GST/compliance filing, HR, or any new kind of request — and also "
                    "when the owner confirms a hire ('haan'/'yes'/'create it'). Prefer nirmata "
                    "over answering a problem yourself."),
                preserve_context=True,
            ))
        if only is None or "web_search" in only:
            subs += web_search_tools(self.tenant_id)  # web/deep mode
        return Agent(
            name="Sahayak",
            model=make_model(
                rules=mock_rules.orchestrator_rules(self.specs()), role="orchestrator"),
            system_prompt=(
                "You are Sahayak (सहायक), the front-desk AI for a small Indian business. "
                "Your ONLY job: route each request to the right specialist tool and relay its "
                "answer. NEVER answer a business question from your own knowledge — always call "
                "a tool.\n\n"
                "Your specialists (call by tool name):\n" + roster + "\n"
                "- nirmata — hires a NEW specialist for any problem the above don't cover.\n\n"
                "Rules:\n"
                "1. Match the request to ONE specialist above and call it.\n"
                "2. If no specialist above fits (transport/logistics/delivery, selling online, "
                "compliance, HR, anything new) → call nirmata. When torn between answering "
                "yourself and nirmata, ALWAYS choose nirmata.\n"
                "3. After a hiring preview, an affirmative ('haan'/'yes'/'ok'/'create it') → nirmata.\n\n"
                "Routing examples:\n"
                "- 'show my overdue invoices' / 'paisa kab aayega' → vasool\n"
                "- 'cheapest steel supplier' / 'MOQ is too high' → sourcer\n"
                "- 'should I take a 90-day-terms order?' / 'cash gap next week' → khata\n"
                + transport_example + "\n"
                "- 'I want to sell online on IndiaMART' → nirmata\n"
                "- 'haan, create it' (confirming a hire) → nirmata\n\n"
                "Reply in the owner's language (English/Hinglish), short and concrete."
                + build_memory_suffix(self.tenant_id)
            ),
            tools=subs,
            session_manager=_session_manager(f"{self.tenant_id}-orchestrator"),
            callback_handler=None,
        )

    def orchestrator(self, only: list[str] | None = None) -> Agent:
        """only=None → the cached full router. A scope list builds an uncached
        variant whose tool set is restricted to the named sub-agents/tools."""
        if only:
            return self._build_orchestrator(only=set(only))
        if not self._orchestrator:
            self._orchestrator = self._build_orchestrator()
        return self._orchestrator


_registries: dict[str, AgentRegistry] = {}


def get_registry(tenant_id: str) -> AgentRegistry:
    if tenant_id not in _registries:
        _registries[tenant_id] = AgentRegistry(tenant_id)
    return _registries[tenant_id]


def reset_registries() -> None:
    _registries.clear()
