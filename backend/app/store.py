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

DATA_DIR = (Path(os.environ["SAHAYAK_DATA_DIR"]) if os.environ.get("SAHAYAK_DATA_DIR")
            else Path("/tmp/sahayak-data") if os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
            else Path(__file__).resolve().parent.parent / "data")


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

    # tasks
    @abstractmethod
    def list_tasks(self, tenant_id: str, status: str | None = None) -> list[dict]: ...
    @abstractmethod
    def get_task(self, tenant_id: str, task_id: str) -> dict | None: ...
    @abstractmethod
    def put_task(self, tenant_id: str, task: dict) -> dict: ...
    @abstractmethod
    def update_task(self, tenant_id: str, task_id: str, **fields) -> dict | None: ...

    # notifications
    @abstractmethod
    def list_notifications(self, tenant_id: str) -> list[dict]: ...
    @abstractmethod
    def put_notification(self, tenant_id: str, note: dict) -> dict: ...
    @abstractmethod
    def update_notification(self, tenant_id: str, note_id: str, **fields) -> dict | None: ...

    # connectors
    @abstractmethod
    def list_connectors(self, tenant_id: str) -> list[dict]: ...
    @abstractmethod
    def put_connector(self, tenant_id: str, conn: dict) -> dict: ...
    @abstractmethod
    def update_connector(self, tenant_id: str, conn_id: str, **fields) -> dict | None: ...

    # settings (single row per tenant, id="settings")
    @abstractmethod
    def get_settings(self, tenant_id: str) -> dict | None: ...
    @abstractmethod
    def put_settings(self, tenant_id: str, settings: dict) -> dict: ...

    # activity feed (dashboard "recent activity")
    @abstractmethod
    def list_activity(self, tenant_id: str, limit: int = 20) -> list[dict]: ...
    @abstractmethod
    def put_activity(self, tenant_id: str, event: dict) -> dict: ...

    # memories (business context — injected into every agent's system prompt)
    @abstractmethod
    def list_memories(self, tenant_id: str) -> list[dict]: ...
    @abstractmethod
    def put_memory(self, tenant_id: str, memory: dict) -> dict: ...
    @abstractmethod
    def delete_memory(self, tenant_id: str, memory_id: str) -> bool: ...

    # artifacts (template-bound mini-apps agents build via the create_artifact tool)
    @abstractmethod
    def list_artifacts(self, tenant_id: str) -> list[dict]: ...
    @abstractmethod
    def get_artifact(self, tenant_id: str, artifact_id: str) -> dict | None: ...
    @abstractmethod
    def put_artifact(self, tenant_id: str, artifact: dict) -> dict: ...
    @abstractmethod
    def update_artifact(self, tenant_id: str, artifact_id: str, **fields) -> dict | None: ...

    # listings (digital-presence: products pushed to marketplaces/storefront)
    @abstractmethod
    def list_listings(self, tenant_id: str, status: str | None = None) -> list[dict]: ...
    @abstractmethod
    def put_listing(self, tenant_id: str, listing: dict) -> dict: ...
    @abstractmethod
    def update_listing(self, tenant_id: str, listing_id: str, **fields) -> dict | None: ...

    # documents (business-context brain: any file/note, auto-tagged + searchable)
    @abstractmethod
    def list_documents(self, tenant_id: str) -> list[dict]: ...
    @abstractmethod
    def get_document(self, tenant_id: str, doc_id: str) -> dict | None: ...
    @abstractmethod
    def put_document(self, tenant_id: str, doc: dict) -> dict: ...
    @abstractmethod
    def update_document(self, tenant_id: str, doc_id: str, **fields) -> dict | None: ...
    @abstractmethod
    def delete_document(self, tenant_id: str, doc_id: str) -> bool: ...

    # approvals (durable action-approval ledger — A1)
    @abstractmethod
    def list_approvals(self, tenant_id: str) -> list[dict]: ...
    @abstractmethod
    def get_approval(self, tenant_id: str, approval_id: str) -> dict | None: ...
    @abstractmethod
    def put_approval(self, tenant_id: str, approval: dict) -> dict: ...
    @abstractmethod
    def update_approval(self, tenant_id: str, approval_id: str, **fields) -> dict | None: ...

    # seed/reset
    @abstractmethod
    def reset(self, tenant_id: str, seed: dict) -> None: ...


