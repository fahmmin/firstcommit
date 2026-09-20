# AYUSH.md — Ayush's Handbook (READ FIRST — including your AI agent)

**You = Ayush — owner of the entire backend.** Set it up, run it, edit it until it's
ready. **Fahmin owns the entire frontend.** The seam between you is
`frontend/mocks/contract.json` — he builds all UI against it and never waits on you;
you implement until responses match it. Both of you work on `USE_AWS=1` once your
`.env` exists.

The app already runs end-to-end locally (`USE_AWS=0`). **75 tests + 25/25
`simulate_demo.py` checks are green** — and green on live AWS too — **keep them green and grow them.**

---

## STATUS (updated 2026-09-20) — done ✅ / open ⬜

**Live AWS is wired** (profile `sahayak`, region `ap-south-1`, account `055533307288`):
Strands + Bedrock Nova (Lite+Pro) + Titan embeddings + Textract + DynamoDB (14 tables) + S3 + SES + Cedar. `USE_AWS=1` verified: `check_aws.py` 5/5, parity+policy 32/32, sim 25/25.

Done ✅
- ✅ AWS console + `.env` (§2) — account, IAM `sahayak`, Bedrock Nova access, 14 DynamoDB tables, S3 bucket, SES sender verified
- ✅ DynamoStore parity green on AWS (§3)
- ✅ SESNotifier (sender verified; sandbox recipient still needs verifying for real delivery)
- ✅ All Round-1 `[TODO]` endpoints (§4): dashboard/summary, notifications, tasks, agents/context, calendar, connectors, settings, login
- ✅ Round-2 (§5): `/import/excel` (openpyxl), memories + prompt injection + `recall_context`, artifacts + `create_artifact` (4 templates), `/search`
- ✅ Round-3: `GET /people` (defaulter agg), `GET /logs`, dashboard `brief[]`, orchestrator+nirmata memory injection
- ✅ Round-3: **Cedar** tool-authorization (`app/agents/policy.py`) — per-agent allowlist is now a real default-deny policy
- ✅ Round-3: **business-context brain** — `documents` collection + `/context/*`, Textract→vision→heuristic extract, Nova auto-tag, Titan-embedding semantic search
- ✅ Round-3: **templates catalog** (`app/templates_catalog.py`) + `/templates` + `/templates/{id}/install`
- ✅ Round-4: **`POST /onboarding`** — rich 7-step wizard backend (profile+prefs+memories+pain→agent auto-hire/suggest)
- ✅ `simulation/setup_aws.py` provisioner + `check_aws.py` (all 14 tables)
- ✅ **Artifact sharing (Claude-style)** — `visibility: private|public` on every artifact; `PATCH /artifacts/{id}` toggles it (logs `artifact_shared`); `GET /public/artifacts/{id}` is the share-link route (private → 404); 5th template `financial_report` (revenue/expenses/margin + monthly projections + highlights + ask) for investor/landlord sharing
- ✅ **Hardware-business demo data** — seed.json rewritten (Ramesh Hardware & Electricals: 16 invoices, 20 suppliers, 6 carriers, 6 payables, 11 kanban tasks, 8 notifications, 12 connectors, 8 memories, 4 artifacts); `simulation/seed_hardware.py` generates **real .xlsx/.pdf files** (sales register, inventory, attendance, GSTR-3B, rate list, chalan log, rent agreement, GST cert, fire insurance, trade license) → ingests via `/context/upload` (extract→Bedrock tag→Titan embed) → uploads raw files to S3 `context/{tenant}/` → hires 3 factory agents. Verified USE_AWS=1.
- ✅ Connector seeds: `facebook_marketplace` (connected) + `indiamart`, `shopify`, `instagram` (available) now in seed.json

Open ⬜ (not done yet)

