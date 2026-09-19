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


def init_deps(s: Store, n: Notifier) -> None:
    global store, notifier
    store, notifier = s, n
