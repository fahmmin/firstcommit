# AYUSH.md — Ayush's Handbook (READ FIRST — including your AI agent)

**You = Ayush — owner of the entire backend.** Set it up, run it, edit it until it's
ready. **Fahmin owns the entire frontend.** The seam between you is
`frontend/mocks/contract.json` — he builds all UI against it and never waits on you;
you implement until responses match it. Both of you work on `USE_AWS=1` once your
`.env` exists.

The app already runs end-to-end locally (`USE_AWS=0`). 39 tests + 14/14
`simulate_demo.py` checks are green — **keep them green and grow them.**

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

- [ ] AWS account → `us-east-1` → billing alert $5
- [ ] Bedrock → Model access → **Nova Lite + Nova Pro** (auto-approve; skip Anthropic)
- [ ] IAM user `hackathon` + AdministratorAccess + key → `aws configure --profile hackathon`
- [ ] DynamoDB `PAY_PER_REQUEST`, PK `tenant_id` + SK `id` — one table per
      `Store._COLLECTIONS` (existing 6 + any you add: `tasks`, `notifications`,
      `connectors`, `settings`, `activity`)
- [ ] SES: verify sender **and the demo recipient** (sandbox only sends to verified)
- [ ] S3 `sahayak-uploads` + CORS `["*"]` PUT/GET
- [ ] Smoke: `sts get-caller-identity`, `dynamodb list-tables`, one
      `bedrock-runtime converse` on `us.amazon.nova-lite-v1:0`

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

## 5. Deploy — ONLY if `simulate_demo.py` is green

Amplify (frontend `dist/`) + Lambda zip (`handler = Mangum(app)` exists) or App
Runner. EventBridge rules → `scheduler.py` logic. No local Docker.

---

## What Fahmin is building meanwhile (context — not your scope)

login → onboarding → dashboard (tiles/charts/activity) → subagents grid →
agent detail + contextual sidebar → create-task flow → calendar →
notifications w/ approve → connectors page → settings → chat polish →
factory-hiring animation → landing → demo video + submission.

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
