"""FastAPI surface — shapes enforced by tests/contract against mocks/contract.json."""
from __future__ import annotations

import io
import json
import os
import re
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel


class UTF8JSONResponse(JSONResponse):
    """Emit UTF-8 (not \\uXXXX-escaped) so ₹ and Devanagari render everywhere."""
    media_type = "application/json; charset=utf-8"

    def render(self, content) -> bytes:
        return json.dumps(content, ensure_ascii=False, allow_nan=False,
                          separators=(",", ":"), default=str).encode("utf-8")

from . import deps, gcp
from .agents import registry as reg
from .agents.specs import ALL_TOOL_NAMES, TOOL_REGISTRY, AgentSpec
from .notifier import get_notifier
from .scheduler import run_once as scheduler_run_once, start as scheduler_start
from .store import DATA_DIR, get_store
from .tools.artifacts import TEMPLATES, create_artifact_impl
from .reports import REPORT_TYPES, build_report
from .tools.comms import send_alert_impl
from .tools.documents import cosine, embed_text, ingest_document_impl
from .tools.importer import import_excel_impl
from .tools.invoices import create_invoice_impl, draft_reminder_impl, parse_invoice_file

ON_LAMBDA = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
_PKG_ROOT = Path("/tmp") if ON_LAMBDA else Path(__file__).resolve().parent.parent
UPLOAD_DIR = _PKG_ROOT / "uploads"          # Lambda FS is read-only outside /tmp
SEED_PATH = Path(__file__).resolve().parent / "seed" / "seed.json"

@asynccontextmanager
async def _lifespan(_app):
    deps.init_deps(get_store(), get_notifier())
    if not deps.store.list_invoices("ramesh_auto"):
        _load_seed("ramesh_auto")
    # local-only daemon — on Lambda, EventBridge invokes the handler directly;
    # a background thread inside a frozen execution environment would race it.
    if not ON_LAMBDA:
        scheduler_start()
    yield


