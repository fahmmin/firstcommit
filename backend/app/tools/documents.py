"""Business-context document brain — drop any file/note, agents organize it.

Pipeline (each step degrades gracefully so USE_AWS=0 always works):
  extract text  → Textract (pdf/image, AWS) → Bedrock vision → openpyxl/csv/plain
  auto-tag+summary → Bedrock Nova converse → keyword heuristic
  embed         → Bedrock Titan (AWS) → skipped offline
Stored in the `documents` collection, summaries injected into agent memory
(`build_context_suffix`), and made content-searchable in GET /search.
"""
from __future__ import annotations

import csv
import io
import json
import math
import os
import uuid
from datetime import datetime, timezone

from .. import deps

_TAG_KEYWORDS = {
    "tax": ["gst", "gstr", "itr", "tax", "tds", "hsn", "cess", "return"],
    "finance": ["invoice", "ledger", "payment", "receivable", "payable", "balance", "statement", "bank"],
    "legal": ["agreement", "contract", "legal", "nda", "terms", "license", "deed", "notice"],
    "procurement": ["supplier", "vendor", "purchase", "rate", "quote", "moq", "material", "price"],
    "logistics": ["carrier", "transport", "delivery", "pickup", "shipment", "lorry", "freight", "eway"],
}

_KIND_BY_EXT = {
    ".pdf": "pdf", ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image",
    ".gif": "image", ".xlsx": "spreadsheet", ".xls": "spreadsheet", ".csv": "spreadsheet",
    ".txt": "note", ".md": "note",
}


def _use_aws() -> bool:
    return os.getenv("USE_AWS", "0") == "1"


def _kind(filename: str) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    return _KIND_BY_EXT.get(ext, "document")


# ---------- text extraction ----------

def _extract_spreadsheet(file_path: str, ext: str) -> str:
    if ext == ".csv":
        with open(file_path, newline="", encoding="utf-8", errors="replace") as f:
            return "\n".join(", ".join(row) for row in csv.reader(f))
    from openpyxl import load_workbook
    wb = load_workbook(file_path, read_only=True, data_only=True)
    lines = []
    for ws in wb.worksheets:
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i > 40:
                break
            lines.append(", ".join("" if c is None else str(c) for c in row))
    wb.close()
    return "\n".join(lines)


def _extract_via_textract(file_path: str) -> str:
    import boto3
    session = boto3.Session(profile_name=os.getenv("AWS_PROFILE") or None,
                            region_name=os.getenv("AWS_REGION", "us-east-1"))
    client = session.client("textract")
    with open(file_path, "rb") as f:
        data = f.read()
    resp = client.detect_document_text(Document={"Bytes": data})
    return "\n".join(b["Text"] for b in resp.get("Blocks", []) if b.get("BlockType") == "LINE")


