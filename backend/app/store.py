"""Store interface — every persistence call goes through this seam.

LocalStore (JSON files, USE_AWS=0) and DynamoStore (DynamoDB, USE_AWS=1)
implement the same contract. backend/tests/unit/test_store_parity.py runs the
SAME suite against both so the AWS swap is provably safe.
"""
from __future__ import annotations

import copy
import json
import os
import threading
from abc import ABC, abstractmethod
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class Store(ABC):
    """All collections are tenant-scoped. Every method takes tenant_id first."""

    # agent specs
    @abstractmethod
    def list_specs(self, tenant_id: str) -> list[dict]: ...
    @abstractmethod
    def get_spec(self, tenant_id: str, spec_id: str) -> dict | None: ...
    @abstractmethod
    def put_spec(self, tenant_id: str, spec: dict) -> dict: ...

    # invoices
    @abstractmethod
    def list_invoices(self, tenant_id: str, status: str | None = None) -> list[dict]: ...
    @abstractmethod
    def get_invoice(self, tenant_id: str, invoice_id: str) -> dict | None: ...
    @abstractmethod
    def put_invoice(self, tenant_id: str, invoice: dict) -> dict: ...
    @abstractmethod
    def update_invoice(self, tenant_id: str, invoice_id: str, **fields) -> dict | None: ...

    # suppliers
    @abstractmethod
    def list_suppliers(self, tenant_id: str, q: str | None = None) -> list[dict]: ...

    # carriers
    @abstractmethod
    def list_carriers(self, tenant_id: str, to: str | None = None) -> list[dict]: ...

    # alerts
    @abstractmethod
    def list_alerts(self, tenant_id: str, status: str | None = None) -> list[dict]: ...
    @abstractmethod
    def put_alert(self, tenant_id: str, alert: dict) -> dict: ...
    @abstractmethod
    def update_alert(self, tenant_id: str, alert_id: str, **fields) -> dict | None: ...

    # payables (cashflow)
    @abstractmethod
    def list_payables(self, tenant_id: str) -> list[dict]: ...

    # seed/reset
    @abstractmethod
    def reset(self, tenant_id: str, seed: dict) -> None: ...


class LocalStore(Store):
    """One JSON file per collection under backend/data/, shaped {tenant_id: [rows]}."""

    _COLLECTIONS = ("specs", "invoices", "suppliers", "carriers", "alerts", "payables")

    def __init__(self, data_dir: Path | None = None):
        self.dir = data_dir or DATA_DIR
        self.dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        for c in self._COLLECTIONS:
            f = self.dir / f"{c}.json"
            if not f.exists():
                f.write_text("{}")

    def _read(self, coll: str) -> dict:
        f = self.dir / f"{coll}.json"
        with self._lock:
            return json.loads(f.read_text() or "{}")

    def _write(self, coll: str, data: dict) -> None:
        f = self.dir / f"{coll}.json"
        tmp = f.with_suffix(".tmp")
        with self._lock:
            tmp.write_text(json.dumps(data, indent=2, default=str))
            os.replace(tmp, f)

    def _rows(self, coll: str, tenant_id: str) -> list[dict]:
        return copy.deepcopy(self._read(coll).get(tenant_id, []))

    def _put(self, coll: str, tenant_id: str, row: dict) -> dict:
        data = self._read(coll)
        rows = data.setdefault(tenant_id, [])
        for i, r in enumerate(rows):
            if r.get("id") == row.get("id"):
                rows[i] = row
                self._write(coll, data)
                return copy.deepcopy(row)
        rows.append(row)
        self._write(coll, data)
        return copy.deepcopy(row)

    def _update(self, coll: str, tenant_id: str, row_id: str, **fields) -> dict | None:
        data = self._read(coll)
        rows = data.setdefault(tenant_id, [])
        for r in rows:
            if r.get("id") == row_id:
                r.update(fields)
                self._write(coll, data)
                return copy.deepcopy(r)
        return None

    # specs
    def list_specs(self, tenant_id):
        return self._rows("specs", tenant_id)

    def get_spec(self, tenant_id, spec_id):
        return next((s for s in self.list_specs(tenant_id) if s["id"] == spec_id), None)

    def put_spec(self, tenant_id, spec):
        return self._put("specs", tenant_id, spec)

    # invoices
    def list_invoices(self, tenant_id, status=None):
        rows = self._rows("invoices", tenant_id)
        return [r for r in rows if status is None or r.get("status") == status]

    def get_invoice(self, tenant_id, invoice_id):
        return next((i for i in self.list_invoices(tenant_id) if i["id"] == invoice_id), None)

    def put_invoice(self, tenant_id, invoice):
        return self._put("invoices", tenant_id, invoice)

    def update_invoice(self, tenant_id, invoice_id, **fields):
        return self._update("invoices", tenant_id, invoice_id, **fields)

    # suppliers
    def list_suppliers(self, tenant_id, q=None):
        rows = self._rows("suppliers", tenant_id)
        if q:
            ql = q.lower()
            rows = [r for r in rows if ql in (r.get("name", "") + r.get("category", "")).lower()]
        return rows

    # carriers
    def list_carriers(self, tenant_id, to=None):
        rows = self._rows("carriers", tenant_id)
        if to:
            rows = [r for r in rows if to.lower() in r.get("route", "").lower()]
        return rows

    # alerts
    def list_alerts(self, tenant_id, status=None):
        rows = self._rows("alerts", tenant_id)
        return [r for r in rows if status is None or r.get("status") == status]

    def put_alert(self, tenant_id, alert):
        return self._put("alerts", tenant_id, alert)

    def update_alert(self, tenant_id, alert_id, **fields):
        return self._update("alerts", tenant_id, alert_id, **fields)

    # payables
    def list_payables(self, tenant_id):
        return self._rows("payables", tenant_id)

    def reset(self, tenant_id, seed):
        for coll in self._COLLECTIONS:
            if coll in seed:
                data = self._read(coll)
                data[tenant_id] = copy.deepcopy(seed[coll])
                self._write(coll, data)