app = FastAPI(title="Sahayak AI", default_response_class=UTF8JSONResponse, lifespan=_lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.middleware("http")
async def _demo_gate(request, call_next):
    """Demo gate — project rule says auth stays demo-only, so instead of real
    auth we gate the API behind a shared passcode (DEMO_GATE_TOKEN). Judges get
    the URL with ?gate=TOKEN baked in; crawlers and link-followers get a 401.
    Exempt: health + public artifact shares (recipients have no passcode)."""
    token = os.getenv("DEMO_GATE_TOKEN", "")
    if (token and request.method != "OPTIONS"
            and not request.url.path.startswith(("/health", "/public/artifacts"))):
        if (request.headers.get("x-demo-token") != token
                and request.query_params.get("gate") != token):
            return JSONResponse({"detail": "demo passcode required"}, status_code=401,
                                headers={"Access-Control-Allow-Origin": "*"})
    return await call_next(request)


def _load_seed(tenant_id: str):
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    deps.store.reset(tenant_id, seed)


class ChatReq(BaseModel):
    tenant_id: str = "ramesh_auto"
    text: str
    agent_id: str | None = None
    mode: str = "chat"   # chat | web | deep — web/deep enable the web_search tool
    scope: list[str] | None = None  # owner's capability pick — restrict this reply's tools


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
    text = req.text
    if req.mode in ("web", "deep"):
        text = (f"[{'Deep research' if req.mode == 'deep' else 'Web search'} mode — use the "
                f"web_search tool{' with deep=True' if req.mode == 'deep' else ''}] " + text)
    actions: list[dict] = []
    token = deps.current_actions.set(actions)
    try:
        if req.agent_id:
            agent = (registry.get_agent(req.agent_id, only_tools=req.scope)
                     if req.scope else registry.get_agent(req.agent_id))
            if not agent:
                raise HTTPException(404, f"unknown agent {req.agent_id}")
            result = _invoke(agent, text)
            agent_name = req.agent_id
            registry.bump_stats(req.agent_id)
        else:
            agent = registry.orchestrator(only=req.scope)
            result = _invoke(agent, text)
            # credit the specialist that actually ran — last invoked tool that
            # maps to a spec or nirmata (utility tools like web_search must not
            # steal the byline, and nirmata isn't a stored spec)
            tool_names = list(result.metrics.tool_metrics.keys()) if result.metrics else []
            agent_name = next((n for n in reversed(tool_names)
                               if n == "nirmata" or registry.get_spec(n)), "sahayak")
            if agent_name != "sahayak":
                registry.bump_stats(agent_name)
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
    valid = [t for t in req.tools if t in ALL_TOOL_NAMES]
    if not valid:
        raise HTTPException(400, f"no valid tools — allowed: {sorted(ALL_TOOL_NAMES)}")
    spec = reg.get_registry(req.tenant_id).create_spec(
        name=req.name, goal=req.goal, tools=valid, hindi_tagline=req.hindi_tagline
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
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


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


# ================= demo surface — auth, dashboard, notifications, tasks =================


class LoginReq(BaseModel):
    name: str = "Ramesh Gupta"
    business: str = "Ramesh Hardware & Electricals"
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
    agent: str = ""          # frontend alias for agent_id
    due: str = ""
    details: str = ""
    status: str = "todo"     # todo | doing | done (kanban)
    col: str = ""            # kanban column id (frontend)


class TaskPatch(BaseModel):
    tenant_id: str = "ramesh_auto"
    status: str | None = None
    col: str | None = None
    agent_id: str | None = None
    title: str | None = None
    due: str | None = None
    details: str | None = None
    result: str | None = None


@app.get("/tasks")
def tasks(tenant_id: str = "ramesh_auto", status: str | None = None):
    return deps.store.list_tasks(tenant_id, status=status)


@app.post("/tasks")
def create_task(req: TaskReq):
    status = req.status or "todo"
    t = deps.store.put_task(req.tenant_id, {
        "id": f"task-{uuid.uuid4().hex[:6]}", "title": req.title,
        "agent_id": req.agent_id or req.agent, "status": status,
        "col": req.col or status, "due": req.due, "details": req.details,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"id": t["id"], "status": t["status"], "col": t.get("col", "")}


@app.patch("/tasks/{task_id}")
def patch_task(task_id: str, req: TaskPatch):
    """Persist kanban drag-drop (status/col) and any task edits. col ↔ status alias."""
    fields = {k: v for k, v in req.model_dump().items()
              if k != "tenant_id" and v is not None}
    if "col" in fields and "status" not in fields:      # frontend sends col alone
        fields["status"] = fields["col"]
    elif "status" in fields:                              # keep col in sync
        fields["col"] = fields["status"]
    t = deps.store.update_task(req.tenant_id, task_id, **fields)
    if not t:
        raise HTTPException(404, "no such task")
    return t


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
    gcal = next((c for c in deps.store.list_connectors(tenant_id)
                 if c["id"] == "google_calendar"), None)
    for e in (gcal or {}).get("last_events", []):
        events.append({"id": f"ev-gcal-{e['id']}", "date": (e.get("start") or "")[:10],
                       "title": e.get("summary") or "Google Calendar event",
                       "kind": "google_calendar", "ref_id": e["id"]})
    if start:
        events = [e for e in events if e["date"] >= start]
    if end:
        events = [e for e in events if e["date"] <= end]
    events.sort(key=lambda e: e["date"])
    return events


_CONNECTOR_STUBS = {"whatsapp", "gmail", "airtable", "slack", "tally",
                    "razorpay", "instagram", "facebook_marketplace",
                    "indiamart", "shopify"}  # no real OAuth yet — coming soon
_GOOGLE_CONNECTORS = {"google_drive", "google_sheets", "google_docs",
                      "google_calendar"}  # real via GCP service account (gcp.py)


def _connector(tenant_id: str, conn_id: str) -> dict:
    c = next((x for x in deps.store.list_connectors(tenant_id) if x["id"] == conn_id), None)
    if not c:
        raise HTTPException(404, "unknown connector")
    return c


def _sync_google_files(tenant_id: str, conn_id: str) -> int:
    """Pull files shared with the service account → real ingest into context.
    Drive = anything shared; Sheets/Docs connectors = filtered by type. New files
    only (dedupe by gdrive:<file_id> in the stored doc)."""
    want = {"google_drive": None,
            "google_sheets": {"application/vnd.google-apps.spreadsheet"},
            "google_docs": {"application/vnd.google-apps.document"}}[conn_id]
    known = {d.get("gdrive_id") for d in deps.store.list_documents(tenant_id)}
    synced = 0
    for f in gcp.list_drive_files():
        mime, fid, name = f.get("mimeType", ""), f["id"], f.get("name", "file")
        if want and mime not in want or fid in known:
            continue
        try:
            if mime.startswith("application/vnd.google-apps."):
                text = gcp.download_text(fid, mime)
                doc = ingest_document_impl(tenant_id, note=f"[google drive] {name}\n\n{text}",
                                           filename=name)
            else:
                raw = gcp.download_bytes(fid)
                UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
                dest = UPLOAD_DIR / f"gdrive-{fid[:8]}-{name}"
                dest.write_bytes(raw)
                doc = ingest_document_impl(tenant_id, file_path=str(dest), filename=name)
            deps.store.update_document(tenant_id, doc["id"], gdrive_id=fid)
            synced += 1
        except Exception as e:
            print(f"[gcp] sync failed for {name}: {e}")
    return synced


@app.get("/connectors")
def connectors(tenant_id: str = "ramesh_auto"):
    return deps.store.list_connectors(tenant_id)


@app.post("/connectors/{conn_id}/connect")
def connect_connector(conn_id: str, tenant_id: str = "ramesh_auto"):
    c = _connector(tenant_id, conn_id)
    if conn_id in _CONNECTOR_STUBS:
        return {"id": conn_id, "status": "coming_soon",
                "note": f"{c['name']} integration ships post-demo"}
    if conn_id in _GOOGLE_CONNECTORS:
        if not gcp.available():
            return {"id": conn_id, "status": "unconfigured",
                    "note": "GOOGLE_SERVICE_ACCOUNT_JSON not set on the backend"}
        now = datetime.now(timezone.utc).isoformat()
        deps.store.update_connector(tenant_id, conn_id, status="connected",
                                    connected_at=now, last_sync=now)
        deps.log_activity(tenant_id, "connector_synced", f"{c['name']} connected")
        return {"id": conn_id, "status": "connected", "connected_at": now,
                "share_to": gcp.sa_email(),
                "note": f"Share Drive files / Sheets / a calendar with {gcp.sa_email()} "
                        "— Sync pulls them into business context."}
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
    if conn_id == "google_calendar" and gcp.available():
        events = gcp.list_calendar_events()
        deps.store.update_connector(tenant_id, conn_id, last_events=events[:50])
        count = len(events)
    elif conn_id in ("google_drive", "google_sheets", "google_docs") and gcp.available():
        count = _sync_google_files(tenant_id, conn_id)
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
    role: str | None = None   # RBAC pick (owner|accountant|manager|worker) → prefs.role


@app.patch("/settings")
def patch_settings(req: SettingsPatch):
    cur = deps.store.get_settings(req.tenant_id) or {}
    prefs = {**cur.get("prefs", {}), **(req.prefs or {})}
    if req.role is not None:
        prefs["role"] = req.role
    nxt = {
        "business": {**cur.get("business", {}), **(req.business or {})},
        "prefs": prefs,
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
             "visibility": a.get("visibility", "private"),
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
    visibility: str = "private"          # private | public — share-link ACL label


class ArtifactPatch(BaseModel):
    tenant_id: str = "ramesh_auto"
    visibility: str | None = None
    title: str | None = None


@app.post("/artifacts")
def create_artifact(req: ArtifactReq):
    """Direct artifact creation (agents use the create_artifact TOOL; this is for UI/tests)."""
    if req.template not in TEMPLATES:
        raise HTTPException(400, f"unknown template — allowed: {sorted(TEMPLATES)}")
    try:
        return create_artifact_impl(req.tenant_id, req.title, req.template, req.data,
                                    created_by=req.created_by, visibility=req.visibility)
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.get("/public/artifacts/{artifact_id}")
def get_public_artifact(artifact_id: str):
    """Share-link route — resolves only when visibility == 'public'.
    Private artifacts 404 here so a leaked link leaks nothing. The owner-app
    route (GET /artifacts/{id}?tenant_id=…) stays permissive until real auth lands."""
    row = deps.store.get_artifact("ramesh_auto", artifact_id)
    if not row or row.get("visibility", "public") != "public":
        raise HTTPException(404, "not found")
    return row


# ================= reports — real-data documents + PDF export =================

class ReportReq(BaseModel):
    tenant_id: str = "ramesh_auto"
    report_type: str
    title: str = ""
    visibility: str = "private"


@app.get("/reports/types")
def report_types():
    return REPORT_TYPES


@app.post("/reports/generate")
def generate_report(req: ReportReq):
    """Aggregate real tenant data → persist as a business_report artifact."""
    try:
        built = build_report(req.tenant_id, req.report_type, req.title)
    except ValueError as e:
        raise HTTPException(400, str(e))
    row = create_artifact_impl(req.tenant_id, built["title"], "business_report",
                               built["data"], created_by="reports-page",
                               visibility=req.visibility)
    return row


def _report_pdf_response(row: dict):
    from .pdf_report import render_report_pdf
    pdf = render_report_pdf(row.get("title", "Report"), row.get("data") or {},
                            business=(row.get("data") or {}).get("business", ""))
    fname = f"{(row.get('title') or 'report').lower().replace(' ', '-')}.pdf"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@app.get("/reports/{artifact_id}/pdf")
def report_pdf(artifact_id: str, tenant_id: str = "ramesh_auto"):
    row = deps.store.get_artifact(tenant_id, artifact_id)
    if not row or row.get("template") != "business_report":
        raise HTTPException(404, "no such report")
    return _report_pdf_response(row)


@app.get("/public/artifacts/{artifact_id}/pdf")
def public_report_pdf(artifact_id: str):
    """PDF download on the share link — same visibility gate as the page itself."""
    row = deps.store.get_artifact("ramesh_auto", artifact_id)
    if not row or row.get("visibility", "public") != "public" \
            or row.get("template") != "business_report":
        raise HTTPException(404, "not found")
    return _report_pdf_response(row)


@app.patch("/artifacts/{artifact_id}")
def patch_artifact(artifact_id: str, req: ArtifactPatch):
    """Toggle visibility (private ↔ public) — the 'share to investors' switch."""
    updates = {k: v for k, v in req.model_dump(exclude={"tenant_id"}).items() if v is not None}
    if "visibility" in updates and updates["visibility"] not in ("private", "public"):
        raise HTTPException(422, "visibility must be private|public")
    if not updates:
        raise HTTPException(400, "nothing to update")
    row = deps.store.update_artifact(req.tenant_id, artifact_id, **updates)
    if not row:
        raise HTTPException(404, "no such artifact")
    if "visibility" in updates:
        deps.log_activity(req.tenant_id, "artifact_shared",
                          f"Artifact '{row['title']}' made {updates['visibility']}")
    return row


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
    out = []
    for d in rows:
        row = {k: v for k, v in d.items() if k not in ("embedding", "text_excerpt", "chunks")}
        # bytes are fetchable if stored under a key/path — or via the legacy
        # context/{tenant}/{filename} seed layout when running on AWS
        row["has_file"] = bool(d.get("s3_key") or d.get("file_path")) or \
            (_use_aws() and d.get("kind") != "note")
        out.append(row)
    return out


@app.delete("/context/{doc_id}")
def delete_context(doc_id: str, tenant_id: str = "ramesh_auto"):
    doc = deps.store.get_document(tenant_id, doc_id)
    if doc and doc.get("s3_key") and _use_aws():
        try:
            _s3().delete_object(Bucket=_s3_bucket(), Key=doc["s3_key"])
        except Exception:
            pass
    if not deps.store.delete_document(tenant_id, doc_id):
        raise HTTPException(404, "no such document")
    reg.get_registry(tenant_id).reset_agents()
    return {"status": "deleted"}


# ---------- document file serving + preview ----------

def _use_aws() -> bool:
    return os.getenv("USE_AWS", "0") == "1"


def _s3_bucket() -> str:
    return os.getenv("S3_BUCKET", "sahayak-sessions")


def _s3():
    import boto3
    return boto3.Session(profile_name=os.getenv("AWS_PROFILE") or None,
                         region_name=os.getenv("AWS_REGION", "us-east-1")).client("s3")


_MIME_BY_EXT = {
    ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
    ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
}


def _doc_bytes(tenant_id: str, doc: dict) -> bytes | None:
    """Resolve raw bytes: doc's own s3_key → legacy seed key → local file_path."""
    filename = doc.get("filename", "")
    if _use_aws():
        for key in filter(None, [doc.get("s3_key"), f"context/{tenant_id}/{filename}"]):
            try:
                return _s3().get_object(Bucket=_s3_bucket(), Key=key)["Body"].read()
            except Exception:
                continue
    fp = doc.get("file_path")
    if fp and os.path.exists(fp):
        with open(fp, "rb") as f:
            return f.read()
    return None


@app.get("/context/{doc_id}/file")
def context_file(doc_id: str, tenant_id: str = "ramesh_auto"):
    """Raw document bytes — rendered inline by the app (pdf/image/text in iframes)."""
    doc = deps.store.get_document(tenant_id, doc_id)
    if not doc:
        raise HTTPException(404, "no such document")
    data = _doc_bytes(tenant_id, doc)
    if data is None:
        raise HTTPException(404, "file bytes not stored for this document")
    ext = os.path.splitext(doc.get("filename", ""))[1].lower()
    mime = _MIME_BY_EXT.get(ext, "application/octet-stream")
    return Response(content=data, media_type=mime,
                    headers={"Content-Disposition": f'inline; filename="{doc.get("filename", "file")}"'})


@app.get("/context/{doc_id}/preview")
def context_preview(doc_id: str, tenant_id: str = "ramesh_auto"):
    """JSON preview — spreadsheets come back as parsed sheets; everything else
    reports its kind so the UI picks iframe (pdf/image/text) or excerpt."""
    doc = deps.store.get_document(tenant_id, doc_id)
    if not doc:
        raise HTTPException(404, "no such document")
    out = {"id": doc_id, "filename": doc.get("filename"), "kind": doc.get("kind"),
           "summary": doc.get("summary"), "tags": doc.get("tags") or [],
           "has_file": bool(doc.get("s3_key") or doc.get("file_path"))}
    if _use_aws() and not out["has_file"]:
        # legacy seed files resolve by filename fallback — but a text note has
        # no bytes anywhere, so it must not claim has_file (same rule as /context)
        out["has_file"] = doc.get("kind") != "note"
    if doc.get("kind") == "spreadsheet":
        data = _doc_bytes(tenant_id, doc)
        if data is not None:
            out["sheets"] = _spreadsheet_preview(data, doc.get("filename", ""))
            out["has_file"] = True
    else:
        out["text"] = (doc.get("text_excerpt") or doc.get("summary") or "")[:4000]
    return out


def _spreadsheet_preview(data: bytes, filename: str) -> list:
    """First ~40 rows × 12 cols per sheet — enough for an in-app look."""
    ext = os.path.splitext(filename or "")[1].lower()
    sheets = []
    try:
        if ext == ".csv":
            import csv as _csv, io as _io
            rows = [r[:12] for r in list(_csv.reader(_io.StringIO(data.decode("utf-8", "replace"))))[:40]]
            return [{"name": filename or "Sheet1", "rows": rows}]
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        for ws in wb.worksheets[:4]:
            rows = [[("" if c is None else str(c)) for c in row][:12]
                    for row in list(ws.iter_rows(values_only=True))[:40]]
            sheets.append({"name": ws.title, "rows": rows})
        wb.close()
    except Exception as e:
        print(f"[context] spreadsheet preview failed ({type(e).__name__}): {e}")
    return sheets


@app.get("/templates")
def templates(tenant_id: str = "ramesh_auto"):
    from .templates_catalog import TEMPLATES
    return TEMPLATES


# pain-chip → template id + human reason (drives onboarding agent setup)
_PAIN_MAP = {
    "late_payments": ("collections-agent", "chasing late payments"),
    "gst": ("compliance-agent", "GST / compliance deadlines"),
    "compliance": ("compliance-agent", "GST / compliance deadlines"),
    "untracked_deliveries": ("hire-logistics", "untracked deliveries"),
    "no_online_presence": ("digital-presence", "no online presence"),
    "stock_outs": ("compare-suppliers", "stock-outs / sourcing"),
    "cash_flow": ("cashflow-check", "cash-flow surprises"),
    "chasing_suppliers": ("compare-suppliers", "chasing suppliers"),
    "pricing": ("should-i-take-90d", "pricing decisions"),
}


class OnboardingReq(BaseModel):
    tenant_id: str = "ramesh_auto"
    business: dict = {}
    prefs: dict = {}
    pains: list[str] = []
    slow_payers: list[str] = []
    key_buyers: list[str] = []
    key_suppliers: list[str] = []
    rules: list[str] = []
    tools_today: list[str] = []
    auto_hire: bool = False


@app.post("/onboarding")
def onboarding(req: OnboardingReq):
    """Rich first-run wizard — one call: profile + prefs + memories + agent setup."""
    from .agents.specs import ALL_TOOL_NAMES
    from .templates_catalog import get_template
    tid = req.tenant_id

    # 1. business profile + prefs
    cur = deps.store.get_settings(tid) or {}
    deps.store.put_settings(tid, {
        "business": {**cur.get("business", {}), **req.business},
        "prefs": {**cur.get("prefs", {}), **req.prefs},
        "onboarded": True,
        "mcp_servers": cur.get("mcp_servers", []),
    })

    # 2. free-text answers → real agent memories
    def _mem(text: str, source: str = "onboarding"):
        deps.store.put_memory(tid, {"id": f"mem-{uuid.uuid4().hex[:6]}", "text": text,
                                    "source": source,
                                    "created_at": datetime.now(timezone.utc).isoformat()})
    memories = 0
    for name in req.slow_payers:
        _mem(f"{name} is a slow payer — follow up carefully, don't push too hard"); memories += 1
    for name in req.key_buyers:
        _mem(f"{name} is a key buyer — prioritize their orders"); memories += 1
    for name in req.key_suppliers:
        _mem(f"{name} is a trusted key supplier"); memories += 1
    for rule in req.rules:
        _mem(rule); memories += 1

    # 3. pains → agents (auto-hire the magic, or suggest)
    registry = reg.get_registry(tid)
    existing_names = {s.get("name", "").lower() for s in registry.specs()}
    agents_installed, suggested, seen = [], [], set()
    for pain in req.pains:
        entry = _PAIN_MAP.get(pain)
        if not entry or entry[0] in seen:
            continue
        tmpl_id, reason = entry
        seen.add(tmpl_id)
        t = get_template(tmpl_id) or {}
        spec_def = t.get("agent_spec")
        valid = [x for x in (spec_def or {}).get("tools", []) if x in ALL_TOOL_NAMES]
        if req.auto_hire and spec_def and valid and spec_def["name"].lower() not in existing_names:
            spec = registry.create_spec(name=spec_def["name"], goal=spec_def["goal"],
                                        tools=valid, hindi_tagline=spec_def.get("hindi_tagline", ""))
            agents_installed.append({"id": spec["id"], "name": spec["name"]})
        else:
            suggested.append({"template_id": tmpl_id, "title": t.get("title", tmpl_id),
                              "reason": reason})

    next_steps = []
    # too_many_excels is a pain with no specialist agent → it's a next-step (import ledger)
    if ("too_many_excels" in req.pains or "excel" in req.tools_today
            or "tally" in req.tools_today):
        next_steps.append("Import your existing ledger from Excel")
    deps.record_action("onboarding_completed",
                       {"memories": memories, "agents": len(agents_installed)})
    deps.log_activity(tid, "onboarding_completed",
                      f"Onboarding done — {memories} context notes, {len(agents_installed)} agents hired")
    registry.reset_agents()  # so new memories/agents take effect
    return {"tenant_id": tid, "onboarded": True, "memories_created": memories,
            "agents_installed": agents_installed, "suggested_agents": suggested,
            "next_steps": next_steps}


class TemplateInstallReq(BaseModel):
    tenant_id: str = "ramesh_auto"


@app.post("/templates/{template_id}/install")
def install_template(template_id: str, req: TemplateInstallReq):
    """Install a template. Agent templates with valid tools → created via the factory;
    factory/prompt templates → return the prompt to run through Nirmata live."""
    from .agents.specs import ALL_TOOL_NAMES
    from .templates_catalog import get_template
    t = get_template(template_id)
    if not t:
        raise HTTPException(404, "unknown template")
    spec_def = t.get("agent_spec")
    valid_tools = [x for x in (spec_def or {}).get("tools", []) if x in ALL_TOOL_NAMES]
    if spec_def and valid_tools:
        spec = reg.get_registry(req.tenant_id).create_spec(
            name=spec_def["name"], goal=spec_def["goal"], tools=valid_tools,
            hindi_tagline=spec_def.get("hindi_tagline", ""))
        deps.record_action("template_installed", {"template": template_id, "agent_id": spec["id"]})
        return {"id": spec["id"], "status": spec["status"], "created_by": spec["created_by"]}
    # no ready toolset (e.g. digital presence) → the owner runs it and Nirmata hires live
    return {"status": "needs_factory", "runs_on": t.get("runs_on", "nirmata"),
            "prompt": t.get("prompt", "")}


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


# ================= A1 — action approval ledger =================


@app.get("/approvals")
def approvals_list(tenant_id: str = "ramesh_auto", status: str | None = None):
    """Durable ledger of agent actions awaiting / past owner approval."""
    rows = deps.store.list_approvals(tenant_id)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    rows.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    return rows


@app.post("/approvals/{approval_id}/approve")
def approvals_approve(approval_id: str, tenant_id: str = "ramesh_auto"):
    """Owner taps approve → the queued action actually executes now."""
    from .agents.approvals import execute_action
    res = execute_action(tenant_id, approval_id)
    if res.get("status") == "not_found":
        raise HTTPException(404, "no such approval")
    return {"id": approval_id, **res}


@app.post("/approvals/{approval_id}/deny")
def approvals_deny(approval_id: str, tenant_id: str = "ramesh_auto"):
    a = deps.store.update_approval(tenant_id, approval_id, status="denied",
                                  decided_at=datetime.now(timezone.utc).isoformat(),
                                  via="owner_denied")
    if not a:
        raise HTTPException(404, "no such approval")
    return {"id": approval_id, "status": "denied"}


class GrantReq(BaseModel):
    tenant_id: str = "ramesh_auto"
    tool: str
    on: bool = True


@app.post("/approvals/grant")
def approvals_grant(req: GrantReq):
    """Session-grant: auto-approve this tool for the rest of the session (fights fatigue)."""
    from .agents.approvals import grant_session, revoke_session
    (grant_session if req.on else revoke_session)(req.tenant_id, req.tool)
    return {"tool": req.tool, "granted": req.on}


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
    # documents — B1 hybrid retrieval (keyword + vector) → rerank → cited chunks.
    from .tools.retrieval import retrieval_mode, search_documents
    for r in search_documents(tenant_id, q, k=8):
        results["documents"].append({
            "id": r["doc_id"], "title": r["filename"],
            "meta": f"{', '.join(r.get('tags', []))} · {r.get('summary', '')}"[:80],
            "snippet": r["snippet"], "score": r.get("rerank_score", r["score"]),
            "ref": "#/context",
        })
    return {"q": q, "results": results, "retrieval": retrieval_mode(tenant_id)}


handler = None
try:
    from mangum import Mangum
    _mangum = Mangum(app)

    def handler(event, context):  # noqa: F811 — real Lambda entrypoint
        # EventBridge scheduled tick → run the alert scheduler, not HTTP.
        # Mangum isn't involved, so init deps ourselves on cold start.
        if isinstance(event, dict) and event.get("detail-type") == "Scheduled Event":
            if deps.store is None:
                deps.init_deps(get_store(), get_notifier())
            return {"moved": scheduler_run_once("ramesh_auto")}
        return _mangum(event, context)
except ImportError:
    pass
