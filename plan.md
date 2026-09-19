---
agent: devin-local
session: shadow-durian
created: 2026-09-18T21:54:20Z
---
# Sahayak AI — Agentic Back-Office for SMBs (First Commit Hackathon)

A demo-first, local-first webapp where a non-techy Indian SMB owner chats with an AI orchestrator routing to specialist agents (receivables, procurement, cash-flow) with proactive alerts — plus the Agent Factory that interviews the owner and hires a new specialist live. Built test-driven on Strands SDK + Bedrock Nova, with local/AWS swappable backends, guardrails, and a polished judge-facing experience.

## 0. Locked Decisions & Operating Principles
- **Track:** Build It (local) guaranteed; Ship It deploy attempted at T+8h as bonus.
- **Agent Factory:** core, with pre-seeded fallback spec (live-create is bonus, never a demo dependency).
- **Team:** vertical module split (§6).
- **Flavor:** Indian SMB — `Sahayak AI`, ₹, kirana/auto-components seed data, Hinglish-tolerant prompts.
- **Demo-first rule:** judges never see code depth — every hour of backend work must produce something *visible*. Polished UI > more agents.
- **TDD rule:** every module ships with its test/simulation BEFORE its UI; each phase ends with `pytest` + `simulate` green.
- **Docs rule:** before writing any Strands/Bedrock/boto3 call, fetch current docs (`npx ctx7` or AWS docs); log verified model IDs/API signatures in `docs/api-notes.md`. No guessing.
- **AWS-swap rule:** every AWS service has a local stand-in behind an interface (`USE_AWS` env var). Demo can never be blocked by AWS.

## 1. Winning Strategy — Judge Experience (the real deliverable)

Judges see: a story, a UI, a moment of surprise, and AWS visibly in use. Design backwards from the 3-min video.

**The 3 "judge moments":**
1. **"Photo → ledger"** — owner uploads a crumpled paper invoice photo; watch it parse live into a clean ₹ ledger row with extracted GST, due date, amount. *(visual: split-screen image → JSON → table row animating in)*
2. **"It hires staff"** — owner types "Mera transporter nahi aaya, order stranded hai" → Nirmata asks 2-3 sharp questions → animated "building your Logistics Agent…" sequence → new agent card materializes in dashboard → immediately answers "cheapest pickup to Ludhiana by tomorrow?" with real carrier data. **This is the moment that wins.**
3. **"It works while you sleep"** — dashboard alert feed shows an overnight reminder auto-sent for an invoice due in 3 days; owner approves/edits before send (human-in-the-loop = guardrail + trust story).

**Visual polish requirements (non-negotiable for winning):**
- shadcn/ui + Tailwind + framer-motion; dark, premium dashboard aesthetic
- Landing page: one-line pitch + 15s looping GIF of the factory moment + "Powered by AWS" strip (Bedrock/Strands/DynamoDB/SES logos)
- Charts (recharts): receivables aging bars, cash-flow timeline, "₹ recovered this month" counter tile
- Agent cards with avatar, hindi tagline, live status dot, tools chips
- Chat UI with agent-routing badges ("→ Vasool") so judges SEE the orchestration happen
- `mock/contract.json` lets Dev 2 perfect visuals without backend

**Pitch framing (README + video + submission text):**
- Hook: "9 crore SMBs in India lose hours daily to work a ₹300/month tool could do — but ERPs are built for enterprises, not for Ramesh."
- One line: "Sahayak is an AI back-office that hires its own staff."
- Map each shipped agent to its real problem statement; show the other 6 as "the platform extends to these by design — the Factory is how."
- End-card: live AWS services montage + cost-per-message stat.

## 2. Product & Agents

