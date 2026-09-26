# QA_REPORT — Sahayak, branch `hardening` (independent audit, 2026-09-26)

> Full-codebase read + live browser test + backend/frontend deep audits. Verdicts:
> **REAL** = works against live data/services · **PARTIAL** = real core, demo shortcut or drift ·
> **FAKED/COSMETIC** = canned, no-op, "coming soon", or UI-only. Companion to `HARDENING.md`
> (the team's own ledger — this verifies it and goes deeper).

## How this was tested
- `pytest backend/tests` → **104 passed, 1 failed** (see Bug #1). `simulate_demo.py` → **27/27**.
- Live browser sweep (localhost, `USE_AWS=0`): login → workspace chat → People, Analytics, Reports, Tasks, Notifications, Settings. **Zero console errors; 38 `/api` calls all 200** — every page is really wired to the backend.
- Two exhaustive code audits (backend + frontend) with file:line evidence.

---

## ✅ REAL — works properly (lead with these on camera)
- **Agent loop** — orchestrator (Nova Pro) → specialists (Nova Lite) via Strands; offline `MockModel` drives the *real* tool loop (genuine Converse stream events), so the same agent→tool→store path runs in both modes. `models.py:136-202`.
- **All agent tools** read/write real store rows (invoices, suppliers, cashflow, logistics, comms, presence) — computed replies, no fixtures. `tools/*.py`.
- **Chat + routing** — verified live: "show overdue invoices" → real reply, correct numbers (6 overdue, ₹2,60,200, INV-1026 112d). Hired agents are now routable (hardening fix).
- **Store parity** — Local ⇄ Dynamo, same suite both impls; 14 collections tenant-scoped.
- **Reports + PDF** — 5 report types aggregate real data; `fpdf2` emits real `%PDF` bytes; public/private gate works. `reports.py`, `pdf_report.py`.
- **Artifacts** — pydantic-validated, persisted, `share_path`, **public gate 404s unless `visibility=public`** (correct). `tools/artifacts.py`, `main.py:798-806`.
- **Cedar tool authorization** — real `is_authorized` default-deny per agent (falls back to an allowlist on error). `agents/policy.py`.
- **SES send / approve flow** — real `ses.send_email` on AWS; draft→owner-approve→sent; `send_reminder` refuses unapproved/future alerts. `notifier.py`, `tools/comms.py`.
- **Pages wired to real endpoints** — Analytics, People, Notifications, Reports, Search, Context, Workspace all call live APIs (confirmed via network, all 200).
- **Demo gate** — `?gate=` shared passcode is a real barrier (raw fetch, no fallback). `api.js:17-23`, `main.py:65-78`.

## 🟡 PARTIAL — real core, degrades silently (know before judging)
- **Doc OCR / semantic search** — Textract + Nova-tag + Titan-embed are real **only on AWS with the right IAM**. Offline / missing `textract:DetectDocumentText` → text becomes **just the filename**, no embeddings, search falls back to **substring**. It never errors, so a perms failure looks like success. `documents.py:75-163`.
- **Google connectors (Drive/Sheets/Docs/Calendar)** — genuinely real via a **service account** (`gcp.py`), but **dormant** without `GOOGLE_SERVICE_ACCOUNT_JSON` → returns `unconfigured`. Real code, off in this env.
- **web_search / Deep research** — real Tavily **with** `TAVILY_API_KEY`; **no-op stub** without one (returns "not configured"). `/chat mode=web|deep` just prefixes the prompt. `tools/websearch.py`.

## ❌ FAKED / COSMETIC / DEMO-ONLY (do not claim as real)
- **`lib/demo.js` merges fake rows even on API success** — **Connectors** and **Tasks** lists always show hard-coded demo rows on top of real data (`.then(demo.*.merge)`, not just `.catch`). The 9 demo task cards + 14-connector catalog are indistinguishable from real. `demo.js`, `api.js:70-71,110-111`.
- **Logs page** — subtitle says "real-time stream" but `LogsExplorer` forever appends a hard-coded `SYNTH` array ("tally-mcp.handshake → tools/list ok", "gmail connector synced · 212 emails") every 1.6s, even when backend is connected. `components/rui/LogsExplorer.jsx:30-80`.
- **Marketplace** — MCP/Skills/agent catalogs are 100% hard-coded with fake install counts ("48.2k"); Install/Save only writes a name with `status:'configured'` + toasts "ships post-demo". Nothing activates. `pages/Marketplace.jsx`.
- **Workspace flourishes** — "Deep research · 12 sources · powered by Perplexity" is hard-coded for any `mode=deep` reply regardless of real sources; TimelineProgress "Reading 12 sources". `Workspace.jsx:289-293`.
- **KhataCards / LogisticsCards** — synthesize a believable cash curve (default gap ₹58,000) and a demo Faridabad→Ludhiana tracking route when the API lacks projection/bookings. `components/cards/*`.
- **RBAC (`lib/role.js`)** — localStorage-only, **dim-only** (elements stay in DOM), role never sent to server → trivially bypassed; every API reachable by any role.
- **Login providers** — Google/OTP are theatre ("any 6 digits work", "Skip verification"); only `/auth/login` + returned token are real, and it's a fabricated `demo-tok-<slug>` for any name. `Login.jsx`, `main.py:318-330`.
- **Single tenant** — `TENANT='ramesh_auto'` hardcoded in `api.js:5` and defaulted across `main.py`; onboarding collects a business but the app never switches tenant. Store is multi-tenant-shaped but single-tenant in practice.
- **10 connectors** permanently `coming_soon` (WhatsApp/Gmail/Tally/Razorpay/Shopify/IndiaMART/FB/Instagram/Airtable/Slack). Only Google is connectable.
- **Context library / Templates / Landing DataFeed** — seed sample docs, local template cards, and marketing ledger rows render as content (fallback/marketing).

---

## 🐞 Bugs found (concrete)
1. **`test_scheduler_promotes_due_alert` FAILS** (`run_once` returns 4, expected 1). Root cause = Bug #2 below (stale seed) + the test isn't isolated (uses seeded `ramesh_auto`). 104/105 otherwise green.
2. **Frozen ledger (highest-impact demo bug).** Invoice `days_overdue`/`status` are **static seed values, never recomputed** — `update_invoice` exists but is called nowhere. After the seed authoring date, numbers are wrong (INV-1031 shows 2 days, really ~8; INV-1026 shows 112, really ~118). Dashboard, `/people` defaulter flag, calendar, reports all trust the frozen numbers.
3. **Scheduler auto-promotion drift.** Seed `scheduled` alerts are dated Sept 21/22/26 2026 — now past → first tick auto-promotes them to `pending_approval`, silently inflating the "N actions need approval" brief/dashboard count with no user action. Confirmed live (brief showed "5 actions waiting").
4. **Silent degradation is systemic.** Textract/Titan/SES/Bedrock all catch-and-fallback; an IAM/perms/sandbox failure looks like success (filename-only tags, no embeddings, console "email"). Nothing tells the user it downgraded.
5. **`reports._cashflow_forecast` hardcodes opening balance ₹180,000** (`reports.py:158`) — the "lowest point" KPI is anchored to a magic number, not real cash.
6. **`gst_summary` doc filter reads `d.get("name")`** but documents store `filename` (`documents.py:195`) → GST-doc filtering by name never matches.
7. **`Tasks.jsx:116` uses `<Can do=… fallback=…>`** but `Can` only accepts `perm`/`reason` → props ignored; non-owners get a silently dimmed Approve instead of the intended message.
8. **Frontend fresh-install gap:** `border-beam / metal-fx / thinking-orbs / liquid-gooey / voice-glow` are real npm deps but a stale lockfile left them uninstalled → vite failed to resolve until a fresh `npm install`. Ensure `package-lock.json` is committed/current so `npm ci` works for judges.
9. **Routing surprise:** with hired agents seeded, "show overdue invoices" routes to **Collections Agent**, not Vasool (both have `list_overdue`). Correct answer, but the classic "→ vasool" demo line changed.

---

## 📋 TODO — yet to be done (prioritized)
### P0 — before judging
- [ ] **Recompute invoice aging at read time** (or on seed load) so `days_overdue`/`status` are live — wire the dead `update_invoice`, or compute in `list_invoices`. Fixes Bugs #2, #1, and half of #3's optics.
- [ ] **Re-date the seed relative to today** (or compute `fires_at` as now+N) so scheduled alerts don't auto-promote and the "3 things need you" count is stable.
- [ ] **Fix/loosen `test_scheduler_promotes_due_alert`** to isolate its tenant (currently red).
- [ ] **Decide the demo-row policy:** stop `demo.js` merging fake Connectors/Tasks on API success (merge only on `.catch`), or label them. Right now real + fake are indistinguishable — a judge poking Tasks/Connectors sees invented rows.
- [ ] **Tone down fabricated streams/labels:** LogsExplorer SYNTH lines and "12 sources · Perplexity" read as fake if inspected. Gate them behind offline-only, or drop.

### P1 — real inconsistencies
- [ ] Surface silent downgrades (Textract/Titan/SES) — a small "parsed by filename (OCR unavailable)" / "console fallback" note instead of pretending success.
- [ ] `reports.py`: real opening balance (from payments/receipts) instead of ₹180,000; fix `gst_summary` `name`→`filename`.
- [ ] RBAC: either enforce server-side (send role, check it) or stop implying it's real; fix `Can do=` prop bug (#7).
- [ ] Tenant: either hide onboarding's tenant capture (single-tenant demo) or carry `tenant_id` from the session (real multi-tenant). Documented open in HARDENING.md.
- [ ] KhataCards/LogisticsCards: show honest empty states instead of synthesized curves/routes when data is missing.

### P2 — cleanup / infra (from HARDENING.md, still open)
- [ ] Textract IAM perm on `AWSHACKATHON` (needs root — see `ENV_TODO.md`).
- [ ] `TAVILY_API_KEY` to activate web search; `GOOGLE_SERVICE_ACCOUNT_JSON` to activate Google connectors.
- [ ] `api.js`: request timeouts + retry (AbortController).
- [ ] Bundle split (1.25MB) — `manualChunks` for recharts/framer-motion/metal-fx.
- [ ] Voice input is Chrome-only (webkitSpeechRecognition); TTS no-ops silently elsewhere — feature-detect + hide.
- [ ] `.gitignore` `nul` + `vite.config.js.timestamp-*`.
- [ ] Deploy currently reflects `main`, not `hardening` — redeploy after merge.

## Verdict
The hardening branch is a big honesty upgrade — pages are really wired, the gate/artifacts/reports/agent-loop are genuinely real, and the team's own `HARDENING.md` fixed most live lies. The **remaining real risks are data-freshness (frozen ledger + scheduler drift)** and **a few UI fabrications that survive even when the backend is up** (demo-row merge, synth logs, Perplexity label). Fix the P0 list and the demo holds up to a judge poking at it.
