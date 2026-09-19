# Sahayak AI — your AI back-office that hires its own staff

> Built during **First Commit** (AWS hackathon). Team: **Fahmin** (frontend) + **Ayush** (backend + AWS).

An SMB owner logs in, sees a dashboard, and chats with **Sahayak** in plain words
(Hinglish fine). An orchestrator routes to specialists — **Vasool** (invoices/payments),
**Sourcer** (suppliers/MOQ/trust), **Khata** (cash-flow/90-day-terms) — and when a
problem has no specialist, **Nirmata** interviews the owner and *hires a new agent
live*. Tasks can be assigned to agents, dues/reminders land on a calendar and in a
notifications feed (all outbound actions are draft-only until the owner approves),
and connectors pull in existing tools (Google Calendar, Airtable, WhatsApp…).

**Demo moments:** photo → parsed ledger row · agent materializes mid-conversation ·
overnight alerts awaiting approval · "it works while you sleep".

## Quickstart

```bash
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000     # works TODAY, zero AWS (USE_AWS=0)

cd frontend && npm install && npm run dev     # → http://localhost:5173

cd backend && pytest tests -v                 # 39 green
python simulation/simulate_demo.py            # must print 14/14
```

`USE_AWS=0` = LocalStore + ConsoleNotifier + MockModel (deterministic, offline).
`USE_AWS=1` + `.env` from Ayush = DynamoDB + SES + Bedrock Nova. Same code, same API.

## The app (frontend flow — see contract.json for endpoint detail)

`/login` → `/onboarding` → `/dashboard` (KPI tiles, aging + cashflow charts, activity)
→ `/agents` grid (incl. AI-hired cards) → `/agents/:id` (persona, tools, stats,
activity + **contextual sidebar**: Vasool → invoice summary + capital locked;
Logistics Agent → carriers/bookings) → `/tasks` (assign work to an agent, watch it run)
→ `/calendar` (dues + alerts + tasks) → `/notifications` (approve/send) →
`/connectors` (GCal, Airtable, WhatsApp, Tally, Razorpay) → `/settings` → `/chat`.

## File map

```
✅ DONE       backend/app/store.py       Store iface + LocalStore ✓ + DynamoStore skeleton
✅ DONE       backend/app/notifier.py    Notifier iface + Console ✓ + SES skeleton
✅ DONE       backend/app/models.py      MockModel ⇄ BedrockModel(Nova) auto-select
✅ DONE       backend/app/agents/        orchestrator, vasool, sourcer, khata,
              nirmata (factory), registry, specs, mock_rules
✅ DONE       backend/app/tools/         17 tools: invoices/suppliers/cashflow/logistics/comms
✅ DONE       backend/app/main.py        [EXISTS] endpoints + Mangum handler
✅ DONE       backend/app/scheduler.py   thread scheduler (EventBridge mapping = Ayush stretch)
✅ DONE       backend/app/seed/seed.json demo data (+ Ayush adds tasks/notifications/connectors rows)
✅ DONE       backend/tests/             unit + routing evals + contract + store-parity
✅ DONE       simulation/simulate_demo.py demo-as-a-test (14 checks)
🟡 SCAFFOLD   frontend/src/              working chat + roster + alert approve
� FROZEN     frontend/mocks/contract.json full API + frontend_flow — single source of truth
✅ DONE       .env.example, .gitignore, AYUSH.md, DESIGN.md (palette)
```

## Work split — equal halves, one seam (contract.json)

### Ayush — backend (`backend/` is yours, edit freely)

| # | Task | Notes |
|---|------|-------|
| 1 | AWS console + `.env` → Fahmin | runbook in AYUSH.md §2 |
| 2 | DynamoStore → parity green | `USE_AWS=1 pytest tests/unit/test_store_parity.py` |
| 3 | SESNotifier → real email | sandbox: verify sender + recipient |
| 4 | `dashboard/summary` + `notifications` endpoints | compose existing stores |
| 5 | `tasks` + `tasks/{id}/run` | run pushes task through assigned agent |
| 6 | `agents/{id}` + `agents/{id}/context` | contextual sidebar payloads |
| 7 | `calendar/events` | unify invoice dues + alerts + tasks |
| 8 | `connectors` | GCal + Airtable real-ish; others stub ok |
| 9 | `settings` + `auth/login` | persistence + demo token |
| 10 | Contract tests + sim steps for new endpoints | keep 14/14 growing |
| 11 | Deploy (stretch): Amplify + Lambda/App Runner + EventBridge | only if sim green |

### Fahmin — frontend (`frontend/src/` is yours)

| # | Task | Notes |
|---|------|-------|
| 1 | Login page | `POST /auth/login` — demo token, no real auth |
| 2 | Onboarding wizard | business line/city/"what eats your time" → dashboard |
| 3 | Dashboard | tiles, aging + cashflow charts (recharts installed), activity feed |
| 4 | Subagents grid | agent cards; "HIRED BY AI" badge; hire-agent button |
| 5 | Agent detail + contextual sidebar | per-agent panels (invoice summary, capital locked…) |
| 6 | Chat polish | routing badges, agent pinning, action toasts (exists — upgrade) |
| 7 | Create-task flow | assign → run → result view |
| 8 | Calendar view | month grid over `/calendar/events` |
| 9 | Notifications feed | action_required → approve → sent |
| 10 | Connectors page | cards w/ connect → syncing → items_synced |
| 11 | Settings page | profile + prefs |
| 12 | Factory-hiring animation + confetti | framer-motion installed — THE judge moment |
| 13 | Landing page | pitch + demo GIF + "Powered by AWS" strip |
| 14 | Demo video + submission text | ~3 min; show AWS visibly |

## Dependencies

| Fahmin waits on Ayush | Ayush waits on Fahmin |
|---|---|
| `.env` (test + film `USE_AWS=1`) | nothing to start — contract is frozen |
| `[TODO]` endpoints (mock till then) | stable demo path (keep sim green) for deploy |
| SES-verified demo inbox | — |

Fully parallel: Fahmin builds against contract.json mocks; Ayush builds to contract.

## The iteration loop (how you two actually work together)

As screens come online, Fahmin reports mismatches to Ayush in this format:

```
PAGE: /agents/agent-l7x2 (right sidebar)
COMPONENT: InvoiceSummaryCard
NEED: oldest_overdue_days (number)
EXPECTED: 111   ACTUAL: missing
KIND: behavior | shape | new-endpoint
```

- **behavior** → reply was wrong/weird → Ayush fixes prompt/tool/mock_rules/seed
- **shape** → component needs a field → agree shape, **edit contract.json first**, then implement
- **new-endpoint** → whole view has no API → same: contract first, then build

Done = contract test for that endpoint + `simulate_demo.py` green.

## Guardrails (pitch these)

tool allowlist per agent · spec validation · human-approval for all outbound ·
parse-confidence gate · tenant isolation (tested) · uploads never in system prompts
Stretch: Bedrock Guardrails (one flag on `BedrockModel`).

## Git

- Merge gate: `pytest` + `simulate_demo.py` green (both modes where relevant)
- Branches `fahmin/*`, `ayush/*` → squash-merge; conventional commits
- `.env`/keys never committed. Tags: `scaffold` `core-loop` `ui-demo` `aws-live` `ship`

## Demo script (== simulate_demo.py)

reset → "show my overdue invoices" → upload invoice photo → draft reminder →
approve → sent → "mera transporter nahi aaya" → Nirmata interviews → confirm →
**Logistics Agent appears** → "cheapest pickup to ludhiana?" → alerts/cashflow views.
