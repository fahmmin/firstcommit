"""Verify the AWS handoff: creds, tables, bucket, SES, Bedrock.

    USE_AWS=1 python simulation/check_aws.py

Run after Ayush sends credentials. Every line = one thing that must work
for the demo to run against real AWS.
"""
import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

COLLS = ["specs", "invoices", "suppliers", "carriers", "alerts", "payables",
         "tasks", "notifications", "connectors", "settings", "activity"]

ok = fail = 0
def check(name, fn):
    global ok, fail
    try:
        detail = fn()
        print(f"[PASS] {name}: {detail}")
        ok += 1
    except Exception as e:
        print(f"[FAIL] {name}: {e}")
        fail += 1

if os.getenv("USE_AWS") != "1":
    print("USE_AWS != 1 — set it in .env first"); sys.exit(1)

import boto3
region = os.getenv("AWS_REGION", "us-east-1")
profile = os.getenv("AWS_PROFILE")
try:
    session = boto3.Session(profile_name=profile, region_name=region)
except Exception as e:
    print(f"[FAIL] session: {e}")
    print("→ ask Ayush for IAM access key + secret, then EITHER run")
    print("  `aws configure --profile " + str(profile) + "`  OR add to .env:")
    print("  AWS_ACCESS_KEY_ID=...  /  AWS_SECRET_ACCESS_KEY=...")
    sys.exit(1)

check(f"credentials (profile={profile or 'env-vars'})",
      lambda: session.client("sts").get_caller_identity()["Arn"])

def tables():
    ddb = session.resource("dynamodb")
    names = {c: os.getenv(f"DDB_TABLE_{c.upper()}", f"sahayak-{c}") for c in COLLS}
    for c, t in names.items():
        ddb.Table(t).load()  # raises if missing/no access
    return f"{len(names)} tables: {', '.join(sorted(set(names.values())))}"
check("DynamoDB tables", tables)

check(f"S3 bucket ({os.getenv('S3_BUCKET','sahayak-sessions')})",
      lambda: session.client("s3").head_bucket(Bucket=os.getenv("S3_BUCKET", "sahayak-sessions")) or "exists")

def ses():
    ids = session.client("ses").list_identities()["Identities"]
    sender = os.getenv("SES_SENDER", "")
    assert sender in ids, f"{sender} NOT a verified identity (verified: {ids})"
    return f"sender verified: {sender}"
check("SES sender", ses)

def bedrock():
    rt = session.client("bedrock-runtime")
    r = rt.converse(modelId=os.getenv("WORKER_MODEL", "apac.amazon.nova-lite-v1:0"),
                    messages=[{"role": "user", "content": [{"text": "reply with: ok"}]}])
    return r["output"]["message"]["content"][0]["text"]
check("Bedrock converse (worker model)", bedrock)

print(f"\n{ok} passed, {fail} failed")
sys.exit(0 if fail == 0 else 1)
