# Sahayak AI — your AI back-office that hires its own staff

> Built during **First Commit** (AWS hackathon). Team: **Fahmin** + **Ayush**.

An SMB owner chats with **Sahayak** in plain words (Hinglish fine). An orchestrator
routes to specialists — **Vasool** (invoices/payments), **Sourcer** (suppliers/MOQ/trust),
**Khata** (cash-flow/90-day-terms) — and when a problem has no specialist, **Nirmata**
interviews the owner and *hires a new agent live*. Every outbound action is draft-only
until the owner approves it.

**Demo moments:** photo → parsed ledger row · agent materializes mid-conversation ·
overnight alerts awaiting approval.

## Quickstart

```bash
# backend — works TODAY with zero AWS (USE_AWS=0: LocalStore + ConsoleNotifier + MockModel)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend
cd frontend && npm install && npm run dev          # → http://localhost:5173

# tests + the demo-as-a-test
cd backend && pytest tests -v
python simulation/simulate_demo.py                 # must print 14/14
```

When Ayush's `.env` arrives: `USE_AWS=1` + `AWS_PROFILE=hackathon` → same commands,
real DynamoDB/SES/Bedrock-Nova. No code changes.

## File map — what exists & what's needed

```
✅ DONE          backend/app/store.py         Store iface + LocalStore ✓ + DynamoStore skeleton
🔧 AYUSH         backend/app/store.py         DynamoStore → pass test_store_parity on AWS
✅ DONE          backend/app/notifier.py      Notifier iface + Console ✓ + SES skeleton
🔧 AYUSH         backend/app/notifier.py      SESNotifier → send a real email
✅ DONE          backend/app/models.py        MockModel ⇄ BedrockModel(Nova) auto-select
✅ DONE          backend/app/agents/          orchestrator, vasool, sourcer, khata,
                 nirmata(factory), registry, specs, mock_rules — tests green
✅ DONE          backend/app/tools/           17 tools across invoices/suppliers/cashflow/
                 logistics/comms
✅ DONE          backend/app/main.py          all endpoints + Mangum handler
✅ DONE          backend/app/scheduler.py     thread scheduler (promotes due alerts)
🔧 AYUSH         EventBridge mapping          same run_once logic via schedule rule (stretch)
✅ DONE          backend/app/seed/seed.json   demo tenant data (tables mirror this)
✅ DONE          backend/tests/               unit + routing evals + contract + store-parity
✅ DONE          simulation/simulate_demo.py  judge walkthrough as assertions (14 checks)
🟡 SCAFFOLD      frontend/src/                working chat + agent roster + alert approve
🔧 FAHMIN        frontend/src/                landing, onboarding, invoice/aging + cashflow
                                              charts (recharts installed), agent-hiring
                                              animation (framer-motion installed),
                                              low-confidence parse confirm UI, polish
🔒 FROZEN        frontend/mocks/contract.json API contract — single source of truth
✅ DONE          .env.example, .gitignore, AYUSH.md, DESIGN.md (palette ref)
```

## The contract (both of you code to this)

`frontend/mocks/contract.json` — every endpoint's request/response shape.
Backend contract tests enforce it; frontend builds against it. To change a
shape: agree, edit contract.json first, then code.

Chat extras: response `actions[]` tells the UI what changed
(`invoice_created`, `reminder_drafted`, `agent_created`, `alert_scheduled` →
refresh that panel); `trace` shows routing for the badge.

## Work split + dependencies

**Fahmin** — `frontend/src/` everything, Hinglish UX polish, demo script +
video + submission text. Works entirely against `USE_AWS=0`; once `.env`
arrives, re-run sim on `USE_AWS=1` and film the AWS bits.

**Ayush** — `AYUSH.md` has his runbook: AWS console, DynamoStore, SESNotifier,
EventBridge, deploy. Give him the repo + tell him to read AYUSH.md first.

| Fahmin waits on Ayush for | Ayush waits on Fahmin for |
|---|---|
| `.env` values (to test + film `USE_AWS=1`) | interfaces + contract + seed schema — **already committed, he's unblocked NOW** |
| deployed URL (stretch) | a stable demo path — keep `simulate_demo.py` green |
| SES-verified demo inbox | — |

Nothing in Fahmin's list blocks Fahmin; nothing in Ayush's list blocks Ayush.
Fully parallel.

## Guardrails (already enforced — mention in pitch)

tool allowlist per agent · spec validation (unknown tools rejected) ·
human-approval for all outbound sends · parse-confidence gate ·
`tenant_id` isolation (tested) · uploads never enter system prompts
Stretch: Bedrock Guardrails on the orchestrator (one flag on `BedrockModel`).

## Git

- `main` protected by habit: commit gate = `pytest` + `simulate_demo.py` green
- Branches `fahmin/*`, `ayush/*` → squash-merge PRs; conventional commits
- `.env` and AWS keys never committed (`.gitignore` covers; verify `git status`)
- Milestones tagged: `scaffold` → `core-loop` → `ui-demo` → `aws-live` → `ship`

## Demo script (== simulate_demo.py)

1. `POST /demo/reset` → fresh tenant
2. "show my overdue invoices" → routes to Vasool → aging numbers
3. Upload invoice photo → parsed → ledger row appears
4. "draft a reminder" → pending_approval → click Approve → sent
5. "mera transporter nahi aaya" → Nirmata interviews → confirm → **Logistics Agent appears in roster** → ask it "cheapest pickup to ludhiana?"
6. Alerts panel → scheduled reminders; cashflow → the 90-day gap callout

Run `python simulation/simulate_demo.py` before recording — if 14/14, demo's green.
