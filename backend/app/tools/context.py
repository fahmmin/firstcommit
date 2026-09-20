"""Business-context (memory) helpers — real memory the owner teaches Sahayak.

Two surfaces, both REAL in offline + Bedrock mode:
- `build_memory_suffix` is appended to every agent's system prompt (Nova reads it).
- `recall_context` is a live tool every agent gets, so even the deterministic
  MockModel can surface the owner's notes in a reply (demo works with USE_AWS=0).
"""
from __future__ import annotations

from strands import tool

from .. import deps


def build_memory_suffix(tenant_id: str) -> str:
    """The '...what the owner told you...' block injected into system prompts."""
    if deps.store is None:
        return ""
    mems = deps.store.list_memories(tenant_id)
    if not mems:
        return ""
    lines = "\n".join(f"- {m['text']}" for m in mems)
    return ("\n\nWhat the owner told you about their business "
            "(honor these in every answer):\n" + lines)


def memory_tools(tenant_id: str) -> list:

    @tool
    def recall_context(query: str = "") -> dict:
        """Recall what the owner has taught you about their business. Optionally
        filter by a keyword (e.g. a buyer or supplier name)."""
        import re
        mems = deps.store.list_memories(tenant_id)
        stop = {"what", "does", "about", "remember", "recall", "know", "tell", "have",
                "your", "the", "you", "told", "context", "note", "notes"}
        if query:
            words = [w for w in re.findall(r"[a-z0-9]+", query.lower())
                     if len(w) > 3 and w not in stop]
            matched = [m for m in mems if any(w in m["text"].lower() for w in words)]
            matched = matched or mems
        else:
            matched = mems
        lines = [m["text"] for m in matched]
        return {
            "memories": lines,
            "reply": ("Here's what you've told me: " + " | ".join(lines))
                     if lines else "You haven't taught me anything specific yet.",
        }

    return [recall_context]