class LocalStore(Store):
    """One JSON file per collection under backend/data/, shaped {tenant_id: [rows]}."""

    _COLLECTIONS = ("specs", "invoices", "suppliers", "carriers", "alerts", "payables",
                    "tasks", "notifications", "connectors", "settings", "activity",
                    "memories", "artifacts", "documents", "listings", "approvals")

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
            return json.loads(f.read_text(encoding="utf-8") or "{}")

    def _write(self, coll: str, data: dict) -> None:
        f = self.dir / f"{coll}.json"
        tmp = f.with_suffix(".tmp")
        with self._lock:
            tmp.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
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

    def _delete(self, coll: str, tenant_id: str, row_id: str) -> bool:
        data = self._read(coll)
        rows = data.setdefault(tenant_id, [])
        kept = [r for r in rows if r.get("id") != row_id]
        if len(kept) == len(rows):
            return False
        data[tenant_id] = kept
        self._write(coll, data)
        return True

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

    # tasks
    def list_tasks(self, tenant_id, status=None):
        rows = self._rows("tasks", tenant_id)
        return [r for r in rows if status is None or r.get("status") == status]

    def get_task(self, tenant_id, task_id):
        return next((t for t in self.list_tasks(tenant_id) if t["id"] == task_id), None)

    def put_task(self, tenant_id, task):
        return self._put("tasks", tenant_id, task)

    def update_task(self, tenant_id, task_id, **fields):
        return self._update("tasks", tenant_id, task_id, **fields)

    # notifications
    def list_notifications(self, tenant_id):
        return self._rows("notifications", tenant_id)

    def put_notification(self, tenant_id, note):
        return self._put("notifications", tenant_id, note)

    def update_notification(self, tenant_id, note_id, **fields):
        return self._update("notifications", tenant_id, note_id, **fields)

    # connectors
    def list_connectors(self, tenant_id):
        return self._rows("connectors", tenant_id)

    def put_connector(self, tenant_id, conn):
        return self._put("connectors", tenant_id, conn)

    def update_connector(self, tenant_id, conn_id, **fields):
        return self._update("connectors", tenant_id, conn_id, **fields)

    # listings
    def list_listings(self, tenant_id, status=None):
        rows = self._rows("listings", tenant_id)
        return [r for r in rows if status is None or r.get("status") == status]

    def put_listing(self, tenant_id, listing):
        return self._put("listings", tenant_id, listing)

    def update_listing(self, tenant_id, listing_id, **fields):
        return self._update("listings", tenant_id, listing_id, **fields)

    # settings
    def get_settings(self, tenant_id):
        return next((r for r in self._rows("settings", tenant_id) if r.get("id") == "settings"), None)

    def put_settings(self, tenant_id, settings):
        return self._put("settings", tenant_id, {**settings, "id": "settings"})

    # activity
    def list_activity(self, tenant_id, limit=20):
        rows = self._rows("activity", tenant_id)
        rows.sort(key=lambda r: r.get("ts", ""), reverse=True)
        return rows[:limit]

    def put_activity(self, tenant_id, event):
        return self._put("activity", tenant_id, event)

    # memories
    def list_memories(self, tenant_id):
        return self._rows("memories", tenant_id)

    def put_memory(self, tenant_id, memory):
        return self._put("memories", tenant_id, memory)

    def delete_memory(self, tenant_id, memory_id):
        return self._delete("memories", tenant_id, memory_id)

    # artifacts
    def list_artifacts(self, tenant_id):
        return self._rows("artifacts", tenant_id)

    def get_artifact(self, tenant_id, artifact_id):
        return next((a for a in self.list_artifacts(tenant_id) if a["id"] == artifact_id), None)

    def put_artifact(self, tenant_id, artifact):
        return self._put("artifacts", tenant_id, artifact)

    def update_artifact(self, tenant_id, artifact_id, **fields):
        return self._update("artifacts", tenant_id, artifact_id, **fields)

    # documents
    def list_documents(self, tenant_id):
        return self._rows("documents", tenant_id)

    def get_document(self, tenant_id, doc_id):
        return next((d for d in self.list_documents(tenant_id) if d["id"] == doc_id), None)

    def put_document(self, tenant_id, doc):
        return self._put("documents", tenant_id, doc)

    def update_document(self, tenant_id, doc_id, **fields):
        return self._update("documents", tenant_id, doc_id, **fields)

    def delete_document(self, tenant_id, doc_id):
        return self._delete("documents", tenant_id, doc_id)

    # approvals
    def list_approvals(self, tenant_id):
        return self._rows("approvals", tenant_id)

    def get_approval(self, tenant_id, approval_id):
        return next((a for a in self.list_approvals(tenant_id) if a["id"] == approval_id), None)

    def put_approval(self, tenant_id, approval):
        return self._put("approvals", tenant_id, approval)

    def update_approval(self, tenant_id, approval_id, **fields):
        return self._update("approvals", tenant_id, approval_id, **fields)

    def reset(self, tenant_id, seed):
        # every collection is reset for the tenant — ones absent from the seed
        # (approvals, …) are cleared, matching DynamoStore.reset
        for coll in self._COLLECTIONS:
            data = self._read(coll)
            if coll in seed:
                data[tenant_id] = copy.deepcopy(seed[coll])
            elif tenant_id in data:
                del data[tenant_id]
            else:
                continue
            self._write(coll, data)


