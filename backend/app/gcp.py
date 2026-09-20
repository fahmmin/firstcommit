"""Google Workspace connector — REAL reads via a service account.

Auth: `GOOGLE_SERVICE_ACCOUNT_JSON` (full key JSON — Lambda-friendly) or
`GOOGLE_SA_KEY_FILE` (local path). The owner shares Drive files, Sheets, Docs,
or a Calendar with the SA's email — sync then reads them for real and feeds
them into the business-context pipeline. No OAuth consent screen needed;
"connect" = share to the SA address.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

_SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
]


def _sa_info() -> dict | None:
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if raw:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None
    path = os.getenv("GOOGLE_SA_KEY_FILE", "").strip()
    if path:
        # resolve relative paths against the repo root, not the launch cwd
        if not os.path.isabs(path) and not os.path.exists(path):
            path = str(Path(__file__).resolve().parents[2] / path)
        if os.path.exists(path):
            try:
                return json.load(open(path, encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                return None
    return None


def available() -> bool:
    return _sa_info() is not None


def sa_email() -> str:
    info = _sa_info() or {}
    return info.get("client_email", "")


def _service(api: str, version: str):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    creds = service_account.Credentials.from_service_account_info(_sa_info(), scopes=_SCOPES)
    return build(api, version, credentials=creds, cache_discovery=False)


def list_drive_files(limit: int = 50) -> list[dict]:
    """Files shared with the SA (its Drive is otherwise empty)."""
    r = (_service("drive", "v3").files()
         .list(pageSize=limit, fields="files(id,name,mimeType,modifiedTime,size)",
               orderBy="modifiedTime desc").execute())
    return r.get("files", [])


def download_text(file_id: str, mime_type: str) -> str:
    """Text of a Drive file — Google-native types export, binaries download."""
    drive = _service("drive", "v3")
    export_map = {
        "application/vnd.google-apps.document": "text/plain",
        "application/vnd.google-apps.spreadsheet": "text/csv",
        "application/vnd.google-apps.presentation": "text/plain",
    }
    if mime_type in export_map:
        data = drive.files().export(fileId=file_id, mimeType=export_map[mime_type]).execute()
    else:
        data = drive.files().get_media(fileId=file_id).execute()
    if isinstance(data, bytes):
        return data.decode("utf-8", errors="replace")
    return str(data)


def download_bytes(file_id: str) -> bytes:
    """Raw bytes — for pdf/xlsx so the real extractors (textract/openpyxl) run."""
    data = _service("drive", "v3").files().get_media(fileId=file_id).execute()
    return data if isinstance(data, bytes) else str(data).encode()


def read_sheet(file_id: str, rng: str = "A1:Z500") -> list[list]:
    r = (_service("sheets", "v4").spreadsheets().values()
         .get(spreadsheetId=file_id, range=rng).execute())
    return r.get("values", [])


def read_doc(file_id: str) -> str:
    doc = _service("docs", "v1").documents().get(documentId=file_id).execute()
    parts = []
    for el in doc.get("body", {}).get("content", []):
        for seg in el.get("paragraph", {}).get("elements", []):
            parts.append(seg.get("textRun", {}).get("content", ""))
    return "".join(parts).strip()


def list_calendar_events(limit: int = 25) -> list[dict]:
    """Events from every calendar shared with the SA."""
    cal = _service("calendar", "v3")
    out = []
    for entry in cal.calendarList().list().execute().get("items", []):
        cid = entry["id"]
        try:
            ev = (cal.events().list(calendarId=cid, maxResults=limit,
                                    singleEvents=True, orderBy="startTime").execute())
            for e in ev.get("items", []):
                out.append({"calendar": entry.get("summary", cid),
                            "summary": e.get("summary", ""),
                            "start": (e.get("start") or {}).get("dateTime")
                                     or (e.get("start") or {}).get("date", ""),
                            "id": e.get("id", "")})
        except Exception:
            continue
    return out
