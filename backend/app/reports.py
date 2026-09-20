"""Business reports — real-data aggregations rendered as `business_report`
artifacts (shareable + PDF-exportable).

A report is a generic document: {subtitle, period, kpis[], sections[]}.
Section kinds: table (columns+rows), bars (items[{label,value,display}]),
list (items[str]), text (text). Both the React renderer and the fpdf2 PDF
renderer consume the same shape.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from pydantic import BaseModel

from . import deps


class BusinessReport(BaseModel):
    """Generic business report document — see module docstring for section kinds."""
    business: str = ""
    subtitle: str = ""
    period: str = ""
    kpis: list = []            # [{label, value, sub}]
    sections: list = []        # [{heading, kind, columns?, rows?, items?, text?, note?}]
    generated_by: str = ""


def _inr(n) -> str:
    return f"Rs. {float(n or 0):,.0f}"


def _status_label(s: str) -> str:
    return (s or "").replace("_", " ")


def build_report(tenant_id: str, report_type: str, title: str = "") -> dict:
    """Aggregate real tenant data into a BusinessReport dict.

    Raises ValueError on unknown report_type.
    """
    builder = _BUILDERS.get(report_type)
    if builder is None:
        raise ValueError(f"unknown report type '{report_type}'. Allowed: {sorted(_BUILDERS)}")
    s = deps.store
    invoices = s.list_invoices(tenant_id)
    biz = (s.get_settings(tenant_id) or {}).get("business_name") or "Ramesh Auto Components"
    data = builder(tenant_id, s, invoices)
    data["business"] = biz
    data["generated_by"] = "Sahayak"
    return {
        "title": title or data.pop("_default_title"),
        "data": BusinessReport(**data).model_dump(),
    }


# ── report builders ───────────────────────────────────────────

def _business_overview(tenant_id, s, invoices):
    unpaid = [i for i in invoices if i.get("status") != "paid"]
    overdue = [i for i in unpaid if i.get("status") == "overdue"]
    outstanding = sum(i.get("amount", 0) for i in unpaid)
    collected = sum(i.get("amount", 0) for i in invoices if i.get("status") == "paid")
    payables = s.list_payables(tenant_id)
    pay_30 = sum(p.get("amount", 0) for p in payables)
    pend = s.list_alerts(tenant_id, status="pending_approval")
    alerts = s.list_alerts(tenant_id)

    by_buyer = defaultdict(float)
    for i in unpaid:
        by_buyer[i.get("buyer", "?")] += i.get("amount", 0)
    top = sorted(by_buyer.items(), key=lambda kv: -kv[1])[:5]

    status_rows = defaultdict(lambda: [0, 0.0])
    for i in invoices:
        status_rows[i.get("status", "due")][0] += 1
        status_rows[i.get("status", "due")][1] += i.get("amount", 0)

    return {
        "_default_title": "Business overview",
        "subtitle": "Owner digest — receivables, payables and what needs a decision",
        "period": datetime.now(timezone.utc).strftime("%d %b %Y"),
        "kpis": [
            {"label": "Outstanding", "value": _inr(outstanding), "sub": f"{len(unpaid)} unpaid invoices"},
            {"label": "Overdue", "value": _inr(sum(i.get('amount', 0) for i in overdue)),
             "sub": f"{len(overdue)} invoices"},
            {"label": "Collected", "value": _inr(collected), "sub": "paid invoices"},
            {"label": "Payables", "value": _inr(pay_30), "sub": f"{len(payables)} vendor dues"},
            {"label": "Pending approvals", "value": str(len(pend)), "sub": "awaiting your tap"},
        ],
        "sections": [
            {"heading": "Invoices by status", "kind": "table",
             "columns": ["Status", "Invoices", "Amount"],
             "rows": [[_status_label(k), str(v[0]), _inr(v[1])]
                      for k, v in sorted(status_rows.items(), key=lambda kv: -kv[1][1])]},
            {"heading": "Largest outstanding — by buyer", "kind": "bars",
             "items": [{"label": b, "value": v, "display": _inr(v)} for b, v in top]},
            {"heading": "Upcoming triggers", "kind": "list",
             "items": [f"{a.get('subject') or a.get('message', 'Alert')} · {_status_label(a.get('status'))}"
                       for a in alerts[:6]] or ["No triggers scheduled."]},
            {"heading": "Read", "kind": "text",
             "text": (f"{_inr(outstanding)} is on the street across {len(unpaid)} invoices; "
                      f"{_inr(sum(i.get('amount', 0) for i in overdue))} of it is already overdue. "
                      f"Vendor dues of {_inr(pay_30)} are scheduled. "
                      f"{len(pend)} items wait on your approval.")},
        ],
    }


def _receivables_aging(tenant_id, s, invoices):
    unpaid = [i for i in invoices if i.get("status") != "paid"]
    buckets = {"current": 0.0, "1-30d": 0.0, "31-60d": 0.0, "60d+": 0.0}
    for i in unpaid:
        d = i.get("days_overdue") or 0
        buckets["current" if d <= 0 else "1-30d" if d <= 30 else "31-60d" if d <= 60 else "60d+"] += i.get("amount", 0)

    rows = sorted(unpaid, key=lambda i: -(i.get("days_overdue") or 0))
    return {
        "_default_title": "Receivables aging report",
        "subtitle": "Who owes what, and how late it is",
        "period": datetime.now(timezone.utc).strftime("%d %b %Y"),
        "kpis": [
            {"label": "Total receivable", "value": _inr(sum(i.get("amount", 0) for i in unpaid)),
             "sub": f"{len(unpaid)} open"},
            {"label": "60d+ overdue", "value": _inr(buckets['60d+']), "sub": "escalate these"},
            {"label": "Oldest", "value": f"{max((i.get('days_overdue') or 0) for i in unpaid) if unpaid else 0}d",
             "sub": "days overdue"},
        ],
        "sections": [
            {"heading": "Aging buckets", "kind": "bars",
             "items": [{"label": k, "value": v, "display": _inr(v)} for k, v in buckets.items()]},
            {"heading": "Open invoices — worst first", "kind": "table",
             "columns": ["Invoice", "Buyer", "Due", "Days over", "Amount"],
             "rows": [[i.get("invoice_no", i.get("id")), i.get("buyer", ""), i.get("due_date", ""),
                       str(i.get("days_overdue") or 0), _inr(i.get("amount"))]
                      for i in rows[:12]]},
            {"heading": "Suggested moves", "kind": "list",
             "items": [
                 "Call the 60d+ bucket first — probability of recovery drops sharply after 90 days.",
                 "Send UPI payment links with reminders; cash buyers pay fastest.",
                 "Offer 1–2% early-settlement discount on the largest current invoices.",
             ]},
        ],
    }


def _cashflow_forecast(tenant_id, s, invoices):
    cf_events = []
    for i in invoices:
        if i.get("status") != "paid":
            cf_events.append({"date": i.get("due_date", ""), "label": f"{i.get('buyer','')} · {i.get('invoice_no','')}",
                              "amt": i.get("amount", 0), "dir": "in"})
    for p in s.list_payables(tenant_id):
        cf_events.append({"date": p.get("due", ""), "label": p.get("vendor", ""), "amt": -p.get("amount", 0), "dir": "out"})
    cf_events.sort(key=lambda e: e["date"])

    opening = 180000.0
    bal, low, low_date = opening, opening, ""
    for e in cf_events:
        bal += e["amt"]
        if bal < low: low, low_date = bal, e["date"]

    return {
        "_default_title": "Cash flow forecast",
        "subtitle": "Dated money-in minus money-out, projected forward",
        "period": datetime.now(timezone.utc).strftime("%d %b %Y") + " · next 90 days",
        "kpis": [
            {"label": "Opening balance", "value": _inr(opening), "sub": "today"},
            {"label": "Expected in", "value": _inr(sum(e['amt'] for e in cf_events if e['amt'] > 0)),
             "sub": "receivables"},
            {"label": "Going out", "value": _inr(-sum(e['amt'] for e in cf_events if e['amt'] < 0)),
             "sub": "payables"},
            {"label": "Lowest point", "value": _inr(low),
             "sub": f"around {low_date or '—'}" + (" — cash gap" if low < 0 else "")},
        ],
        "sections": [
            {"heading": "Dated cash events", "kind": "table",
             "columns": ["Date", "What", "In", "Out"],
             "rows": [[e["date"], e["label"], _inr(e["amt"]) if e["amt"] > 0 else "",
                       _inr(-e["amt"]) if e["amt"] < 0 else ""] for e in cf_events[:18]]},
            {"heading": "Verdict", "kind": "text",
             "text": (f"Cash dips to {_inr(low)} around {low_date}. "
                      + ("That crosses zero — pull collections forward or stagger vendor payments before that week."
                         if low < opening else "Position stays positive through the window."))},
        ],
    }


def _gst_summary(tenant_id, s, invoices):
    by_month = defaultdict(lambda: [0.0, 0.0])
    for i in invoices:
        m = (i.get("issue_date") or "")[:7] or "undated"
        by_month[m][0] += i.get("amount", 0)
        by_month[m][1] += i.get("gst") or 0
    docs = s.list_documents(tenant_id)
    gst_docs = [d for d in docs if "gst" in (d.get("tags") or []) or "gstr" in (d.get("name") or "").lower()
                or "gst" in (d.get("name") or "").lower()]
    total_gst = sum(i.get("gst") or 0 for i in invoices)
    return {
        "_default_title": "GST summary",
        "subtitle": "Output tax collected on invoices, and filing documents on record",
        "period": datetime.now(timezone.utc).strftime("%d %b %Y"),
        "kpis": [
            {"label": "Billed (incl. GST)", "value": _inr(sum(i.get('amount',0) for i in invoices)),
             "sub": f"{len(invoices)} invoices"},
            {"label": "GST collected", "value": _inr(total_gst), "sub": "output tax on record"},
            {"label": "GST docs", "value": str(len(gst_docs)), "sub": "in business context"},
        ],
        "sections": [
            {"heading": "By invoice month", "kind": "table",
             "columns": ["Month", "Billed", "GST"],
             "rows": [[m, _inr(v[0]), _inr(v[1])] for m, v in sorted(by_month.items())]},
            {"heading": "Filing documents on record", "kind": "list",
             "items": [f"{d.get('name')} · {(d.get('tags') or ['general'])[0]}" for d in gst_docs]
                      or ["No GST documents found — upload GSTR-3B / registration to Business context."]},
            {"heading": "Note", "kind": "text",
             "text": ("Figures reflect invoices on record only — reconcile against the GSTR-2B "
                      "statement before filing. Sahayak tracks output tax on issued invoices; "
                      "input credit needs the purchase register.")},
        ],
    }


def _ops_digest(tenant_id, s, invoices):
    specs = s.list_specs(tenant_id)
    agents = [a for a in specs if a.get("status") == "active"]
    activity = s.list_activity(tenant_id, limit=40)
    alerts = s.list_alerts(tenant_id)
    tasks = s.list_tasks(tenant_id)
    by_col = defaultdict(int)
    for t in tasks:
        by_col[t.get("col") or t.get("status") or "todo"] += 1
    sent = [a for a in alerts if a.get("status") == "sent"]
    pend = [a for a in alerts if a.get("status") == "pending_approval"]
    return {
        "_default_title": "Operations digest",
        "subtitle": "What the AI team did, what's queued, what needs you",
        "period": datetime.now(timezone.utc).strftime("%d %b %Y"),
        "kpis": [
            {"label": "Agents on staff", "value": str(len(agents)),
             "sub": f"{sum(1 for a in agents if a.get('created_by')=='factory')} hired by AI"},
            {"label": "Alerts sent", "value": str(len(sent)), "sub": "reminders + warnings"},
            {"label": "Awaiting approval", "value": str(len(pend)), "sub": "one tap each"},
            {"label": "Tasks on board", "value": str(len(tasks)),
             "sub": f"{by_col.get('done', 0)} done · {by_col.get('todo', 0)} to do"},
        ],
        "sections": [
            {"heading": "Active agents", "kind": "table",
             "columns": ["Agent", "Role", "Origin"],
             "rows": [[a.get("name", a.get("id")), (a.get("goal") or a.get("description") or "")[:48],
                       "AI-hired" if a.get("created_by") == "factory" else "template"]
                      for a in agents[:10]]},
            {"heading": "Recent activity", "kind": "list",
             "items": [a.get("text", "") for a in activity[:10]] or ["No activity logged yet."]},
            {"heading": "Waiting on you", "kind": "list",
             "items": [f"{a.get('subject') or a.get('message','')} — approve to send" for a in pend]
                      or ["Nothing pending — inbox zero."]},
        ],
    }


_BUILDERS = {
    "business_overview": _business_overview,
    "receivables_aging": _receivables_aging,
    "cashflow_forecast": _cashflow_forecast,
    "gst_summary": _gst_summary,
    "ops_digest": _ops_digest,
}

# drives the frontend picker — honest metadata, no invented capability
REPORT_TYPES = [
    {"id": "business_overview", "name": "Business overview",
     "desc": "The whole shop on one page — receivables, payables, triggers, and a plain-words read.",
     "sections": ["KPIs", "Invoice status", "Top debtors", "Upcoming triggers"]},
    {"id": "receivables_aging", "name": "Receivables aging",
     "desc": "Who owes what and how late — buckets, worst-first list, and collection moves.",
     "sections": ["Aging buckets", "Open invoices", "Suggested moves"]},
    {"id": "cashflow_forecast", "name": "Cash flow forecast",
     "desc": "Dated money-in vs money-out for the next 90 days, with the lowest point flagged.",
     "sections": ["Cash events", "Lowest point", "Verdict"]},
    {"id": "gst_summary", "name": "GST summary",
     "desc": "Output tax collected by month and the filing documents on record.",
     "sections": ["Monthly billed + GST", "Filing docs", "Reconcile note"]},
    {"id": "ops_digest", "name": "Operations digest",
     "desc": "What the AI team did — agents active, alerts sent, approvals waiting on you.",
     "sections": ["Active agents", "Recent activity", "Waiting on you"]},
]
