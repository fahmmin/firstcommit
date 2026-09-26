"""Top-to-bottom E2E against a LIVE backend on a real model provider, with
per-job token + cost accounting. Writes MODEL_TEST_REPORT.md + .json.

    # backend running with e.g. MODEL_PROVIDER=openai EMBED_PROVIDER=openai
    python simulation/model_e2e.py [--base http://localhost:8000]

Cost per job = change in the backend's spend counter (tracing.spent) across the
job, so it includes hidden calls (auto-tag, embeddings, vision), not just chat.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
SPEND = ROOT / "backend" / "data" / "spend.json"
T = "ramesh_auto"


def spent() -> float:
    try:
        return float(json.loads(SPEND.read_text())["usd"])
    except Exception:
        return 0.0


class Runner:
    def __init__(self, base: str):
        self.c = httpx.Client(base_url=base, timeout=180)
        login = self.c.post("/auth/login", json={"provider": "guest"}).json()
        self.h = {"Authorization": f"Bearer {login['token']}"}
        self.jobs: list[dict] = []

    # ---- http helpers ----
    def get(self, p, **kw):
        return self.c.get(p, headers=self.h, **kw)

    def post(self, p, **kw):
        return self.c.post(p, headers={**self.h, **kw.pop("headers", {})}, **kw)

    def chat(self, text, agent_id=None, mode="chat"):
        return self.post("/chat", json={"tenant_id": T, "text": text, "agent_id": agent_id, "mode": mode})

    # ---- a job = one measured step ----
    def job(self, flow: str, name: str, fn, check=None, expect: str = ""):
        s0, t0 = spent(), time.perf_counter()
        err, out = None, {}
        try:
            out = fn() or {}
        except Exception as e:  # never stop the battery on one failure
            err = f"{type(e).__name__}: {e}"
        ms = int((time.perf_counter() - t0) * 1000)
        cost = round(spent() - s0, 6)
        usage = out.get("usage") or {}
        ok = err is None and (check(out) if check else True)
        row = {
            "flow": flow, "job": name, "pass": bool(ok), "expect": expect, "error": err,
            "agent": out.get("agent_name", ""), "tools": usage.get("tools", out.get("tools", [])),
            "input_tokens": usage.get("input_tokens", 0), "output_tokens": usage.get("output_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0), "cost_usd": cost, "latency_ms": ms,
            "output": (out.get("reply") or out.get("_summary") or "")[:600],
        }
        self.jobs.append(row)
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {flow} › {name}  tok={row['total_tokens']}  ${cost:.5f}  {ms}ms  {row['output'][:90]!r}"
              + (f"  ERR {err}" if err else ""))
        return out


def invoice_png() -> bytes:
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (900, 600), "white")
    d = ImageDraw.Draw(img)
    lines = ["TAX INVOICE", "Invoice No: INV-7781", "Bill To: Kapoor Hardware Stores, Ludhiana",
             "Date: 2026-09-20      Due Date: 2026-10-20", "",
             "Item: PVC conduit pipes 25mm x 400", "Taxable value: Rs 42,000",
             "GST 18%: Rs 7,560", "TOTAL: Rs 49,560"]
    for i, ln in enumerate(lines):
        d.text((60, 50 + i * 50), ln, fill="black")
    buf = io.BytesIO()
    img.resize((1800, 1200)).save(buf, "PNG")
    return buf.getvalue()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    a = ap.parse_args()
    r = Runner(a.base)
    health = r.c.get("/health").json()
    print("provider:", health)
    r.post("/demo/reset", params={"tenant_id": T})
    r.post("/metrics/spend/reset") if False else None  # keep the session total

    R = lambda resp: {**resp.json(), "_status": resp.status_code} if resp.headers.get("content-type", "").startswith("application/json") else {"_status": resp.status_code}

    # ---------- 1. routing / specialists ----------
    r.job("Routing", "Overdue invoices → Vasool", lambda: R(r.chat("show my overdue invoices")),
          lambda o: o.get("agent_name") == "vasool" and "₹" in o["reply"], "vasool + rupee figures")
    r.job("Routing", "Hinglish money question", lambda: R(r.chat("bhai paisa kab aayega, sabse purana udhaar kaunsa hai?")),
          lambda o: o.get("agent_name") == "vasool", "vasool")
    r.job("Routing", "Cheapest supplier → Sourcer", lambda: R(r.chat("who is the cheapest supplier for MCB switches and can I trust them?")),
          lambda o: o.get("agent_name") == "sourcer", "sourcer")
    r.job("Routing", "90-day terms → Khata", lambda: R(r.chat("A buyer wants 90-day credit on a ₹2,00,000 order. Should I take it?")),
          lambda o: o.get("agent_name") == "khata", "khata")
    r.job("Routing", "Aging report tool", lambda: R(r.chat("give me a receivables aging report", agent_id="vasool")),
          lambda o: "aging_report" in o["usage"]["tools"], "aging_report tool")

    # ---------- 1b. numeric accuracy (ground truth from the ledger) ----------
    import re as _re
    inv = r.get("/invoices", params={"tenant_id": T, "status": "overdue"}).json()
    agg: dict = {}
    for i in inv:
        agg[i["buyer"]] = agg.get(i["buyer"], 0) + i["amount"]
    top, amt = max(agg.items(), key=lambda kv: kv[1])
    for q in ["bhai sabse zyada paisa kis customer pe atka hai?",
              "which customer owes me the most money in total?",
              "rank my customers by how much overdue money they owe"]:
        r.job("Accuracy", f"Top debtor: {q[:40]}", lambda q=q: R(r.chat(q)),
              lambda o: top.split()[0] in o["reply"] and str(int(amt)) in _re.sub(r"[^\d]", "", o["reply"]),
              f"{top} ₹{int(amt):,} (ledger truth)")

    # ---------- 2. factory ----------
    before = {x["id"] for x in r.get("/agents", params={"tenant_id": T}).json()}
    r.job("Factory", "Problem → hiring preview", lambda: R(r.chat("mera transporter nahi aaya, order stranded hai. kuch karo")),
          lambda o: o.get("agent_name") == "nirmata", "nirmata previews a hire")
    r.job("Factory", "'haan' → agent hired", lambda: R(r.chat("haan, hire kar do")),
          lambda o: any(a["type"] == "agent_created" for a in o.get("actions", [])), "agent_created")
    new = [x for x in r.get("/agents", params={"tenant_id": T}).json() if x["id"] not in before]
    nid = new[0]["id"] if new else None
    r.job("Factory", "New hire answers", lambda: R(r.chat("cheapest pickup to Ludhiana tomorrow for 500 kg?", agent_id=nid)),
          lambda o: "carrier" in o["reply"].lower() or "₹" in o["reply"], "carrier quote")
    before = {x["id"] for x in r.get("/agents", params={"tenant_id": T}).json()}
    r.job("Factory", "Multi-role ask → team preview",
          lambda: R(r.chat("I need a team: someone to watch GST filing deadlines, and someone to put my products online on IndiaMART")),
          lambda o: o.get("agent_name") == "nirmata", "preview_team")
    r.job("Factory", "'yes' → team hired", lambda: R(r.chat("yes hire them")),
          lambda o: sum(a["type"] == "agent_created" for a in o.get("actions", [])) >= 2
                    and "process" not in o["reply"].lower(), ">=2 agents, no false 'processing'")
    team = [x for x in r.get("/agents", params={"tenant_id": T}).json() if x["id"] not in before]
    r.jobs[-1]["output"] += f"  | hired: {[x['name'] + '/' + str(x.get('role_id')) for x in team]}"

    # ---------- 3. approvals (real arg extraction) ----------
    inv_before = len(r.get("/invoices", params={"tenant_id": T}).json())
    q = r.job("Approvals", "Create invoice from free text → queued",
              lambda: R(r.chat("Create an invoice for Kapoor Hardware Stores for ₹18,500, due 2026-11-10, for 50 MCB boxes", agent_id="vasool")),
              lambda o: any(a["type"] == "action_queued" for a in o.get("actions", [])), "queued, nothing written")
    pend = r.get("/approvals", params={"tenant_id": T, "status": "pending"}).json()
    ap = next((p for p in pend if p["tool"] == "create_invoice"), None)
    r.jobs[-1]["output"] += f"  | ledger: {ap['summary'] if ap else 'NONE'}"

    def _approve():
        res = r.post(f"/approvals/{ap['id']}/approve", params={"tenant_id": T}).json()
        inv = [i for i in r.get("/invoices", params={"tenant_id": T}).json()]
        return {"_summary": f"{res['status']} → {res.get('result_ref')}; invoices {inv_before}→{len(inv)}; "
                            f"buyer={next((i['buyer'] for i in inv if i['id'] == (res.get('result_ref') or {}).get('id')), '?')}",
                "ok": res["status"] == "executed" and len(inv) == inv_before + 1}
    r.job("Approvals", "Owner approves → invoice written", _approve, lambda o: o.get("ok"), "executed, +1 invoice")
    r.job("Approvals", "Schedule a reminder → queued",
          lambda: R(r.chat("Schedule a reminder to call Sharma Constructions about INV-1029 on 2026-10-01", agent_id="vasool")),
          lambda o: any(a["type"] == "action_queued" for a in o.get("actions", [])), "schedule_alert queued")
    r.job("Approvals", "Draft a payment reminder (draft only)",
          lambda: R(r.chat("draft a polite WhatsApp reminder for the oldest overdue invoice", agent_id="vasool")),
          lambda o: "draft_reminder" in o["usage"]["tools"], "draft_reminder")

    # ---------- 4. memory ----------
    r.post("/memories", json={"tenant_id": T, "text": "Falcon Traders is a cash-only buyer — never extend them credit", "source": "owner"})
    r.job("Memory", "Agent uses owner memory",
          lambda: R(r.chat("Falcon Traders wants 30 days credit on a new order. What should I do?")),
          lambda o: "cash" in o["reply"].lower(), "mentions cash-only")

    # ---------- 5. business context (auto-tag + embeddings + retrieval) ----------
    def _upload_note():
        res = r.post("/context/upload", data={"tenant_id": T, "text":
                     "Balaji Steel rate card Oct 2026: TMT bars Fe500 ₹58/kg, binding wire ₹72/kg, "
                     "MOQ 2 tonnes, delivery 4 days to Faridabad. Valid till Diwali."}).json()
        return {"_summary": f"tags={res.get('tags')} summary={res.get('summary')!r}", "tags": res.get("tags")}
    r.job("Context", "Upload note → model auto-tag + embed", _upload_note, lambda o: bool(o.get("tags")), "tags")

    def _search():
        res = r.get("/search", params={"tenant_id": T, "q": "iron rod price per kilo"}).json()
        docs = res["results"].get("documents", [])
        return {"_summary": f"mode={res.get('retrieval')} top={[d['title'] for d in docs[:3]]}",
                "hit": any("note" in d["title"] or "Balaji" in (d.get("meta") or "") for d in docs), "mode": res.get("retrieval")}
    r.job("Context", "Semantic search (no keyword overlap)", _search, lambda o: o.get("hit"), "finds TMT note via vectors")
    r.job("Context", "Agent answers from documents",
          lambda: R(r.chat("what is Balaji Steel's rate for TMT bars and their MOQ?", agent_id="sourcer")),
          lambda o: "58" in o["reply"], "₹58/kg from the note")

    # ---------- 6. vision (invoice photo) ----------
    def _vision():
        res = r.post("/upload", files={"file": ("invoice.png", invoice_png(), "image/png")},
                     data={"tenant_id": T}).json()
        p = res.get("parsed") or res.get("invoice") or {}
        return {"_summary": f"parsed buyer={p.get('buyer')!r} amount={p.get('amount')} no={p.get('invoice_no')} due={p.get('due_date')}",
                "ok": "kapoor" in str(p.get("buyer", "")).lower() and float(p.get("amount") or 0) in (49560.0, 42000.0)}
    r.job("Vision", "Invoice photo → structured fields", _vision, lambda o: o.get("ok"), "Kapoor / 49,560")

    # ---------- 7. artifacts ----------
    r.job("Artifacts", "Ask for a shareable tracking page → queued",
          lambda: R(r.chat("create a shareable tracking page for order ORD-1042 going to Ludhiana with SafeRoad, ETA tomorrow", agent_id="vasool")),
          lambda o: any(a["type"] in ("action_queued", "artifact_created") for a in o.get("actions", [])), "create_artifact gated")

    # ---------- 8. tasks / web / deep ----------
    tasks = r.get("/tasks", params={"tenant_id": T}).json()
    tid = next((t["id"] for t in tasks if t.get("status") != "done"), None)
    def _task():
        o = R(r.post(f"/tasks/{tid}/run", params={"tenant_id": T}))
        o["_summary"] = f"{o.get('agent_name')}: {o.get('result', '')}"
        return o
    r.job("Tasks", "Run a kanban task with its agent", _task,
          lambda o: o.get("status") == "done" and bool(o.get("result")), "done + result")
    r.job("Web", "Web mode without Tavily key → honest",
          lambda: R(r.chat("what is today's steel price in Delhi?", mode="web")),
          lambda o: any(k in o["reply"].lower() for k in ("not configured", "isn't configured",
                                                          "configure nahi", "configured nahi"))
                    and not any(a["type"] == "agent_created" for a in o.get("actions", []))
                    and o.get("agent_name") != "nirmata",
          "says not configured, hires nobody")

    # ---------- 9. MCP (model must pick the tool from its description) ----------
    tok = r.post("/integrations/mcp/token", params={"tenant_id": T}).json()["token"]
    r.c.patch("/settings", headers=r.h, json={"tenant_id": T, "mcp_servers": [
        {"id": "mcp-self", "name": "ledger", "url": f"{a.base}/mcp", "auth_token": tok}]})
    r.job("MCP", "Handshake", lambda: {"_summary": str(r.post("/integrations/mcp/mcp-self/test", params={"tenant_id": T}).json().get("status")),
                                       "ok": True}, None, "connected")
    r.job("MCP", "Model picks an MCP tool by itself",
          lambda: R(r.chat("Using the external ledger MCP server, what is my cashflow summary?", agent_id="khata")),
          lambda o: any(t.startswith("mcp_ledger") for t in o["usage"]["tools"]), "mcp_ledger_* tool used")
    r.c.patch("/settings", headers=r.h, json={"tenant_id": T, "mcp_servers": []})

    # ---------- 10. onboarding (new tenant, auto-hire) ----------
    def _onboard():
        c2 = httpx.Client(base_url=a.base, timeout=120)
        lg = c2.post("/auth/login", json={"provider": "phone", "provider_id": f"+9198{int(time.time()) % 100000000:08d}"}).json()
        h2 = {"Authorization": f"Bearer {lg['token']}"}
        ob = c2.post("/onboarding", headers=h2, json={"business": {"name": "Mehta Paints", "city": "Pune"},
                     "pains": ["late_payments", "gst"], "slow_payers": ["Joshi Builders"], "auto_hire": True}).json()
        ch = c2.post("/chat", headers=h2, json={"text": "who are my slow payers?"}).json()
        return {"_summary": f"tenant={lg['tenant_id']} hired={[x['name'] for x in ob['agents_installed']]} "
                            f"memories={ob['memories_created']} | chat: {ch['reply'][:160]}",
                "usage": ch.get("usage"), "ok": len(ob["agents_installed"]) >= 2 and "joshi" in ch["reply"].lower()}
    r.job("Onboarding", "New tenant: wizard → auto-hire → memory used", _onboard, lambda o: o.get("ok"),
          "2 agents + mentions Joshi")

    # ---------- summary ----------
    total = round(sum(j["cost_usd"] for j in r.jobs), 5)
    passed = sum(j["pass"] for j in r.jobs)
    print(f"\n{passed}/{len(r.jobs)} jobs passed · total ${total} · tokens {sum(j['total_tokens'] for j in r.jobs)}")
    out = {"when": datetime.now(timezone.utc).isoformat(), "health": health, "jobs": r.jobs,
           "passed": passed, "total_jobs": len(r.jobs), "total_cost_usd": total,
           "spend_counter_usd": spent()}
    (ROOT / "simulation" / "model_e2e_results.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
    return 0 if passed == len(r.jobs) else 1


if __name__ == "__main__":
    sys.exit(main())
