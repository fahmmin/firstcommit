"""Store-parity suite — the SAME tests must pass on LocalStore AND DynamoStore.

    USE_AWS=1 pytest tests/unit/test_store_parity.py   # runs the AWS impl too

This is the proof the AWS swap is safe: if both impls pass, every feature
built on the interface works identically on AWS.
"""
import os
import pytest

from app.store import LocalStore


IMPLS = ["local"] + (["dynamo"] if os.getenv("USE_AWS", "0") == "1" else [])


@pytest.mark.parametrize("impl", IMPLS)
class TestStoreParity:
    T = "t1"

    _ALL_COLLECTIONS = ("specs", "invoices", "suppliers", "carriers", "alerts", "payables",
                        "tasks", "notifications", "connectors", "settings", "activity")

    def _store(self, impl, tmp_path):
        if impl == "local":
            return LocalStore(data_dir=tmp_path / "data")
        from app.store import DynamoStore
        s = DynamoStore()
        s.reset(self.T, {c: [] for c in self._ALL_COLLECTIONS})  # tmp_path equivalent
        return s

    def test_spec_roundtrip(self, impl, tmp_path):
        s = self._store(impl, tmp_path)
        spec = {"id": "a1", "name": "X", "goal": "g", "tools": ["list_overdue"]}
        s.put_spec(self.T, spec)
        assert s.get_spec(self.T, "a1")["name"] == "X"
        assert len(s.list_specs(self.T)) == 1

    def test_invoice_status_filter(self, impl, tmp_path):
        s = self._store(impl, tmp_path)
        s.put_invoice(self.T, {"id": "i1", "status": "overdue", "amount": 100})
        s.put_invoice(self.T, {"id": "i2", "status": "paid", "amount": 200})
        assert [r["id"] for r in s.list_invoices(self.T, status="overdue")] == ["i1"]
        assert len(s.list_invoices(self.T)) == 2

    def test_invoice_update(self, impl, tmp_path):
        s = self._store(impl, tmp_path)
        s.put_invoice(self.T, {"id": "i1", "status": "sent"})
        s.update_invoice(self.T, "i1", status="paid")
        assert s.get_invoice(self.T, "i1")["status"] == "paid"

    def test_alert_update(self, impl, tmp_path):
        s = self._store(impl, tmp_path)
        s.put_alert(self.T, {"id": "al1", "status": "scheduled", "kind": "reminder"})
        s.update_alert(self.T, "al1", status="sent", via="ses")
        got = s.list_alerts(self.T, status="sent")
        assert len(got) == 1 and got[0]["via"] == "ses"

    def test_tenant_isolation(self, impl, tmp_path):
        s = self._store(impl, tmp_path)
        s.put_invoice("tenant_a", {"id": "i1"})
        assert s.list_invoices("tenant_b") == []
        assert s.get_invoice("tenant_b", "i1") is None

    def test_supplier_search(self, impl, tmp_path):
        s = self._store(impl, tmp_path)
        s.put_spec(self.T, {"id": "x"})  # ensure collection exists across impls
        if hasattr(s, "_rows"):
            pass
        s.reset(self.T, {"suppliers": [
            {"id": "s1", "name": "Balaji Steel", "category": "raw steel"},
            {"id": "s2", "name": "Om Rubber", "category": "rubber sheets"},
        ]})
        assert len(s.list_suppliers(self.T, q="steel")) >= 1
        assert all("steel" in (r["name"] + r["category"]).lower() for r in s.list_suppliers(self.T, q="steel"))

    def test_carriers_route_filter(self, impl, tmp_path):
        s = self._store(impl, tmp_path)
        s.reset(self.T, {"carriers": [
            {"id": "c1", "name": "VRL", "route": "Faridabad→Ludhiana"},
            {"id": "c2", "name": "TCI", "route": "Faridabad→Delhi"},
        ]})
        res = s.list_carriers(self.T, to="ludhiana")
        assert len(res) == 1 and res[0]["name"] == "VRL"

    def test_task_roundtrip(self, impl, tmp_path):
        s = self._store(impl, tmp_path)
        s.put_task(self.T, {"id": "t1", "title": "x", "status": "todo"})
        s.update_task(self.T, "t1", status="done", result="ok")
        assert s.get_task(self.T, "t1")["status"] == "done"
        assert [t["id"] for t in s.list_tasks(self.T, status="todo")] == []

    def test_settings_roundtrip(self, impl, tmp_path):
        s = self._store(impl, tmp_path)
        s.put_settings(self.T, {"business": {"name": "B"}, "prefs": {"language": "hi"}})
        assert s.get_settings(self.T)["prefs"]["language"] == "hi"
        s.put_settings(self.T, {"business": {"name": "B2"}, "prefs": {}})
        assert s.get_settings(self.T)["business"]["name"] == "B2"

    def test_notification_and_activity(self, impl, tmp_path):
        s = self._store(impl, tmp_path)
        s.put_notification(self.T, {"id": "n1", "status": "unread", "title": "t"})
        s.update_notification(self.T, "n1", status="read")
        assert s.list_notifications(self.T)[0]["status"] == "read"
        s.put_activity(self.T, {"id": "a1", "ts": "2026-09-19T00:00:00Z", "kind": "k", "text": "x"})
        s.put_activity(self.T, {"id": "a2", "ts": "2026-09-19T01:00:00Z", "kind": "k", "text": "y"})
        assert s.list_activity(self.T)[0]["id"] == "a2"  # newest first

    def test_connector_roundtrip(self, impl, tmp_path):
        s = self._store(impl, tmp_path)
        s.put_connector(self.T, {"id": "airtable", "status": "available"})
        s.update_connector(self.T, "airtable", status="connected", items_synced=32)
        assert s.list_connectors(self.T)[0]["items_synced"] == 32
