"""D2 — per-run agent tracing + token/cost accounting.

Every /chat run records which tools fired, token usage (real on Bedrock, 0 offline),
an estimated cost, and latency — as an `agent_run` activity event so it shows in
/logs and aggregates at /metrics. Offline has no LLM cost (MockModel), reported honestly.
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

from . import deps

# approx USD per 1M tokens (Amazon Nova, apac inference profiles) — estimate only
_PRICING = {"nova-pro": (0.80, 3.20), "nova-lite": (0.06, 0.24)}


def _usage(result) -> tuple[int, int]:
    m = getattr(result, "metrics", None)
    au = getattr(m, "accumulated_usage", None) if m else None
    if isinstance(au, dict):
        return int(au.get("inputTokens", 0) or 0), int(au.get("outputTokens", 0) or 0)
    if au is not None:
        return int(getattr(au, "inputTokens", 0) or 0), int(getattr(au, "outputTokens", 0) or 0)
    return 0, 0


def _cost(inp: int, out: int, model: str) -> float:
    key = "nova-pro" if "pro" in (model or "").lower() else "nova-lite"
    pi, po = _PRICING[key]
    return round(inp / 1e6 * pi + out / 1e6 * po, 6)


def run_metrics(result, latency_ms: int, model: str) -> dict:
    m = getattr(result, "metrics", None)
    tools = list(getattr(m, "tool_metrics", {}) or {}) if m else []
    inp, out = _usage(result)
    return {"tools": tools, "input_tokens": inp, "output_tokens": out,
            "total_tokens": inp + out, "cost_usd": _cost(inp, out, model),
            "latency_ms": latency_ms}


def record_run(tenant_id: str, agent: str, metrics: dict) -> None:
    """Persist a structured agent_run event (shows in /logs, aggregates at /metrics)."""
    if deps.store is None:
        return
    toolstr = ", ".join(metrics.get("tools", [])) or "—"
    deps.store.put_activity(tenant_id, {
        "id": f"run-{uuid.uuid4().hex[:8]}",
        "ts": datetime.now(timezone.utc).isoformat(),
        "kind": "agent_run",
        "text": (f"{agent} · {metrics['total_tokens']} tok · ${metrics['cost_usd']:.4f} · "
                 f"{metrics['latency_ms']}ms · tools: {toolstr}"),
        "agent": agent, **{k: metrics[k] for k in
                           ("tools", "input_tokens", "output_tokens", "total_tokens",
                            "cost_usd", "latency_ms")},
    })


class timer:
    """`with timer() as t: ...; t.ms` — elapsed milliseconds."""
    def __enter__(self):
        self._t = time.perf_counter(); return self
    def __exit__(self, *a):
        self.ms = int((time.perf_counter() - self._t) * 1000)
