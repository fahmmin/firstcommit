# BACKEND_HANDOFF.md — Rounds 2–4 backend → what's built & what Fahmin wires next

> Companion to `AYUSH.md` (backend handbook) and `FAHMIN.md` (frontend handbook).
> Everything here is **live** at the API (both `USE_AWS=0` and on real AWS). The
> frontend just needs to call it. Contract shapes are in `frontend/mocks/contract.json`.

---

## TL;DR

- **Backend Rounds 2–4 are done and green:** `USE_AWS=0` → 75 tests + 25/25 sim; live AWS (Bedrock Nova + DynamoDB + S3 + SES + Textract + Titan embeddings + Cedar) → 32 parity+policy tests + ~25/25 sim.
- **New for the frontend to build:** onboarding wizard, People page, Business-context page, Templates/Marketplace gallery, Artifacts viewer, morning-brief card, global search, login. **The backend for all of these already exists.**
- **Honest status:** Excel import, business-context docs, memories, artifacts, search, onboarding are REAL. External connectors (Drive/Gmail/Airtable/GCal/WhatsApp/Tally/Razorpay) are simulated by design.

---

## How to run

```bash
# backend (uses .env → USE_AWS=1 on AWS, or override to 0 for offline)
cd backend && .venv/bin/python -m uvicorn app.main:app --port 8000
# offline/deterministic:
USE_AWS=0 .venv/bin/python -m uvicorn app.main:app --port 8000

# frontend
cd frontend && npm install && npm run dev      # proxies /api → :8000

# checks
cd backend && USE_AWS=0 .venv/bin/python -m pytest tests -q       # 75 passed
.venv/bin/python ../simulation/simulate_demo.py                   # 25/25
```

---

## What the backend now does (everything built in Rounds 2–4)

### Round 2
| Feature | Endpoint(s) | Notes |
|---|---|---|
| Excel/Tally ledger import | `POST /import/excel` | openpyxl; maps columns → invoice rows; bad rows → `skipped` count |
| Business memory | `GET/POST/DELETE /memories` | injected into every agent's system prompt; agents genuinely cite it |
| Agent-built artifacts | `GET /artifacts`, `GET /artifacts/{id}`, `POST /artifacts` + `create_artifact` tool | 4 validated templates: `tracking_page, invoice_summary, supplier_compare, payment_card`; each has `share_path` (`/a/{id}`) |
| Enterprise search | `GET /search?q=` | grouped results across invoices/suppliers/carriers/agents/tasks/memories/documents |

### Round 3
| Feature | Endpoint(s) | Notes |
|---|---|---|
| People | `GET /people` | customers (from invoices, `defaulter` if worst overdue >30d), suppliers, carriers + summary totals |
| Activity log | `GET /logs` | unified activity feed |
| Morning brief | `GET /dashboard/summary` → `brief[]` | "N things need you" cards (`{icon,title,detail,ref}`) |
| Cedar guardrails | (internal) | per-agent tool allowlist is a real default-deny Cedar policy — `app/agents/policy.py` |
| Business-context brain | `POST /context/upload`, `GET /context`, `DELETE /context/{id}` | any file/note → Textract/vision/openpyxl extract → Nova auto-tag + summary → Titan embeddings → "fed to agents" → semantic search |
| Templates catalog | `GET /templates`, `POST /templates/{id}/install` | 18 categorized templates; install tool-backed agents via the factory |

### Round 4
| Feature | Endpoint(s) | Notes |
|---|---|---|
| Rich onboarding | `POST /onboarding` | one call: profile+prefs → settings; free-text answers + pain-chips → memories; pains → agents (`auto_hire:true` installs; else returns `suggested_agents`) |

### AWS services actually integrated (with offline fallbacks)
Strands SDK · Bedrock Nova (Lite+Pro) · **Bedrock Titan embeddings** (semantic search) · **Amazon Textract** (doc extraction) · **Cedar** (authorization policy) · DynamoDB (14 tables) · S3 · SES.
Provisioner: `simulation/setup_aws.py`; verifier: `simulation/check_aws.py`.

---

## What Fahmin builds next (UI for already-live endpoints)

All shapes are in `contract.json`. Add these methods to `frontend/src/api.js` (append-only) and the routes to `App.jsx`.

