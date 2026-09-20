# HARDENING — everything we demo-tuned, untested, or faked

> Branch `hardening`. Ordered by demo-criticality: **P0** breaks or lies on
> camera, **P1** is a real inconsistency a judge could poke, **P2** is cleanup.

## P0 — demo blockers / live lies

- [ ] **Scheduler double-fires on AWS.** `main.py:73` calls `scheduler_start()`
  unconditionally — the 30 s daemon thread runs inside Lambda *and* EventBridge
  hits `run_once` every minute. Guard `start()` behind `USE_AWS=0` so only the
  local path uses the thread.
- [ ] **Scope tabs are cosmetic.** `Skills 3` / `MCP 3` exclusion tabs in
  Workspace render hardcoded `installedSkills` / `mcpServers` fallbacks
  (`Workspace.jsx:99-102`) and the selected `scope` is **never sent** to
  `/chat` — the request body is `{tenant_id, text, agent_id, mode}` only.
  Either wire scope → backend (tool filter on the agent call) or cut the tabs.
- [ ] **Marketplace install is theatre.** `install()` writes `mcp_servers` /
  `prefs.installed_skills` into settings, but no agent/tool ever reads them —
  nothing actually gets installed. Catalog entries + install counts
  (`48.2k`…) are fabricated. Either honour installs as real capability flags
  or mark the page "preview".
- [ ] **`/reports` + context file endpoints have zero tests.** New in the last
  push: `GET /reports/types`, `POST /reports/generate`, `GET /reports/{id}/pdf`,
  `GET /public/artifacts/{id}/pdf`, `GET /context/{id}/file`,
  `GET /context/{id}/preview` — none in `test_api_contract.py`. Add contract +
  PDF-bytes assertions.
- [ ] **`Calendar` falls back to `DEMO_EVENTS` silently.** When the API returns
  empty or fails, five hardcoded events render as if real (`Calendar.jsx:25-31`,
  `72-73`). Label it or drop it — right now it's invisible fake data.

## P1 — real inconsistencies

- [ ] **Tenant is hardcoded everywhere.** `TENANT = 'ramesh_auto'` in api.js and
  `tenant_id: "ramesh_auto"` defaults across `main.py`. Onboarding creates a new
  tenant that the UI never switches to — sign up as a new business and you still
  see Ramesh's data. Decide: single-tenant demo (hide onboarding tenant) or real
  multi-tenant (session carries tenant_id).
- [ ] **Login is a token vending machine.** `POST /auth/login` returns a session
  for any name — the gate (`?gate=`) is the only barrier and it's shared. Fine
  for demo, but document it as demo-auth, not auth.
- [ ] **Two sources of truth for connector state.** `connectors` list lives in
  the store; `demo.js` ships a parallel hardcoded connector array with stale
  statuses — if the API fails, the UI silently shows the fake list. Make the
  offline path render `unavailable`, not stale `connected`.
- [ ] **`draft_reminder` mock rule fires without an invoice arg.** Keywords
  `remind/reminder/chase/draft` match broadly; `args: {}` means the tool guesses
  the invoice. Works in the canned demo, breaks on real phrasing ("remind me
  about the rent agreement" → drafts a payment reminder).
- [ ] **`send_reminder` sends `scheduled` alerts too.** The guard blocks
  `pending_approval` only — a `scheduled` alert (not yet due) gets sent
  immediately by an agent, skipping the owner's calendar intent. Should send
  only `status == "approved"`... or require approve→sent flow via the endpoint.
- [ ] **ThinkingOrb size is a preset key, not px.** Only `20 | 64` are valid —
  any other number crashes the whole React tree (already fixed in Context +
  Reports; audit every callsite once — CloudWave 64, Workspace 20 are the only
  legal values).
- [ ] **`agent_name` comes from tool-metrics order.** `main.py:133` takes the
  last tool name as the responding agent — if a specialist calls
  `recall_context`/`create_artifact` last, the chat header credits the wrong
  agent. Track the actual sub-agent invocation instead.

## P2 — cleanup / robustness

- [ ] **`@app.on_event("startup")` deprecated** → move to lifespan handlers.
- [ ] **`role.js` is UI-only RBAC** — `viewer` can still hit every API; enforce
  or relabel as display preference.
- [ ] **No request timeouts/retries** on `api.js` fetches — a hung Lambda leaves
  the composer spinning forever. Add AbortController + the existing cold-start
  message.
- [ ] **`UPLOAD_DIR` on Lambda** writes to package dir (read-only risk) — uploads
  go to S3 anyway; make local write `/tmp` or skip when `USE_AWS=1`.
- [ ] **Big main bundle** — 1.25 MB / 356 KB gzip; `manualChunks` for recharts +
  framer-motion + metal-fx.
- [ ] **Voice overlay** only works on Chrome (Web Speech API) — non-Chrome gets
  a dead overlay; show the unsupported note earlier.
- [ ] **`nul` / stray artifacts keep getting committed** — the gitignore now
  covers `*.log` + `.playwright-mcp/`; add `nul` + `vite.config.js.timestamp-*`.
- [ ] **No `GET /agents/{id}` refresh on template install** — sidebar groups are
  computed once at mount; a Nirmata-hired agent needs a manual refresh to appear
  in the right group (verify — `refresh()` is called on `agent_created` action
  already, confirm grouping re-runs).

## Done / verified this session
- strands-agents pinned 1.56.0 + pywin32 stub → `as_tool` exists on Lambda.
- `bedrock:InvokeModelWithResponseStream` added to role.
- Double CORS headers removed (Function URL Cors cleared; FastAPI owns it).
- UTF-8 file IO fixed; ₹ / Devanagari clean in DynamoDB.
- Doc preview endpoints + S3 byte persistence wired.
- Reports page + fpdf2 export + public/private artifact sharing.