**Needed by the live frontend** (Fahmin's pages are shipped — these are the real gaps):
- ✅ `PATCH /tasks/{id}` — kanban drag-drop persistence (col↔status alias); contract-tested + sim step
- ✅ `POST /tasks` field mapping — accepts `col`+`status`+`agent`+`agent_id`, all persist
- ✅ **UTF-8 charset** on JSON responses — `UTF8JSONResponse` (`ensure_ascii=False`, `charset=utf-8`); `₹` verified on the wire
- ✅ `PATCH /settings` accept `role` — persists to `prefs.role`
- ✅ `_PAIN_MAP` `too_many_excels` — handled as an "import your ledger" next-step (no specialist agent)
- ⬜ **Textract IAM** — user `AWSHACKATHON` lacks `textract:DetectDocumentText`/`AnalyzeDocument`; PDF ingest falls back to filename-only. **Needs the IAM policy attached in the AWS console** (a security-settings change — do this yourself; xlsx unaffected — openpyxl path works).
- ⬜ **Real auth + OAuth connectors** — see §OAuth below (login is demo-only; connector connect/sync are stubs; artifact private ACL needs auth to be real)

**Reconcile route names** — ✅ resolved: frontend adopted your routes. Context docs → `POST /context/upload` + `GET /context` + `DELETE /context/{id}` (spec's `/context/docs` dropped). Activity feed → `GET /logs` (spec's `/activity` dropped). contract.json + Round-3 §1 spec updated to match.

**Stretch / open**
- ⬜ **Real Google Drive / Google Calendar OAuth connectors** — §OAuth below has the full setup list (env placeholders already in `.env.example`)
- ✅ **Deploy** (§6): shipped — Amplify frontend live, Lambda + EventBridge deployed (`simulation/deploy_aws.py`); only `lambda:CreateFunctionUrlConfig` IAM grant pending for the permanent public URL
- 🟡 **Web search / Deep research** agent tool — **plumbing DONE**: `/chat` now honors `mode: "web"|"deep"` (prepends a hint), `web_search` tool given to all agents + orchestrator (`tools/websearch.py`, Tavily via httpx), mock rule added. **Activate by setting `TAVILY_API_KEY`** — keyless it returns a graceful "not configured" reply.
- ⬜ Digital-presence template's tools (`publish_listing`, `sync_catalog`, `seo_audit`, `storefront_builder`) aren't in `TOOL_REGISTRY` — template ships `tools: []` so install converges via Nirmata prompt only
- ✅ ~~Frontend wiring of already-built backends~~ — DONE (Fahmin, 2026-09-20): `/context/*` → Context page, `POST /onboarding` → wizard (chips→`pains`, auto-hire toast), `/people` → CRM tabs, `/logs` → LogsExplorer stream, `POST /notifications/{id}/read` → mark-read + mark-all, `GET /connectors/{id}/sync` → Settings "Sync now" + post-connect sync, `/templates` + `/templates/{id}/install` → gallery merged catalog + Install buttons (agent_spec → open_agent deep-link; `needs_factory` → prompt prefill). Every screen still falls back to the demo store offline.

---

## 1. The contract (your build list)

`frontend/mocks/contract.json` is the spec. Every endpoint is tagged
`[EXISTS]` (already works — don't break) or `[TODO]` (yours to build):

- `POST /auth/login` — demo login → token + user
- `GET /dashboard/summary` — KPI tiles + recent activity for the dashboard
- `GET /agents/{id}` + `GET /agents/{id}/context` — agent detail + **contextual
  sidebar payload** (vasool → invoice summary + capital locked; logistics agent →
  carriers/bookings; generic → tools + recent actions)
- `GET/POST /tasks`, `POST /tasks/{id}/run` — task queue; run pushes it through
  the assigned agent and returns a chat-shaped result
- `GET /calendar/events` — unified feed (invoice dues + scheduled alerts + tasks)
- `GET /notifications`, `POST /notifications/{id}/read` — the feed
- `GET /connectors`, `connect`, `disconnect`, `sync` — Google Calendar + Airtable
  can be genuinely useful; Tally/Razorpay/WhatsApp may stay stubs ("coming soon")
- `GET/PATCH /settings` — business profile + prefs persistence
- `GET /dashboard` data mostly composes existing stores — cheap to build

New collections you'll need in `Store`: `tasks`, `notifications`, `connectors`,
`settings`, `activity` (for dashboard feed + agent stats). Add them to BOTH
`LocalStore` and `DynamoStore` — the parity test forces this anyway.
Add seed rows in `seed.json` for tasks/notifications/connectors/activity.

## 2. AWS console (~60–90 min) — needs nothing from Fahmin

> NOTE: actuals differ from the original draft below — region `ap-south-1`, profile `sahayak`,
> bucket `sahayak-sessions-055533307288`, models `apac.amazon.nova-*`. All provisioning is
> automated in `simulation/setup_aws.py`.
- [x] AWS account (`055533307288`) → `ap-south-1`  ⬜ billing alert (set one if not already)
- [x] Bedrock → Model access → **Nova Lite + Nova Pro** (verified reachable)
- [x] IAM user `sahayak` + key → `aws configure --profile sahayak`
- [x] DynamoDB `PAY_PER_REQUEST`, PK `tenant_id` + SK `id` — **14 tables** (all of `Store._COLLECTIONS`
      incl. `tasks notifications connectors settings activity memories artifacts documents`)
- [x] SES: sender `kkfahmin@gmail.com` verified  ⬜ verify a demo recipient for real delivery (sandbox)
- [x] S3 bucket `sahayak-sessions-055533307288`
- [x] Smoke: `check_aws.py` 5/5 (`sts`, `dynamodb`, `s3`, `ses`, `bedrock converse`)

Then fill `.env` (copy `.env.example`), hand it to Fahmin: "set `USE_AWS=1` +
`AWS_PROFILE=hackathon`, restart backend." **He's waiting on exactly this to
test and film the AWS path.**

## 3. Make AWS impls green

```bash
cd backend && pip install -r requirements.txt
USE_AWS=1 AWS_PROFILE=hackathon pytest tests/unit/test_store_parity.py -v
USE_AWS=1 AWS_PROFILE=hackathon python ../simulation/simulate_demo.py
```

## 4. Build the [TODO] endpoints + their tests

Order them by what unblocks Fahmin's screens fastest:
`dashboard/summary` → `notifications` → `tasks` → `agents/{id}/context` →
`calendar/events` → `connectors` → `settings` → `auth/login` (trivial last).
Every endpoint gets a contract test; add 2–3 sim steps for the headline ones.

## 5. Round 2 — demo features (the next few hours, priority order)

New `[TODO]` shapes are already in `contract.json` — build to them exactly.
MVP rule: **real at the contract + storage layer, thin at external integrations.**

1. **`POST /import/excel`** — `tools/importer.py`. openpyxl → map columns
   (`invoice_no, buyer, amount, due_date, gst?`) → `store.put_invoice` rows.
   Unmappable rows → `skipped` count, never 500. Fahmin uploads a pre-made file —
   generic parsing NOT required. **`openpyxl` is the one pre-approved new dep.**
2. **`memories` collection + `GET/POST/DELETE /memories` + prompt injection** —
   THE demo-worthy one. Add `memories` to `Store._COLLECTIONS` (both impls) +
   2–3 seed rows. Wherever agent system prompts are assembled
   (`agents/registry.py` spec→prompt builder), append:
   `"What the owner told you about their business:" + memory lines`.
   Then Vasool genuinely references "Sharma pays in 45d" — real memory.
3. **`create_artifact` tool + `artifacts` collection + `GET /artifacts{,/{id}}`** —
   new `tools/artifacts.py`. Tool sig: `create_artifact(title, template, data)`
   where `template ∈ {tracking_page, invoice_summary, supplier_compare,
   payment_card}` — validate `data` per-template (pydantic, lenient: missing
   optional fields ok, required fields → tool error so the model retries).
   Give it to ALL agents (registry tool map). When it runs, chat must emit
   `actions: [{type:"artifact_created", data:{id,title,template,share_path}}]`
   — same action path `reminder_drafted` uses. **No raw-HTML artifacts** —
   template-bound only, same philosophy as the card system.
4. **`GET /search?q=`** — case-insensitive substring over title/desc/meta fields
   of invoices(buyer,invoice_no), suppliers(name,category), carriers(name,route),
   agents(name,goal), tasks(title), memories(text), uploads(filename).
   Grouped `{results:{invoices:[],...}}` per contract. No embeddings.
5. **Connector seeds** — add `gmail`, `google_drive` rows to the connectors
   catalog (toggle connect already works). Excel stays `/import/excel`, not a connector.
6. **Tests** — contract tests for each new endpoint (same `_ep()` pattern) +
   3 sim steps: excel import count>0, memory visible in agent reply, artifact
   created + fetchable.

**File map for Round 2** (yours, merge-safe — Fahmin never touches `backend/`):
`tools/importer.py`, `tools/artifacts.py`, `store.py` (+2 collections),
`main.py` (append-only endpoints), `agents/registry.py` (memory injection +
tool map), `seed.json`, `requirements.txt` (openpyxl).

## 6. Deploy — ✅ SHIPPED (2026-09-20)

`simulation/deploy_aws.py` is the whole pipeline, idempotent, re-runnable:

```
python simulation/deploy_aws.py                    # full deploy
python simulation/deploy_aws.py --package-only     # just build the lambda zip
python simulation/deploy_aws.py --api-url <url>    # frontend pointed at any backend URL
```

**What's live**
- Frontend: Amplify manual zip-deploy → `https://main.dym7go4p5hfno.amplifyapp.com`
  (S3 static-website fallback inside the script if Amplify fails)
- Backend: Lambda `sahayak-api` (python3.11 zip, 41MB, handler `app.main.handler`)
  — verified via direct invoke: `/health` 200, gated routes 401→200 with token,
  public artifact route open, private artifacts 404
- Scheduler: EventBridge rule `sahayak-scheduler` (rate 1 min) → same function;
  `handler` detects `detail-type:"Scheduled Event"` and runs `scheduler.run_once`
  instead of HTTP (verified: `{'moved': N}`)

**Demo gate (auth stays demo-only per project rules)** — `DEMO_GATE_TOKEN`
env var turns on a FastAPI middleware: every API call needs `x-demo-token`
header or `?gate=` param; exempt = `/health` + `/public/artifacts/*` (share
links must work for recipients). Frontend stores the token once from
`?gate=CODE` in the URL → sends it on every call; wrong/missing → `#/gate`
passcode screen. Judge link format: `https://<site>/?gate=<TOKEN>#/app`.

**The one blocked step** — `lambda:CreateFunctionUrlConfig` is denied on the
`AWSHACKATHON` IAM user (apigateway/ecr/ecs/lightsail/eb all denied too).
The function is deployed + working; it just has no public URL. To finish:
grant the user `lambda:CreateFunctionUrlConfig` + `lambda:InvokeFunctionUrl`
(or attach `AWSLambda_FullAccess`) and re-run the script — it creates the URL,
rebuilds the frontend against it, done. Until then the demo backend rides an
ngrok tunnel to the local uvicorn (`ngrok http 8000`), which is why
`--api-url` exists. API Gateway HTTP-API path is ready in the script's
fallback if the permission lands there instead.

---

## What Fahmin is building meanwhile (context — not your scope)

Shipped so far: login (phone OTP + email verify UI) → 5-step onboarding
(name, **role → RBAC**, business, city, problems → memories) → workspace
chat (attachments, web/deep modes, thinking trace, link previews,
read-aloud) → approvals drawer → morning digest → ⌘K palette → pages:
templates gallery, business-context dump (auto-tag), enterprise search,
marketplace (MCP + skills + agent templates), kanban tasks board, people
(CRM), notifications, analytics, calendar, logs, artifacts, settings
(a11y: dark mode/text size/contrast/reduced motion + connectors + MCP
persistence + role switcher) → docs page → landing.

## Dependencies

| You're waiting on Fahmin for | He's waiting on you for |
|---|---|
| nothing to start — contract is frozen | `.env` (to test + film `USE_AWS=1`) |
| stable demo path when you deploy | `[TODO]` endpoints (he mocks till then) |
| — | SES-verified demo inbox |

## The iteration loop — how Fahmin reports, how you fix

As you build, Fahmin wires real screens and will send you reports. Every report
is one of three kinds — identify which before touching code:

| He says… | Kind | You do |
|---|---|---|
| "reply was wrong / weird / missed the point" | **BEHAVIOR** | Fix prompt, tool logic, mock_rules, or seed until *actual* matches his *expected*. Contract shapes untouched. |
| "this component needs field X" / "missing data" | **SHAPE** | Don't just add it ad-hoc — agree the shape with him, **edit contract.json first**, then implement. Then contract test. |
| "expose an API for this view" (whole component has nothing) | **NEW ENDPOINT** | Same: contract.json first (shape + page in `frontend_flow`), then build. |

**Report format he'll use:**

```
PAGE: /agents/agent-l7x2 (right sidebar)
COMPONENT: InvoiceSummaryCard
NEED: oldest_overdue_days (number)
EXPECTED: 111   ACTUAL: missing
KIND: shape | behavior | new-endpoint
```

**Your response rule:** fix it, then re-run the contract test for that endpoint +
`simulate_demo.py` before saying "done." If you can't tell which kind it is — ask
him, don't guess and refactor.

## Expected commits from you

```
feat(api): dashboard/summary + notifications endpoints
feat(api): tasks + run-through-agent
feat(api): agent context endpoint (contextual sidebar payloads)
feat(api): calendar/events + connectors + settings + login
feat(store): new collections in Local+Dynamo, parity green
feat(store): DynamoStore on AWS — parity suite green
feat(notify): SESNotifier verified, first real email
chore(env): .env → Fahmin (never committed)
test: contract tests + sim steps for new endpoints
feat(api): excel import + memories + artifacts + search   ← round 2
chore(deploy): amplify + lambda URL                ← stretch
```

## Rules — for you AND your AI agent

1. **`contract.json` is frozen.** Want a shape changed → tell Fahmin, edit it together.
2. **Don't break `USE_AWS=0`.** `LocalStore`, `ConsoleNotifier`, `MockModel`,
   seeds, mock rules, tests — the local path is the demo fallback. Extend, never delete.
3. **You MAY edit anything in `backend/`** — endpoints, agents, tools, prompts —
   as long as contract shapes, tests, and the sim stay green. "Working" =
   green, not elegant.
4. **No infra tooling**: no CDK/SAM/Terraform/Docker/ECS/EKS/VPC/auth/Cognito.
   boto3 + zip + console clicks. Auth stays demo-only.
5. **No new dependencies** without asking Fahmin — requirements.txt + package.json are complete.
6. **No new .md files** — README + this file are the docs.
7. **Never commit `.env`/keys.** Check `git status` first.
8. **Merge gate: `pytest` + `simulate_demo.py` green in both modes.**
9. **If AWS fights back: stop, tell Fahmin, stay local.** Working local > broken cloud.

## Round 3 — backend additions (contract-compatible)

These landed on the frontend already; the demo store covers them until you ship.

> **Status after `ayush/backend-rounds-2-4` + frontend wiring:** §1 ✅ built AND consumed — frontend calls your actual routes (`/context/upload`, `GET /context`, `DELETE /context/{id}`), spec below updated to match. §2 ⬜ (`mode` silently ignored today), §3 ✅ nothing needed, §4 ⬜ seeds missing, §5 ⚠️ template exists but `tools: []`.

### 1. `POST /context/upload` + `GET /context` + `DELETE /context/{id}` — business-context ingestion (auto-tag) ✅ live
Frontend sends multipart `file` OR `text` form field (+ `tenant_id`) — exactly what
you built. Store `{id, filename, kind, tags, summary, status, created_at}`;
`kind ∈ pdf|spreadsheet|image|note|document` (frontend maps to its own labels).
Folded into `/search` documents group ✅ and fed to agent memory ✅ — both verified.

### 2. `POST /chat` — new optional field `mode`
`"chat" | "web" | "deep"`. Contract-tolerant: ignore if you can't wire it yet —
the UI only uses it to label the trace. If easy: `web`/`deep` could call a
search tool and append cited links to `reply` (URLs get link previews free).

### 3. Attachments — already real
`POST /upload` accepts invoice photos/PDFs; the composer pipes them there
before `/chat`. No work needed unless you want non-invoice files → auto-route
to `/context/docs` (nice, not needed).

### 4. Connector seeds
Add rows for `facebook_marketplace`, `indiamart`, `shopify`, `instagram`
(frontend already renders them with official brand marks). Statuses:
fb_marketplace `connected`, rest `available`.

### 5. Agent template spec (digital presence)
Pre-seed a factory-ready spec so "hire a digital presence agent" converges:
tools `publish_listing`, `sync_catalog`, `seo_audit`, `storefront_builder`;
goal mentions Facebook Marketplace + IndiaMART + Shopify + SEO/GEO.

---

## Round 4 — backend additions (what the newest frontend needs)

All contract-tolerant — demo store covers until you ship. Order by effort.

> **Status after `ayush/backend-rounds-2-4` + frontend wiring:** §1 ⬜ missing (kanban moves 404 → demo-store fallback; now IN contract.json), §2 ⬜ frontend now sends BOTH spellings (`col`+`status`, `agent`+`agent_id`) so `agent_id` lands today — but `status`/`col` on create is still dropped (hardcoded `todo`), §3 ⬜ open, §4 ✅ resolved — LogsExplorer now streams `GET /logs`, §5 ⬜ `role` silently dropped (frontend sends `prefs.role` in `/onboarding` AND `PATCH /settings`).

### 1. `PATCH /tasks/{id}` — kanban moves (NEW, needed — in contract.json)
The tasks board (`#/tasks`) drags cards between
`todo | in_progress | approval | done`. Frontend sends `{col, status}` — same
value twice; treat `col` as alias — + `tenant_id` query.
Update `status`, return the row. `GET /tasks` already exists and works —
the board is live on it today; this patch is the missing half.

### 2. `POST /tasks` field mapping
Frontend sends `{tenant_id, title, col, agent, status, agent_id}` — both
spellings. `agent_id` already persists; `status`/`col` are dropped today
(hardcoded `todo` server-side) — accept them so quick-add can land in any column.
Priority/due/tags optional.

### 3. UTF-8 bug — FIX BEFORE FILMING
JSON responses mangle `₹` → `â‚¹` (visible in `/tasks` title
"Get steel quotes under â‚¹62/unit", also on invoice amounts).
Fix: ensure every JSON response is `application/json; charset=utf-8` —
either `JSONResponse(..., media_type="application/json; charset=utf-8")`
or a tiny middleware. Verify: `curl -s localhost:8000/tasks | grep ₹`.

### 4. `GET /logs` — real feed for the Logs page ✅ consumed
LogsExplorer now seeds its stream from `GET /logs?limit=` (your `activity`
collection — `{ts, kind, text}` rows), synthesized entries as fallback.
No `/activity` alias needed.

### 5. `PATCH /settings` — accept `role` (optional)
Onboarding asks role (owner/accountant/manager/worker) and maps it to RBAC
client-side. Frontend sends `prefs: {role: "owner|manager|viewer"}` in both
`POST /onboarding` (✅ persists via prefs merge) and `PATCH /settings` —
verify a top-level `role` or `prefs.role` survives a re-login.

### Already covered / no backend work needed
- Analytics (`#/analytics`) composes `dashboard/summary` + `/cashflow` +
  `/invoices` + `/agents` — all exist.
- People (`#/people`) calls `GET /people` ✅ — defaulter flags + outstanding
  totals straight from your aggregation (client-side compose is the fallback).
- Notifications page uses `GET /notifications` + `POST /notifications/{id}/read` ✅.
- Approvals drawer uses `GET /alerts` + `POST /alerts/{id}/approve` — exists.
- Templates page merges `GET /templates` with its local gallery — agent_spec
  templates get a real Install button (`created_by:"factory"` → opens the new
  agent in the workspace; `needs_factory` → prefills the composer).
- Onboarding calls `POST /onboarding` ✅ — problem chips map to your `pains`
  ids (late_payments, stock_outs, untracked_deliveries, too_many_excels,
  cash_flow, chasing_suppliers), `auto_hire:true`, and it toasts the count
  from `agents_installed[]`. Heads-up: `too_many_excels` isn't in `_PAIN_MAP`
  — map it to `compare-suppliers` or add an excel-helper template.
- Calendar calls `GET /calendar/events` ✅ — maps `invoice_due→invoice`,
  `alert→reminder` display kinds and filters by the viewed day.
- Settings "Sync now" + post-connect auto-sync call `GET /connectors/{id}/sync` ✅.
- Voice input, TTS, command palette, dark mode, kanban DnD — all client-side.

---

## §OAuth — real authentication + connector setup (NEW — 2026-09-20)

**Today everything is demo auth.** `POST /auth/login` accepts any credentials,
there is no session/token check on any route, and connector connect/sync are
stubs (connect flips `status`, sync counts local rows). This section is what
makes it real. All env placeholders are already in `.env.example` — ask Fahmin
for the real `.env` values once provisioned.

### A. App auth (do this FIRST — everything else hangs off it)
1. `AUTH_JWT_SECRET` — issue a signed JWT (or opaque session id) at
   `POST /auth/login`; verify it via a FastAPI dependency on every tenant route.
2. Decide login mechanism: password+hash (argon2), or SES magic-link. Keep the
   demo bypass behind `USE_AWS=0` or a `DEMO_LOGIN=1` flag so local dev stays
   frictionless.
3. Once auth exists, enforce on `GET /artifacts/{id}`: private artifacts must
   require the owner's session. `/public/artifacts/{id}` already 404s private —
   that's the share-link contract, keep it.
4. `PUBLIC_API_URL` / `PUBLIC_APP_URL` — needed for OAuth redirect URIs and for
   building absolute share links server-side.

### B. Connector OAuth — what each needs
| Connector | Provider console | Env vars | Redirect URI | Scopes |
|---|---|---|---|---|
| Gmail / Drive / Calendar (ONE client) | Google Cloud → OAuth consent + Web client | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `{PUBLIC_API_URL}/connectors/google/callback` | `gmail.readonly gmail.send drive.readonly calendar.events openid email` |
| WhatsApp Business | Meta Dev app + WhatsApp product | `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | meta callback + webhook URL for inbound | embedded signup or permanent token |
| Facebook / Instagram | same Meta app | `META_*` above | meta callback | `pages_manage_posts`, `instagram_basic` (⚠ Marketplace has NO public listing API — keep that connector manual/simulated) |
| Shopify | Partner dashboard → custom app | `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES` | `/connectors/shopify/callback` | `read_products,write_products,read_orders` |
| Razorpay | dashboard → API keys (not OAuth) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | webhook URL | payment links + webhook verify |
| IndiaMART | partner program | `INDIAMART_API_KEY` | — | lead/catalog APIs |
| Airtable | airtable.com/create/oauth (or PAT) | `AIRTABLE_CLIENT_ID`, `AIRTABLE_CLIENT_SECRET` or `AIRTABLE_PAT` | `/connectors/airtable/callback` | `data.records.read` |
| Slack | api.slack.com/apps | `SLACK_CLIENT_ID/SECRET`, `SLACK_SIGNING_SECRET` | `/connectors/slack/callback` | `chat:write`, `channels:read` |
| Tally | no OAuth — TallyPrime HTTP on LAN | `TALLY_GATEWAY_URL` | — | XML over HTTP |

### C. Backend work this implies (your build list)
1. `GET /connectors/{id}/authorize` → redirect to provider consent (state=tenant+connector).
2. `GET /connectors/{provider}/callback` → exchange code → store refresh token.
3. **Token storage** — `TOKEN_STORE=secretsmanager` (AWS Secrets Manager) or an
   encrypted `sahayak-tokens` table. NEVER plaintext tokens in DynamoDB.
4. `GET /connectors/{id}/sync` — read real rows via the stored token instead of
   counting local collections.
5. Webhook receivers where the provider pushes (WhatsApp inbound, Razorpay
   payment captured) — verify `WHATSAPP_VERIFY_TOKEN` / `RAZORPAY_WEBHOOK_SECRET`.
6. Scheduler/EventBridge hookup so syncs run without a button press (already
   planned in §6 deploy).
7. Update `GET /auth/login` contract — return `{token, user}` not just a profile;
   frontend stores the token and sends `Authorization: Bearer` on every call.

### D. Frontend impact (Fahmin's side — FYI only)
- api.js sends `Authorization` header once `AUTH_JWT_SECRET` flow exists.
- ArtifactView already treats private as unresolvable on the public route —
  after auth lands, private artifacts become owner-viewable in-app.
- Connect buttons should open `window.location = /connectors/{id}/authorize`
  instead of flipping state optimistically (keep the optimistic path as
  offline fallback).
