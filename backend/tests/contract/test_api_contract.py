"""Contract tests — API responses must match frontend/mocks/contract.json shapes.

If the backend drifts from the contract, this fails before the frontend does.
"""
import io
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

CONTRACT = json.loads(
    (Path(__file__).resolve().parents[3] / "frontend" / "mocks" / "contract.json").read_text(encoding="utf-8")
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _keys(obj):
    return set(obj.keys()) if isinstance(obj, dict) else set()


def _ep(name: str) -> dict:
    """contract keys carry a ' [EXISTS]'/' [TODO]' tag — strip it for lookup."""
    eps = CONTRACT["endpoints"]
    key = next((k for k in eps if k == name or k.startswith(name + " ")), None)
    assert key, f"endpoint {name} not in contract.json"
    return eps[key]


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert _keys(r.json()) >= _keys(_ep("GET /health")["response"])


def test_agents_shape(client):
    r = client.get("/agents", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list) and len(body) >= 3
    expected = _keys(_ep("GET /agents")["response"][0])
    assert _keys(body[0]) >= expected


def test_chat_shape(client):
    r = client.post("/chat", json={"tenant_id": "ramesh_auto", "text": "show overdue invoices"})
    assert r.status_code == 200
    expected = _keys(_ep("POST /chat")["response"])
    assert _keys(r.json()) >= expected


def test_invoices_shape(client):
    r = client.get("/invoices", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert "amount" in r.json()[0] and "status" in r.json()[0]


def test_alerts_shape(client):
    r = client.get("/alerts", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    assert all("status" in a and "title" in a for a in r.json())


def test_cashflow_shape(client):
    r = client.get("/cashflow", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    assert _keys(r.json()) >= {"receivables", "payables", "gaps"}


def test_upload_parse(client):
    r = client.post(
        "/upload",
        files={"file": ("invoice.jpg", b"\xff\xd8\xff\xe0fakejpeg", "image/jpeg")},
        data={"tenant_id": "ramesh_auto"},
    )
    assert r.status_code == 200
    body = r.json()
    assert _keys(body) >= {"file_id", "filename", "parsed"}
    assert _keys(body["parsed"]) >= {"invoice_no", "buyer", "amount", "due_date"}


def test_agents_preview_and_create(client):
    req = {"tenant_id": "ramesh_auto", "name": "T Agent", "goal": "g",
           "tools": ["list_carriers", "bogus_tool"]}
    prev = client.post("/agents/preview", json=req)
    assert prev.status_code == 200 and prev.json()["valid"] is True
    assert prev.json()["spec"]["tools"] == ["list_carriers"]  # bogus dropped

    created = client.post("/agents", json=req)
    assert created.status_code == 200
    assert created.json()["created_by"] == "factory"
    # and it shows up in /agents
    ids = [a["id"] for a in client.get("/agents").json()]
    assert created.json()["id"] in ids


def test_reminder_requires_approval(client):
    invs = client.get("/invoices", params={"status": "overdue"}).json()
    r = client.post(f"/invoices/{invs[0]['id']}/reminder")
    assert r.status_code == 200
    assert r.json()["requires_approval"] is True
    draft_id = r.json()["draft_id"]
    # approve → sent
    r2 = client.post(f"/alerts/{draft_id}/approve")
    assert r2.status_code == 200 and r2.json()["status"] == "sent"


# ---------- [TODO] endpoints ----------

def test_login(client):
    r = client.post("/auth/login", json={"name": "Ramesh Gupta", "business": "Ramesh Auto Components"})
    assert r.status_code == 200
    assert _keys(r.json()) >= _keys(_ep("POST /auth/login")["response"])


def test_dashboard_summary(client):
    r = client.get("/dashboard/summary", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    assert _keys(r.json()) >= _keys(_ep("GET /dashboard/summary")["response"])
    assert _keys(r.json()["receivables"]) >= {"total", "overdue_count", "overdue_total", "due_soon_total"}


def test_notifications_lifecycle(client):
    r = client.get("/notifications", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 1
    assert _keys(rows[0]) >= _keys(_ep("GET /notifications")["response"][0])
    n = next(n for n in rows if n["status"] == "unread")
    r2 = client.post(f"/notifications/{n['id']}/read", params={"tenant_id": "ramesh_auto"})
    assert r2.status_code == 200 and r2.json()["status"] == "read"


def test_tasks_lifecycle(client):
    r = client.get("/tasks", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200 and isinstance(r.json(), list)
    assert _keys(r.json()[0]) >= _keys(_ep("GET /tasks")["response"][0])
    c = client.post("/tasks", json={"tenant_id": "ramesh_auto", "title": "List overdue invoices",
                                    "agent_id": "vasool", "due": "2026-09-22"})
    assert c.status_code == 200
    tid = c.json()["id"]
    run = client.post(f"/tasks/{tid}/run", params={"tenant_id": "ramesh_auto"})
    assert run.status_code == 200
    assert _keys(run.json()) >= _keys(_ep("POST /tasks/{id}/run")["response"])
    assert run.json()["status"] == "done" and run.json()["agent_name"] == "vasool"


def test_agent_detail_and_context(client):
    d = client.get("/agents/vasool", params={"tenant_id": "ramesh_auto"})
    assert d.status_code == 200
    assert _keys(d.json()) >= _keys(_ep("GET /agents/{id}")["response"])
    ctx = client.get("/agents/vasool/context", params={"tenant_id": "ramesh_auto"})
    assert ctx.status_code == 200
    assert "invoice_summary" in ctx.json() and "top_defaulters" in ctx.json()


def test_calendar_events(client):
    r = client.get("/calendar/events", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 1
    assert _keys(rows[0]) >= _keys(_ep("GET /calendar/events?from=&to=")["response"][0])
    assert {e["kind"] for e in rows} >= {"invoice_due", "alert", "task"}


def test_connectors_flow(client):
    r = client.get("/connectors", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    rows = r.json()
    assert _keys(rows[0]) >= _keys(_ep("GET /connectors")["response"][0])
    c = client.post("/connectors/google_calendar/connect", params={"tenant_id": "ramesh_auto"})
    assert c.status_code == 200 and c.json()["status"] == "connected"
    s = client.get("/connectors/airtable/sync", params={"tenant_id": "ramesh_auto"})
    assert s.status_code == 200 and s.json()["state"] == "ok"
    d = client.post("/connectors/google_calendar/disconnect", params={"tenant_id": "ramesh_auto"})
    assert d.status_code == 200 and d.json()["status"] == "available"


def test_settings_roundtrip(client):
    g = client.get("/settings", params={"tenant_id": "ramesh_auto"})
    assert g.status_code == 200
    assert _keys(g.json()) >= _keys(_ep("GET /settings")["response"])
    p = client.patch("/settings", json={"tenant_id": "ramesh_auto",
                                        "prefs": {"reminder_cadence_days": 5}})
    assert p.status_code == 200 and p.json()["status"] == "saved"
    g2 = client.get("/settings", params={"tenant_id": "ramesh_auto"})
    assert g2.json()["prefs"]["reminder_cadence_days"] == 5


# ---------- Round 2 endpoints ----------

def _make_xlsx() -> bytes:
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.append(["Invoice No", "Buyer", "Amount", "Due Date", "GST"])
    ws.append(["INV-9001", "Kapil Auto", 12400, "2026-10-02", 2232])
    ws.append(["INV-9002", "Metro Spares", "₹8,500", "2026-09-01", None])  # overdue + rupee fmt
    ws.append([None, "", None, None, None])       # blank → skipped
    ws.append(["INV-9003", "", 5000, "2026-10-10", None])  # no buyer → skipped
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_import_excel(client):
    r = client.post("/import/excel",
                    files={"file": ("ledger.xlsx", _make_xlsx(),
                                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                    data={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    body = r.json()
    assert _keys(body) >= _keys(_ep("POST /import/excel")["response"])
    assert body["imported"] == 2 and body["skipped"] == 1  # blank row ignored, no-buyer skipped
    assert body["sample"][0]["buyer"] == "Kapil Auto"


def test_memories_lifecycle(client):
    r = client.get("/memories", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200 and isinstance(r.json(), list)
    assert _keys(r.json()[0]) >= _keys(_ep("GET /memories?tenant_id=")["response"][0])
    add = client.post("/memories", json={"tenant_id": "ramesh_auto",
                                         "text": "Test buyer pays on time", "source": "owner"})
    assert add.status_code == 200 and add.json()["status"] == "saved"
    mid = add.json()["id"]
    assert any(m["id"] == mid for m in client.get("/memories").json())
    d = client.delete(f"/memories/{mid}", params={"tenant_id": "ramesh_auto"})
    assert d.status_code == 200 and d.json()["status"] == "deleted"


def test_memory_injected_into_agent(client):
    """Memory is real: a fresh memory shows up when the agent recalls context."""
    client.post("/memories", json={"tenant_id": "ramesh_auto",
                                   "text": "Zephyr Traders is our VIP — always priority"})
    r = client.post("/chat", json={"tenant_id": "ramesh_auto", "agent_id": "vasool",
                                   "text": "what do you remember about Zephyr?"})
    assert r.status_code == 200
    assert "zephyr" in r.json()["reply"].lower()


def test_artifacts_lifecycle(client):
    created = client.post("/artifacts", json={
        "tenant_id": "ramesh_auto", "title": "Tracking — ORD-1", "template": "tracking_page",
        "data": {"order_id": "ORD-1", "carrier": "SafeRoad", "from": "Ludhiana",
                 "to": "Faridabad", "status": "in_transit", "progress_pct": 40}})
    assert created.status_code == 200
    aid = created.json()["id"]
    assert created.json()["share_path"] == f"/a/{aid}"
    lst = client.get("/artifacts", params={"tenant_id": "ramesh_auto"})
    assert _keys(lst.json()[0]) >= _keys(_ep("GET /artifacts?tenant_id=")["response"][0])
    got = client.get(f"/artifacts/{aid}", params={"tenant_id": "ramesh_auto"})
    assert got.status_code == 200
    assert _keys(got.json()) >= _keys(_ep("GET /artifacts/{id}")["response"])
    assert got.json()["data"]["order_id"] == "ORD-1"


def test_artifact_validation_rejects_bad_template(client):
    bad = client.post("/artifacts", json={"tenant_id": "ramesh_auto", "title": "x",
                                          "template": "tracking_page", "data": {"carrier": "X"}})
    assert bad.status_code == 422  # missing required order_id/to/status


def test_search_grouped(client):
    r = client.get("/search", params={"q": "sharma", "tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    body = r.json()
    assert _keys(body) >= {"q", "results"}
    assert _keys(body["results"]) >= _keys(_ep("GET /search?q=&tenant_id=")["response"]["results"])
    assert len(body["results"]["invoices"]) >= 1  # Sharma Motors invoices
    assert client.get("/search", params={"q": ""}).json()["results"]["invoices"] == []


# ---------- Phase A: people / logs / brief ----------

def test_people_aggregation(client):
    r = client.get("/people", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    body = r.json()
    assert _keys(body) >= _keys(_ep("GET /people?tenant_id=")["response"])
    assert _keys(body["summary"]) >= {"customers", "suppliers", "carriers", "outstanding"}
    assert len(body["customers"]) >= 1
    assert _keys(body["customers"][0]) >= {"name", "invoices", "outstanding", "defaulter"}
    # Om Sai Traders is 111 days overdue in seed → defaulter
    assert any(c["defaulter"] for c in body["customers"])


def test_logs(client):
    r = client.get("/logs", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200 and isinstance(r.json(), list)
    assert _keys(r.json()[0]) >= {"kind", "text", "ts"}


def test_dashboard_brief(client):
    r = client.get("/dashboard/summary", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    brief = r.json()["brief"]
    assert isinstance(brief, list) and len(brief) >= 1
    assert _keys(brief[0]) >= {"icon", "title", "detail", "ref"}


# ---------- Phase B: business context / document brain ----------

def test_context_note_lifecycle(client):
    up = client.post("/context/upload", data={"tenant_id": "ramesh_auto",
        "text": "Zenith Traders always disputes GST — attach HSN codes on every invoice"})
    assert up.status_code == 200
    body = up.json()
    assert _keys(body) >= _keys(_ep("POST /context/upload")["response"])
    assert body["status"] == "fed_to_agents" and "tax" in body["tags"]  # gst/hsn → tax
    did = body["id"]
    lst = client.get("/context", params={"tenant_id": "ramesh_auto"})
    assert any(d["id"] == did for d in lst.json())
    # content search finds it (substring path, offline-safe)
    s = client.get("/search", params={"q": "zenith", "tenant_id": "ramesh_auto"})
    assert any(d["id"] == did for d in s.json()["results"]["documents"])
    d = client.delete(f"/context/{did}", params={"tenant_id": "ramesh_auto"})
    assert d.status_code == 200 and d.json()["status"] == "deleted"


def test_context_excel_upload(client):
    up = client.post("/context/upload",
        files={"file": ("suppliers.xlsx", _make_xlsx(),
               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"tenant_id": "ramesh_auto"})
    assert up.status_code == 200
    assert up.json()["kind"] == "spreadsheet"


def test_context_fed_to_agent(client):
    client.post("/context/upload", data={"tenant_id": "ramesh_auto",
        "text": "Peacock Industries is our largest export buyer — handle with priority"})
    r = client.post("/chat", json={"tenant_id": "ramesh_auto", "agent_id": "vasool",
                                   "text": "what do you know about Peacock?"})
    assert r.status_code == 200
    assert "peacock" in r.json()["reply"].lower()


# ---------- Phase C: templates catalog + install ----------

def test_templates_catalog(client):
    r = client.get("/templates", params={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 8
    assert _keys(rows[0]) >= _keys(_ep("GET /templates?tenant_id=")["response"][0])
    cats = {t["category"] for t in rows}
    assert cats >= {"money", "procurement", "logistics", "new_agent", "presence"}
    assert any(t["id"] == "digital-presence" and t["runs_on"] == "nirmata" for t in rows)


def test_install_agent_template(client):
    before = {a["id"] for a in client.get("/agents").json()}
    r = client.post("/templates/collections-agent/install", json={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    assert r.json()["created_by"] == "factory"
    after = {a["id"] for a in client.get("/agents").json()}
    assert r.json()["id"] in after and len(after) > len(before)


def test_install_factory_template_returns_prompt(client):
    r = client.post("/templates/digital-presence/install", json={"tenant_id": "ramesh_auto"})
    assert r.status_code == 200
    assert r.json()["status"] == "needs_factory" and r.json()["prompt"]


# ---------- Round 4: onboarding ----------

def test_onboarding_autohire(client):
    before = {a["id"] for a in client.get("/agents").json()}
    r = client.post("/onboarding", json={
        "tenant_id": "ramesh_auto",
        "business": {"name": "Ramesh Auto Components", "city": "Faridabad"},
        "prefs": {"language": "hinglish", "credit_terms_days": 45},
        "pains": ["late_payments", "no_online_presence"],
        "slow_payers": ["Verma Traders"], "rules": ["Big orders via GST invoice only"],
        "tools_today": ["excel"], "auto_hire": True})
    assert r.status_code == 200
    body = r.json()
    assert _keys(body) >= _keys(_ep("POST /onboarding")["response"])
    assert body["onboarded"] is True and body["memories_created"] >= 2
    # late_payments (tool-backed) → installed; no_online_presence (no tools) → suggested
    assert len(body["agents_installed"]) >= 1
    assert any(s["template_id"] == "digital-presence" for s in body["suggested_agents"])
    assert any(a["id"] not in before for a in body["agents_installed"])
    # settings persisted + memory searchable
    assert client.get("/settings").json()["prefs"]["credit_terms_days"] == 45
    assert any("verma" in m["text"].lower() for m in client.get("/memories").json())


def test_onboarding_suggest_only(client):
    r = client.post("/onboarding", json={"tenant_id": "ramesh_auto",
        "pains": ["late_payments", "gst"], "auto_hire": False})
    assert r.status_code == 200
    assert r.json()["agents_installed"] == []
    assert len(r.json()["suggested_agents"]) >= 2
