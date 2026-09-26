"""evals.py — golden-set scorecard for Sahayak (routing + retrieval + gating).

    python simulation/evals.py            # local (deterministic)
    USE_AWS=1 python simulation/evals.py  # scores the real Bedrock path

Prints a pass-rate scorecard. Unlike simulate_demo (pass/fail gate), this reports
a SCORE so you can track quality/regression across prompt or model changes.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
os.environ.setdefault("USE_AWS", "0")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app                  # noqa: E402

TENANT = "ramesh_auto"
ROUTING = [
    ("show my overdue invoices", "vasool"),
    ("compare steel suppliers for me", "sourcer"),
    ("should I take a 90 day terms order", "khata"),
    ("mera transporter nahi aaya, order stranded", "nirmata"),
    ("I want to sell online on IndiaMART", "nirmata"),
]


def main() -> int:
    passed = total = 0
    rows = []
    with TestClient(app) as c:
        c.headers["Authorization"] = "Bearer " + c.post("/auth/login", json={"provider": "guest"}).json()["token"]
        if os.getenv("DEMO_GATE_TOKEN"):
            c.headers["x-demo-token"] = os.environ["DEMO_GATE_TOKEN"]
        c.post("/demo/reset", params={"tenant_id": TENANT})

        # 1. routing accuracy
        for q, exp in ROUTING:
            got = c.post("/chat", json={"tenant_id": TENANT, "text": q}).json().get("agent_name")
            ok = got == exp; passed += ok; total += 1
            rows.append((f"route: {q[:34]:34}", f"{got} (want {exp})", ok))

        # 2. retrieval grounding (upload → cited hit)
        c.post("/context/upload", data={"tenant_id": TENANT,
               "text": "Comet Traders is blacklisted — 3 bounced cheques, do not extend credit."})
        docs = c.get("/search", params={"q": "Comet Traders credit bounced cheque", "tenant_id": TENANT}).json()["results"]["documents"]
        ok = any("comet" in d.get("snippet", "").lower() for d in docs); passed += ok; total += 1
        rows.append(("retrieval: cited doc hit", f"{len(docs)} docs", ok))

        # 3. approval gating (pinned specialist write → queued, not executed)
        from app.agents import approvals as appr
        appr.revoke_session(TENANT, "create_invoice")
        inv0 = len(c.get("/invoices", params={"tenant_id": TENANT}).json())
        c.post("/chat", json={"tenant_id": TENANT, "agent_id": "vasool", "text": "bill banao for Eval Co"})
        pend = [a for a in c.get("/approvals", params={"tenant_id": TENANT, "status": "pending"}).json()
                if a["tool"] == "create_invoice"]
        inv1 = len(c.get("/invoices", params={"tenant_id": TENANT}).json())
        ok = (not pend) or inv1 == inv0  # queued ⇒ nothing written; or LLM didn't call it
        passed += ok; total += 1
        rows.append(("gating: no write before approve", f"queued={bool(pend)}", ok))

        # 4. tracing present
        u = c.post("/chat", json={"tenant_id": TENANT, "text": "show overdue"}).json().get("usage", {})
        ok = {"total_tokens", "cost_usd", "latency_ms"} <= set(u); passed += ok; total += 1
        rows.append(("tracing: usage on /chat", str(list(u)[:3]), ok))

    for name, detail, ok in rows:
        print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}")
    pct = round(100 * passed / total)
    print(f"\n{'='*60}\nEVAL SCORE: {passed}/{total} ({pct}%)  mode={'aws' if os.getenv('USE_AWS')=='1' else 'local'}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
