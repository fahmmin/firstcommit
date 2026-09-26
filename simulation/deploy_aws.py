"""deploy_aws.py — ship the demo.

  Backend  → Lambda (zip, python3.11) + Function URL (public, app-level gate)
  Timer    → EventBridge rule (rate 1 min) → the same function (Scheduled Event)
  Frontend → S3 static website bucket, built with VITE_API_URL=<function url>

  python simulation/deploy_aws.py            # full deploy
  python simulation/deploy_aws.py --package-only   # just build the lambda zip

Reads repo-root .env for AWS creds + table names (never forwards AWS keys into
the Lambda env — the execution role supplies them). Auth stays demo-only per
project rules: the gate is DEMO_GATE_TOKEN (x-demo-token header / ?gate= param),
public artifact shares stay open.

Idempotent — safe to re-run; updates code + config in place.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import boto3  # noqa: E402
from dotenv import dotenv_values  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
PKG = BUILD / "lambda_pkg"
ZIP = BUILD / "sahayak-api.zip"
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

FUNCTION_NAME = os.getenv("LAMBDA_FUNCTION_NAME", "sahayak-api")
ROLE_NAME = os.getenv("LAMBDA_ROLE_NAME", "sahayak-lambda-role")
RULE_NAME = "sahayak-scheduler"
RUNTIME_DEPS = [
    "strands-agents==1.56.0", "fastapi", "mangum", "python-dotenv", "python-multipart",
    "boto3", "pydantic", "openpyxl", "cedarpy", "fpdf2", "mcp>=2.1,<2.2",
    "google-api-python-client", "google-auth",  # gcp.py — google_* connectors
]
# forwarded to the Lambda env verbatim — never AWS keys/profile (role supplies
# creds) and never AWS_REGION (Lambda reserves + sets it itself)
ENV_FORWARD = ("USE_AWS", "ORCHESTRATOR_MODEL", "WORKER_MODEL",
               "EMBED_MODEL", "SES_SENDER", "S3_BUCKET", "DEFAULT_TENANT",
               "DEMO_GATE_TOKEN", "AUTH_SECRET", "TAVILY_API_KEY", "TOKEN_STORE",
               "GOOGLE_SERVICE_ACCOUNT_JSON")
LAMBDA_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {"Effect": "Allow", "Action": "dynamodb:*", "Resource": [
            "arn:aws:dynamodb:*:*:table/sahayak-*",
            "arn:aws:dynamodb:*:*:table/sahayak-*/index/*"]},
        {"Effect": "Allow", "Action": "s3:*", "Resource": [
            "arn:aws:s3:::sahayak-*", "arn:aws:s3:::sahayak-*/*"]},
        {"Effect": "Allow", "Action": ["bedrock:InvokeModel", "bedrock:Converse",
                                       "bedrock:InvokeModelWithResponseStream",
                                       "bedrock:ConverseStream"], "Resource": "*"},
        {"Effect": "Allow", "Action": ["textract:DetectDocumentText",
                                       "textract:AnalyzeDocument"], "Resource": "*"},
        {"Effect": "Allow", "Action": ["ses:SendEmail", "ses:SendRawEmail"],
         "Resource": "*"},
        {"Effect": "Allow", "Action": "secretsmanager:GetSecretValue", "Resource": "*"},
    ],
}

_env = {**dotenv_values(ROOT / ".env"), **os.environ}
REGION = _env.get("AWS_REGION", "us-east-1")
session = boto3.Session(
    aws_access_key_id=_env.get("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=_env.get("AWS_SECRET_ACCESS_KEY"),
    profile_name=_env.get("AWS_PROFILE") or None,
    region_name=REGION,
) if (_env.get("AWS_ACCESS_KEY_ID") or _env.get("AWS_PROFILE")) else boto3.Session(region_name=REGION)
acct = session.client("sts").get_caller_identity()["Account"]
print(f"[aws] account={acct} region={REGION}")

failures: list[tuple[str, str]] = []


def step(name, fn):
    try:
        return fn()
    except Exception as e:
        failures.append((name, f"{type(e).__name__}: {e}"))
        print(f"  [FAIL] {name}: {type(e).__name__}: {str(e)[:300]}")
        return None


# ---------------------------------------------------------------- package
def _win32_stub_wheels() -> Path:
    """Stub wheels for Windows-only marker deps that break manylinux resolution.

    pip evaluates `sys_platform == "win32"` markers against THIS host (Windows)
    even with --platform manylinux… — mcp (a strands dep) then requires pywin32,
    which has no manylinux wheel, so pip silently backtracks strands-agents to
    1.1.0 (no Agent.as_tool → /chat 500s on Lambda). Feeding an inert
    py3-none-any stub lets resolution complete; the marker never activates on
    Linux, so the empty package is never imported.
    """
    import base64
    import csv
    import hashlib
    import io

    stubs = BUILD / "_wheel_stubs"
    stubs.mkdir(parents=True, exist_ok=True)
    whl = stubs / "pywin32-999-py3-none-any.whl"
    if not whl.exists():
        meta = "Metadata-Version: 2.1\nName: pywin32\nVersion: 999\n"
        wheel = ("Wheel-Version: 1.0\nGenerator: deploy_aws\n"
                 "Root-Is-Purelib: true\nTag: py3-none-any\n")
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        for name, data in (("pywin32-999.dist-info/METADATA", meta),
                           ("pywin32-999.dist-info/WHEEL", wheel)):
            digest = base64.urlsafe_b64encode(
                hashlib.sha256(data.encode()).digest()).rstrip(b"=").decode()
            w.writerow([name, f"sha256={digest}", len(data)])
        w.writerow(["pywin32-999.dist-info/RECORD", "", ""])
        with zipfile.ZipFile(whl, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("pywin32-999.dist-info/METADATA", meta)
            z.writestr("pywin32-999.dist-info/WHEEL", wheel)
            z.writestr("pywin32-999.dist-info/RECORD", buf.getvalue())
    return stubs


# B2 — optional provider SDKs (MODEL_PROVIDER=anthropic|openai|…); off by default
# to keep the zip small. `--with-providers` bundles them.
PROVIDER_DEPS = ["strands-agents[anthropic,openai,ollama,litellm]==1.56.0"]


def package(with_providers: bool = False) -> Path:
    if PKG.exists():
        shutil.rmtree(PKG)
    PKG.mkdir(parents=True)
    print(f"[pkg] pip install {len(RUNTIME_DEPS)} runtime deps → {PKG} (manylinux)")
    subprocess.run([
        sys.executable, "-m", "pip", "install", "--quiet", "--upgrade",
        "--target", str(PKG), "--platform", "manylinux2014_x86_64",
        "--python-version", "3.11", "--only-binary=:all:",
        "--find-links", str(_win32_stub_wheels()), *RUNTIME_DEPS,
        *(PROVIDER_DEPS if with_providers else [])], check=True)
    # guard: fail loudly if dep resolution ever drifts strands below the
    # version with Agent.as_tool (the silent-1.1.0 failure mode above)
    agent_py = PKG / "strands" / "agent" / "agent.py"
    if not agent_py.exists() or "as_tool" not in agent_py.read_text(encoding="utf-8"):
        raise RuntimeError(
            "packaged strands-agents lacks Agent.as_tool — dep resolution "
            "backtracked; check pywin32 stub / pin in RUNTIME_DEPS")
    shutil.copytree(BACKEND / "app", PKG / "app",
                    ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "data", "uploads"))
    if ZIP.exists():
        ZIP.unlink()
    n = 0
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in PKG.rglob("*"):
            if p.is_file() and "__pycache__" not in p.parts:
                z.write(p, p.relative_to(PKG))
                n += 1
    print(f"[pkg] {ZIP.name}: {ZIP.stat().st_size/1e6:.0f} MB zipped, {n} files")
    return ZIP


# ---------------------------------------------------------------- iam role
def ensure_role() -> str | None:
    if _env.get("LAMBDA_ROLE_ARN"):
        print(f"[iam] using LAMBDA_ROLE_ARN={_env['LAMBDA_ROLE_ARN']}")
        return _env["LAMBDA_ROLE_ARN"]
    iam = session.client("iam")
    arn = None
    try:
        arn = iam.get_role(RoleName=ROLE_NAME)["Role"]["Arn"]
        print(f"[iam] role {ROLE_NAME} exists")
    except iam.exceptions.NoSuchEntityException:
        r = iam.create_role(RoleName=ROLE_NAME, AssumeRolePolicyDocument=json.dumps({
            "Version": "2012-10-17", "Statement": [{
                "Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"},
                "Action": "sts:AssumeRole"}]}))
        arn = r["Role"]["Arn"]
        print(f"[iam] created {ROLE_NAME}")
    iam.attach_role_policy(RoleName=ROLE_NAME,
                           PolicyArn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole")
    iam.put_role_policy(RoleName=ROLE_NAME, PolicyName="sahayak-runtime",
                        PolicyDocument=json.dumps(LAMBDA_POLICY))
    return arn


# ---------------------------------------------------------------- lambda
def deploy_lambda(role_arn: str, zip_path: Path) -> str | None:
    lam = session.client("lambda")
    env = {k: str(_env[k]) for k in ENV_FORWARD if _env.get(k)}
    # Lambda can't read a local key file — inline the SA JSON as the env var.
    if not env.get("GOOGLE_SERVICE_ACCOUNT_JSON") and _env.get("GOOGLE_SA_KEY_FILE"):
        sa_path = Path(_env["GOOGLE_SA_KEY_FILE"])
        if not sa_path.is_absolute():
            sa_path = ROOT / sa_path
        if sa_path.exists():
            env["GOOGLE_SERVICE_ACCOUNT_JSON"] = json.dumps(
                json.loads(sa_path.read_text(encoding="utf-8")), separators=(",", ":"))
            print("[gcp] inlined GOOGLE_SERVICE_ACCOUNT_JSON from", sa_path.name)
    env["USE_AWS"] = "1"
    if not env.get("DEMO_GATE_TOKEN"):
        import secrets
        env["DEMO_GATE_TOKEN"] = secrets.token_urlsafe(9)
        print(f"[gate] generated DEMO_GATE_TOKEN={env['DEMO_GATE_TOKEN']}  ← save this, it is the passcode")
    if not env.get("AUTH_SECRET"):
        # signs RBAC tokens (app/auth.py) — keep it stable across deploys by
        # putting it in .env, or every redeploy signs everyone out
        import secrets
        env["AUTH_SECRET"] = secrets.token_urlsafe(32)
        print("[auth] generated AUTH_SECRET — add AUTH_SECRET=<value from Lambda env> to .env to keep sessions across deploys")
    if not env.get("DEFAULT_TENANT"):
        env["DEFAULT_TENANT"] = "ramesh_auto"

    # upload zip via S3 (direct upload caps at 50MB)
    bucket = env.get("S3_BUCKET", "sahayak-sessions")
    key = f"deploy/{zip_path.name}"
    session.client("s3").upload_file(str(zip_path), bucket, key)
    print(f"[s3] code → s3://{bucket}/{key}")

    cfg = dict(Runtime="python3.11", Handler="app.main.handler", Role=role_arn,
               Timeout=120, MemorySize=1024, Environment={"Variables": env},
               Architectures=["x86_64"])
    try:
        lam.get_function(FunctionName=FUNCTION_NAME)
        lam.update_function_code(FunctionName=FUNCTION_NAME, S3Bucket=bucket, S3Key=key)
        lam.get_waiter("function_updated_v2").wait(FunctionName=FUNCTION_NAME)
        lam.update_function_configuration(FunctionName=FUNCTION_NAME, **{
            k: v for k, v in cfg.items() if k not in ("Runtime", "Architectures")})
        lam.get_waiter("function_updated_v2").wait(FunctionName=FUNCTION_NAME)
        print(f"[lambda] updated {FUNCTION_NAME}")
    except lam.exceptions.ResourceNotFoundException:
        lam.create_function(FunctionName=FUNCTION_NAME, Code={"S3Bucket": bucket, "S3Key": key},
                            Publish=True, **cfg)
        lam.get_waiter("function_active_v2").wait(FunctionName=FUNCTION_NAME)
        print(f"[lambda] created {FUNCTION_NAME}")
    return lam.get_function(FunctionName=FUNCTION_NAME)["Configuration"]["FunctionArn"]


def function_url() -> str | None:
    lam = session.client("lambda")
    # NO Cors here — FastAPI's CORSMiddleware owns it. Setting CORS on both
    # layers emits duplicate Access-Control-Allow-Origin headers, which every
    # browser rejects ("multiple values" → frontend reports backend down).
    try:
        lam.create_function_url_config(FunctionName=FUNCTION_NAME, AuthType="NONE")
    except lam.exceptions.ResourceConflictException:
        lam.update_function_url_config(FunctionName=FUNCTION_NAME, AuthType="NONE", Cors={})
    # public URL needs BOTH grants: URL access + actual invocation
    for sid, kw in [
        ("FunctionURLAllowPublicAccess", dict(Action="lambda:InvokeFunctionUrl",
                                            FunctionUrlAuthType="NONE")),
        ("FunctionURLInvokePublic", dict(Action="lambda:InvokeFunction",
                                       InvokedViaFunctionUrl=True)),
    ]:
        try:
            lam.add_permission(FunctionName=FUNCTION_NAME, StatementId=sid,
                               Principal="*", **kw)
        except lam.exceptions.ResourceConflictException:
            pass
    url = lam.get_function_url_config(FunctionName=FUNCTION_NAME)["FunctionUrl"]
    print(f"[lambda] Function URL: {url}")
    return url


# ---------------------------------------------------------------- scheduler
def schedule(fn_arn: str):
    ev = session.client("events")
    rule = ev.put_rule(Name=RULE_NAME, ScheduleExpression="rate(1 minute)",
                       State="ENABLED", Description="sahayak alert scheduler tick")
    ev.put_targets(Rule=RULE_NAME, Targets=[{"Id": "sahayak", "Arn": fn_arn,
                                             "Input": json.dumps({"detail-type": "Scheduled Event", "source": "aws.events"})}])
    lam = session.client("lambda")
    try:
        lam.add_permission(FunctionName=FUNCTION_NAME, StatementId="eventbridge-tick",
                           Action="lambda:InvokeFunction", Principal="events.amazonaws.com",
                           SourceArn=rule["RuleArn"])
    except lam.exceptions.ResourceConflictException:
        pass
    print("[events] rule sahayak-scheduler → lambda (1/min)")


# ---------------------------------------------------------------- frontend
def deploy_frontend_amplify(api_url: str) -> str | None:
    """Amplify manual deploy — zip upload, no git connection needed."""
    env = {**os.environ, "VITE_API_URL": api_url.rstrip("/")}
    print(f"[web] building frontend with VITE_API_URL={env['VITE_API_URL']}")
    subprocess.run("npm run build", cwd=FRONTEND, env=env, shell=True, check=True)

    # zip dist/
    dist_zip = BUILD / "sahayak-web.zip"
    if dist_zip.exists():
        dist_zip.unlink()
    with zipfile.ZipFile(dist_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for p in (FRONTEND / "dist").rglob("*"):
            if p.is_file():
                z.write(p, p.relative_to(FRONTEND / "dist"))

    amp = session.client("amplify")
    app_id = None
    for a in amp.list_apps().get("apps", []):
        if a["name"] == "sahayak":
            app_id = a["appId"]
    if not app_id:
        app_id = amp.create_app(name="sahayak")["app"]["appId"]
        print(f"[amplify] created app {app_id}")
    try:
        amp.create_branch(appId=app_id, branchName="main")
    except Exception:
        pass  # branch exists
    dep = amp.create_deployment(appId=app_id, branchName="main")
    import urllib.request
    req = urllib.request.Request(dep["zipUploadUrl"], data=dist_zip.read_bytes(),
                                 method="PUT",
                                 headers={"Content-Type": "application/zip"})
    urllib.request.urlopen(req)
    amp.start_deployment(appId=app_id, branchName="main", jobId=dep["jobId"])
    print("[amplify] deploy started — polling…")
    for _ in range(40):
        st = amp.get_job(appId=app_id, branchName="main",
                         jobId=dep["jobId"])["job"]["summary"]["status"]
        if st in ("SUCCEED", "FAILED", "CANCELLED"):
            break
        time.sleep(5)
    url = f"https://main.{app_id}.amplifyapp.com"
    print(f"[amplify] {st} → {url}")
    return url if st == "SUCCEED" else None


def deploy_frontend(api_url: str) -> str | None:
    env = {**os.environ, "VITE_API_URL": api_url.rstrip("/")}
    print(f"[web] building frontend with VITE_API_URL={env['VITE_API_URL']}")
    subprocess.run("npm run build", cwd=FRONTEND, env=env, shell=True, check=True)

    bucket = f"sahayak-web-{acct}"
    s3 = session.client("s3")
    try:
        s3.head_bucket(Bucket=bucket)
    except Exception:
        kwargs = {"Bucket": bucket}
        if REGION != "us-east-1":
            kwargs["CreateBucketConfiguration"] = {"LocationConstraint": REGION}
        s3.create_bucket(**kwargs)
        print(f"[s3] created {bucket}")
    s3.put_public_access_block(Bucket=bucket, PublicAccessBlockConfiguration={
        "BlockPublicAcls": False, "IgnorePublicAcls": False,
        "BlockPublicPolicy": False, "RestrictPublicBuckets": False})
    s3.put_bucket_policy(Bucket=bucket, Policy=json.dumps({
        "Version": "2012-10-17", "Statement": [{
            "Sid": "public", "Effect": "Allow", "Principal": "*",
            "Action": "s3:GetObject", "Resource": f"arn:aws:s3:::{bucket}/*"}]}))
    s3.put_bucket_website(Bucket=bucket, WebsiteConfiguration={
        "IndexDocument": {"Suffix": "index.html"},
        "ErrorDocument": {"Key": "index.html"}})

    import mimetypes
    n = 0
    for p in (FRONTEND / "dist").rglob("*"):
        if not p.is_file():
            continue
        ct = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
        if p.suffix == ".js":
            ct = "text/javascript"
        elif p.suffix == ".html":
            ct = "text/html"
        extra = {"ContentType": ct}
        if p.name == "index.html":
            extra["CacheControl"] = "no-cache"
        s3.upload_file(str(p), bucket, str(p.relative_to(FRONTEND / "dist")).replace("\\", "/"),
                       ExtraArgs=extra)
        n += 1
    url = f"http://{bucket}.s3-website.{REGION}.amazonaws.com"
    print(f"[s3] uploaded {n} files → {url}")
    return url


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--package-only", action="store_true")
    ap.add_argument("--api-url", default=None,
                    help="public backend URL the frontend should call — e.g. an ngrok "
                         "tunnel while lambda:CreateFunctionUrlConfig is ungranted")
    ap.add_argument("--skip-backend", action="store_true", help="frontend deploy only")
    ap.add_argument("--skip-frontend", action="store_true")
    ap.add_argument("--with-providers", action="store_true",
                    help="bundle optional model-provider SDKs (MODEL_PROVIDER≠bedrock)")
    args = ap.parse_args()

    fn_arn = None
    api_url = args.api_url
    if not args.skip_backend:
        zip_path = step("package", lambda: package(with_providers=args.with_providers))
        if args.package_only:
            return 0 if zip_path else 1
        if zip_path:
            role = step("iam role", ensure_role)
            fn_arn = step("lambda deploy", lambda: deploy_lambda(role, zip_path)) if role else None
            if fn_arn and not api_url:
                api_url = step("function url", function_url)
            if fn_arn:
                step("eventbridge schedule", lambda: schedule(fn_arn))
    elif args.package_only:
        return 1

    site = None
    if api_url and not args.skip_frontend:
        site = step("amplify deploy", lambda: deploy_frontend_amplify(api_url))
        if not site:
            site = step("s3 website fallback", lambda: deploy_frontend(api_url))

    print("\n================ RESULT ================")
    if site:
        gate = _env.get("DEMO_GATE_TOKEN") or "<gate token — see Lambda env>"
        print(f"  app:     {site}/?gate={gate}#/app")
        print(f"  api:     {api_url}")
        print(f"  share:   {site}/#/a/art-fy26   (public artifact — no gate)")
    elif api_url:
        print(f"  api:     {api_url}")
    if failures:
        print("  failures (fix in console or rerun):")
        for n, e in failures:
            print(f"    - {n}: {e[:200]}")
        return 1
    print("  all green")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
