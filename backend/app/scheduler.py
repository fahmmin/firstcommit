"""Alert scheduler — 'agents work while you sleep'.

Local: daemon thread wakes every N seconds, promotes due `scheduled` alerts to
`pending_approval` (guardrail: they still need owner approval to send).
AWS: partner maps this to EventBridge Scheduler → the same run_once logic
(comms.schedule_alert tool already writes fires_at; EventBridge just calls it).
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

from . import deps

_started = False
_thread: threading.Thread | None = None
INTERVAL_SEC = 30


def run_once(tenant_id: str) -> int:
    """Promote due scheduled alerts → pending_approval. Returns count moved."""
    now = datetime.now(timezone.utc).isoformat()
    moved = 0
    for a in deps.store.list_alerts(tenant_id, status="scheduled"):
        if a.get("fires_at", "9999") <= now:
            deps.store.update_alert(tenant_id, a["id"], status="pending_approval")
            moved += 1
    return moved


def _loop(tenant_ids: list[str]):
    while True:
        try:
            for t in tenant_ids:
                run_once(t)
        except Exception as e:  # daemon must never die
            print(f"[scheduler] {e}")
        time.sleep(INTERVAL_SEC)


def start(tenant_ids: list[str] | None = None) -> None:
    global _started, _thread
    if _started:
        return
    _started = True
    _thread = threading.Thread(target=_loop, args=(tenant_ids or ["ramesh_auto"],), daemon=True)
    _thread.start()
