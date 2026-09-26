# HARDENING — everything we demo-tuned, untested, or faked

> Branch `hardening`. Ordered by demo-criticality: **P0** breaks or lies on
> camera, **P1** is a real inconsistency a judge could poke, **P2** is cleanup.
> ✅ = fixed + test-locked in `backend/tests/contract/test_hardening.py`.

## P0 — demo blockers / live lies

- [x] **Scheduler double-fires on AWS.** `scheduler_start()` now only runs when
  `not ON_LAMBDA` — EventBridge owns scheduled ticks in AWS, the 30 s daemon
  owns them locally. Idempotency test locks `run_once` → second pass moves 0.
- [x] **Scope tabs were cosmetic.** Fake `Skills 3`/`MCP 3` inventories deleted.
  Chips now list **real** capabilities — agents Sahayak can route to, or the
  active specialist's tools — and selections go to `/chat` as `scope`, which
  filters the actual tool set for that reply (`ChatReq.scope`).
- [x] **Marketplace install was theatre.** Install → **Save**; toasts and copy
  now say "saved to your workspace — live MCP activation ships post-demo".
  Settings shows saved servers as `saved`, not `configured`.
- [x] **`/reports` + context file endpoints had zero tests.** Contract tests
  cover all 5 report types (generate → artifact → `%PDF` bytes → public gate),
  context file/preview happy paths + 404s, and the note-no-file case.
- [x] **`Calendar` silently rendered `DEMO_EVENTS`.** Fallback deleted — empty
  days show an honest "nothing scheduled" state. Date-only backend events now
  stagger through the morning instead of stacking at 09:00.
- [x] **Wrong-customer reminder.** `POST /invoices/NOPE/reminder` used to draft
  for the *oldest overdue* invoice. Now 404s; `invoice_no` (INV-1026) resolves
  too, since callers pass the visible number, not the row id.
- [x] **`send_reminder` sent `scheduled` alerts.** A future reminder could be
  pushed out by an agent with no owner approval. Now refused with the fire
  date; only pending→owner-approve→sent remains.
- [x] **Hired agents were unreachable.** Orchestrator hardcoded
  vasool/sourcer/khata — a Nirmata hire could never be routed to. Router now
  wires every spec in the registry + dynamic mock rules; `create_spec`
  invalidates the cached orchestrator.
- [x] **Nirmata created the wrong agent.** Mock always built "Logistics Agent"
  and treated a *new request* as a confirm (stale preview → wrong hire).
  Preview now derives name/goal/tools from the owner's intent; create mirrors
  exactly the previewed spec; confirm keywords are pure affirmatives.

## P1 — real inconsistencies

- [x] **`agent_name` credited the wrong agent.** Last tool metric won — a
  trailing `web_search`/`recall_context` stole the byline, and `nirmata` (not a
  spec) showed as "sahayak". Now: last tool that maps to a spec or nirmata.
- [x] **`POST /agents` accepted garbage tools.** All-invalid tool lists created
  a useless agent; now 400 with the allowed set (preview already warned).
- [x] **Notes claimed file bytes on AWS.** `context_preview` forced
  `has_file=True` under AWS — an uploaded note's iframe then 404'd. Notes
  excluded, matching `/context`.
- [x] **"Backend may be cold-starting" on every error.** Chat errors now
  distinguish unreachable (cold-start hint) from real API errors (status shown).
- [x] **TimelineProgress named fake MCPs** ("via tally-mcp"). `via` labels are
  now real subsystems (invoice ledger, supplier catalog, carrier board…).
- [x] **Deprecated `@app.on_event("startup")`** → `lifespan` handler.
- [x] **Stale `# [TODO] surface` comment** removed — those endpoints are live.
- [ ] **Tenant is hardcoded everywhere.** `TENANT = 'ramesh_auto'` in api.js and
  `tenant_id` defaults across `main.py`. Onboarding creates a tenant the UI
  never switches to. **Decision needed:** single-tenant demo (hide onboarding
  tenant) or real multi-tenant (session carries tenant_id).
- [ ] **Login is a token vending machine.** `POST /auth/login` returns a
  session for any name; the `?gate=` passcode is the only barrier. Documented
  as demo-auth — keep until real auth.
- [ ] **`demo.js` merges demo rows into live lists** (connectors, tasks) even
  on success — extras render alongside real data. Deliberate offline layer;
  left as-is but documented.

## P2 — cleanup / robustness

- [ ] **`role.js` is UI-only RBAC** — `viewer` can still hit every API.
- [ ] **No request timeouts** on `api.js` fetches — AbortController + retry.
- [ ] **Big main bundle** — 1.25 MB / 356 KB gzip; `manualChunks` for recharts +
  framer-motion + metal-fx.
- [ ] **Voice overlay** is Chrome-only (Web Speech API) — dead button elsewhere.
- [ ] **`nul` / stray artifacts keep getting committed** — gitignore covers
  `*.log` + `.playwright-mcp/`; add `nul` + `vite.config.js.timestamp-*`.

## Verified live this session
- strands-agents pinned 1.56.0 + pywin32 stub → `as_tool` exists on Lambda.
- `bedrock:InvokeModelWithResponseStream` added to role.
- Double CORS headers removed (Function URL Cors cleared; FastAPI owns it).
- Doc preview endpoints + S3 byte persistence wired.
- Reports page + fpdf2 export + public/private artifact sharing.
- Route sweep: all 59 endpoints exercised via TestClient — errors caught and
  fixed above; contract suite at 105 tests.
