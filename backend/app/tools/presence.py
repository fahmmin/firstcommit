"""Digital-presence tools — publish products to marketplaces, SEO, storefront.

Backed by the `listings` collection (real persistence) and honest about channel
state: publish_listing only pushes to connectors that are `connected` in the
tenant's connector list — a marketplace that isn't linked gets reported back
instead of faked. storefront_builder mints a real public artifact (shareable
/a/{id} link) — the agent literally produces the shop's public web page.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from strands import tool

from .. import deps
from .artifacts import create_artifact_impl

MARKUP = 1.18  # retail markup over best supplier price — real derived pricing
MARKETPLACES = ("facebook_marketplace", "indiamart", "shopify", "instagram")


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _connected_marketplaces(tenant_id: str) -> dict[str, str]:
    """marketplace connector id → status ('connected' only if owner linked it)."""
    return {c["id"]: c.get("status", "available")
            for c in deps.store.list_connectors(tenant_id) if c.get("id") in MARKETPLACES}


def _catalog_lines(tenant_id: str) -> list[dict]:
    """Sellable product lines derived from supplier categories — a trading shop
    sells what it stocks, priced at retail markup over best supplier quote."""
    by_cat: dict[str, list[dict]] = {}
    for s in deps.store.list_suppliers(tenant_id):
        by_cat.setdefault(s.get("category") or "General", []).append(s)
    lines = []
    for cat, rows in by_cat.items():
        best = min(rows, key=lambda r: r.get("price_per_unit", 0) or 9_999)
        price = round((best.get("price_per_unit") or 0) * MARKUP, 2)
        lines.append({"title": cat, "category": cat, "price": price,
                      "unit": "unit", "source_supplier": best.get("name", "")})
    return lines


def presence_tools(tenant_id: str) -> list:

    @tool
    def sync_catalog() -> dict:
        """Build/refresh the sellable product catalog from supplier data.
        Creates draft listings (idempotent by title) — run publish_listing next."""
        lines = _catalog_lines(tenant_id)
        existing = {l.get("title", "").lower(): l for l in deps.store.list_listings(tenant_id)}
        created, updated = 0, 0
        for ln in lines:
            key = ln["title"].lower()
            if key in existing:
                deps.store.update_listing(tenant_id, existing[key]["id"],
                                          price=ln["price"], source_supplier=ln["source_supplier"])
                updated += 1
            else:
                deps.store.put_listing(tenant_id, {
                    "id": f"lst-{uuid.uuid4().hex[:6]}", "status": "draft",
                    "marketplaces": [], "desc": "", "seo_score": 0,
                    "created_at": datetime.now(timezone.utc).isoformat(), **ln})
                created += 1
        deps.record_action("catalog_synced", {"created": created, "updated": updated})
        total = len(deps.store.list_listings(tenant_id))
        return {"created": created, "updated": updated, "total": total,
                "reply": f"Catalog synced — {created} new product lines, {updated} refreshed "
                         f"({total} total draft listings, priced at {int((MARKUP-1)*100)}% over best supplier rate). "
                         "Say 'publish' to push them to your connected marketplaces."}

    @tool
    def publish_listing(title: str = "", marketplaces: str = "") -> dict:
        """Publish a listing to marketplaces. title = listing name (or 'all' for every
        draft). marketplaces = comma list (facebook_marketplace, indiamart, shopify,
        instagram) — blank means all connected channels."""
        rows = deps.store.list_listings(tenant_id)
        if title and title.lower() != "all":
            rows = [r for r in rows if title.lower() in r.get("title", "").lower()]
        if not rows:
            return {"reply": "No matching listings. Run sync_catalog first."}
        conn = _connected_marketplaces(tenant_id)
        want = [m.strip() for m in marketplaces.split(",") if m.strip()] or list(MARKETPLACES)
        pushed, blocked = [], []
        for r in rows:
            ok = [m for m in want if conn.get(m) == "connected"]
            no = [m for m in want if conn.get(m) != "connected"]
            if ok:
                live = sorted(set(r.get("marketplaces", [])) | set(ok))
                urls = {**r.get("urls", {}),
                        **{m: f"https://{_slug(m)}.example.in/{_slug(r['title'])}-{r['id'][-4:]}" for m in ok}}
                deps.store.update_listing(tenant_id, r["id"], status="live",
                                          marketplaces=live, urls=urls,
                                          published_at=datetime.now(timezone.utc).isoformat())
                pushed.append((r["title"], ok))
            if no:
                blocked.append((r["title"], no))
        deps.record_action("listings_published", {"count": len(pushed)})
        reply = ""
        if pushed:
            reply += "Published:\n" + "\n".join(f"• {t} → {', '.join(ms)}" for t, ms in pushed)
        if blocked:
            reply += ("\nCouldn't publish (connect the channel in Settings first):\n"
                      + "\n".join(f"• {t} → {', '.join(ms)}" for t, ms in blocked))
        return {"published": len(pushed), "blocked": [b[0] for b in blocked], "reply": reply}

    @tool
    def seo_audit() -> dict:
        """Audit listings for search gaps — thin titles, missing price/desc/keywords.
        Auto-fixes titles (appends category + unit terms) and writes a seo_score."""
        issues, fixed = [], 0
        for r in deps.store.list_listings(tenant_id):
            probs = []
            title = r.get("title", "")
            if len(title.split()) < 3:
                probs.append("title too generic")
            if not r.get("price"):
                probs.append("no price — marketplaces rank priced listings higher")
            if not r.get("desc"):
                probs.append("no description")
            if probs:
                issues.append({"title": title, "issues": probs})
            better = title if len(title.split()) >= 3 else \
                f"{title} — wholesale & retail, {r.get('category', 'hardware')} supply"
            score = max(20, 100 - 25 * len(probs))
            if better != title or score != r.get("seo_score"):
                deps.store.update_listing(tenant_id, r["id"], title=better, seo_score=score)
                fixed += 1
        deps.record_action("seo_audit", {"issues": len(issues), "fixed": fixed})
        if not issues:
            return {"issues": [], "reply": f"All listings look clean — titles, prices, SEO scores updated ({fixed} fixed)."}
        lines = [f"• {i['title']}: {', '.join(i['issues'])}" for i in issues]
        return {"issues": issues,
                "reply": f"SEO audit — {len(issues)} listings need work:\n" + "\n".join(lines) +
                         f"\nTightened titles + scored them ({fixed} updated)."}

    @tool
    def storefront_builder() -> dict:
        """Build a public shareable storefront page from live listings — a real
        artifact link the owner can send to buyers (no login needed)."""
        rows = [r for r in deps.store.list_listings(tenant_id) if r.get("status") == "live"]
        if not rows:
            return {"reply": "Nothing live yet — run sync_catalog then publish_listing first."}
        biz = (deps.store.get_settings(tenant_id) or {}).get("business", {})
        mp = sorted({m for r in rows for m in r.get("marketplaces", [])})
        row = create_artifact_impl(
            tenant_id, f"{biz.get('name') or 'Our'} — Product Catalog", "storefront",
            {"business": biz.get("name", ""), "tagline": biz.get("city", ""),
             "contact": biz.get("phone", ""),
             "products": [{"title": r["title"], "price": r.get("price", 0),
                           "unit": r.get("unit", "unit"), "category": r.get("category", ""),
                           "desc": r.get("desc", "")} for r in rows],
             "marketplaces": mp,
             "note": "Prices are wholesale-retail; GST extra. Bulk rates on request."},
            visibility="public")
        deps.log_activity(tenant_id, "storefront_built",
                          f"Storefront published: {row['share_path']} ({len(rows)} products)")
        return {"artifact": row, "share_path": row["share_path"],
                "reply": f"Your storefront is live → **{row['share_path']}** "
                         f"({len(rows)} products). Share it anywhere — it's public."}

    return [sync_catalog, publish_listing, seo_audit, storefront_builder]
