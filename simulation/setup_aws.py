"""One-shot AWS provisioner — creates every resource the app needs (boto3 only).

    USE_AWS=1 python simulation/setup_aws.py

Idempotent: skips anything that already exists. Needs a working profile first
(`aws configure --profile sahayak`). Creates the 13 DynamoDB tables + S3 bucket,
and kicks off SES sender verification (you must click the email). Bedrock model
access is an account-level console toggle — this script only checks it.
"""
import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

COLLS = ["specs", "invoices", "suppliers", "carriers", "alerts", "payables",
         "tasks", "notifications", "connectors", "settings", "activity",
         "memories", "artifacts", "documents", "listings", "approvals"]

if os.getenv("USE_AWS") != "1":
    print("USE_AWS != 1 — set it in .env first"); sys.exit(1)

import boto3
from botocore.exceptions import ClientError

region = os.getenv("AWS_REGION", "us-east-1")
profile = os.getenv("AWS_PROFILE")
try:
    session = boto3.Session(profile_name=profile, region_name=region)
    ident = session.client("sts").get_caller_identity()
    print(f"[ok] authenticated as {ident['Arn']} (region={region})")
except Exception as e:
    print(f"[FAIL] no working credentials for profile={profile!r}: {e}")
    print("→ run:  aws configure --profile", profile)
    sys.exit(1)


def create_tables():
    ddb = session.client("dynamodb")
    existing = set(ddb.list_tables()["TableNames"])
    for c in COLLS:
        name = os.getenv(f"DDB_TABLE_{c.upper()}", f"sahayak-{c}")
        if name in existing:
            print(f"[skip] table {name} exists")
            continue
        ddb.create_table(
            TableName=name,
            AttributeDefinitions=[
                {"AttributeName": "tenant_id", "AttributeType": "S"},
                {"AttributeName": "id", "AttributeType": "S"},
            ],
            KeySchema=[
                {"AttributeName": "tenant_id", "KeyType": "HASH"},
                {"AttributeName": "id", "KeyType": "RANGE"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        print(f"[create] table {name} …")
    # wait until all are ACTIVE
    for c in COLLS:
        name = os.getenv(f"DDB_TABLE_{c.upper()}", f"sahayak-{c}")
        ddb.get_waiter("table_exists").wait(TableName=name)
    print(f"[ok] {len(COLLS)} DynamoDB tables ready")


def create_bucket():
    bucket = os.getenv("S3_BUCKET", "sahayak-sessions")
    s3 = session.client("s3")
    try:
        s3.head_bucket(Bucket=bucket)
        print(f"[skip] bucket {bucket} exists")
        return
    except ClientError:
        pass
    kwargs = {"Bucket": bucket}
    if region != "us-east-1":  # us-east-1 rejects an explicit LocationConstraint
        kwargs["CreateBucketConfiguration"] = {"LocationConstraint": region}
    s3.create_bucket(**kwargs)
    print(f"[ok] bucket {bucket} created")


def verify_ses():
    sender = os.getenv("SES_SENDER", "")
    if not sender:
        print("[skip] no SES_SENDER set"); return
    ses = session.client("ses")
    ids = ses.list_identities()["Identities"]
    if sender in ids:
        attrs = ses.get_identity_verification_attributes(Identities=[sender])
        st = attrs["VerificationAttributes"].get(sender, {}).get("VerificationStatus")
        print(f"[ok] SES {sender}: {st}")
    else:
        ses.verify_email_identity(EmailAddress=sender)
        print(f"[action] verification email sent to {sender} — click the link, then re-run check_aws.py")


def check_bedrock():
    try:
        rt = session.client("bedrock-runtime")
        rt.converse(modelId=os.getenv("WORKER_MODEL", "apac.amazon.nova-lite-v1:0"),
                    messages=[{"role": "user", "content": [{"text": "ok"}]}])
        print("[ok] Bedrock worker model reachable")
    except Exception as e:
        print(f"[action] Bedrock not reachable ({type(e).__name__}) — enable Nova Lite+Pro "
              "in Bedrock console → Model access")


if __name__ == "__main__":
    create_tables()
    create_bucket()
    verify_ses()
    check_bedrock()
    print("\nDone. Now run:  USE_AWS=1 backend/.venv/bin/python simulation/check_aws.py")
