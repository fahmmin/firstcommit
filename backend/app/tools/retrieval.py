"""Hybrid retrieval for the business-context brain (B1).

Upgrades the old "substring OR whole-doc cosine" into a real RAG retriever:
  chunk → hybrid (keyword BM25-lite + vector cosine, alpha-weighted) → rerank → cite.

Works in both modes: with Titan embeddings (USE_AWS) the vector term is live;
offline it degrades to keyword-only (never a no-op). The reranker is a deterministic
lexical cross-feature re-score (phrase/filename/tag boosts) so ordering improves in
both modes; a Bedrock reranker can be slotted in via `_bedrock_rerank` later.
"""
from __future__ import annotations

import os
import re
from collections import Counter

from .documents import cosine, embed_text

CHUNK_SIZE = 600          # chars per chunk
CHUNK_OVERLAP = 100
MAX_CHUNKS = 8            # cap per doc (keeps DynamoDB items well under 400KB)
ALPHA = 0.5              # hybrid weight: alpha*vector + (1-alpha)*keyword
_WORD = re.compile(r"[a-z0-9]+")
_STOP = {"the", "a", "an", "of", "to", "is", "in", "for", "on", "and", "or", "my",
         "me", "do", "does", "what", "who", "how", "about", "with", "i"}


def tokens(s: str) -> list[str]:
    return [w for w in _WORD.findall((s or "").lower()) if len(w) > 1 and w not in _STOP]


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split on paragraph/line boundaries, packing into ~`size`-char windows."""
    text = (text or "").strip()
    if not text:
        return []
    units = [u.strip() for u in re.split(r"\n{2,}|\r\n\r\n", text) if u.strip()] or [text]
    chunks, buf = [], ""
    for u in units:
        if len(buf) + len(u) + 1 <= size:
            buf = f"{buf}\n{u}".strip()
        else:
            if buf:
                chunks.append(buf)
            # a single unit larger than `size` → hard-split with overlap
            while len(u) > size:
                chunks.append(u[:size])
                u = u[size - overlap:]
            buf = u
    if buf:
        chunks.append(buf)
    return chunks[:MAX_CHUNKS]


def build_chunks(text: str, embed: bool = True) -> list[dict]:
    """Chunk + (optionally) embed each chunk. Embedding is None offline."""
    out = []
    for i, c in enumerate(chunk_text(text)):
        out.append({"i": i, "text": c, "embedding": embed_text(c) if embed else None})
    return out


def keyword_score(q_tokens: list[str], text: str) -> float:
    """BM25-lite: query-term coverage (0.7) + capped term-frequency bonus (0.3), 0..1."""
    if not q_tokens:
        return 0.0
    qset = set(q_tokens)
    tf = Counter(tokens(text))
    matched = [q for q in qset if tf.get(q)]
    if not matched:
        return 0.0
    coverage = len(matched) / len(qset)
    tf_bonus = sum(min(tf[q], 3) for q in matched) / (3 * len(qset))
    return round(0.7 * coverage + 0.3 * tf_bonus, 4)


def _doc_chunks(doc: dict) -> list[dict]:
    """Chunks for a doc, with backward-compat for pre-B1 docs (summary+excerpt)."""
    chunks = doc.get("chunks")
    if chunks:
        return chunks
    blob = f"{doc.get('summary', '')} {doc.get('text_excerpt', '')}".strip()
    return [{"i": 0, "text": blob, "embedding": doc.get("embedding")}]


def _rerank(query: str, cands: list[dict], top_n: int) -> list[dict]:
    """Deterministic lexical re-rank: hybrid score + phrase/filename/tag boosts."""
    ql = query.lower().strip()
    q_toks = set(tokens(query))
    for c in cands:
        boost = 0.0
        if ql and ql in c["snippet"].lower():
            boost += 0.30                                   # exact phrase in the chunk
        if q_toks & set(tokens(c["filename"])):
            boost += 0.10                                   # filename match
        if q_toks & set(tokens(" ".join(c.get("tags", [])))):
            boost += 0.05                                   # tag match
        c["rerank_score"] = round(c["score"] + boost, 4)
    cands.sort(key=lambda c: c["rerank_score"], reverse=True)
    return cands[:top_n]


def search_documents(tenant_id: str, query: str, k: int = 6, alpha: float = ALPHA) -> list[dict]:
    """Hybrid retrieve → rerank → return top-k cited chunks (best chunk per doc)."""
    from .. import deps
    docs = deps.store.list_documents(tenant_id)
    if not docs or not query.strip():
        return []
    q_toks = tokens(query)
    has_vectors = any(ch.get("embedding") for d in docs for ch in _doc_chunks(d))
    qvec = embed_text(query) if has_vectors else None

    cands: list[dict] = []
    for d in docs:
        fname, tags = d.get("filename", ""), d.get("tags", [])
        best = None
        for ch in _doc_chunks(d):
            kw = keyword_score(q_toks, f"{ch['text']} {fname} {' '.join(tags)}")
            vec = cosine(qvec, ch.get("embedding")) if qvec and ch.get("embedding") else 0.0
            score = round(alpha * vec + (1 - alpha) * kw, 4) if (qvec and ch.get("embedding")) else kw
            if best is None or score > best["score"]:
                best = {"score": score, "kw": kw, "vec": round(vec, 4),
                        "chunk_index": ch.get("i", 0), "snippet": ch["text"][:280]}
        if best and (best["score"] > 0 or best["vec"] >= 0.30):
            cands.append({"doc_id": d["id"], "filename": fname, "tags": tags,
                          "summary": d.get("summary", ""), **best})
    return _rerank(query, cands, k)


def retrieval_mode(tenant_id: str) -> str:
    """Honest label for how retrieval is running (surfaced to UI/tests)."""
    from .. import deps
    docs = deps.store.list_documents(tenant_id) if deps.store else []
    vectors = any(ch.get("embedding") for d in docs for ch in _doc_chunks(d))
    return "hybrid" if vectors else "keyword"