class DynamoStore(Store):
    """DynamoDB impl — partner wires tables per plan §7. PK tenant_id, SK id."""

    _TABLES = {
        "specs": "DDB_TABLE_SPECS",
        "invoices": "DDB_TABLE_INVOICES",
        "suppliers": "DDB_TABLE_SUPPLIERS",
        "carriers": "DDB_TABLE_CARRIERS",
        "alerts": "DDB_TABLE_ALERTS",
        "payables": "DDB_TABLE_PAYABLES",
    }

    def __init__(self, region: str | None = None):
        import boto3
        from boto3.dynamodb.conditions import Key
        self._key = Key
        session = boto3.Session(
            profile_name=os.getenv("AWS_PROFILE") or None,
            region_name=region or os.getenv("AWS_REGION", "us-east-1"),
        )
        ddb = session.resource("dynamodb")
        self.tables = {coll: ddb.Table(os.getenv(env, f"sahayak-{coll}")) for coll, env in self._TABLES.items()}

    def _all(self, coll: str, tenant_id: str) -> list[dict]:
        resp = self.tables[coll].query(KeyConditionExpression=self._key("tenant_id").eq(tenant_id))
        return resp.get("Items", [])

    def _put(self, coll: str, tenant_id: str, row: dict) -> dict:
        self.tables[coll].put_item(Item={**row, "tenant_id": tenant_id})
        return row

    def _update(self, coll: str, tenant_id: str, row_id: str, **fields) -> dict | None:
        if not fields:
            return None
        expr = "SET " + ", ".join(f"#{k} = :{k}" for k in fields)
        self.tables[coll].update_item(
            Key={"tenant_id": tenant_id, "id": row_id},
            UpdateExpression=expr,
            ExpressionAttributeNames={f"#{k}": k for k in fields},
            ExpressionAttributeValues={f":{k}": v for k, v in fields.items()},
        )
        return self._put_get(coll, tenant_id, row_id)

    def _put_get(self, coll, tenant_id, row_id):
        resp = self.tables[coll].get_item(Key={"tenant_id": tenant_id, "id": row_id})
        return resp.get("Item")

    def list_specs(self, tenant_id):
        return self._all("specs", tenant_id)

    def get_spec(self, tenant_id, spec_id):
        return self._put_get("specs", tenant_id, spec_id)

    def put_spec(self, tenant_id, spec):
        return self._put("specs", tenant_id, spec)

    def list_invoices(self, tenant_id, status=None):
        rows = self._all("invoices", tenant_id)
        return [r for r in rows if status is None or r.get("status") == status]

    def get_invoice(self, tenant_id, invoice_id):
        return self._put_get("invoices", tenant_id, invoice_id)

    def put_invoice(self, tenant_id, invoice):
        return self._put("invoices", tenant_id, invoice)

    def update_invoice(self, tenant_id, invoice_id, **fields):
        return self._update("invoices", tenant_id, invoice_id, **fields)

    def list_suppliers(self, tenant_id, q=None):
        rows = self._all("suppliers", tenant_id)
        if q:
            ql = q.lower()
            rows = [r for r in rows if ql in (r.get("name", "") + r.get("category", "")).lower()]
        return rows

    def list_carriers(self, tenant_id, to=None):
        rows = self._all("carriers", tenant_id)
        if to:
            rows = [r for r in rows if to.lower() in r.get("route", "").lower()]
        return rows

    def list_alerts(self, tenant_id, status=None):
        rows = self._all("alerts", tenant_id)
        return [r for r in rows if status is None or r.get("status") == status]

    def put_alert(self, tenant_id, alert):
        return self._put("alerts", tenant_id, alert)

    def update_alert(self, tenant_id, alert_id, **fields):
        return self._update("alerts", tenant_id, alert_id, **fields)

    def list_payables(self, tenant_id):
        return self._all("payables", tenant_id)

    def reset(self, tenant_id, seed):
        for coll, rows in seed.items():
            if coll in self.tables:
                for row in rows:
                    self._put(coll, tenant_id, copy.deepcopy(row))


def get_store() -> Store:
    if os.getenv("USE_AWS", "0") == "1":
        return DynamoStore()
    return LocalStore()
