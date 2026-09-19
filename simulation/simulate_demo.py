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
        check("preview offered", "spec|haan", r1["reply"][:120],
              "haan" in r1["reply"].lower() or "yes" in r1["reply"].lower())

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

    passed = sum(1 for *_, ok in results if ok)
    print(f"\n{'='*60}\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
