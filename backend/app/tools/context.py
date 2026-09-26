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
    """Owner's typed memories + shared-document summaries, injected into prompts."""
    if deps.store is None:
        return ""
    suffix = ""
    mems = deps.store.list_memories(tenant_id)
    if mems:
        lines = "\n".join(f"- {m['text']}" for m in mems)
        suffix += ("\n\nWhat the owner told you about their business "
                   "(honor these in every answer):\n" + lines)
    from .documents import build_context_suffix
    suffix += build_context_suffix(tenant_id)
    return suffix


def memory_tools(tenant_id: str) -> list:

    @tool
    def recall_context(query: str = "") -> dict:
        """Recall what the owner taught you + retrieve relevant business documents.
        Uses hybrid search (keyword + embeddings) and returns grounded citations."""
        from .retrieval import keyword_score, search_documents, tokens
        mems = deps.store.list_memories(tenant_id)
        # memories: keyword-rank against the query (fall back to all when query is broad)
        q_toks = tokens(query)
        if q_toks:
            scored = [(keyword_score(q_toks, m["text"]), m) for m in mems]
            mem_hits = [m for s, m in sorted(scored, key=lambda x: x[0], reverse=True) if s > 0][:5]
            mem_lines = [m["text"] for m in mem_hits] or [m["text"] for m in mems[:3]]
        else:
            mem_lines = [m["text"] for m in mems]
        # documents: real hybrid retrieval → cited snippets
        doc_hits = search_documents(tenant_id, query, k=4) if query else []
        citations = [{"filename": h["filename"], "snippet": h["snippet"],
                      "score": h.get("rerank_score", h["score"])} for h in doc_hits]
        parts = []
        if mem_lines:
            parts.append("What you've told me: " + " | ".join(mem_lines))
        for c in citations:
            parts.append(f"From {c['filename']}: {c['snippet']}")
        reply = "\n".join(parts) if parts else "You haven't taught me anything specific yet."
        return {"memories": mem_lines, "citations": citations, "reply": reply}

    return [recall_context]
