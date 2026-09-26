"""A1 approval engine — risk policy, session grants, queue→execute."""
from app import deps
from app.agents import approvals as appr


def test_risk_policy():
    assert appr.risk_for("list_overdue") == appr.AUTO       # reads auto
    assert appr.risk_for("create_invoice") == appr.ASK      # writes ask
    assert appr.risk_for("create_artifact") == appr.ASK


def test_decide_and_session_grant(tenant):
    appr.revoke_session(tenant, "create_invoice")
    assert appr.decide(tenant, "list_overdue") == appr.AUTO
    assert appr.decide(tenant, "create_invoice") == appr.ASK
    appr.grant_session(tenant, "create_invoice")            # owner grants for session
    assert appr.decide(tenant, "create_invoice") == appr.AUTO
    appr.revoke_session(tenant, "create_invoice")
    assert appr.decide(tenant, "create_invoice") == appr.ASK


def test_gate_queues_then_execute(tenant):
    appr.revoke_session(tenant, "create_invoice")
    before = len(deps.store.list_invoices(tenant))
    q = appr.gate(tenant, "create_invoice",
                  {"buyer": "Gate Test Co", "amount": 5000, "due_date": "2026-12-01"},
                  "Add invoice for Gate Test Co")
    assert q and q["queued"] and "approval" in q["reply"].lower()
    # nothing written yet
    assert len(deps.store.list_invoices(tenant)) == before
    ap = deps.store.get_approval(tenant, q["approval_id"])
    assert ap["status"] == "pending" and ap["tool"] == "create_invoice"
    # owner approves → executes
    res = appr.execute_action(tenant, q["approval_id"])
    assert res["status"] == "executed"
    assert len(deps.store.list_invoices(tenant)) == before + 1
    assert deps.store.get_approval(tenant, q["approval_id"])["status"] == "executed"
    # idempotent
    assert appr.execute_action(tenant, q["approval_id"])["status"] == "executed"


def test_gate_auto_when_granted(tenant):
    appr.grant_session(tenant, "create_invoice")
    q = appr.gate(tenant, "create_invoice", {"buyer": "X", "amount": 1}, "x")
    assert q is None   # auto-approved → proceed, no queue
    appr.revoke_session(tenant, "create_invoice")
