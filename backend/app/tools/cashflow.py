"""Cash-flow tools — timeline, payment-term gap analysis, order advisor."""
from __future__ import annotations

from datetime import date

from strands import tool

from .. import deps


def cashflow_tools(tenant_id: str) -> list:

    @tool
    def timeline() -> dict:
        """Receivables vs payables timeline — money in vs money out."""
        receivables = [
            {"buyer": r["buyer"], "amount": r["amount"], "expected": r["due_date"]}
            for r in deps.store.list_invoices(tenant_id)
            if r.get("status") in ("sent", "due_soon", "overdue")
        ]
        payables = deps.store.list_payables(tenant_id)
        total_in = sum(r["amount"] for r in receivables)
        total_out = sum(p["amount"] for p in payables)
        deps.record_action("cashflow_report", {"in": total_in, "out": total_out})
        return {
            "receivables": receivables, "payables": payables,
            "total_in": total_in, "total_out": total_out,
            "reply": f"Money in pipeline: ₹{total_in:,} receivable. "
                     f"Money out: ₹{total_out:,} payable to suppliers. "
                     + ("You look covered — if buyers pay on time." if total_in >= total_out
                        else "Watch it — more going out than coming in near-term."),
        }

    @tool
    def term_gap_analysis() -> dict:
        """Analyze the payment-terms gap: buyers paying in 60-90d while you pay in 30d."""
        long_term = [r for r in deps.store.list_invoices(tenant_id)
                     if (r.get("terms_days") or 30) >= 60 and r.get("status") != "paid"]
        locked = sum(r["amount"] for r in long_term)
        near_out = sum(p["amount"] for p in deps.store.list_payables(tenant_id))
        gap = max(0, near_out - sum(r["amount"] for r in deps.store.list_invoices(tenant_id, status="due_soon")))
        deps.record_action("cashflow_report", {"gap": gap})
        return {
            "long_term_invoices": long_term, "locked_amount": locked,
            "near_term_payables": near_out, "projected_gap": gap,
            "reply": f"₹{locked:,} is locked in 60–90 day buyer terms while ₹{near_out:,} "
                     f"of supplier payments are due in 30 days. "
                     f"Projected gap: ~₹{gap:,}. Options: ask {long_term[0]['buyer'] if long_term else 'buyers'} "
                     "for part-payment, invoice discounting, or stagger supplier payments.",
        }

    @tool
    def order_advisor(order_amount: float = 0, margin_pct: float = 20, terms_days: int = 90) -> dict:
        """Should I take this order? Weighs margin vs working-capital cost of long terms."""
        if order_amount <= 0:
            order_amount = 50000
        margin = order_amount * margin_pct / 100
        # ~18% p.a. short-term loan cost for the gap period
        borrow_cost = order_amount * (1 - margin_pct / 100) * 0.18 * terms_days / 365
        net = margin - borrow_cost
        verdict = "WORTH IT" if net > 0 else "MARGINAL — negotiate terms"
        deps.record_action("cashflow_report", {"order": order_amount, "verdict": verdict})
        return {
            "order_amount": order_amount, "margin": round(margin), "borrow_cost": round(borrow_cost),
            "net": round(net), "verdict": verdict,
            "reply": f"On a ₹{order_amount:,} order at {margin_pct}% margin with {terms_days}-day terms: "
                     f"margin ₹{margin:,.0f}, but financing the gap costs ~₹{borrow_cost:,.0f} "
                     f"(18% short-term rate). Net ₹{net:,.0f} — {verdict}. "
                     + ("" if net > 0 else "Counter: ask for 30% advance or 45-day terms."),
        }

    return [timeline, term_gap_analysis, order_advisor]
