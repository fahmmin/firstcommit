"""Notifier interface — Console (local) ⇄ SES (AWS). Same contract as Store."""
from __future__ import annotations

import json
import os
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path

from .store import DATA_DIR


class Notifier(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, body: str, channel: str = "email") -> dict:
        """Returns {id, status, via, sent_at}."""


class ConsoleNotifier(Notifier):
    """'Sends' by printing + appending to data/sent_messages.json so the
    AlertsPanel can show a real sent feed in offline mode."""

    def __init__(self, data_dir: Path | None = None):
        self.log_file = (data_dir or DATA_DIR) / "sent_messages.json"
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.log_file.exists():
            self.log_file.write_text("[]")

    def send(self, to: str, subject: str, body: str, channel: str = "email") -> dict:
        msg = {
            "id": f"msg-{uuid.uuid4().hex[:8]}",
            "to": to,
            "subject": subject,
            "body": body,
            "channel": channel,
            "status": "sent",
            "via": "console",
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }
        log = json.loads(self.log_file.read_text(encoding="utf-8") or "[]")
        log.append(msg)
        self.log_file.write_text(json.dumps(log, indent=2), encoding="utf-8")
        print(f"\n📧 [{channel.upper()}] To: {to}\nSubject: {subject}\n{body}\n")
        return msg


class SESNotifier(Notifier):
    """SES sandbox caveat: `to` must be a verified address too."""

    def __init__(self, sender: str | None = None, region: str | None = None):
        import boto3
        self.sender = sender or os.getenv("SES_SENDER", "sahayak@example.com")
        session = boto3.Session(
            profile_name=os.getenv("AWS_PROFILE") or None,
            region_name=region or os.getenv("AWS_REGION", "us-east-1"),
        )
        self.client = session.client("ses")

    def send(self, to: str, subject: str, body: str, channel: str = "email") -> dict:
        try:
            resp = self.client.send_email(
                Source=self.sender,
                Destination={"ToAddresses": [to]},
                Message={
                    "Subject": {"Data": subject},
                    "Body": {"Text": {"Data": body}},
                },
            )
            return {
                "id": resp["MessageId"],
                "to": to,
                "subject": subject,
                "status": "sent",
                "via": "ses",
                "sent_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            # Sandbox rejects unverified recipients — degrade to console so the
            # approve→send flow still completes and lands in the sent feed.
            print(f"[notifier] SES send failed ({type(e).__name__}): {e} — console fallback")
            msg = ConsoleNotifier().send(to, subject, body, channel)
            msg["via"] = "ses-fallback-console"
            return msg


def get_notifier() -> Notifier:
    if os.getenv("USE_AWS", "0") == "1":
        return SESNotifier()
    return ConsoleNotifier()
