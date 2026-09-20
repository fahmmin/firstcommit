# ARCHITECTURE.md — what Sahayak uses & where

> Companion to `README.md`, `AYUSH.md` (backend), `FAHMIN.md` (frontend), `BACKEND_HANDOFF.md`.
> One toggle — `USE_AWS` — swaps every cloud dependency for a local equivalent, so the
> exact same code runs offline (`USE_AWS=0`) and on real AWS (`USE_AWS=1`).

---

## 1. Stack at a glance

| Layer | Tech | Where in repo | Purpose |
|---|---|---|---|
| Frontend | **React 18 + Vite 5** | `frontend/src/` | SPA, hash router (`App.jsx`) |
| Styling | **Tailwind CSS v4** | `frontend/src/index.css`, `vite.config.js` | design system |
| Motion / charts / icons | **framer-motion, recharts, lucide-react, react-icons** | `frontend/src/pages/*`, `components/*` | animations, dashboards, iconography |
| API | **FastAPI + Uvicorn** | `backend/app/main.py` | all HTTP endpoints |
| Models (validation) | **Pydantic** | `backend/app/**` (`AgentSpec`, request models, artifact templates) | typed request/spec/template validation |
| Agents | **Strands Agents SDK** | `backend/app/agents/`, `backend/app/tools/` | orchestrator + specialists + factory, tool loop |
| LLM | **Amazon Bedrock Nova** (Lite + Pro) ⇄ `MockModel` | `backend/app/models.py` | reasoning/routing; Mock drives the real Strands loop offline |
| Auth policy | **Cedar** (`cedarpy`) | `backend/app/agents/policy.py` | per-agent tool allowlist as a real default-deny policy |
| Persistence | **DynamoDB** ⇄ `LocalStore` (JSON) | `backend/app/store.py` | 14 tenant-scoped collections, identical interface |
| Files / sessions | **Amazon S3** ⇄ local dir | `backend/app/agents/registry.py` (session mgr), uploads | agent session memory, uploads |
| Email | **Amazon SES** ⇄ `ConsoleNotifier` | `backend/app/notifier.py` | reminder/alert delivery (draft→approve→send) |
| Doc OCR | **Amazon Textract** → Bedrock vision → heuristic | `backend/app/tools/documents.py` | extract text from PDFs/scans for business context |
| Embeddings | **Bedrock Titan** (`titan-embed-text-v2`) | `backend/app/tools/documents.py` | semantic ranking in `GET /search` |
| Excel | **openpyxl** | `backend/app/tools/importer.py` | ledger import → invoice rows |
| PDF (planned) | **fpdf2** | declared in `requirements.txt` (not yet wired) | artifact/statement PDF export |
| Lambda adapter | **Mangum** | `backend/app/main.py` (`handler`) | run FastAPI on AWS Lambda (deploy path) |
| Tests | **pytest** + FastAPI `TestClient` | `backend/tests/`, `simulation/` | 75 contract/unit/parity tests + demo-as-a-test |

---

## 2. AWS services — where each is used (and its offline fallback)

| AWS service | Used for | Code | Offline fallback (`USE_AWS=0`) |
|---|---|---|---|
| **Bedrock Nova Lite/Pro** | agent reasoning, routing, invoice-photo parse | `models.py`, `tools/invoices.py` | `MockModel` (deterministic rules, real tool loop) |
| **Bedrock Titan Embeddings** | semantic document search | `tools/documents.py` `embed_text` | substring match |
| **Amazon Textract** | PDF/scan text extraction | `tools/documents.py` `_extract_via_textract` | Bedrock vision → filename-only |
| **DynamoDB** (14 tables) | all persistence | `store.py` `DynamoStore` | `LocalStore` JSON files under `backend/data/` |
| **Amazon S3** | Strands session store, uploads | `agents/registry.py` `S3SessionManager`, `main.py` demo/reset | `FileSessionManager`, local `uploads/` |
| **Amazon SES** | send approved reminders | `notifier.py` `SESNotifier` | `ConsoleNotifier` → `data/sent_messages.json` |
| **Lambda + API Gateway** | serverless host (deploy) | `main.py` `Mangum(app)` | local Uvicorn |
| **EventBridge** *(planned)* | scheduled alert promotion | maps to `scheduler.py` `run_once` | in-process daemon thread |

Provision everything with `simulation/setup_aws.py`; verify with `simulation/check_aws.py`.
Account `055533307288`, region `ap-south-1`, profile `sahayak`.

---

## 3. The core seam — one interface, two backends

```
                USE_AWS=0 (offline, demo fallback)     USE_AWS=1 (real cloud)
Store           LocalStore (JSON files)          ⇄     DynamoStore (DynamoDB)
Notifier        ConsoleNotifier (log + file)     ⇄     SESNotifier (SES email)
Model           MockModel (rules, real loop)     ⇄     BedrockModel (Nova)
Sessions        FileSessionManager               ⇄     S3SessionManager
Doc extract     heuristic / vision               ⇄     Textract
Search rank     substring                        ⇄     Titan embeddings (cosine)
```
`store.py`, `notifier.py`, `models.py` each expose one interface; `get_store()/get_notifier()/make_model()` pick the impl from `USE_AWS`. **The store-parity test runs the same suite against both, proving the swap is safe.**

## 4. Data model — 14 tenant-scoped collections
`specs, invoices, suppliers, carriers, alerts, payables, tasks, notifications, connectors, settings, activity, memories, artifacts, documents`
Every row is keyed `(tenant_id, id)`. DynamoDB uses one table per collection (`sahayak-<name>`).

## 5. Request flow (chat)
```
POST /chat → AgentRegistry.orchestrator() [Sahayak, Nova Pro]
   → routes to a specialist tool: vasool | sourcer | khata | nirmata (factory)
   → specialist [Nova Lite] calls its bound tools (invoices/suppliers/cashflow/logistics/comms
      + create_artifact + recall_context) — each tool authorized by Cedar, writes to Store,
      records UI actions + activity
   → reply + agent_name + actions[] + trace[]  (memories + doc summaries injected into prompts)
```

## 6. Guardrails (pitch these)
- **Cedar** per-agent tool allowlist (default-deny, `policy.py`)
- **Human-approval** for every outbound action (draft → approve → send)
- **Spec validation** (Pydantic) — factory agents can't gain tools we didn't build
- **Tenant isolation** (every store call is tenant-scoped; tested)
- **Parse-confidence** gate on invoice OCR; uploads never enter system prompts raw

## 7. Deployment (planned) — auth note
Project rule: **auth stays demo-only** (no Cognito). For hackathon judging the pragmatic
gate is a **lightweight CloudFront / Lambda-level token or an unlisted URL**, not real auth.
Deploy path: Amplify Hosting (frontend `dist/`) + Lambda URL via `Mangum` (or App Runner) +
EventBridge rule → `scheduler.run_once`. Do it only when `simulate_demo.py` is green.

## 8. Remaining work
See **AYUSH.md → STATUS (Open ⬜)** for the live list. Current open items include:
`PATCH /tasks/{id}` (kanban persist), `POST /tasks` status/col mapping, UTF-8 charset on JSON,
`PATCH /settings` role persist, `_PAIN_MAP` `too_many_excels`, **Textract IAM permission**,
real OAuth connectors, deploy, and web-search (`/chat` `mode` is received but ignored — needs `TAVILY_API_KEY`).