**Built-in agents** (system prompt + tools from registry):
1. **Vasool (Receivables)** — invoice photo → Nova Lite vision parse → ledger → aging → draft reminder → owner approves → send via Notifier. *(problems #1, #7)*
2. **Sourcer (Procurement)** — catalog, stock check, price compare, trust scores, MOQ pooling. *(#4, #5, #6, #9)*
3. **Khata (Cash-Flow)** — receivables-vs-payables timeline, 90-day-term gap warning, order advisor. *(#7)*

**Nirmata (Factory)** — interview → `AgentSpec` → validate → registry → live Strands Agent → dashboard card. Demo target: Logistics Agent. *(#2, #3, #8)*

**AgentSpec schema** `{id, name, hindi_tagline, persona_prompt, goal, tools[] ⊆ registry, alerts[], schedule?, created_by, status, guardrails:{allowed_tools, max_action: "draft_only"|"can_send"}}`

**Tool registry** — `invoices(parse_document, create, list_overdue, aging_report, draft_reminder)` · `suppliers(search_catalog, check_stock, compare_prices, trust_score, suggest_moq_pool)` · `cashflow(timeline, term_gap_analysis, order_advisor)` · `logistics(list_carriers, quote_pickup, book_pickup)` · `comms(send_reminder, schedule_alert, list_alerts)`

## 3. Guardrails (added per request)

**Application-level (always on):**
- **Tool allowlist per agent** — spec validation rejects any tool not in registry; factory output is filtered to registry ∩ requested
- **Human-in-the-loop for outbound** — agents can only *draft* reminders/messages; `send` requires owner approval click (`max_action` in spec; factory agents default `draft_only`)
- **AgentSpec schema validation** — pydantic model; invalid spec → factory asks clarifying question instead of creating a broken agent
- **Parse confidence gate** — Nova Lite extraction below confidence threshold → "please confirm these fields" UI, never silently write bad ledger data
- **Tenant isolation** — every store query scoped by `tenant_id`; tests assert cross-tenant reads return empty
- **Injection hygiene** — uploaded docs treated as data, never concatenated into system prompts; tool args validated

**AWS-level (stretch, if account healthy):**
- Amazon Bedrock Guardrails on the orchestrator endpoint (content filters, denied topics) — 30 min to wire, big responsible-AI talking point

## 4. Test-Driven Implementation (expected vs actual, always verified)

```
backend/tests/
  unit/            pure fns: invoice parse schema, aging math, term-gap calc, spec validation
  routing/         eval tests: utterance → expected agent+tools (real model, temp 0, retry×2)
  contract/        API shape tests vs docs/api.md; store impl parity (Local ≡ Dynamo semantics)
simulation/
  simulate_demo.py THE DEMO AS A TEST — drives the full judge walkthrough via API,
                   asserts each step, prints EXPECTED vs ACTUAL diff, exit code
frontend/mocks/contract.json   golden API responses (tests + offline UI dev)
```

**Test pyramid:**
- **Unit** — parsers, aging/term math, spec validator, tool allowlist enforcer, notifier/Store impl parity (LocalStore and DynamoStore pass the same suite → proves the swap is safe)
- **Routing evals** — table of ~15 utterances (incl. Hinglish) → assert orchestrator picks correct agent/tool; temp=0, retry once, report pass-rate not binary (LLM nondeterminism acknowledged honestly)
- **Contract** — every endpoint conforms to `docs/api.md` schemas
- **E2E simulation** — `simulate_demo.py` = the literal demo script as assertions: onboard → upload invoice → parsed row → aging → reminder draft → approve → send → factory interview → logistics agent exists → answers carrier query → alert fires. Prints `EXPECTED | ACTUAL | PASS/FAIL` table. **Run before every milestone commit — this is the "did we build what we expected" check.**

## 5. Architecture

```
React SPA (Vite+Tailwind+shadcn) ──REST──▶ FastAPI (uvicorn → Lambda/App Runner if deploying)
   demo-tenant selector                       │
   (Cognito only if deploying)                ▼
                              Orchestrator (Strands Agent, Nova Pro)
                              ├─ as_tool: Vasool  (Nova Lite)
                              ├─ as_tool: Sourcer (Nova Lite)
                              ├─ as_tool: Khata   (Nova Lite)
                              └─ as_tool: Nirmata (Nova Pro) → AgentSpec→registry→live Agent
   Store ── LocalStore(JSON) ⇄ DynamoStore(DynamoDB)          [USE_AWS]
   Notifier ── Console ⇄ SES                                  [USE_AWS]
   Uploads ── ./uploads ⇄ S3                                  [USE_AWS]
   Scheduler ── thread ⇄ EventBridge+SES                      [USE_AWS]
```

**Repo layout:**
```
backend/app/{main.py, store.py, notifier.py, scheduler.py}
backend/app/agents/{orchestrator, vasool, sourcer, khata, factory, registry}.py
backend/app/tools/{invoices, suppliers, cashflow, logistics, comms}.py
backend/app/seed/seed.json   backend/tests/…   simulation/simulate_demo.py
frontend/src/{chat, onboarding, dashboard/, panels/}   frontend/mocks/
docs/{api.md, api-notes.md, demo-script.md, architecture.png}
```

## 6. Timeline (~21h → midnight; freeze T-3h)

| Phase | Hrs | Dev 1 (Ledger slice) | Dev 2 (Platform/judge-experience slice) | Gate |
|---|---|---|---|---|
| 0 Setup | 0–1 | AWS acct + Nova Lite/Pro check; store+notifier interfaces + Local impl | repo init, `.gitignore`, first commit; **API contract (30m, together)**; Vite+shadcn scaffold; mock server | `pytest` skeleton green |
| 1 Core loop | 1–4 | seed data; invoice tools + unit tests; Vasool | orchestrator + 2 stub agents + routing evals; chat UI w/ routing badges against mocks | `simulate` step 1–2 pass |
| 2 Flagship | 4–8 | upload→Nova Lite parse→ledger→aging (tests first); reminder draft | landing page; onboarding wizard; InvoicePanel + aging chart; approve/send flow UI | invoice e2e in sim |
| 3 Factory | 8–12 | DynamoStore + USE_AWS path; SES notifier; supplier/cashflow tools | Nirmata interview + spec→registry→live agent; agent-card materialize animation; Logistics path | sim factory steps pass |
| 4 Deploy (bonus) | 8–12 ∥ | Lambda zip (Mangum) / App Runner + DynamoDB | Amplify frontend; Cognito-lite or tenant selector; "Powered by AWS" strip | — |
| 5 Polish | 12–16 | Khata agent; alert scheduler (thread⇄EventBridge); Hinglish tuning | AlertsPanel; cash-flow chart; empty/loading states; confetti on agent creation; screenshots | full sim green |
| 6 Ship | 16–19 | seed demo tenant; rehearsal support | **demo video (3 min)**, README + arch diagram, submission text | video + README done |

**Rules:** rehearse `simulate_demo.py` steps as the demo script — if sim is green, demo is green. Record video at T+16 with T+3 buffer. Never trade local-working for deployed-broken.

## 7. Team Split (vertical modules)

**Dev 1 — Ledger slice:** `store.py`, `notifier.py`, `scheduler.py`; `tools/{invoices,suppliers,cashflow}.py`; `agents/{vasool,sourcer,khata}.py`; invoice parse pipeline; seeds; unit tests for all of the above; `InvoicePanel`/`SupplierPanel` UI widgets; DynamoDB+SES if deploying.

**Dev 2 — Platform & judge-experience slice:** `main.py`; `agents/{orchestrator,factory,registry}.py`; spec schema+validator; `tools/{logistics,comms}.py`; routing evals + `simulate_demo.py`; chat shell, onboarding, `AgentDashboard`, `AlertsPanel`, landing page; Amplify deploy; **demo video + README**.

## 8. Git Plan

- Branches: `main` + `dev1/*` / `dev2/*` → squash-merge PRs (self-review OK)
- Conventional commits; milestone tags: `scaffold` `core-loop` `invoice-e2e` `factory-live` `alerts` `ship`
- Commit gate: `pytest` + `simulate` green before merging to `main`
- `.gitignore`: `.env*`, `node_modules`, `__pycache__`, `dist`, `.aws-sam`, `uploads/`; `.env.example` committed; **never commit AWS keys**
- README: hook → demo GIF → AWS services → "built during First Commit" → run steps → architecture

## 9. Verification

- [ ] `pytest` all green; Local/Dynamo store-parity suite passes
- [ ] Routing evals ≥90% pass-rate on utterance table
- [ ] `simulate_demo.py` prints all-PASS expected-vs-actual table
- [ ] Invoice photo → ledger row → draft → approve → (console|SES) send
- [ ] "Mera transporter nahi aaya" → interview → Logistics card appears → answers carrier query
- [ ] Alert fires on due-in-3-days invoice; approval gate blocks unsanctioned sends
- [ ] `USE_AWS=0` offline demo ≡ `USE_AWS=1` cloud path
- [ ] 3-min video shows AWS visibly; README complete; `git log` clean

## 10. Risks / Mitigations

| Risk | Mitigation |
|---|---|
| Bedrock/Nova access gated | Hour-0 check; Strands runs on any provider — demo still shows AWS OSS (Strands); keep trying enable in background |
| Factory flakes live | Pre-seeded identical spec; live-create is bonus |
| LLM nondeterminism breaks tests | temp=0 + retry + pass-rate reporting; sim asserts state not wording |
| Time overrun on deploy | Local-first rule; deploy only if sim green at T+8 |
| UI polish underestimated | Dev 2 owns it from hour 1; mocks unblock visuals before backend exists |
| Docs drift / wrong API | `ctx7` + AWS docs check per call; signatures logged in `docs/api-notes.md` |
