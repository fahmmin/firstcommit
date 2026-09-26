"""D2 golden evals — routing, retrieval grounding, gating, tracing.

Deterministic in mock mode (part of CI). The same golden set is scored in either
mode by `simulation/evals.py` (which prints a scorecard and tolerates LLM variance).
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

# query → the specialist the orchestrator should route to
ROUTING_GOLDEN = [
    ("show my overdue invoices", "vasool"),
    ("compare steel suppliers for me", "sourcer"),
    ("should I take a 90 day terms order", "khata"),
    ("mera transporter nahi aaya, order stranded", "nirmata"),
]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        c.post("/demo/reset", params={"tenant_id": "ramesh_auto"})
        yield c


@pytest.mark.parametrize("query,expected", ROUTING_GOLDEN)
def test_routing_golden(client, query, expected):
    r = client.post("/chat", json={"tenant_id": "ramesh_auto", "text": query}).json()
    assert r["agent_name"] == expected, f"{query!r} → {r['agent_name']} (want {expected})"


def test_retrieval_grounding(client):
    client.post("/context/upload", data={"tenant_id": "ramesh_auto",
        "text": "Orion Steel offers HR coil at Rs 61/kg with a 400kg minimum order."})
    body = client.get("/search", params={"q": "Orion Steel HR coil price", "tenant_id": "ramesh_auto"}).json()
    docs = body["results"]["documents"]
    assert docs and any("orion" in d.get("snippet", "").lower() for d in docs)
    assert all("score" in d for d in docs)  # cited + scored


def test_tracing_usage_and_metrics(client):
    r = client.post("/chat", json={"tenant_id": "ramesh_auto", "text": "show overdue invoices"}).json()
    assert "usage" in r and {"tools", "total_tokens", "cost_usd", "latency_ms"} <= set(r["usage"])
    m = client.get("/metrics", params={"tenant_id": "ramesh_auto"}).json()
    assert m["runs"] >= 1 and "by_tool" in m and "est_cost_usd" in m
