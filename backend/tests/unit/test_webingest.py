"""C1 web/RSS connector — parsing + keyless ingest into the context brain."""
from app import deps
from app.tools.webingest import _html_to_text, _parse_rss, ingest_content
from app.tools.retrieval import search_documents

RSS = """<?xml version="1.0"?><rss version="2.0"><channel>
<title>Steel Market</title>
<item><title>Steel prices rise 4% in Ludhiana</title>
<description>Hot-rolled coil up to Rs 64/kg amid demand.</description></item>
<item><title>New GST e-invoice rule for exporters</title>
<description>HSN codes now mandatory on all export invoices.</description></item>
</channel></rss>"""

HTML = "<html><head><style>x{}</style></head><body><h1>Rate List</h1>" \
       "<p>Brake pads Rs 45, gaskets Rs 30.</p><script>evil()</script></body></html>"


def test_html_to_text_strips_tags_and_scripts():
    t = _html_to_text(HTML)
    assert "Rate List" in t and "Brake pads" in t
    assert "evil" not in t and "<" not in t


def test_parse_rss_extracts_items():
    items = _parse_rss(RSS)
    assert len(items) == 2
    assert items[0]["title"].startswith("Steel prices")
    assert "64/kg" in items[0]["summary"]


def test_ingest_content_rss_creates_searchable_docs(tenant):
    before = len(deps.store.list_documents(tenant))
    n = ingest_content(tenant, "https://news.example.com/feed", RSS, "application/rss+xml")
    assert n == 2 and len(deps.store.list_documents(tenant)) == before + 2
    hits = search_documents(tenant, "GST e-invoice HSN export rule", k=5)
    assert any("gst" in h["snippet"].lower() or "hsn" in h["snippet"].lower() for h in hits)


def test_ingest_content_html_single_page(tenant):
    before = len(deps.store.list_documents(tenant))
    n = ingest_content(tenant, "https://shop.example.com/rates", HTML, "text/html")
    assert n == 1 and len(deps.store.list_documents(tenant)) == before + 1
    hits = search_documents(tenant, "brake pads rate", k=5)
    assert any("brake" in h["snippet"].lower() for h in hits)
