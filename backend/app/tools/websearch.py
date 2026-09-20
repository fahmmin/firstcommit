"""Web search tool — real when TAVILY_API_KEY is set, graceful no-op otherwise.

Powers the composer's "Web search" / "Deep research" toggles (`/chat` `mode`).
Genuine SMB uses: live commodity/material prices, GST/HSN lookups, finding buyers.
Keyless-safe: without a key the tool returns a clear "not configured" message so
the demo never breaks; set TAVILY_API_KEY to make it real.
"""
from __future__ import annotations

import os

from strands import tool

from .. import deps


def web_search_available() -> bool:
    return bool(os.getenv("TAVILY_API_KEY"))


def _tavily(query: str, depth: str = "basic", max_results: int = 5) -> dict:
    import httpx
    resp = httpx.post(
        "https://api.tavily.com/search",
        json={"api_key": os.getenv("TAVILY_API_KEY"), "query": query,
              "search_depth": depth, "max_results": max_results,
              "include_answer": True},
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


def web_search_tools(tenant_id: str) -> list:

    @tool
    def web_search(query: str, deep: bool = False) -> dict:
        """Search the live web for current info (prices, GST/HSN rules, market data,
        potential buyers). Set deep=True for a broader multi-source pass."""
        if not web_search_available():
            return {"reply": "Web search isn't configured yet — set TAVILY_API_KEY to enable "
                             "live web lookups. (I can still help from your business data.)"}
        try:
            data = _tavily(query, depth="advanced" if deep else "basic")
        except Exception as e:
            return {"reply": f"Web search failed ({type(e).__name__}). Try again shortly."}
        deps.record_action("web_searched", {"query": query, "deep": deep})
        results = [{"title": r.get("title"), "url": r.get("url"),
                    "snippet": (r.get("content") or "")[:300]} for r in data.get("results", [])]
        answer = data.get("answer") or ""
        lines = "\n".join(f"• {r['title']} — {r['snippet']}" for r in results[:5])
        return {"results": results, "answer": answer,
                "reply": (answer + "\n\n" if answer else "") + "Sources:\n" + lines
                         if results else "No web results found."}

    return [web_search]
