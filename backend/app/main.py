"""FastAPI surface — shapes enforced by tests/contract against mocks/contract.json."""
from __future__ import annotations

import json
import os
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import deps
from .agents import registry as reg
from .agents.specs import ALL_TOOL_NAMES, TOOL_REGISTRY, AgentSpec
from .notifier import get_notifier
from .scheduler import run_once as scheduler_run_once, start as scheduler_start
from .store import DATA_DIR, get_store
from .tools.comms import send_alert_impl
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
            result = agent(req.text)
            agent_name = req.agent_id
        else:
            agent = registry.orchestrator()
            result = agent(req.text)
            tool_names = list(result.metrics.tool_metrics.keys()) if result.metrics else []
            agent_name = tool_names[-1] if tool_names else "sahayak"
    finally:
        deps.current_actions.reset(token)

    spec = registry.get_spec(agent_name) or {}
    trace = ["sahayak"] + ([agent_name] if agent_name != "sahayak" else [])
    return {
        "reply": str(result),
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
    reg.reset_registries()
    return {"status": "reseeded", "tenants": [tenant_id]}


handler = None
try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    pass
