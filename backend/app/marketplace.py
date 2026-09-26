"""Curated MCP catalogue for the Marketplace (GET /marketplace).

Honest by construction: no install counts, and no endpoint URLs we can't vouch
for — every remote MCP server is operated by its vendor, so the owner pastes
the URL their provider gives them. "Add" saves it to settings.mcp_servers and
"Test" performs a real handshake (mcp/client.py test_server), so the status the
UI shows is always the server's actual answer.
"""
from __future__ import annotations

MCP_CATALOG: list[dict] = [
    {"id": "google-sheets", "name": "Google Sheets", "icon": "sheets", "category": "data",
     "desc": "Read/write your registers as agent tools.",
     "url_hint": "Remote MCP endpoint from your Sheets MCP provider"},
    {"id": "google-drive", "name": "Google Drive", "icon": "google_drive", "category": "storage",
     "desc": "Search and read Drive files as agent context.",
     "url_hint": "Remote MCP endpoint from your Drive MCP provider"},
    {"id": "gmail", "name": "Gmail", "icon": "gmail", "category": "messaging",
     "desc": "Search the inbox and draft replies (sends still need approval).",
     "url_hint": "Remote MCP endpoint from your Gmail MCP provider"},
    {"id": "whatsapp", "name": "WhatsApp Business", "icon": "whatsapp", "category": "messaging",
     "desc": "Read and draft WhatsApp Business messages.",
     "url_hint": "Remote MCP endpoint from your WhatsApp Business provider"},
    {"id": "razorpay", "name": "Razorpay", "icon": "razorpay", "category": "payments",
     "desc": "Payment links and settlement lookups.",
     "url_hint": "Remote MCP endpoint from your Razorpay integration"},
    {"id": "shopify", "name": "Shopify", "icon": "shopify", "category": "commerce",
     "desc": "Products and orders on your storefront.",
     "url_hint": "Remote MCP endpoint from your Shopify app"},
    {"id": "zapier", "name": "Zapier", "icon": "zapier", "category": "automation",
     "desc": "Bridge to thousands of apps via your Zapier MCP actions.",
     "url_hint": "Your personal Zapier MCP server URL"},
    {"id": "custom", "name": "Any MCP server", "icon": "mcp", "category": "custom",
     "desc": "Any remote MCP server over streamable HTTP or SSE.",
     "url_hint": "https://…/mcp (or …/sse)"},
]
