"""Template catalog — prompt & agent templates for the gallery/marketplace.

Two kinds:
- prompt templates: `runs_on` names an existing agent; the client drops `prompt`
  into the composer (no agent created).
- agent templates: carry an `agent_spec` (name/goal/tools) and a `role_id` from
  the role registry (agents/roles.py). Installing one creates the agent via the
  factory (registry.create_spec(role_id=…)), clamped to that role's tool limits.
  `runs_on: nirmata` with empty tools → the owner runs `prompt` and Nirmata
  interviews + hires live (the demo "factory moment").
"""
from __future__ import annotations

TEMPLATES: list[dict] = [
    # ---- money ----
    {"id": "chase-overdue", "category": "money", "title": "Chase overdue payments",
     "desc": "Vasool finds what is late and drafts the reminder",
     "prompt": "Show my overdue invoices and draft a polite reminder for the oldest one.",
     "runs_on": "vasool"},
    {"id": "aging-report", "category": "money", "title": "Receivables aging report",
     "desc": "0-30 / 31-60 / 61-90 / 90+ day buckets",
     "prompt": "Give me a receivables aging report.", "runs_on": "vasool"},
    {"id": "cashflow-check", "category": "money", "title": "Cash-flow check",
     "desc": "Next 30 days of inflows vs payables",
     "prompt": "Check my cash flow for the next 30 days and flag any gap.", "runs_on": "khata"},
    {"id": "should-i-take-90d", "category": "money", "title": "Should I take 90-day terms?",
     "desc": "Khata weighs a big order against cash flow",
     "prompt": "A buyer wants 90-day terms on a ₹2,00,000 order. Should I take it?",
     "runs_on": "khata"},
    {"id": "gst-gap", "category": "money", "title": "GST invoice gap check",
     "desc": "Find invoices missing GST",
     "prompt": "List invoices that are missing GST and flag them.", "runs_on": "vasool"},
    {"id": "payment-plan", "category": "money", "title": "Payment-plan proposer",
     "desc": "Draft an installment plan for a defaulter",
     "prompt": "Draft a 3-installment payment plan for my oldest defaulter.", "runs_on": "vasool"},
    {"id": "customer-statement", "category": "money", "title": "Customer statement",
     "desc": "Shareable outstanding statement for a buyer",
     "prompt": "Build a shareable outstanding statement for Sharma Motors.", "runs_on": "vasool"},

    # ---- procurement ----
    {"id": "compare-suppliers", "category": "procurement", "title": "Compare suppliers",
     "desc": "Right supplier, right price, right MOQ",
     "prompt": "Compare suppliers for raw steel coils under ₹62/unit.", "runs_on": "sourcer"},
    {"id": "moq-pool", "category": "procurement", "title": "MOQ pool finder",
     "desc": "Pool a small order to hit the minimum",
     "prompt": "I need only 300 units but MOQ is 1000 — can I pool it?", "runs_on": "sourcer"},
    {"id": "vendor-trust", "category": "procurement", "title": "New-vendor trust check",
     "desc": "Verify before the first order",
     "prompt": "Check the trust score of Apex Alloys before I order.", "runs_on": "sourcer"},

    # ---- logistics ----
    {"id": "cheapest-pickup", "category": "logistics", "title": "Cheapest pickup finder",
     "desc": "Best carrier for a route + weight",
     "prompt": "Cheapest reliable pickup to Ludhiana for 500 kg?", "runs_on": "nirmata"},
    {"id": "tracking-page", "category": "logistics", "title": "Delivery tracking page",
     "desc": "Builds a shareable tracking artifact",
     "prompt": "Build a tracking page for my latest shipment to Ludhiana.", "runs_on": "nirmata"},

    # ---- new agent (factory) ----
    {"id": "hire-logistics", "role_id": "logistics", "category": "new_agent", "title": "Hire a logistics agent",
     "desc": "The magic moment — Nirmata builds one live",
     "prompt": "Mera transporter nahi aaya, order stranded hai — I need a logistics agent.",
     "runs_on": "nirmata",
     "agent_spec": {"name": "Logistics Agent", "goal": "Find backup transport and book pickups when carriers fail",
                    "tools": ["list_carriers", "quote_pickup", "book_pickup"],
                    "hindi_tagline": "सामान पहुँचाने वाला"}},
    {"id": "collections-agent", "role_id": "collections", "category": "new_agent", "title": "Dedicated collections agent",
     "desc": "A specialist that only chases money",
     "prompt": "Hire an agent whose only job is chasing overdue payments.",
     "runs_on": "nirmata",
     "agent_spec": {"name": "Collections Agent", "goal": "Relentlessly track and recover overdue receivables",
                    "tools": ["list_overdue", "aging_report", "draft_reminder", "schedule_alert"],
                    "hindi_tagline": "वसूली विशेषज्ञ"}},
    {"id": "compliance-agent", "role_id": "compliance", "category": "new_agent", "title": "Compliance agent",
     "desc": "GST / TDS filing deadline watcher",
     "prompt": "Hire an agent to watch my GST and filing deadlines.",
     "runs_on": "nirmata",
     "agent_spec": {"name": "Compliance Agent", "goal": "Track GST/TDS filing deadlines and remind before due dates",
                    "tools": ["schedule_alert", "list_alerts"], "hindi_tagline": "कानूनी पहरेदार"}},

    # ---- presence / growth ----
    {"id": "digital-presence", "role_id": "digital_presence", "category": "presence", "title": "Digital presence agent",
     "desc": "Facebook Marketplace, IndiaMART, Shopify + SEO — one agent",
     "prompt": "I want to sell online. Hire an agent that publishes my products to Facebook "
               "Marketplace and IndiaMART, builds a web storefront, and keeps listings SEO-optimized.",
     "runs_on": "nirmata",
     "agent_spec": {"name": "Digital Presence Agent",
                    "goal": "Publish products to online marketplaces and keep listings SEO-optimized",
                    "tools": ["sync_catalog", "publish_listing", "seo_audit", "storefront_builder"],
                    "hindi_tagline": "ऑनलाइन पहचान"}},
    {"id": "catalog-builder", "category": "presence", "title": "Catalog builder",
     "desc": "Turn your products into a shareable catalog",
     "prompt": "Build me a shareable product catalog artifact.", "runs_on": "sourcer"},
]

_BY_ID = {t["id"]: t for t in TEMPLATES}


def get_template(template_id: str) -> dict | None:
    return _BY_ID.get(template_id)