def _to_ddb(v):
    """DynamoDB rejects floats — serialize to Decimal (recursively)."""
    from decimal import Decimal
    if isinstance(v, float):
        return Decimal(str(v))
    if isinstance(v, dict):
        return {k: _to_ddb(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_to_ddb(x) for x in v]
    return v


def _from_ddb(v):
    """Reads come back as Decimal — restore plain JSON types to match LocalStore."""
    from decimal import Decimal
    if isinstance(v, Decimal):
        return int(v) if v % 1 == 0 else float(v)
    if isinstance(v, dict):
        return {k: _from_ddb(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_from_ddb(x) for x in v]
    return v


class DynamoStore(Store):
    """DynamoDB impl — partner wires tables per plan §7. PK tenant_id, SK id."""

    _TABLES = {
        "specs": "DDB_TABLE_SPECS",
        "invoices": "DDB_TABLE_INVOICES",
        "suppliers": "DDB_TABLE_SUPPLIERS",
        "carriers": "DDB_TABLE_CARRIERS",
        "alerts": "DDB_TABLE_ALERTS",
        "payables": "DDB_TABLE_PAYABLES",
        "tasks": "DDB_TABLE_TASKS",
        "notifications": "DDB_TABLE_NOTIFICATIONS",
        "connectors": "DDB_TABLE_CONNECTORS",
        "settings": "DDB_TABLE_SETTINGS",
        "activity": "DDB_TABLE_ACTIVITY",
        "memories": "DDB_TABLE_MEMORIES",
        "artifacts": "DDB_TABLE_ARTIFACTS",
        "documents": "DDB_TABLE_DOCUMENTS",
        "listings": "DDB_TABLE_LISTINGS",
        "approvals": "DDB_TABLE_APPROVALS",
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
        # ConsistentRead: demo code does read-your-writes (create agent → GET /agents)
        resp = self.tables[coll].query(KeyConditionExpression=self._key("tenant_id").eq(tenant_id),
                                       ConsistentRead=True)
        return [_from_ddb(i) for i in resp.get("Items", [])]

    def _put(self, coll: str, tenant_id: str, row: dict) -> dict:
        self.tables[coll].put_item(Item=_to_ddb({**row, "tenant_id": tenant_id}))
        return row

    def _update(self, coll: str, tenant_id: str, row_id: str, **fields) -> dict | None:
        if not fields:
            return None
        expr = "SET " + ", ".join(f"#{k} = :{k}" for k in fields)
        try:
            self.tables[coll].update_item(
                Key={"tenant_id": tenant_id, "id": row_id},
                UpdateExpression=expr,
                # only update an EXISTING row — a bare UpdateExpression would upsert a
                # ghost row on an unknown id; this matches LocalStore (None on missing).
                ConditionExpression="attribute_exists(id)",
                ExpressionAttributeNames={f"#{k}": k for k in fields},
                ExpressionAttributeValues={f":{k}": _to_ddb(v) for k, v in fields.items()},
            )
        except self.tables[coll].meta.client.exceptions.ConditionalCheckFailedException:
            return None
        return self._put_get(coll, tenant_id, row_id)

    def _put_get(self, coll, tenant_id, row_id):
        resp = self.tables[coll].get_item(Key={"tenant_id": tenant_id, "id": row_id})
        item = resp.get("Item")
        return _from_ddb(item) if item else None

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

    # tasks
    def list_tasks(self, tenant_id, status=None):
        rows = self._all("tasks", tenant_id)
        return [r for r in rows if status is None or r.get("status") == status]

    def get_task(self, tenant_id, task_id):
        return self._put_get("tasks", tenant_id, task_id)

    def put_task(self, tenant_id, task):
        return self._put("tasks", tenant_id, task)

    def update_task(self, tenant_id, task_id, **fields):
        return self._update("tasks", tenant_id, task_id, **fields)

    # notifications
    def list_notifications(self, tenant_id):
        return self._all("notifications", tenant_id)

    def put_notification(self, tenant_id, note):
        return self._put("notifications", tenant_id, note)

    def update_notification(self, tenant_id, note_id, **fields):
        return self._update("notifications", tenant_id, note_id, **fields)

    # connectors
    def list_connectors(self, tenant_id):
        return self._all("connectors", tenant_id)

    def put_connector(self, tenant_id, conn):
        return self._put("connectors", tenant_id, conn)

    def update_connector(self, tenant_id, conn_id, **fields):
        return self._update("connectors", tenant_id, conn_id, **fields)

    # listings
    def list_listings(self, tenant_id, status=None):
        rows = self._all("listings", tenant_id)
        return [r for r in rows if status is None or r.get("status") == status]

    def put_listing(self, tenant_id, listing):
        return self._put("listings", tenant_id, listing)

    def update_listing(self, tenant_id, listing_id, **fields):
        return self._update("listings", tenant_id, listing_id, **fields)

    # settings
    def get_settings(self, tenant_id):
        return self._put_get("settings", tenant_id, "settings")

    def put_settings(self, tenant_id, settings):
        return self._put("settings", tenant_id, {**settings, "id": "settings"})

    # activity
    def list_activity(self, tenant_id, limit=20):
        rows = self._all("activity", tenant_id)
        rows.sort(key=lambda r: r.get("ts", ""), reverse=True)
        return rows[:limit]

    def put_activity(self, tenant_id, event):
        return self._put("activity", tenant_id, event)

    # memories
    def list_memories(self, tenant_id):
        return self._all("memories", tenant_id)

    def put_memory(self, tenant_id, memory):
        return self._put("memories", tenant_id, memory)

    def delete_memory(self, tenant_id, memory_id):
        if not self._put_get("memories", tenant_id, memory_id):
            return False
        self.tables["memories"].delete_item(Key={"tenant_id": tenant_id, "id": memory_id})
        return True

    # artifacts
    def list_artifacts(self, tenant_id):
        return self._all("artifacts", tenant_id)

    def get_artifact(self, tenant_id, artifact_id):
        return self._put_get("artifacts", tenant_id, artifact_id)

    def put_artifact(self, tenant_id, artifact):
        return self._put("artifacts", tenant_id, artifact)

    def update_artifact(self, tenant_id, artifact_id, **fields):
        return self._update("artifacts", tenant_id, artifact_id, **fields)

    # documents
    def list_documents(self, tenant_id):
        return self._all("documents", tenant_id)

    def get_document(self, tenant_id, doc_id):
        return self._put_get("documents", tenant_id, doc_id)

    def put_document(self, tenant_id, doc):
        return self._put("documents", tenant_id, doc)

    def update_document(self, tenant_id, doc_id, **fields):
        return self._update("documents", tenant_id, doc_id, **fields)

    def delete_document(self, tenant_id, doc_id):
        if not self._put_get("documents", tenant_id, doc_id):
            return False
        self.tables["documents"].delete_item(Key={"tenant_id": tenant_id, "id": doc_id})
        return True

    # approvals
    def list_approvals(self, tenant_id):
        return self._all("approvals", tenant_id)

    def get_approval(self, tenant_id, approval_id):
        return self._put_get("approvals", tenant_id, approval_id)

    def put_approval(self, tenant_id, approval):
        return self._put("approvals", tenant_id, approval)

    def update_approval(self, tenant_id, approval_id, **fields):
        return self._update("approvals", tenant_id, approval_id, **fields)

    def reset(self, tenant_id, seed):
        # clear every existing row for the tenant first — a spec-free seed
        # must also remove previously factory-created specs (parity w/ LocalStore)
        for coll in self.tables:
            for row in self._all(coll, tenant_id):
                self.tables[coll].delete_item(Key={"tenant_id": tenant_id, "id": row["id"]})
        for coll, rows in seed.items():
            if coll in self.tables:
                for row in rows:
                    self._put(coll, tenant_id, copy.deepcopy(row))


def get_store() -> Store:
    if os.getenv("USE_AWS", "0") == "1":
        return DynamoStore()
    return LocalStore()
