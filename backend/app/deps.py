"""Shared runtime deps + per-request context (actions & trace).

Tools record UI-visible actions and mock-arg helpers read the store through
this registry so `MockModel` stays decoupled from app wiring.
"""
from __future__ import annotations

import contextvars

from .notifier import Notifier
from .store import Store

store: Store | None = None
notifier: Notifier | None = None

# per-request accumulators, set by the /chat endpoint, appended by tools
current_actions: contextvars.ContextVar[list | None] = contextvars.ContextVar("actions", default=None)


def record_action(type_: str, data: dict) -> None:
    actions = current_actions.get()
    if actions is not None:
        actions.append({"type": type_, "data": data})


def log_activity(tenant_id: str, kind: str, text: str) -> None:
    """Persisted event for the dashboard activity feed (separate from per-request actions)."""
    import uuid
    from datetime import datetime, timezone
    if store is None:
        return
    store.put_activity(tenant_id, {
        "id": f"act-{uuid.uuid4().hex[:8]}",
        "ts": datetime.now(timezone.utc).isoformat(),
        "kind": kind, "text": text,
    })


def notify(tenant_id: str, kind: str, title: str, body: str = "", ref_id: str = "") -> None:
    """Push a row into the notifications feed (action_required/info/warning)."""
    import uuid
    from datetime import datetime, timezone
    if store is None:
        return
    store.put_notification(tenant_id, {
        "id": f"n-{uuid.uuid4().hex[:8]}", "kind": kind, "title": title,
        "body": body, "ref_id": ref_id,
        "created_at": datetime.now(timezone.utc).isoformat(), "status": "unread",
    })


def init_deps(s: Store, n: Notifier) -> None:
    global store, notifier
    store, notifier = s, n
