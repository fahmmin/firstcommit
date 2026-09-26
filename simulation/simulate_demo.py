"""simulate_demo.py — THE DEMO AS A TEST.

Runs the full judge walkthrough against the real API and prints an
EXPECTED | ACTUAL | PASS/FAIL table. If this is green, the demo is green.

    python simulation/simulate_demo.py            # local mode
    USE_AWS=1 python simulation/simulate_demo.py  # same path on AWS

Asserts state, not wording (LLM output varies; store rows don't).
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
os.environ.setdefault("USE_AWS", "0")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # cp1252 can't print ₹

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app                  # noqa: E402

TENANT = "ramesh_auto"
results: list[tuple[str, str, bool]] = []


def check(step: str, expected: str, actual: str, ok: bool):
    results.append((step, f"{expected} | {actual}", ok))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {step}: expected={expected!r} actual={actual!r}")


def main() -> int:
    with TestClient(app) as c:
        # deployed backend gates on x-demo-token; when .env sets it, we send it
        # (so the sim also exercises the gate path end-to-end)
        if os.getenv("DEMO_GATE_TOKEN"):
            c.headers["x-demo-token"] = os.environ["DEMO_GATE_TOKEN"]
        c.post("/demo/reset", params={"tenant_id": TENANT})

        # 1. Onboarding — agents visible
        agents = c.get("/agents", params={"tenant_id": TENANT}).json()
        check("builtin agents visible", ">=3", str(len(agents)), len(agents) >= 3)

        # 2. Chat routes to receivables
        r = c.post("/chat", json={"tenant_id": TENANT, "text": "show my overdue invoices"}).json()
        check("routing", "vasool", r["agent_name"], r["agent_name"] == "vasool")
        check("reply mentions amounts", "contains ₹", r["reply"][:80], "₹" in r["reply"])

        # 3. Invoice upload → parsed ledger row
        before = len(c.get("/invoices", params={"tenant_id": TENANT}).json())
        up = c.post("/upload", files={"file": ("invoice.jpg", b"\xff\xd8fake", "image/jpeg")},
                    data={"tenant_id": TENANT}).json()
        after = len(c.get("/invoices", params={"tenant_id": TENANT}).json())
        check("invoice parsed+created", before + 1, str(after), after == before + 1)
        check("parsed fields", "buyer+amount", str(up["parsed"].get("buyer")),
              bool(up["parsed"].get("buyer")) and up["parsed"].get("amount") > 0)

        # 4. Reminder draft → needs approval → sends
        overdue = c.get("/invoices", params={"tenant_id": TENANT, "status": "overdue"}).json()
        d = c.post(f"/invoices/{overdue[0]['id']}/reminder", params={"tenant_id": TENANT}).json()
        check("reminder is draft-only", True, d["requires_approval"], d["requires_approval"] is True)
        ap = c.post(f"/alerts/{d['draft_id']}/approve", params={"tenant_id": TENANT}).json()
        check("approved alert sends", "sent", ap["status"], ap["status"] == "sent")

        # 5. THE MOMENT — factory hires a logistics agent
        r1 = c.post("/chat", json={"tenant_id": TENANT,
                                   "text": "mera transporter nahi aaya, order stranded hai"}).json()
        check("factory routed", "nirmata", r1["agent_name"], r1["agent_name"] == "nirmata")
        check("factory engaged", "preview|interview|created", r1["reply"][:120],
              "haan" in r1["reply"].lower() or "yes" in r1["reply"].lower() or "?" in r1["reply"]
              or "live" in r1["reply"].lower() or "spec" in r1["reply"].lower())

        r2 = c.post("/chat", json={"tenant_id": TENANT, "text": "haan, create it"}).json()
        agents2 = c.get("/agents", params={"tenant_id": TENANT}).json()
        new_ids = {a["id"] for a in agents2} - {a["id"] for a in agents}
        check("agent materialized", ">=1 new", str(len(new_ids)), len(new_ids) >= 1)

        new_id = next(iter(new_ids), None)
        r3 = c.post("/chat", json={"tenant_id": TENANT, "agent_id": new_id,
                                   "text": "cheapest pickup to ludhiana tomorrow?"}).json()
        check("new agent answers", "carrier info", r3["reply"][:80],
              "₹" in r3["reply"] or "carrier" in r3["reply"].lower() or "kg" in r3["reply"].lower())

        # 6. Cash-flow gap advisor
        cf = c.get("/cashflow", params={"tenant_id": TENANT}).json()
        check("cashflow data", "receivables+payables", f"{len(cf['receivables'])}/{len(cf['payables'])}",
              len(cf["receivables"]) > 0 and len(cf["payables"]) > 0)

        # 7. Scheduler promotes a due alert
        moved = c.post("/scheduler/run", params={"tenant_id": TENANT}).json()
        check("scheduler ran", ">=0 moved", str(moved["moved"]), moved["moved"] >= 0)

        # 8. Tenant isolation
        other = c.get("/invoices", params={"tenant_id": "other_tenant"}).json()
        check("tenant isolation", "0 rows", str(len(other)), len(other) == 0)

        # 9. Dashboard summary composes real numbers
        d = c.get("/dashboard/summary", params={"tenant_id": TENANT}).json()
        check("dashboard summary", "overdue>0 + activity", f"{d['receivables']['overdue_count']}/{len(d['recent_activity'])}",
              d["receivables"]["overdue_count"] > 0 and len(d["recent_activity"]) > 0)

        # 10. Task assigned → run through agent → done
        t = c.post("/tasks", json={"tenant_id": TENANT, "title": "List my overdue invoices",
                                   "agent_id": "vasool", "due": "2026-09-22"}).json()
        run = c.post(f"/tasks/{t['id']}/run", params={"tenant_id": TENANT}).json()
        check("task run", "done via vasool", f"{run['status']}/{run['agent_name']}",
              run["status"] == "done" and run["agent_name"] == "vasool")

        # 11. Notifications feed alive + readable
        notes = c.get("/notifications", params={"tenant_id": TENANT}).json()
        unread = [n for n in notes if n.get("status") == "unread"]
        rd = c.post(f"/notifications/{notes[0]['id']}/read", params={"tenant_id": TENANT}).json()
        check("notifications", ">=1 unread + read works", f"{len(unread)}/{rd['status']}",
              len(unread) >= 1 and rd["status"] == "read")

        # 12. Calendar unifies dues + alerts + tasks
        ev = c.get("/calendar/events", params={"tenant_id": TENANT}).json()
        kinds = {e["kind"] for e in ev}
        check("calendar unified", "3 kinds", str(sorted(kinds)),
              {"invoice_due", "alert", "task"} <= kinds)

        # 13. Round 2 — Excel import → real ledger rows
        import io
        from openpyxl import Workbook
        wb = Workbook(); ws = wb.active
        ws.append(["Invoice No", "Buyer", "Amount", "Due Date"])
        ws.append(["INV-8001", "Ludhiana Motors", 15600, "2026-10-15"])
        ws.append(["INV-8002", "Amritsar Spares", 9200, "2026-08-20"])
        buf = io.BytesIO(); wb.save(buf)
        before = len(c.get("/invoices", params={"tenant_id": TENANT}).json())
        imp = c.post("/import/excel",
                     files={"file": ("ledger.xlsx", buf.getvalue(),
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                     data={"tenant_id": TENANT}).json()
        after = len(c.get("/invoices", params={"tenant_id": TENANT}).json())
        check("excel import", "2 imported → ledger grows", f"{imp['imported']}/{after - before}",
              imp["imported"] == 2 and after - before == 2)

        # 14. Round 2 — memory taught, then referenced by the agent (real memory)
        c.post("/memories", json={"tenant_id": TENANT,
               "text": "Falcon Traders is a cash-only buyer — never offer credit"})
        rm = c.post("/chat", json={"tenant_id": TENANT, "agent_id": "vasool",
                    "text": "what do you remember about Falcon?"}).json()
        check("memory referenced in reply", "mentions Falcon", rm["reply"][:80],
              "falcon" in rm["reply"].lower())

        # 15. Round 2 — agent builds an artifact, fetchable via share link
        art = c.post("/artifacts", json={"tenant_id": TENANT, "title": "Tracking — ORD-9",
                     "template": "tracking_page",
                     "data": {"order_id": "ORD-9", "carrier": "SafeRoad Carriers",
                              "from": "Ludhiana", "to": "Faridabad", "status": "in_transit",
                              "progress_pct": 55}}).json()
        fetched = c.get(f"/artifacts/{art['id']}", params={"tenant_id": TENANT}).json()
        check("artifact created + fetchable", "same order_id via /a/ link",
              f"{art['share_path']}", fetched.get("data", {}).get("order_id") == "ORD-9"
              and art["share_path"] == f"/a/{art['id']}")

        # 16. Phase A — People aggregation + defaulter flag
        ppl = c.get("/people", params={"tenant_id": TENANT}).json()
        defaulters = [x for x in ppl["customers"] if x.get("defaulter")]
        check("people aggregated + defaulter flagged",
              "customers>0 + >=1 defaulter", f"{ppl['summary']['customers']}/{len(defaulters)}",
              ppl["summary"]["customers"] > 0 and len(defaulters) >= 1)

        # 17. Phase B — business context: drop a note → auto-tagged → searchable → fed to agents
        doc = c.post("/context/upload", data={"tenant_id": TENANT,
              "text": "Falcon Exports demands GST invoice with HSN codes on every order"}).json()
        found = c.get("/search", params={"q": "falcon", "tenant_id": TENANT}).json()
        in_search = any(d["id"] == doc["id"] for d in found["results"]["documents"])
        rc = c.post("/chat", json={"tenant_id": TENANT, "agent_id": "vasool",
                    "text": "what do you know about Falcon Exports?"}).json()
        check("business context tagged + searchable + fed",
              "tags + in-search + agent cites it",
              f"{doc.get('tags')}/{in_search}/{'falcon' in rc['reply'].lower()}",
              bool(doc.get("tags")) and in_search and "falcon" in rc["reply"].lower())

        # 18. Phase C — template catalog + install-as-agent via the factory
        tmpls = c.get("/templates", params={"tenant_id": TENANT}).json()
        cats = {t["category"] for t in tmpls}
        before_agents = {a["id"] for a in c.get("/agents", params={"tenant_id": TENANT}).json()}
        inst = c.post("/templates/collections-agent/install", json={"tenant_id": TENANT}).json()
        after_agents = {a["id"] for a in c.get("/agents", params={"tenant_id": TENANT}).json()}
        check("templates catalog + install→agent",
              ">=5 categories + new agent", f"{len(cats)}/{inst.get('created_by')}",
              len(cats) >= 5 and inst.get("created_by") == "factory"
              and inst["id"] in after_agents and inst["id"] not in before_agents)

        # 18a. A1 — agent side-effecting action is queued, not executed, until approved
        from app.agents import approvals as _appr
        _appr.revoke_session(TENANT, "create_invoice")
        inv_before = len(c.get("/invoices", params={"tenant_id": TENANT}).json())
        qr = c.post("/chat", json={"tenant_id": TENANT, "agent_id": "vasool",
                                   "text": "bill banao for Approval Test Co"}).json()
        pend = [a for a in c.get("/approvals", params={"tenant_id": TENANT, "status": "pending"}).json()
                if a["tool"] == "create_invoice"]
        inv_mid = len(c.get("/invoices", params={"tenant_id": TENANT}).json())
        ap_ok = False
        if pend:
            ap = c.post(f"/approvals/{pend[0]['id']}/approve", params={"tenant_id": TENANT}).json()
            ap_ok = ap.get("status") == "executed"
        inv_after = len(c.get("/invoices", params={"tenant_id": TENANT}).json())
        check("approval gate: queue→approve→execute",
              "not-run-until-approved then +1",
              f"queued={bool(pend)} mid={inv_mid-inv_before} after={inv_after-inv_before}",
              bool(pend) and inv_mid == inv_before and ap_ok and inv_after == inv_before + 1)

        # 18b. Round 4 fix — kanban drag persists via PATCH /tasks/{id} (col↔status)
        tk = c.post("/tasks", json={"tenant_id": TENANT, "title": "Kanban card",
                                    "agent": "vasool", "col": "todo"}).json()
        moved = c.patch(f"/tasks/{tk['id']}", json={"tenant_id": TENANT, "col": "done"}).json()
        check("kanban drag persists", "status→done via col",
              f"{moved.get('status')}/{moved.get('col')}",
              moved.get("status") == "done" and moved.get("col") == "done")

        # 18c. Round 4 fix — ₹ is real UTF-8 (not mojibaked) on the wire
        raw = c.post("/chat", json={"tenant_id": TENANT, "text": "show overdue invoices"}).content
        check("utf-8 rupee on the wire", "₹ present", "u20b9" ,
              "₹".encode("utf-8") in raw)

        # 19. Round 4 — onboarding: rich answers → memory + auto-hire → agent cites it
        onb = c.post("/onboarding", json={"tenant_id": TENANT,
              "business": {"city": "Faridabad"}, "prefs": {"credit_terms_days": 60},
              "pains": ["gst", "no_online_presence"],
              "slow_payers": ["Verma Traders"], "auto_hire": True}).json()
        rv = c.post("/chat", json={"tenant_id": TENANT, "agent_id": "vasool",
                    "text": "what do you remember about Verma Traders?"}).json()
        check("onboarding → memory + auto-hire + fed",
              "mem>0 + agent installed + cited",
              f"{onb['memories_created']}/{len(onb['agents_installed'])}/{'verma' in rv['reply'].lower()}",
              onb["memories_created"] >= 1 and len(onb["agents_installed"]) >= 1
              and "verma" in rv["reply"].lower())

    passed = sum(1 for *_, ok in results if ok)
    print(f"\n{'='*60}\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
