"""FastAPI surface — shapes enforced by tests/contract against mocks/contract.json."""
from __future__ import annotations

import json
import os
import re
import shutil
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import deps
from .agents import registry as reg
from .agents.specs import ALL_TOOL_NAMES, TOOL_REGISTRY, AgentSpec
from .notifier import get_notifier
from .scheduler import run_once as scheduler_run_once, start as scheduler_start
from .store import DATA_DIR, get_store
from .tools.artifacts import TEMPLATES, create_artifact_impl
from .tools.comms import send_alert_impl
from .tools.documents import cosine, embed_text, ingest_document_impl
from .tools.importer import import_excel_impl
from .tools.invoices import create_invoice_impl, draft_reminder_impl, parse_invoice_file

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
SEED_PATH = Path(__file__).resolve().parent / "seed" / "seed.json"

app = FastAPI(title="Sahayak AI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    deps.init_deps(get_store(), get_notifier())
    if not deps.store.list_invoices("ramesh_auto"):
        _load_seed("ramesh_auto")
    scheduler_start()


def _load_seed(tenant_id: str):
    seed = json.loads(SEED_PATH.read_text())
    deps.store.reset(tenant_id, seed)


class ChatReq(BaseModel):
    tenant_id: str = "ramesh_auto"
    text: str
    agent_id: str | None = None


class SpecReq(BaseModel):
    tenant_id: str = "ramesh_auto"
    name: str
    goal: str
    tools: list[str]
    hindi_tagline: str = ""


@app.get("/health")
def health():
    model = "bedrock" if os.getenv("USE_AWS", "0") == "1" else "mock"
    return {"status": "ok", "use_aws": os.getenv("USE_AWS", "0") == "1", "model": model}


def _invoke(agent, text: str):
    """Nova occasionally emits an invalid ToolUse stream — one retry absorbs it."""
    try:
        return agent(text)
    except Exception as e:
        if "ToolUse" in str(e) or "modelStreamError" in type(e).__name__:
            return agent(text)
        raise


@app.post("/chat")
def chat(req: ChatReq):
    registry = reg.get_registry(req.tenant_id)
    actions: list[dict] = []
    token = deps.current_actions.set(actions)
    try:
        if req.agent_id:
            agent = registry.get_agent(req.agent_id)
            if not agent:
                raise HTTPException(404, f"unknown agent {req.agent_id}")
            result = _invoke(agent, req.text)
            agent_name = req.agent_id
            registry.bump_stats(req.agent_id)
        else:
            agent = registry.orchestrator()
            result = _invoke(agent, req.text)
            tool_names = list(result.metrics.tool_metrics.keys()) if result.metrics else []
            agent_name = tool_names[-1] if tool_names else "sahayak"
    finally:
        deps.current_actions.reset(token)

    spec = registry.get_spec(agent_name) or {}
    trace = ["sahayak"] + ([agent_name] if agent_name != "sahayak" else [])
    reply = re.sub(r"</?(thinking|response)>.*?</(thinking|response)>|</?(thinking|response)>", "", str(result), flags=re.DOTALL).strip()
    return {
        "reply": reply,
        "agent_name": agent_name,
        "agent_tagline": spec.get("hindi_tagline", ""),
        "actions": actions,
        "trace": trace,
    }


@app.get("/agents")
def agents(tenant_id: str = "ramesh_auto"):
    return reg.get_registry(tenant_id).specs()


@app.post("/agents/preview")
def preview_agent(req: SpecReq):
    tools = [t for t in req.tools if t in ALL_TOOL_NAMES]
    warnings = [f"dropped unknown tools: {sorted(set(req.tools) - set(tools))}"] if len(tools) != len(req.tools) else []
    if not tools:
        warnings.append("no valid tools — agent would be useless")
    return {
        "valid": bool(tools),
        "spec": {"name": req.name, "goal": req.goal, "tools": tools,
                 "hindi_tagline": req.hindi_tagline,
                 "guardrails": {"allowed_tools": tools, "max_action": "draft_only"}},
        "warnings": warnings,
    }


@app.post("/agents")
def create_agent(req: SpecReq):
    spec = reg.get_registry(req.tenant_id).create_spec(
        name=req.name, goal=req.goal, tools=req.tools, hindi_tagline=req.hindi_tagline
    )
    return {"id": spec["id"], "status": spec["status"], "created_by": spec["created_by"], "spec": spec}


@app.post("/upload")
async def upload(file: UploadFile = File(...), tenant_id: str = Form("ramesh_auto")):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_id = f"f-{uuid.uuid4().hex[:6]}"
    dest = UPLOAD_DIR / f"{file_id}_{file.filename}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    parsed = parse_invoice_file(str(dest))
    inv = create_invoice_impl(
        tenant_id, buyer=parsed["buyer"], amount=parsed["amount"],
        due_date=parsed["due_date"], items=parsed.get("items", ""),
        invoice_no=parsed.get("invoice_no", ""), gst=parsed.get("gst"),
    )
    deps.log_activity(tenant_id, "invoice_parsed",
                      f"Invoice {inv['invoice_no']} parsed from photo → ledger")
    return {
        "file_id": file_id, "filename": file.filename, "parsed": parsed,
        "invoice": inv, "low_confidence_fields": parsed.get("low_confidence_fields", []),
    }


@app.get("/invoices")
def invoices(tenant_id: str = "ramesh_auto", status: str | None = None):
    return deps.store.list_invoices(tenant_id, status=status)


@app.post("/invoices/{invoice_id}/reminder")
def reminder(invoice_id: str, tenant_id: str = "ramesh_auto", channel: str = "email"):
    result = draft_reminder_impl(tenant_id, invoice_id=invoice_id)
    if "draft" not in result:
        raise HTTPException(404, result["reply"])
    return {
        "draft_id": result["draft"]["id"], "status": "draft",
        "body": result["draft"]["body"], "requires_approval": True,
    }


@app.get("/suppliers")
def suppliers(tenant_id: str = "ramesh_auto", q: str | None = None):
    return deps.store.list_suppliers(tenant_id, q=q)


@app.get("/carriers")
def carriers(tenant_id: str = "ramesh_auto", to: str | None = None):
    return deps.store.list_carriers(tenant_id, to=to)


@app.get("/alerts")
def alerts(tenant_id: str = "ramesh_auto", status: str | None = None):
    return deps.store.list_alerts(tenant_id, status=status)


@app.post("/alerts/{alert_id}/approve")
def approve_alert(alert_id: str, tenant_id: str = "ramesh_auto"):
    a = next((x for x in deps.store.list_alerts(tenant_id) if x["id"] == alert_id), None)
    if not a:
        raise HTTPException(404, "no such alert")
    result = send_alert_impl(tenant_id, alert_id)
    return {"id": alert_id, "status": "sent", "via": result.get("message", {}).get("via", "console")}


@app.get("/cashflow")
def cashflow(tenant_id: str = "ramesh_auto"):
    receivables = [
        {"buyer": r["buyer"], "amount": r["amount"], "expected": r["due_date"]}
        for r in deps.store.list_invoices(tenant_id)
        if r.get("status") in ("sent", "due_soon", "overdue")
    ]
    payables = deps.store.list_payables(tenant_id)
    total_in = sum(r["amount"] for r in receivables)
    total_out = sum(p["amount"] for p in payables)
    return {
        "receivables": receivables, "payables": payables,
        "gaps": ([{"period": "next 30d", "shortfall": total_out - total_in,
                   "reason": "90-day buyer terms vs 30-day supplier terms"}]
                 if total_out > total_in else []),
        "total_in": total_in, "total_out": total_out,
    }


@app.post("/scheduler/run")
def run_scheduler(tenant_id: str = "ramesh_auto"):
    return {"moved": scheduler_run_once(tenant_id)}


@app.get("/sent")
def sent_messages():
    f = DATA_DIR / "sent_messages.json"
    return json.loads(f.read_text()) if f.exists() else []


@app.post("/demo/reset")
def demo_reset(tenant_id: str = "ramesh_auto"):
    _load_seed(tenant_id)
    # wipe sessions + factory-created agents so the demo is repeatable
    sessions = DATA_DIR / "sessions"
    if sessions.exists():
        shutil.rmtree(sessions)
    if os.getenv("USE_AWS", "0") == "1":
        try:
            import boto3
            s3 = boto3.Session(
                profile_name=os.getenv("AWS_PROFILE") or None,
                region_name=os.getenv("AWS_REGION", "us-east-1"),
            ).client("s3")
            bucket = os.getenv("S3_BUCKET", "sahayak-sessions")
            objs = s3.list_objects_v2(Bucket=bucket).get("Contents", [])
            if objs:
                s3.delete_objects(Bucket=bucket, Delete={"Objects": [{"Key": o["Key"]} for o in objs]})
        except Exception as e:
            print(f"[demo/reset] S3 session wipe failed: {e}")
    reg.reset_registries()
    return {"status": "reseeded", "tenants": [tenant_id]}


# ================= [TODO] surface — contract.json-tagged endpoints =================


class LoginReq(BaseModel):
    name: str = "Ramesh Gupta"
    business: str = "Ramesh Auto Components"
    provider: str = "guest"
    provider_id: str | None = None


@app.post("/auth/login")
def login(req: LoginReq):
    """Demo login — provider adapters are client-side; this resolves tenant + token."""
    s = deps.store.get_settings("ramesh_auto") or {}
    biz = s.get("business", {})
    slug = re.sub(r"[^a-z0-9]+", "", (req.provider_id or req.name).lower())[:12] or "user"
    return {
        "token": f"demo-tok-{slug}",
        "tenant_id": "ramesh_auto",
        "user": {"name": req.name, "business": req.business,
                 "city": biz.get("city", ""), "line": biz.get("line", "")},
        "onboarded": bool(s.get("onboarded", True)),
    }


@app.get("/dashboard/summary")
def dashboard_summary(tenant_id: str = "ramesh_auto"):
    invoices = deps.store.list_invoices(tenant_id)
    open_inv = [i for i in invoices if i.get("status") in ("sent", "due_soon", "overdue")]
    overdue = [i for i in invoices if i.get("status") == "overdue"]
    due_soon = [i for i in invoices if i.get("status") == "due_soon"]
    horizon = (date.today() + timedelta(days=30)).isoformat()
    payables = deps.store.list_payables(tenant_id)
    specs = reg.get_registry(tenant_id).specs()
    pending = deps.store.list_alerts(tenant_id, status="pending_approval")
    bookings = [a for a in pending if a.get("kind") == "booking"]

    # "N things need you" — the morning-brief card
    brief: list[dict] = []
    if overdue:
        brief.append({"icon": "receipt", "kind": "overdue",
                      "title": f"{len(overdue)} invoices overdue",
                      "detail": f"₹{sum(i['amount'] for i in overdue):,} locked", "ref": "#/app"})
    if pending:
        brief.append({"icon": "bell", "kind": "approval",
                      "title": f"{len(pending)} action{'s' if len(pending) != 1 else ''} waiting for your approval",
                      "detail": "drafted overnight — nothing sent yet", "ref": "#/notifications"})
    if bookings:
        brief.append({"icon": "truck", "kind": "shipment",
                      "title": "Shipments on the move",
                      "detail": f"{len(bookings)} pickup{'s' if len(bookings) != 1 else ''} awaiting confirmation",
                      "ref": "#/calendar"})

    return {
        "receivables": {
            "total": sum(i["amount"] for i in open_inv),
            "overdue_count": len(overdue),
            "overdue_total": sum(i["amount"] for i in overdue),
            "due_soon_total": sum(i["amount"] for i in due_soon),
        },
        "capital_locked_long_terms": sum(i["amount"] for i in open_inv if i.get("terms_days", 30) >= 60),
        "payables_due_30d": sum(p["amount"] for p in payables if p.get("due", "9999") <= horizon),
        "pending_approvals": len(pending),
        "agents": {"total": len(specs),
                   "ai_hired": sum(1 for s in specs if s.get("created_by") == "factory")},
        "alerts_unread": sum(1 for n in deps.store.list_notifications(tenant_id)
                             if n.get("status") == "unread"),
        "brief": brief,
        "recent_activity": deps.store.list_activity(tenant_id, limit=10),
    }


@app.get("/notifications")
def notifications(tenant_id: str = "ramesh_auto"):
    rows = deps.store.list_notifications(tenant_id)
    rows.sort(key=lambda n: n.get("created_at", ""), reverse=True)
    return rows


@app.post("/notifications/{note_id}/read")
def read_notification(note_id: str, tenant_id: str = "ramesh_auto"):
    n = deps.store.update_notification(tenant_id, note_id, status="read")
    if not n:
        raise HTTPException(404, "no such notification")
    return {"id": note_id, "status": "read"}


class TaskReq(BaseModel):
    tenant_id: str = "ramesh_auto"
    title: str
    agent_id: str = ""
    due: str = ""
    details: str = ""


@app.get("/tasks")
def tasks(tenant_id: str = "ramesh_auto", status: str | None = None):
    return deps.store.list_tasks(tenant_id, status=status)


@app.post("/tasks")
def create_task(req: TaskReq):
    t = deps.store.put_task(req.tenant_id, {
        "id": f"task-{uuid.uuid4().hex[:6]}", "title": req.title,
        "agent_id": req.agent_id, "status": "todo", "due": req.due,
        "details": req.details,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"id": t["id"], "status": t["status"]}


@app.post("/tasks/{task_id}/run")
def run_task(task_id: str, tenant_id: str = "ramesh_auto"):
    t = deps.store.get_task(tenant_id, task_id)
    if not t:
        raise HTTPException(404, "no such task")
    registry = reg.get_registry(tenant_id)
    agent_id = t.get("agent_id") or "sahayak"
    agent = registry.orchestrator() if agent_id == "sahayak" else registry.get_agent(agent_id)
    if not agent:
        raise HTTPException(404, f"unknown agent {agent_id}")
    actions: list[dict] = []
    token = deps.current_actions.set(actions)
    try:
        prompt = f"Task for you: {t['title']}."
        if t.get("details"):
            prompt += f" Details: {t['details']}."
        result = _invoke(agent, prompt)
        reply = re.sub(r"</?(thinking|response)>.*?</(thinking|response)>|</?(thinking|response)>", "", str(result), flags=re.DOTALL).strip()
    finally:
        deps.current_actions.reset(token)
    deps.store.update_task(tenant_id, task_id, status="done", result=reply)
    registry.bump_stats(agent_id)
    deps.log_activity(tenant_id, "task_completed", f"{agent_id} finished '{t['title']}'")
    return {"task_id": task_id, "status": "done", "agent_name": agent_id,
            "result": reply, "actions": actions}


@app.get("/agents/{agent_id}")
def agent_detail(agent_id: str, tenant_id: str = "ramesh_auto"):
    spec = reg.get_registry(tenant_id).get_spec(agent_id)
    if not spec:
        raise HTTPException(404, "unknown agent")
    return spec


@app.get("/agents/{agent_id}/context")
def agent_context(agent_id: str, tenant_id: str = "ramesh_auto"):
    """Contextual right-sidebar payload — shape varies by the agent's tool set."""
    spec = reg.get_registry(tenant_id).get_spec(agent_id)
    if not spec:
        raise HTTPException(404, "unknown agent")
    tools = spec.get("tools", [])
    if "list_overdue" in tools:  # receivables specialist (vasool et al.)
        invoices = deps.store.list_invoices(tenant_id)
        open_inv = [i for i in invoices if i.get("status") in ("sent", "due_soon", "overdue")]
        overdue = sorted((i for i in invoices if i.get("status") == "overdue"),
                         key=lambda r: r.get("days_overdue", 0), reverse=True)
        return {
            "invoice_summary": {
                "total_outstanding": sum(i["amount"] for i in open_inv),
                "overdue_total": sum(i["amount"] for i in overdue),
                "oldest_overdue_days": overdue[0].get("days_overdue", 0) if overdue else 0,
            },
            "capital_locked_90d": sum(i["amount"] for i in open_inv if i.get("terms_days", 30) >= 60),
            "top_defaulters": [{"buyer": i["buyer"], "amount": i["amount"],
                                "days": i.get("days_overdue", 0)} for i in overdue[:3]],
            "recent_invoices": sorted(invoices, key=lambda r: r.get("issue_date", ""),
                                      reverse=True)[:5],
        }
    if "list_carriers" in tools:  # logistics-type (factory-hired)
        carriers = deps.store.list_carriers(tenant_id)
        cheapest = min(carriers, key=lambda c: c["rate_per_kg"], default=None)
        bookings = [a for a in deps.store.list_alerts(tenant_id) if a.get("kind") == "booking"]
        return {
            "carriers_available": len(carriers),
            "cheapest_route": {"name": cheapest["name"], "rate_per_kg": cheapest["rate_per_kg"]}
                              if cheapest else None,
            "pending_bookings": sum(1 for b in bookings if b.get("status") == "pending_approval"),
            "recent_bookings": bookings[:5],
        }
    return {"tools": tools, "recent_actions": deps.store.list_activity(tenant_id, limit=5)}


@app.get("/calendar/events")
def calendar_events(tenant_id: str = "ramesh_auto",
                    start: str | None = Query(None, alias="from"),
                    end: str | None = Query(None, alias="to")):
    """Unified feed: open invoice dues + scheduled alerts + task deadlines."""
    events: list[dict] = []
    for i in deps.store.list_invoices(tenant_id):
        if i.get("status") in ("sent", "due_soon", "overdue") and i.get("due_date"):
            events.append({"id": f"ev-inv-{i['id']}", "date": i["due_date"],
                           "title": f"{i['invoice_no']} due (₹{i['amount']:,} — {i['buyer']})",
                           "kind": "invoice_due", "ref_id": i["id"]})
    for a in deps.store.list_alerts(tenant_id):
        if a.get("status") in ("scheduled", "pending_approval") and a.get("fires_at"):
            events.append({"id": f"ev-alert-{a['id']}", "date": a["fires_at"][:10],
                           "title": f"Reminder fires: {a['title']}",
                           "kind": "alert", "ref_id": a["id"]})
    for t in deps.store.list_tasks(tenant_id):
        if t.get("due"):
            events.append({"id": f"ev-task-{t['id']}", "date": t["due"],
                           "title": f"Task: {t['title']}", "kind": "task", "ref_id": t["id"]})
    if start:
        events = [e for e in events if e["date"] >= start]
    if end:
        events = [e for e in events if e["date"] <= end]
    events.sort(key=lambda e: e["date"])
    return events


_CONNECTOR_STUBS = {"whatsapp", "tally", "razorpay"}  # real OAuth post-demo


def _connector(tenant_id: str, conn_id: str) -> dict:
    c = next((x for x in deps.store.list_connectors(tenant_id) if x["id"] == conn_id), None)
    if not c:
        raise HTTPException(404, "unknown connector")
    return c


@app.get("/connectors")
def connectors(tenant_id: str = "ramesh_auto"):
    return deps.store.list_connectors(tenant_id)


@app.post("/connectors/{conn_id}/connect")
def connect_connector(conn_id: str, tenant_id: str = "ramesh_auto"):
    c = _connector(tenant_id, conn_id)
    if conn_id in _CONNECTOR_STUBS:
        return {"id": conn_id, "status": "coming_soon",
                "note": f"{c['name']} integration ships post-demo"}
    now = datetime.now(timezone.utc).isoformat()
    deps.store.update_connector(tenant_id, conn_id, status="connected",
                                connected_at=now, last_sync=now)
    deps.log_activity(tenant_id, "connector_synced", f"{c['name']} connected")
    return {"id": conn_id, "status": "connected", "connected_at": now}


@app.post("/connectors/{conn_id}/disconnect")
def disconnect_connector(conn_id: str, tenant_id: str = "ramesh_auto"):
    _connector(tenant_id, conn_id)
    deps.store.update_connector(tenant_id, conn_id, status="available", items_synced=0)
    return {"id": conn_id, "status": "available"}


@app.get("/connectors/{conn_id}/sync")
def sync_connector(conn_id: str, tenant_id: str = "ramesh_auto"):
    c = _connector(tenant_id, conn_id)
    if c.get("status") != "connected":
        return {"id": conn_id, "state": "not_connected",
                "items_synced": c.get("items_synced", 0), "last_sync": c.get("last_sync")}
    if conn_id == "airtable":
        count = len(deps.store.list_invoices(tenant_id)) + len(deps.store.list_suppliers(tenant_id))
    elif conn_id == "google_calendar":
        count = len(calendar_events(tenant_id))
    else:
        count = c.get("items_synced", 0)
    now = datetime.now(timezone.utc).isoformat()
    deps.store.update_connector(tenant_id, conn_id, last_sync=now, items_synced=count)
    deps.log_activity(tenant_id, "connector_synced", f"{c['name']} synced — {count} items")
    return {"id": conn_id, "last_sync": now, "items_synced": count, "state": "ok"}


@app.get("/settings")
def settings(tenant_id: str = "ramesh_auto"):
    s = deps.store.get_settings(tenant_id)
    if not s:
        raise HTTPException(404, "no settings seeded")
    return {
        "business": s.get("business", {}),
        "onboarded": s.get("onboarded", True),
        "prefs": {"disabled_tools": [], **s.get("prefs", {})},
        "mcp_servers": s.get("mcp_servers", []),
    }


class SettingsPatch(BaseModel):
    tenant_id: str = "ramesh_auto"
    business: dict | None = None
    prefs: dict | None = None
    onboarded: bool | None = None
    mcp_servers: list | None = None


@app.patch("/settings")
def patch_settings(req: SettingsPatch):
    cur = deps.store.get_settings(req.tenant_id) or {}
    nxt = {
        "business": {**cur.get("business", {}), **(req.business or {})},
        "prefs": {**cur.get("prefs", {}), **(req.prefs or {})},
    }
    for k in ("onboarded", "mcp_servers"):
        v = getattr(req, k)
        if v is not None:
            nxt[k] = v
        elif k in cur:
            nxt[k] = cur[k]
    deps.store.put_settings(req.tenant_id, nxt)
    return {"status": "saved"}


# ================= Round 2 — import / memories / artifacts / search =================


@app.post("/import/excel")
async def import_excel(file: UploadFile = File(...), tenant_id: str = Form("ramesh_auto")):
    """Owner drops an .xlsx/Tally ledger export → rows become invoice entries."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_id = f"f-imp-{uuid.uuid4().hex[:6]}"
    dest = UPLOAD_DIR / f"{file_id}_{file.filename}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        result = import_excel_impl(tenant_id, str(dest), filename=file.filename or "ledger.xlsx")
    except Exception as e:  # a bad file must never 500 — report a clean skip
        raise HTTPException(400, f"could not read spreadsheet: {type(e).__name__}: {e}")
    return result


class MemoryReq(BaseModel):
    tenant_id: str = "ramesh_auto"
    text: str
    source: str = "owner"


@app.get("/memories")
def memories(tenant_id: str = "ramesh_auto"):
    rows = deps.store.list_memories(tenant_id)
    rows.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    return rows


@app.post("/memories")
def add_memory(req: MemoryReq):
    mem = deps.store.put_memory(req.tenant_id, {
        "id": f"mem-{uuid.uuid4().hex[:6]}", "text": req.text, "source": req.source,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    deps.record_action("memory_added", {"id": mem["id"], "text": mem["text"]})
    # new memory should reach live agents — rebuild them with the fresh context
    reg.get_registry(req.tenant_id).reset_agents()
    return {"id": mem["id"], "status": "saved"}


@app.delete("/memories/{memory_id}")
def delete_memory(memory_id: str, tenant_id: str = "ramesh_auto"):
    if not deps.store.delete_memory(tenant_id, memory_id):
        raise HTTPException(404, "no such memory")
    reg.get_registry(tenant_id).reset_agents()
    return {"status": "deleted"}


@app.get("/artifacts")
def artifacts(tenant_id: str = "ramesh_auto"):
    rows = deps.store.list_artifacts(tenant_id)
    rows.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    return [{"id": a["id"], "title": a["title"], "template": a["template"],
             "created_by": a.get("created_by", ""), "created_at": a.get("created_at", ""),
             "share_path": a.get("share_path", f"/a/{a['id']}")} for a in rows]


@app.get("/artifacts/{artifact_id}")
def artifact_detail(artifact_id: str, tenant_id: str = "ramesh_auto"):
    a = deps.store.get_artifact(tenant_id, artifact_id)
    if not a:
        raise HTTPException(404, "no such artifact")
    return a


class ArtifactReq(BaseModel):
    tenant_id: str = "ramesh_auto"
    title: str
    template: str
    data: dict = {}
    created_by: str = "owner"


@app.post("/artifacts")
def create_artifact(req: ArtifactReq):
    """Direct artifact creation (agents use the create_artifact TOOL; this is for UI/tests)."""
    if req.template not in TEMPLATES:
        raise HTTPException(400, f"unknown template — allowed: {sorted(TEMPLATES)}")
    try:
        return create_artifact_impl(req.tenant_id, req.title, req.template, req.data,
                                    created_by=req.created_by)
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.post("/context/upload")
async def context_upload(file: UploadFile | None = File(None),
                        text: str | None = Form(None),
                        tenant_id: str = Form("ramesh_auto")):
    """Business context — drop any file OR a note; auto-tagged + fed to agents."""
    if file is None and not (text and text.strip()):
        raise HTTPException(400, "provide a file or a text note")
    if file is not None:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        fid = f"f-{uuid.uuid4().hex[:6]}"
        dest = UPLOAD_DIR / f"{fid}_{file.filename}"
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
        return ingest_document_impl(tenant_id, file_path=str(dest), filename=file.filename)
    return ingest_document_impl(tenant_id, note=text.strip(), filename="note.txt")


@app.get("/context")
def context(tenant_id: str = "ramesh_auto"):
    rows = deps.store.list_documents(tenant_id)
    rows.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return [{k: v for k, v in d.items() if k not in ("embedding", "text_excerpt")} for d in rows]


@app.delete("/context/{doc_id}")
def delete_context(doc_id: str, tenant_id: str = "ramesh_auto"):
    if not deps.store.delete_document(tenant_id, doc_id):
        raise HTTPException(404, "no such document")
    reg.get_registry(tenant_id).reset_agents()
    return {"status": "deleted"}


@app.get("/people")
def people(tenant_id: str = "ramesh_auto"):
    """Everyone the business touches — customers (from invoices), suppliers, carriers."""
    invoices = deps.store.list_invoices(tenant_id)
    by_buyer: dict[str, dict] = {}
    for i in invoices:
        buyer = i.get("buyer", "").strip()
        if not buyer:
            continue
        c = by_buyer.setdefault(buyer, {
            "id": "cust-" + re.sub(r"[^a-z0-9]+", "-", buyer.lower()).strip("-"),
            "name": buyer, "invoices": 0, "billed": 0, "outstanding": 0, "worst_overdue_days": 0,
        })
        c["invoices"] += 1
        c["billed"] += i.get("amount", 0)
        if i.get("status") in ("sent", "due_soon", "overdue"):
            c["outstanding"] += i.get("amount", 0)
        c["worst_overdue_days"] = max(c["worst_overdue_days"], i.get("days_overdue", 0))
    customers = sorted(by_buyer.values(), key=lambda c: c["outstanding"], reverse=True)
    for c in customers:
        c["defaulter"] = c["worst_overdue_days"] > 30
    suppliers = deps.store.list_suppliers(tenant_id)
    carriers = deps.store.list_carriers(tenant_id)
    return {
        "summary": {"customers": len(customers), "suppliers": len(suppliers),
                    "carriers": len(carriers),
                    "outstanding": sum(c["outstanding"] for c in customers)},
        "customers": customers, "suppliers": suppliers, "carriers": carriers,
    }


@app.get("/logs")
def logs(tenant_id: str = "ramesh_auto", limit: int = 50):
    """Unified activity/audit log (dashboard feed + agent actions)."""
    return deps.store.list_activity(tenant_id, limit=limit)


@app.get("/search")
def search(q: str = "", tenant_id: str = "ramesh_auto"):
    """Enterprise search — case-insensitive substring over title/desc/meta fields."""
    ql = q.strip().lower()
    results: dict[str, list] = {"invoices": [], "suppliers": [], "carriers": [],
                                "agents": [], "tasks": [], "memories": [], "documents": []}
    if not ql:
        return {"q": q, "results": results}

    def hit(*parts) -> bool:
        return any(ql in str(p).lower() for p in parts if p)

    for i in deps.store.list_invoices(tenant_id):
        if hit(i.get("buyer"), i.get("invoice_no"), i.get("items")):
            meta = f"₹{i.get('amount', 0):,} · {i.get('status', '')}"
            if i.get("days_overdue"):
                meta += f" {i['days_overdue']}d"
            results["invoices"].append({"id": i["id"],
                "title": f"{i.get('invoice_no', '')} — {i.get('buyer', '')}", "meta": meta, "ref": "#/app"})
    for s in deps.store.list_suppliers(tenant_id):
        if hit(s.get("name"), s.get("category")):
            results["suppliers"].append({"id": s["id"], "title": s.get("name", ""),
                "meta": f"{s.get('category', '')} · trust {s.get('trust_score', '')}", "ref": "#/app"})
    for c in deps.store.list_carriers(tenant_id):
        if hit(c.get("name"), c.get("route")):
            results["carriers"].append({"id": c["id"], "title": c.get("name", ""),
                "meta": f"{c.get('route', '')} · ₹{c.get('rate_per_kg', '')}/kg", "ref": "#/app"})
    for a in reg.get_registry(tenant_id).specs():
        if hit(a.get("name"), a.get("goal"), a.get("description")):
            results["agents"].append({"id": a["id"], "title": a.get("name", ""),
                "meta": a.get("description") or a.get("goal", ""), "ref": f"#/agents/{a['id']}"})
    for t in deps.store.list_tasks(tenant_id):
        if hit(t.get("title"), t.get("details")):
            results["tasks"].append({"id": t["id"], "title": t.get("title", ""),
                "meta": t.get("status", ""), "ref": "#/tasks"})
    for m in deps.store.list_memories(tenant_id):
        if hit(m.get("text")):
            results["memories"].append({"id": m["id"], "title": m.get("text", ""),
                "meta": m.get("source", "owner"), "ref": "#/settings"})
    # documents — content search over the business-context brain (tags/summary/excerpt),
    # ranked by Titan-embedding cosine similarity when embeddings are present.
    docs = deps.store.list_documents(tenant_id)
    qvec = embed_text(q) if any(d.get("embedding") for d in docs) else None
    doc_hits = []
    for d in docs:
        substr = hit(d.get("filename"), d.get("summary"), d.get("text_excerpt"),
                     " ".join(d.get("tags", [])))
        score = cosine(qvec, d["embedding"]) if qvec and d.get("embedding") else 0.0
        if substr or score >= 0.35:
            doc_hits.append((score, {"id": d["id"], "title": d.get("filename", ""),
                "meta": f"{', '.join(d.get('tags', []))} · {d.get('summary', '')}"[:80],
                "ref": "#/context"}))
    doc_hits.sort(key=lambda x: x[0], reverse=True)
    results["documents"] = [h for _, h in doc_hits]
    return {"q": q, "results": results}


handler = None
try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    pass
