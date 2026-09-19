"""Supplier/procurement tools — catalog, stock, price compare, trust, MOQ pooling."""
from __future__ import annotations

from strands import tool

from .. import deps


def supplier_tools(tenant_id: str) -> list:

    @tool
    def search_catalog(q: str = "") -> dict:
        """Search the supplier catalog by name or category."""
        rows = deps.store.list_suppliers(tenant_id, q=q or None)
        deps.record_action("suppliers_listed", {"count": len(rows)})
        if not rows:
            return {"suppliers": [], "reply": "No suppliers matched."}
        top = sorted(rows, key=lambda r: r.get("trust_score", 0), reverse=True)[:5]
        lines = [f"• {r['name']} ({r['category']}) — trust {r['trust_score']}/5, MOQ {r['moq']}, ₹{r['price_per_unit']}/unit, {r['stock'].replace('_',' ')}, {r['lead_days']}d lead"
                 for r in top]
        return {"suppliers": rows, "reply": "Top matches:\n" + "\n".join(lines)}

    @tool
    def check_stock(supplier: str = "") -> dict:
        """Check live stock status of a supplier by name."""
        rows = deps.store.list_suppliers(tenant_id, q=supplier or None)
        if not rows:
            return {"reply": f"Couldn't find supplier '{supplier}'."}
        r = rows[0]
        return {"supplier": r, "reply": f"{r['name']}: {r['stock'].replace('_',' ')}, ~{r['lead_days']} day lead time."}

    @tool
    def compare_prices(category: str = "") -> dict:
        """Compare per-unit prices across suppliers in a category."""
        rows = deps.store.list_suppliers(tenant_id, q=category or None)
        if len(rows) < 2:
            rows = deps.store.list_suppliers(tenant_id)
        rows = sorted(rows, key=lambda r: r.get("price_per_unit", 1e9))[:5]
        lines = [f"{i+1}. {r['name']} — ₹{r['price_per_unit']}/unit (MOQ {r['moq']}, trust {r['trust_score']})"
                 for i, r in enumerate(rows)]
        return {"ranked": rows, "reply": "Cheapest first:\n" + "\n".join(lines) +
                "\nNote: cheapest isn't always best — check trust scores."}

    @tool
    def trust_score(supplier: str = "") -> dict:
        """Get the trust/verification score of a supplier before committing."""
        rows = deps.store.list_suppliers(tenant_id, q=supplier or None)
        if not rows:
            return {"reply": f"Couldn't find supplier '{supplier}'."}
        r = rows[0]
        verdict = "safe to try a small order" if r["trust_score"] >= 4 and r.get("verified") else \
                  "risky — start with a sample batch or ask for references"
        return {"supplier": r, "reply": f"{r['name']}: trust {r['trust_score']}/5"
                + (" ✅ verified" if r.get("verified") else " ⚠️ unverified") + f" — {verdict}."}

    @tool
    def suggest_moq_pool(category: str = "", qty: int = 0) -> dict:
        """Suggest pooling an order with similar shops when MOQ exceeds need."""
        rows = deps.store.list_suppliers(tenant_id, q=category or None)
        r = min(rows, key=lambda x: x.get("price_per_unit", 1e9), default=None)
        if not r:
            return {"reply": "No suppliers found for that category."}
        if qty and qty >= r["moq"]:
            return {"supplier": r, "reply": f"{r['name']} MOQ is {r['moq']} — your {qty} units qualify directly at ₹{r['price_per_unit']}/unit."}
        needed = r["moq"] - qty if qty else r["moq"]
        return {
            "supplier": r, "pool_qty_needed": needed,
            "reply": f"{r['name']} wants MOQ {r['moq']}. You need {qty or 'less'}. "
                     f"Pooling with 2-3 similar units near you covers the {needed}-unit gap "
                     f"and gets wholesale ₹{r['price_per_unit']}/unit instead of retail.",
        }

    return [search_catalog, check_stock, compare_prices, trust_score, suggest_moq_pool]
