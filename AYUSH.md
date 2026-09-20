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

Open ⬜ (not done yet)
- ⬜ **Real Google Drive / Google Calendar OAuth connectors** (currently simulated — connect flips status, sync counts local rows only). Gmail/Drive/WhatsApp/Tally/Razorpay are stubs. ← revisit for genuine external integration
- ⬜ **Deploy** (§6): Amplify (frontend) + Lambda URL (`Mangum` ready) + EventBridge rule → `scheduler.run_once`
- ⬜ **Web search / Deep research** agent tool (needs a `TAVILY_API_KEY`)
- ⬜ Frontend wiring of already-built backends (artifacts UI, business-context page, people, templates gallery, onboarding wizard, excel import) — Fahmin's side

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

## 6. Deploy — ONLY if `simulate_demo.py` is green

Amplify (frontend `dist/`) + Lambda zip (`handler = Mangum(app)` exists) or App
Runner. EventBridge rules → `scheduler.py` logic. No local Docker.

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

### 1. `POST /context/docs` — business-context ingestion (auto-tag)
Multipart `file` OR JSON `{text}`. On ingest, run the tagger and store:
```json
{ "id": "ctx-..", "name": "GSTR-3B_FY25.xlsx", "kind": "Spreadsheet",
  "tags": ["tax","finance"], "meta": "18 rows · GSTIN linked",
  "source": "upload", "created_at": "..." }
```
Tag rules mirror `frontend/src/lib/context.js` TAG_RULES — filename + extracted
text keywords → {tax, invoices, procurement, logistics, finance, hr, sales,
legal}. `GET /context/docs` lists; `DELETE` removes. Fold into `/search`
documents group (match name + tags + meta). Extracted text also becomes a
`memories` row with `source: "doc"` so agents genuinely cite it.

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

### 1. `PATCH /tasks/{id}` — kanban moves (NEW, needed)
The tasks board (`#/tasks`) drags cards between
`todo | in_progress | approval | done`. Frontend sends
`{status}` (and a duplicate `col` field — ignore it) + `tenant_id` query.
Update `status`, return the row. `GET /tasks` already exists and works —
the board is live on it today; this patch is the missing half.

### 2. `POST /tasks` field mapping
Frontend quick-add sends `{tenant_id, title, col, agent}` — map
`col→status`, `agent→agent_id` (accept both spellings, contract already
has `status`/`agent_id` canonical). Priority/due/tags optional.

### 3. UTF-8 bug — FIX BEFORE FILMING
JSON responses mangle `₹` → `â‚¹` (visible in `/tasks` title
"Get steel quotes under â‚¹62/unit", also on invoice amounts).
Fix: ensure every JSON response is `application/json; charset=utf-8` —
either `JSONResponse(..., media_type="application/json; charset=utf-8")`
or a tiny middleware. Verify: `curl -s localhost:8000/tasks | grep ₹`.

### 4. `GET /activity` — real feed for the Logs page (optional)
`#/logs` synthesizes entries from alerts + notifications today. If you have
the `activity` collection from §1 anyway, expose `GET /activity?tenant_id=`
→ `[{ts, level, kind, message, agent_id}]` (level ∈ INFO/TOOL/MCP/APPROVE/
SYNC/WARN) and the page will stream real events instead.

### 5. `PATCH /settings` — accept `role` (optional)
Onboarding now asks role (owner/accountant/manager/worker) and maps it to
RBAC client-side. Persist `settings.role` so it survives a re-login.

### Already covered / no backend work needed
- Analytics (`#/analytics`) composes `dashboard/summary` + `/cashflow` +
  `/invoices` + `/agents` — all exist.
- People (`#/people`) aggregates `/invoices` + `/suppliers` + `/carriers`.
- Notifications page uses `GET /notifications` (+ `read` when it lands).
- Approvals drawer uses `GET /alerts` + `POST /alerts/{id}/approve` — exists.
- Global search `tasks` group is live via the demo merge; your `/search`
  already lists tasks per Round 2 spec — keep it.
- Voice input, TTS, command palette, dark mode, kanban DnD, onboarding —
  all client-side.
