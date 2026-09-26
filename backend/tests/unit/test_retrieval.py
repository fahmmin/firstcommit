"""B1 retrieval — chunking, keyword/hybrid scoring, rerank, cited search."""
import pytest

from app import deps
from app.tools.retrieval import (build_chunks, chunk_text, keyword_score,
                                 search_documents, tokens)


def test_chunking_splits_and_caps():
    text = "\n\n".join(f"Paragraph {i} about brake pads and GST invoices." for i in range(40))
    chunks = chunk_text(text, size=200, overlap=40)
    assert len(chunks) >= 2
    assert all(len(c) <= 260 for c in chunks)  # size + a little slack
    assert len(build_chunks("short note", embed=False)) == 1


def test_keyword_score_ranks_relevant_higher():
    q = tokens("overdue GST invoice for Sharma")
    hi = keyword_score(q, "This is the overdue GST invoice for Sharma Motors, amount due.")
    lo = keyword_score(q, "A generic invoice template, nothing else.")  # only 'invoice' overlaps
    assert 0 < lo < hi <= 1.0
    assert keyword_score(q, "A rubber gasket delivery note.") == 0.0  # no overlap → 0
    assert keyword_score(q, "") == 0.0


@pytest.fixture
def ctx(tenant):
    # tenant fixture seeds the store + deps; add two docs to retrieve over
    deps.store.put_document(tenant, {
        "id": "d-gst", "filename": "GST_Registration.pdf", "tags": ["tax", "legal"],
        "summary": "GST registration certificate", "kind": "pdf",
        "chunks": [{"i": 0, "text": "GSTIN 06ABCDE1234F1Z5 registered for Ramesh Hardware, "
                    "HSN codes apply to all export invoices.", "embedding": None}]})
    deps.store.put_document(tenant, {
        "id": "d-rate", "filename": "Supplier_Rates.xlsx", "tags": ["procurement"],
        "summary": "supplier rate list", "kind": "spreadsheet",
        "chunks": [{"i": 0, "text": "Balaji Steel coils at Rs 62 per kg, MOQ 500.",
                    "embedding": None}]})
    return tenant


def _rank(hits, filename):
    names = [h["filename"] for h in hits]
    return names.index(filename) if filename in names else 999


def test_search_documents_hybrid_and_citation(ctx):
    hits = search_documents(ctx, "what is our GSTIN and HSN rule?", k=8)
    assert hits, "expected at least one document hit"
    gst = next((h for h in hits if h["filename"] == "GST_Registration.pdf"), None)
    assert gst, "GST doc should be retrieved"
    assert "gst" in gst["snippet"].lower() or "hsn" in gst["snippet"].lower()  # cited chunk
    assert "rerank_score" in gst                                                # reranked
    assert _rank(hits, "GST_Registration.pdf") < _rank(hits, "Supplier_Rates.xlsx")


def test_search_documents_offline_is_keyword_not_noop(ctx):
    # no embeddings present → keyword path must still rank the rate list above the GST doc
    hits = search_documents(ctx, "Balaji Steel rate per kg", k=8)
    assert _rank(hits, "Supplier_Rates.xlsx") < _rank(hits, "GST_Registration.pdf")


def test_search_documents_empty_query():
    assert search_documents("nobody", "", k=4) == []
