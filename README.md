# Sahayak AI — an AI staff for the small businessman the internet left behind

> The online-shopping boom handed every big retailer a software army — logistics
> engines, collection teams, analytics dashboards — while the man running a
> components shop in Faridabad got a smartphone and a warning that his customers
> are buying online now. **63 million small businesses** still run on paper
> ledgers, WhatsApp threads and memory — not because they're behind, but because
> every tool ever built for them assumes an IT department. Sahayak is our answer:
> **an AI staff, not another dashboard.**

[![Live demo](https://img.shields.io/badge/demo-sahaayak.space-3494f4)](https://www.sahaayak.space/?gate=WJecxdO_WdjZ#/app)
[![YT-Video](https://img.shields.io/badge/demo-sahaayak.space-3494f4)]([https://www.sahaayak.space/?gate=WJecxdO_WdjZ#/app](https://youtu.be/4jNoelUtQ9Q))

**Live demo:** `https://www.sahaayak.space/?gate=WJecxdO_WdjZ#/app`
(gate code `WJecxdO_WdjZ` — click **Continue as Ramesh** on the sign-in screen)
**Youtube Video With Audio [EN]:** - `https://youtu.be/4jNoelUtQ9Q`
---

## What does Sahayak do?

Ramesh owns an auto-components shop. His "system" is a notebook, a billing app,
and his own memory of who owes him what. Sahayak gives him the thing only big
companies have ever had: **a staff that works while he sleeps.**

- **He talks, they work.** Plain words — Hinglish fine. An orchestrator
  (**Sahayak**, Nova Pro) routes every request to a specialist: **Vasool** chases
  payments, **Khata** watches cash flow and 90-day terms, **Sourcer** knows
  suppliers and MOQs. Replies arrive in a group-chat thread that shows exactly
  *which* agent answered and how the request was routed.
- **It hires its own specialists.** Describe a problem nobody covers — "I need
  to sell online," "my transporter is flaky" — and **Nirmata**, the agent
  factory, interviews him and spins up a new agent live (digital presence,
  logistics, compliance…), each with a Cedar-scoped tool allowlist.
- **Proactive, but the owner stays boss.** An EventBridge trigger wakes the
  agents every minute: overdue reminders get *drafted*, cash gaps get flagged —
  and **nothing leaves the shop without his one-tap approval.** Approve → real
  email goes out over SES.
- **It reads his paperwork.** Rent agreements, GST certificates, rate lists —
  dropped files are OCR'd (Textract), auto-tagged, embedded (Titan), folded into
  every agent's memory, and **render in-app** when clicked — the actual PDF, not
  a placeholder.
- **Reports on real ledgers.** Business overview, receivables aging, cash-flow
  forecast, GST summary, ops digest — generated from live data, exported as a
  branded PDF, or shared as a live public link he can WhatsApp to his CA.
- **Honest integrations.** Google Drive / Sheets / Docs / Calendar connect for
  real via a service account. Everything else says **coming soon** — because a
  demo that lies is worse than a feature that isn't built.

**The moment that sells it:** an agent drafts a payment reminder overnight —
and waits. One tap from the owner sends it. AI does the work; the human keeps
the keys.

---

## How we used AWS

### Build it — AWS open-source stack

| Tool | What it does for us |
|---|---|
| **Strands Agents SDK** | The entire agent layer — orchestrator + specialists, the tool loop, `Agent.as_tool` sub-agent composition, and `S3SessionManager` for durable agent memory |
| **Cedar** (`cedarpy`) | AWS's open-source policy language — every agent gets a real **default-deny** tool allowlist; a hired agent can never touch tools we didn't grant |
| **boto3** | Every AWS call in the backend + the whole deploy/provision toolchain |

### Ship it — AWS services

| Service | Role in Sahayak |
|---|---|
| **Amazon Bedrock** | Nova Pro (orchestrator, via `apac.amazon.nova-pro-v1:0` inference profile) routes requests; Nova Lite powers each specialist; **Titan Embed v2** drives semantic document search; Nova vision parses invoice photos |
| **AWS Lambda + Function URL** | The whole FastAPI backend runs serverless via **Mangum** — zero idle cost, scales to zero between demo clicks |
| **Amazon DynamoDB** | 14 tenant-scoped tables — invoices, payables, alerts, specs, documents, artifacts, memories, connectors… all keyed `(tenant_id, id)` |
| **Amazon S3** | Agent session memory, uploaded document bytes, deployment artifacts |
| **Amazon Textract** | OCR for scanned/PDF business documents dropped into Context |
| **Amazon SES** | Approved reminders/alerts go out as real email |
| **Amazon EventBridge** | `rate(1 minute)` rule → the proactive loop that drafts overnight reminders |
| **AWS Amplify** | Frontend hosting + the `sahaayak.space` custom domain |
| **IAM** | Scoped execution role — Bedrock invoke, Textract, SES send, DDB/S3 on `sahayak-*` only |

---

## Architecture

```
                      sahaayak.space (Amplify, React SPA)
                                │  fetch + x-demo-token
                                ▼
                  Lambda Function URL ── Mangum ── FastAPI
                                │
        ┌───────────────────────┼────────────────────────────┐
        ▼                       ▼                            ▼
  EventBridge (1/min)     Strands orchestrator          /context upload
  scheduler → draft       Sahayak · Nova Pro            → S3 bytes
  overnight alerts              │                       → Textract OCR
        │         ┌─────────────┼─────────────┐         → Titan embed
        ▼         ▼             ▼             ▼              ▼
     Alerts   Vasool        Khata        Sourcer   Nirmata (factory)
     (pending │ tools       │ tools      │ tools   │ creates new specs
     approval)│ invoices    │ cashflow   │ suppl.  │ + Cedar allowlist
        │     └──────┬──────┴──────┬─────┴─────────┘
        ▼            ▼             ▼
   Owner taps   DynamoDB ×14    S3 sessions    SES send
   Approve &    Titan search    Bedrock        (approved only)
   send
```

**One seam, two backends.** `USE_AWS` flips every cloud dependency to a local
equivalent — `LocalStore` (JSON) ⇄ `DynamoStore`, `ConsoleNotifier` ⇄
`SESNotifier`, `MockModel` (deterministic rules driving the *real* Strands tool
loop) ⇄ Bedrock — and a parity test runs the same suite against both. The demo
never needs the cloud to be up; the cloud just makes it real.

**Guardrails:** Cedar default-deny per agent · human approval on every outbound
action · Pydantic spec validation (factory agents can't grant themselves tools)
· tenant isolation on every store call · demo gate (`DEMO_GATE_TOKEN`) on the
API, public share links exempt.

---

## Quickstart

```bash
# backend — runs fully offline, zero AWS needed
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend
cd frontend
npm install && npm run dev        # → http://localhost:5173

# verify
cd backend && pytest tests -q                    # 81 green
python ../simulation/simulate_demo.py            # end-to-end demo-as-a-test
```

`USE_AWS=0` (default) = LocalStore + ConsoleNotifier + MockModel — deterministic
and offline. To run on real AWS: copy `.env.example` → `.env`, add credentials,
`python simulation/setup_aws.py` (provisions tables/bucket/role), set `USE_AWS=1`.
Deploy everything with `python simulation/deploy_aws.py`.

---

## Team

### Ayush — team lead · backend + AWS platform

- **AWS provisioning from zero:** `simulation/setup_aws.py` + `check_aws.py` —
  all 14 DynamoDB tables, S3 bucket, IAM execution role/policy, SES sender
  verification, with a verifier that prints green/red per resource
- **The Cedar authorization layer** (`agents/policy.py`) — real default-deny
  per-agent tool allowlists, so a factory-hired agent can never exceed its grant
- **The business-context brain** (`tools/documents.py`) — Textract OCR →
  Titan embeddings → auto-tagging, so dropped files become searchable agent
  memory
- **Store parity** — `memories` + `artifacts` collections across LocalStore and
  DynamoStore with identical semantics, plus Excel import, search, `/people`,
  `/logs`, morning brief, and the memory injection into orchestrator/Nirmata
  prompts
- **Contract coverage** — every `TODO` endpoint from the API contract, the
  onboarding wizard API, and the templates catalog + install-as-agent flow
- Round-4 hardening: kanban `PATCH /tasks`, task field mapping, UTF-8 JSON,
  settings role persist, web-search mode

### Fahmin — frontend + backend + deployment

- **The entire frontend** — landing page, the group-chat workspace with
  per-agent identity and route pills, and every internal page: analytics,
  tasks kanban, calendar, people/CRM, notifications + approvals drawer,
  context library, artifacts, marketplace, templates, settings, search, logs,
  docs — plus the design system, dark mode, a11y suite, command palette, and
  the libraries.dev motion layer (thinking orbs, voice beam, border beam,
  liquid pills, metal badges)
- **Half the backend** — core agent/tool/store seams, the reports engine +
  branded `fpdf2` PDF export, the Google service-account connector layer
  (`gcp.py`), digital-presence tools, document file persistence + preview
  endpoints, and the demo gate
- **Deployment end-to-end** — `simulation/deploy_aws.py`: Lambda packaging +
  Function URL, EventBridge scheduler, Amplify + `sahaayak.space`, reseeding —
  including the ugly parts (manylinux pip backtracking, double-CORS headers)
- The demo seed: a believable Faridabad hardware business — 10 real documents
  generated, uploaded, OCR'd and embedded into agent memory

---

## Repo map

```
backend/app/        FastAPI — routes, Strands agents, tools, store, Cedar policy
backend/tests/      81 contract/unit/parity tests
frontend/src/       React SPA — pages/, components/, hash router
simulation/         setup_aws.py · check_aws.py · deploy_aws.py · seed_hardware.py
AYUSH.md            backend status ledger          FAHMIN.md     frontend status ledger
ARCHITECTURE.md     the full stack map             contract.json  the API contract
```