def extract_text(file_path: str | None, filename: str, note: str | None = None) -> str:
    if note:
        return note
    if not file_path:
        return filename
    ext = os.path.splitext(filename or "")[1].lower()
    try:
        if ext in (".xlsx", ".xls", ".csv"):
            return _extract_spreadsheet(file_path, ext)
        if ext in (".txt", ".md"):
            with open(file_path, encoding="utf-8", errors="replace") as f:
                return f.read()
        if ext in (".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"):
            if _use_aws():
                try:
                    return _extract_via_textract(file_path)
                except Exception as e:
                    print(f"[documents] textract failed ({type(e).__name__}): {e} — filename only")
            return filename  # offline: no OCR, tag by filename
        with open(file_path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        print(f"[documents] extract failed ({type(e).__name__}): {e}")
        return filename


# ---------- auto-tag + summary ----------

def _heuristic_tags(text: str, filename: str) -> list[str]:
    hay = f"{filename} {text}".lower()
    tags = [tag for tag, kws in _TAG_KEYWORDS.items() if any(k in hay for k in kws)]
    return tags or ["general"]


def _auto_tag(text: str, filename: str) -> tuple[list[str], str]:
    excerpt = (text or "")[:4000]
    if _use_aws():
        try:
            import boto3
            session = boto3.Session(profile_name=os.getenv("AWS_PROFILE") or None,
                                    region_name=os.getenv("AWS_REGION", "us-east-1"))
            client = session.client("bedrock-runtime")
            resp = client.converse(
                modelId=os.getenv("WORKER_MODEL", "apac.amazon.nova-lite-v1:0"),
                messages=[{"role": "user", "content": [{"text": (
                    "Classify this business document for an Indian SMB. Return strict JSON: "
                    '{"tags": [subset of tax,finance,legal,procurement,logistics,general], '
                    '"summary": "one short sentence"}. Document:\n\n' + excerpt)}]}],
            )
            out = resp["output"]["message"]["content"][0]["text"]
            data = json.loads(out[out.find("{"):out.rfind("}") + 1])
            tags = [t for t in data.get("tags", []) if t] or _heuristic_tags(text, filename)
            summary = data.get("summary") or f"{filename} — business document"
            return tags[:4], summary
        except Exception as e:
            print(f"[documents] bedrock auto-tag failed ({type(e).__name__}): {e} — heuristic")
    tags = _heuristic_tags(text, filename)
    first = next((ln.strip() for ln in (text or "").splitlines() if ln.strip()), "")
    summary = (first[:120] or f"{filename} — business document")
    return tags, summary


# ---------- embeddings (Titan) ----------

def embed_text(text: str) -> list[float] | None:
    if not _use_aws() or not text:
        return None
    try:
        import boto3
        session = boto3.Session(profile_name=os.getenv("AWS_PROFILE") or None,
                                region_name=os.getenv("AWS_REGION", "us-east-1"))
        client = session.client("bedrock-runtime")
        resp = client.invoke_model(
            modelId=os.getenv("EMBED_MODEL", "amazon.titan-embed-text-v2:0"),
            body=json.dumps({"inputText": text[:8000]}),
        )
        return json.loads(resp["body"].read())["embedding"]
    except Exception as e:
        print(f"[documents] titan embed failed ({type(e).__name__}): {e}")
        return None


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


# ---------- ingest ----------

def _upload_to_s3(tenant_id: str, doc_id: str, file_path: str, filename: str) -> str | None:
    """Persist the raw file so it can be rendered/previewed later.
    Returns the s3 key, or None when AWS is off."""
    if not _use_aws() or not file_path:
        return None
    try:
        import boto3
        session = boto3.Session(profile_name=os.getenv("AWS_PROFILE") or None,
                                region_name=os.getenv("AWS_REGION", "us-east-1"))
        s3 = session.client("s3")
        bucket = os.getenv("S3_BUCKET", "sahayak-sessions")
        key = f"context/{tenant_id}/docs/{doc_id}-{filename}"
        s3.upload_file(file_path, bucket, key)
        return key
    except Exception as e:
        print(f"[documents] s3 upload failed ({type(e).__name__}): {e} — metadata only")
        return None


def ingest_document_impl(tenant_id: str, file_path: str | None = None,
                         filename: str | None = None, note: str | None = None) -> dict:
    filename = filename or ("note.txt" if note else "document")
    text = extract_text(file_path, filename, note=note)
    tags, summary = _auto_tag(text, filename)
    doc_id = f"doc-{uuid.uuid4().hex[:6]}"
    s3_key = _upload_to_s3(tenant_id, doc_id, file_path, filename)
    doc = {
        "id": doc_id,
        "filename": filename,
        "kind": "note" if note else _kind(filename),
        "tags": tags,
        "summary": summary,
        "text_excerpt": (text or "")[:2000],
        "embedding": embed_text(text),
        "status": "fed_to_agents",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if s3_key:
        doc["s3_key"] = s3_key
    elif file_path:
        doc["file_path"] = file_path  # local mode — bytes stay on disk
    deps.store.put_document(tenant_id, doc)
    deps.record_action("context_added", {"id": doc["id"], "filename": filename, "tags": tags})
    deps.log_activity(tenant_id, "context_added",
                      f"Added '{filename}' to business context ({', '.join(tags)})")
    # rebuild agents so the new context reaches their memory
    from ..agents import registry as reg
    reg.get_registry(tenant_id).reset_agents()
    return {k: v for k, v in doc.items() if k not in ("embedding", "text_excerpt")}


def build_context_suffix(tenant_id: str) -> str:
    """Document summaries injected into agent prompts (companion to memories)."""
    if deps.store is None:
        return ""
    docs = deps.store.list_documents(tenant_id)
    if not docs:
        return ""
    lines = "\n".join(f"- {d.get('filename', '')}: {d.get('summary', '')}"
                      f" [{', '.join(d.get('tags', []))}]" for d in docs[:20])
    return "\n\nBusiness documents the owner has shared (cite them when relevant):\n" + lines