| Screen (route) | Build | Endpoint(s) | api.js method to add |
|---|---|---|---|
| **Login** (`#/login`) | provider buttons + guest | `POST /auth/login` | `login(body)` |
| **Onboarding** (`#/onboarding`) | 7-step wizard (see question set below) → one submit | `POST /onboarding` | `onboarding(body)` |
| **Dashboard brief** (in `#/app`) | "Good morning — N things need you" card | `GET /dashboard/summary` (`.brief[]`) | `dashboard()` (exists) |
| **People** (`#/people`) | Customers/Suppliers/Carriers tabs, outstanding, `defaulter` badge | `GET /people` | `people()` |
| **Business context** (`#/context`) | drag-drop file/note → "organized library" w/ tags + "fed to agents" | `POST /context/upload` (multipart: `file` OR `text`), `GET /context`, `DELETE /context/{id}` | `uploadContext(fileOrText)`, `context()`, `delContext(id)` |
| **Templates / Marketplace** (`#/templates`) | categorized gallery; install button | `GET /templates`, `POST /templates/{id}/install` | `templates()`, `installTemplate(id)` |
| **Artifacts viewer** (`#/a/:id`) | render by `template`; "copy share link" | `GET /artifacts/{id}` (+ `GET /artifacts` list) | `artifact(id)`, `artifacts()` |
| **Artifact card in chat** | when `actions[]` has `artifact_created` → card linking `#/a/{id}` | (from `POST /chat` response) | — |
| **Global search** (`#/search`) | topbar input → grouped results | `GET /search?q=` | `search(q)` |
| **Excel import card** (Settings) | file picker → toast "N rows imported" | `POST /import/excel` (multipart) | `importExcel(file)` |
| **Business context in Settings** | list/add/delete memories | `GET/POST/DELETE /memories` | `memories()`, `addMemory(t)`, `delMemory(id)` |
| **Logs** (`#/logs`) | activity/audit list | `GET /logs` | `logs()` |
| **Connectors sync** (Settings) | connect→syncing→items_synced | `GET /connectors/{id}/sync` | `syncConnector(id)` |

### Onboarding question set (7 steps → `POST /onboarding`)
1. **You**: name, business, city, WhatsApp → `business{}`
2. **What you do**: type, products, materials, years → `business{}`
3. **"What eats your time?"** chips → `pains[]` (values: `late_payments, stock_outs, untracked_deliveries, too_many_excels, cash_flow, chasing_suppliers, gst, no_online_presence, pricing`)
4. **Money habits**: credit terms days, **slow payers** (names), GST always? → `prefs{}` + `slow_payers[]`
5. **Who you work with**: **key buyers**, **key suppliers**, ship goods + routes → `key_buyers[]`, `key_suppliers[]`
6. **Tools today**: Tally/Excel/WhatsApp/pen-paper/Razorpay → `tools_today[]` (+ optional Excel ledger upload)
7. **Preferences**: language, reminder tone, approval mode, notify email → `prefs{}`
   Final toggle: **"Set up my team automatically?"** → `auto_hire: true|false`

Response gives `agents_installed[]`, `suggested_agents[]` (render install cards), `memories_created`, `next_steps[]`.

---

## Stub vs real — know it before filming

| Real (say it proudly) | Simulated (don't linger) |
|---|---|
| Excel → real ledger rows | Google Drive / Gmail sync (stub) |
| Business-context docs → auto-tagged, embedded, fed to agents, searchable | Airtable / Google Calendar (count local rows only) |
| Memories → injected into agent prompts | WhatsApp / Tally / Razorpay ("coming soon") |
| Artifacts → agents build via a real tool | — |
| Search → real substring + Titan semantic ranking | — |
| Onboarding → real settings + memories + agent hiring | Login provider step (demo token) |
| Cedar → real per-agent authorization | — |

---

## Open items (tracked in AYUSH.md)
- ⬜ Real Google Drive / Calendar OAuth connectors (currently simulated)
- ⬜ Deploy: Amplify (frontend) + Lambda URL (`Mangum` ready) + EventBridge → scheduler
- ⬜ Web search / Deep research agent tool (needs `TAVILY_API_KEY`)

## Rules recap
- `contract.json` is the seam — new shapes were added additively for the endpoints above.
- Backend is `backend/**` (Ayush); frontend is `frontend/src/**` (Fahmin). No merge overlap.
- Never commit `.env`/keys.
