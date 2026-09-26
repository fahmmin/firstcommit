"""Real request auth + RBAC — signed, tenant-bound tokens enforced server-side.

Before this, `/auth/login` returned an unchecked `demo-tok-*` string and the role
lived only in the browser, so "RBAC" was greyed-out buttons. Now:

- `/auth/login` issues an HMAC-SHA256 token `{tid, role, base, iat, exp}`.
- `AuthMiddleware` (pure ASGI, so it can inspect JSON/multipart bodies) rejects
  unsigned/expired tokens (401), binds every request to the token's tenant
  (a `tenant_id` for another tenant → 403; a missing one is filled in), and
  checks the route's permission against the role (403).
- Permissions are evaluated by Cedar — the same engine that authorizes agent
  tool calls (agents/policy.py) — with the dict below as the source of truth.
- `base` is the highest role the session may assume: an owner can "view as"
  manager/viewer and back; an invited manager can never escalate.

No new dependency (stdlib hmac/hashlib). Works identically in USE_AWS=0/1.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import time
from contextvars import ContextVar
from urllib.parse import parse_qs, urlencode

import cedarpy

ROLE_PERMS: dict[str, list[str]] = {
    "owner": ["*"],
    "manager": ["approve", "hire", "chat", "artifacts"],
    "viewer": ["chat"],
}
ROLE_RANK = {"viewer": 0, "manager": 1, "owner": 2}
ALL_PERMS = ["approve", "hire", "chat", "artifacts", "connect", "mcp", "settings", "data"]

DEFAULT_TTL = 7 * 24 * 3600
current_principal: ContextVar[dict | None] = ContextVar("current_principal", default=None)


# ---------------- tokens ----------------

def _secret() -> bytes:
    s = os.getenv("AUTH_SECRET", "")
    if not s:
        # dev/offline default; deploy_aws.py sets a real AUTH_SECRET on Lambda
        s = "sahayak-dev-secret-change-me"
    return s.encode()


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def issue(tenant_id: str, role: str = "owner", base: str | None = None,
          ttl: int = DEFAULT_TTL, scope: str = "app") -> str:
    role = role if role in ROLE_PERMS else "owner"
    base = base if base in ROLE_PERMS else role
    if ROLE_RANK[role] > ROLE_RANK[base]:
        role = base
    now = int(time.time())
    payload = {"tid": tenant_id, "role": role, "base": base, "scope": scope,
               "iat": now, "exp": now + ttl}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify(token: str) -> dict | None:
    """Claims if the signature is valid and unexpired, else None."""
    try:
        body, sig = token.strip().split(".", 1)
        want = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, want):
            return None
        claims = json.loads(_unb64(body))
        if int(claims.get("exp", 0)) < time.time():
            return None
        if claims.get("role") not in ROLE_PERMS or claims.get("base") not in ROLE_PERMS:
            return None
        return claims
    except Exception:
        return None


# ---------------- Cedar role policy ----------------

def build_role_policy() -> str:
    lines = []
    for role, perms in ROLE_PERMS.items():
        if "*" in perms:
            lines.append(f'permit(principal == Role::"{role}", action, resource);')
        else:
            acts = ", ".join(f'Action::"{p}"' for p in perms)
            lines.append(f'permit(principal == Role::"{role}", action in [{acts}], resource);')
    return "\n".join(lines)


_ROLE_POLICY = build_role_policy()


def role_allowed(role: str, perm: str) -> bool:
    """Cedar decision (default-deny) — falls back to the dict on engine error."""
    try:
        r = cedarpy.is_authorized({
            "principal": {"type": "Role", "id": role},
            "action": {"type": "Action", "id": perm},
            "resource": {"type": "Workspace", "id": "tenant"},
            "context": {},
        }, _ROLE_POLICY, [])
        return r.decision == cedarpy.Decision.Allow
    except Exception:
        perms = ROLE_PERMS.get(role, [])
        return "*" in perms or perm in perms


def can_switch(claims: dict, target: str) -> bool:
    return target in ROLE_PERMS and ROLE_RANK[target] <= ROLE_RANK[claims.get("base", "viewer")]


# ---------------- route → permission ----------------
# GETs need only a valid token (read). Writes are default-deny: anything not
# listed requires owner ("*"). Order matters — first match wins.
_RULES: list[tuple[str, re.Pattern, str]] = [(m, re.compile(p), perm) for m, p, perm in [
    ("POST", r"^/chat$", "chat"),
    ("POST", r"^/tasks$", "chat"),
    ("POST", r"^/memories$", "chat"),
    ("POST", r"^/notifications/[^/]+/read$", "chat"),
    ("POST", r"^/auth/role$", "chat"),          # switching is checked by can_switch
    ("POST", r"^/alerts/[^/]+/(approve|dismiss)$", "approve"),
    ("POST", r"^/approvals/[^/]+/(approve|deny)$", "approve"),
    ("POST", r"^/approvals/grant$", "approve"),
    ("POST", r"^/invoices/[^/]+/reminder$", "approve"),
    ("POST", r"^/tasks/[^/]+/run$", "approve"),
    ("PATCH", r"^/tasks/[^/]+$", "approve"),
    ("POST", r"^/agents(/preview|/batch)?$", "hire"),
    ("POST", r"^/templates/[^/]+/install$", "hire"),
    ("POST", r"^/artifacts$", "artifacts"),
    ("PATCH", r"^/artifacts/[^/]+$", "artifacts"),
    ("POST", r"^/reports/generate$", "artifacts"),
]]
# connectors/sync is a GET with side effects → owner
_OWNER_GETS = [re.compile(r"^/connectors/[^/]+/sync$")]

PUBLIC_PREFIXES = ("/health", "/auth/login", "/public/", "/docs", "/redoc",
                   "/openapi.json", "/mcp")


def required_perm(method: str, path: str) -> str | None:
    """None = any valid token. '*' = owner-only."""
    if method in ("GET", "HEAD"):
        return "*" if any(p.match(path) for p in _OWNER_GETS) else None
    for m, pat, perm in _RULES:
        if m == method and pat.match(path):
            return perm
    return "*"


def perm_ok(role: str, perm: str | None) -> bool:
    if perm is None:
        return True
    if perm == "*":
        return "*" in ROLE_PERMS.get(role, [])
    return role_allowed(role, perm)


# ---------------- ASGI middleware ----------------

_MP_TENANT = re.compile(rb'name="tenant_id"\r\n\r\n([^\r\n]*)\r\n')


class AuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        method, path = scope["method"], scope["path"]
        if method == "OPTIONS" or path == "/" or path.startswith(PUBLIC_PREFIXES):
            return await self.app(scope, receive, send)

        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        qs = parse_qs(scope.get("query_string", b"").decode(), keep_blank_values=True)
        raw = headers.get("authorization", "")
        tok = raw[7:] if raw.lower().startswith("bearer ") else (qs.get("access_token") or [""])[0]
        claims = verify(tok) if tok else None
        if not claims:
            return await _deny(send, 401, "sign in required")
        if claims.get("scope") not in ("app",):
            return await _deny(send, 403, "token not valid for the app API")

        # buffer the body (needed to read tenant_id from JSON / multipart)
        body = b""
        if method in ("POST", "PATCH", "PUT", "DELETE"):
            more = True
            while more:
                msg = await receive()
                body += msg.get("body", b"")
                more = msg.get("more_body", False)

        tid = claims["tid"]
        ctype = headers.get("content-type", "")
        seen = list(qs.get("tenant_id", []))
        json_body = None
        if body and "application/json" in ctype:
            try:
                json_body = json.loads(body)
                if isinstance(json_body, dict) and json_body.get("tenant_id") is not None:
                    seen.append(json_body["tenant_id"])
            except Exception:
                json_body = None
        elif body and "multipart/form-data" in ctype:
            seen += [m.decode() for m in _MP_TENANT.findall(body)]
        if any(t and t != tid for t in seen):
            return await _deny(send, 403, "token is for a different workspace")

        perm = required_perm(method, path)
        if not perm_ok(claims["role"], perm):
            need = "owner" if perm == "*" else perm
            return await _deny(send, 403, f"your role ({claims['role']}) can't do this — needs {need}")

        # bind to the token's tenant when the client didn't say (endpoints
        # default to the showcase tenant otherwise — never let that leak)
        if not qs.get("tenant_id"):
            qs["tenant_id"] = [tid]
            scope = dict(scope, query_string=urlencode(qs, doseq=True).encode())
        if isinstance(json_body, dict) and "tenant_id" not in json_body:
            json_body["tenant_id"] = tid
            body = json.dumps(json_body).encode()
            scope = dict(scope, headers=[(k, v) for k, v in scope["headers"]
                                         if k.lower() != b"content-length"]
                         + [(b"content-length", str(len(body)).encode())])

        sent = False

        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        ctx = current_principal.set(claims)
        try:
            await self.app(scope, replay if method in ("POST", "PATCH", "PUT", "DELETE") else receive, send)
        finally:
            current_principal.reset(ctx)


async def _deny(send, status: int, detail: str):
    body = json.dumps({"detail": detail}).encode()
    await send({"type": "http.response.start", "status": status,
                "headers": [(b"content-type", b"application/json"),
                            (b"access-control-allow-origin", b"*"),
                            (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


# ---------------- in-process harness auth ----------------

try:
    try:  # starlette's TestClient is built on httpx2; fall back to httpx
        import httpx2 as _httpx
    except ImportError:
        import httpx as _httpx

    class HarnessAuth(_httpx.Auth):
        """For trusted in-process harnesses only (pytest, simulate_demo, evals):
        they already hold AUTH_SECRET, so each request gets an owner token for
        whichever tenant it targets. Requests that set Authorization themselves
        (the RBAC tests) are left untouched. Never used by the served app."""
        requires_request_body = True

        def auth_flow(self, request):
            if "authorization" not in request.headers:
                tid = request.url.params.get("tenant_id")
                if not tid and request.content:
                    ctype = request.headers.get("content-type", "")
                    try:
                        if "application/json" in ctype:
                            tid = (json.loads(request.content) or {}).get("tenant_id")
                        elif "multipart/form-data" in ctype:
                            m = _MP_TENANT.search(request.content)
                            tid = m.group(1).decode() if m else None
                    except Exception:
                        tid = None
                request.headers["Authorization"] = f"Bearer {issue(tid or 'ramesh_auto', 'owner', 'owner')}"
            yield request
except ImportError:  # httpx is a test/dev dependency
    HarnessAuth = None  # type: ignore
