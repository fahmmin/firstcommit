"""Keyless 'Web / RSS' connector (C1) — pull a public page or feed into context.

No OAuth, no key: the owner gives a URL, sync fetches it and ingests the content
into the business-context brain (chunked + embedded by the B1 pipeline), so it's
searchable and cited like any other document. Proves the real-connector pattern
without depending on the Google service-account key.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET

from .documents import ingest_document_impl

MAX_RSS_ITEMS = 8


def _html_to_text(html: str) -> str:
    html = re.sub(r"(?is)<(script|style|head|nav|footer)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", html)                # strip tags
    text = re.sub(r"&[a-z#0-9]+;", " ", text)               # crude entity strip
    return re.sub(r"\s+", " ", text).strip()


def _looks_like_rss(content: str, content_type: str) -> bool:
    head = content.lstrip()[:400].lower()
    return ("xml" in content_type.lower() or head.startswith("<?xml")
            or "<rss" in head or "<feed" in head)


def _parse_rss(content: str) -> list[dict]:
    items: list[dict] = []
    try:
        root = ET.fromstring(content.encode("utf-8", "replace"))
    except ET.ParseError:
        return items
    # RSS <item> and Atom <entry>
    for node in root.iter():
        tag = node.tag.split("}")[-1].lower()
        if tag not in ("item", "entry"):
            continue
        get = lambda n: next((c.text or "" for c in node
                              if c.tag.split("}")[-1].lower() == n), "")
        title = get("title").strip()
        summary = (_html_to_text(get("description") or get("summary")) or "").strip()
        if title or summary:
            items.append({"title": title or "(untitled)", "summary": summary})
        if len(items) >= MAX_RSS_ITEMS:
            break
    return items


def ingest_content(tenant_id: str, url: str, content: str, content_type: str = "") -> int:
    """Parse fetched content (RSS→items, else HTML/text→one doc) and ingest. Testable
    without network. Returns docs created."""
    host = re.sub(r"^https?://(www\.)?", "", url).split("/")[0] or "web"
    n = 0
    if _looks_like_rss(content, content_type):
        for it in _parse_rss(content):
            body = f"[web feed: {host}] {it['title']}\n\n{it['summary']}"
            ingest_document_impl(tenant_id, note=body, filename=f"{host} — {it['title'][:60]}")
            n += 1
    if n == 0:  # not RSS, or empty feed → treat as a single page
        text = _html_to_text(content) if "<" in content else content
        if text.strip():
            ingest_document_impl(tenant_id, note=f"[web page: {url}]\n\n{text[:8000]}",
                                 filename=f"{host} page")
            n = 1
    return n


def fetch_and_ingest(tenant_id: str, url: str) -> int:
    """Fetch a URL and ingest it. Network errors return 0 (never crash sync)."""
    import httpx
    try:
        r = httpx.get(url, timeout=15, follow_redirects=True,
                      headers={"User-Agent": "SahayakBot/1.0"})
        r.raise_for_status()
    except Exception as e:
        print(f"[webingest] fetch failed for {url}: {type(e).__name__}: {e}")
        return 0
    return ingest_content(tenant_id, url, r.text, r.headers.get("content-type", ""))
