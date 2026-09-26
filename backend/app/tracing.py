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

# approx USD per 1M tokens (input, output) — ESTIMATES, matched by the longest
# substring of the real model id (B2: any provider). Unknown model → 0 and
# priced=False rather than a wrong number; local models genuinely cost 0.
_PRICING = {
    "nova-premier": (2.50, 12.50), "nova-pro": (0.80, 3.20), "nova-lite": (0.06, 0.24),
    "nova-micro": (0.035, 0.14),
    "claude-opus": (15.0, 75.0), "claude-sonnet": (3.0, 15.0), "claude-haiku": (1.0, 5.0),
    "gpt-4.1-mini": (0.40, 1.60), "gpt-4.1": (2.0, 8.0), "gpt-4o-mini": (0.15, 0.60), "gpt-4o": (2.5, 10.0),
    "llama": (0.0, 0.0), "mock": (0.0, 0.0),
}


def _usage(result) -> tuple[int, int]:
    m = getattr(result, "metrics", None)
    au = getattr(m, "accumulated_usage", None) if m else None
    if isinstance(au, dict):
        return int(au.get("inputTokens", 0) or 0), int(au.get("outputTokens", 0) or 0)
    if au is not None:
        return int(getattr(au, "inputTokens", 0) or 0), int(getattr(au, "outputTokens", 0) or 0)
    return 0, 0


def price_for(model: str) -> tuple[float, float] | None:
    m = (model or "").lower()
    hits = [k for k in _PRICING if k in m]
    return _PRICING[max(hits, key=len)] if hits else None


def _cost(inp: int, out: int, model: str) -> float:
    p = price_for(model)
    if not p:
        return 0.0
    return round(inp / 1e6 * p[0] + out / 1e6 * p[1], 6)


def run_metrics(result, latency_ms: int, model: str) -> dict:
    m = getattr(result, "metrics", None)
    tools = list(getattr(m, "tool_metrics", {}) or {}) if m else []
    inp, out = _usage(result)
    return {"tools": tools, "input_tokens": inp, "output_tokens": out,
            "total_tokens": inp + out, "cost_usd": _cost(inp, out, model),
            "priced": price_for(model) is not None, "model": model,
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
                            "cost_usd", "latency_ms") if k in metrics},
        "model": metrics.get("model", ""),
    })


class timer:
    """`with timer() as t: ...; t.ms` — elapsed milliseconds."""
    def __enter__(self):
        self._t = time.perf_counter(); return self
    def __exit__(self, *a):
        self.ms = int((time.perf_counter() - self._t) * 1000)
