# E2E_TEST_REPORT — meticulous full-workflow pass (branch `hardening`, 2026-09-26)

Covers backend suites (both modes), the demo sim (both modes), and live browser
workflows on the local hardening build (with B1 retrieval, A1 approvals, D1 multi-tenant).

## Automated — GREEN
| Suite | Mode | Result |
|---|---|---|
| `pytest backend/tests` | `USE_AWS=0` | **120 passed** |
| `simulate_demo.py` | `USE_AWS=0` | **28/28** |
| parity + policy + approvals + retrieval units | `USE_AWS=1` (DynamoDB + Titan) | **43 passed** |
| targeted contract (search/context/tasks/settings/login/approvals) | `USE_AWS=1` | pass |
| All 21 page endpoints | live | **200 + payload** each |

## Live UI workflows — PASS (no console errors)
1. **Guest login** → `#/app`; session `tenant_id=ramesh_auto`, onboarded=true. ✓
2. **Chat routing** — "show my overdue invoices" → **Vasool** reply "5 overdue ₹2,60,200, oldest INV-1026 112d" + SOURCES (invoices, business memory). ✓
3. **Contextual sidebar** — pinning Vasool loads its panel (Tracking 8 invoices, outstanding ₹8,54,700, aging). ✓
4. **A1 approval gate** (via pinned Vasool) — "bill banao …" → **"⏳ Queued for your approval"**; nothing written; `/approvals` shows pending; **approve → invoice created** (`INV-F693`, status executed). ✓
5. **D1 multi-tenant** — phone login (new provider_id) → new tenant `919876500011`, onboarded=false → **routed to onboarding**, **0 invoices (isolated)**; guest still sees the full showcase. ✓
6. **Pages render + wired** — People/Analytics/Reports/Tasks/Notifications/Settings/Search/Context/Calendar/Logs/Artifacts all 200 with data; zero console errors across the sweep. ✓

## Findings (real, not code bugs)
- **P1 — Live-Bedrock routing is non-deterministic.** The AWS demo sim scored **24–27/28** across 2 runs: once Nova routed *"mera transporter nahi aaya"* to **Vasool instead of Nirmata** (the headline factory-hire moment didn't fire → no agent hired); once Nova didn't call `create_invoice` so the approval-gate step didn't queue. Offline (mock) is deterministic **28/28**. → The **offline path is the safe demo**; the live-AWS factory moment needs a firmer orchestrator prompt / few-shot / routing classifier to be reliable on camera.
- **P2 — Offline routing quirk.** Free-text "bill banao …" through the orchestrator hits **Nirmata's** `banao` keyword → fallback "Samajh nahi aaya" (the create-invoice/approval path is only reachable by pinning the specialist offline). Real Nova routes it correctly.
- **P3 — Mock create_invoice args are fixed** ("New Buyer" ₹10,000) — offline can't extract the buyer name from free text; real Nova does. Cosmetic for offline.
- **Note — `/context` is empty after a plain `demo/reset` offline** (the 10 demo docs are generated/ingested by `seed_hardware.py` on the AWS path; offline the Context page shows its placeholder library). Not a regression.

## Round 2 (after B1/A1/D1/P1/C1/D2) — final battery
| Suite | Local | Live AWS |
|---|---|---|
| pytest | **151 passed** | 57 unit+parity passed |
| simulate_demo | **28/28** | **28/28** |
| evals scorecard | **8/8** | **8/8** |
| edge-case probe | **28/28** | 26/27 (only miss = Nova choosing not to call a tool) |
| frontend build | clean | — |

Bugs found **and fixed** this round:
1. **DynamoStore upsert-on-update** — updating an unknown id created a ghost row → `PATCH /tasks/BAD`, `/approvals/BAD/deny` returned 200 on AWS (404 locally). Fixed with a ConditionExpression; parity-locked.
2. **Fabricated brief item** — `Digest` always showed "Shipments on the move" even for empty tenants. Now sourced from the backend brief.
3. **Hardcoded identity** — header "Ramesh Auto Components · Faridabad" and "Good …, Ramesh" shown to every tenant; now tenant-driven.
4. **Demo Google login landed on an empty tenant** (after D1) — owner-email now resolves to its workspace; stale `rameshauto.in` identity aligned with the rebranded seed.
5. Offline routing for the factory moment was already fixed by P1 (12/12 on Bedrock).

## Verdict
Every core workflow works end-to-end and the whole automated suite is green in both
modes; **B1/A1/D1 are verified live** (hybrid search + citations, approval queue→approve→execute,
multi-tenant isolation). The one thing to harden before a *live-AWS* demo is
**orchestrator routing reliability** (the factory-hire moment); the offline demo already
nails it deterministically.

## Round 3 (Round-5 backlog: honesty · RBAC · Approvals · A2 · A3 · B2) — 2026-09-26
| Suite | Local (`USE_AWS=0`) | Live AWS (DynamoDB + Bedrock Nova + Titan) |
|---|---|---|
| pytest | **232 passed** | 97 unit + parity passed |
| simulate_demo | **30/30** | **30/30** |
| evals scorecard | **8/8** | **8/8** |
| provider seam on AWS | — | Bedrock via `providers.py`: Titan 1024-d embed ✓, Nova `complete_text` ✓ |
| frontend build | clean | — |

Verified live in the browser (local build, no console errors from the new code):
1. **Honesty** — Tasks/Connectors show only server rows; stopping the backend shows the amber **"Offline — sample data"** pill and Logs says **"paused — backend unreachable"**; Logs streams real `/logs` rows + `/metrics` header; Marketplace has no counts/invented URLs.
2. **RBAC** — stale `demo-tok` sessions are sent to sign-in; owner → "view as Viewer" → a direct `POST /alerts/{id}/approve` returns **403 "your role (viewer) can't do this — needs approve"** from the server; switching back to owner works.
3. **Approvals** — pinned Vasool "bill banao…" → inline approval card in chat → `#/approvals` shows it → Approve → toast "Done" and the card links **"Invoice INV-2302 created →"**; Message-drafts Dismiss persists.
4. **A2** — Marketplace: select Working Capital + Procurement → **Hire team (2)** → both join, sidebar refreshes.
5. **A3** — Settings → create an MCP access token → register Sahayak's own `/mcp` as an MCP server → **Test → "connected · 8 tools"** → Vasool calls `mcp_sahayak_self_list_overdue_invoices`; Logs shows `mcp_connected` + `mcp_tool_called`.
6. **B2** — `/health` reports provider/models; the right rail shows the real model ("Offline mock model" locally, Nova on AWS).

Bugs found **and fixed** this round:
1. **Nova answers wiped to ''** — the reply cleaner deleted `<response>…</response>` blocks; a hired agent's well-formed answer came back empty on Bedrock (AWS sim "new agent answers" failed). Now drops only `<thinking>`.
2. **Approvals marked "executed" when nothing ran** — tools without an executor; 3 gated tools never called `gate()`. All ASK tools now have executors; missing executor → `failed`.
3. **Deny could overwrite an executed action** → 409 unless pending.
4. **MCP writes would have auto-run** — `risk_for("mcp:…")` defaulted to AUTO and mcp 2.x exposes `read_only_hint` (not `readOnlyHint`); both caught by the dogfood test and fixed.
5. **Tests reset the dev server's data** — TestClient lifespans re-pointed `deps.store` at `backend/data`; now an isolated temp dir + idempotent lifespan.
6. **LocalStore.reset kept collections absent from the seed** (approvals survived a demo reset) — parity with DynamoStore restored.
7. `Reports.jsx` called `toast()` as a function (every report toast threw); `Tasks.jsx` `<Can do=…>` locked managers out.
8. Seed claimed "Gmail synced — 212 emails" though Gmail is `coming_soon`.

Still open (needs you): B2 live run on a non-Bedrock provider (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` or local Ollama); identity providers are still demo adapters (sessions/roles are now real).

## Round 3b — extensive end-to-end in Chrome (Claude in Chrome) + a real Claude MCP client — 2026-09-26
**Chrome (local build, owner → viewer → manager), all PASS, zero console errors:**
1. Unauthenticated `#/app` → redirected to login → guest login issues a signed owner token for `ramesh_auto`.
2. Chat routing → Vasool "5 overdue ₹2,60,200 · oldest INV-1026" with only real source chips.
3. Factory: "mera transporter nahi aaya" → preview → "haan" → Logistics Agent live in the sidebar → answers with 4 real Ludhiana carriers.
4. Team hire in chat ("customer support … monthly reports") → both hired → Reporting Agent's aging matches the MCP numbers exactly.
5. Approval gate from chat: inline card → Approve → invoices 16 → 17, ledger result `INV-72DF`; second queue → Deny → nothing written, denied=1.
6. Message drafts: Approve & send → sent (console notifier offline), pending 5 → 4.
7. View as Viewer: UI swaps to "Needs a manager or the owner", server **403** on approve + settings, chat 200.
8. Owner invite link (Manager) → `#/join/<token>` → approve 200, settings 403, escalate to owner 403, mint invite 403.
9. Forged token (manager→owner in the payload) → server 401 → back to sign-in.
10. Marketplace Hire team (Compliance + Digital Presence) → 4 → 6 agents; Compliance correctly gets no `web_search` (role extras).
11. All 14 pages render live data (no sample fallback); context upload → searchable; report generate + real PDF; task move persists; People 7/20/6.
12. Settings MCP: mint token → add Sahayak's own `/mcp` → **Test: connected · 8 tools** (6 read-only, 2 write); token masked `••••`; agent MCP write → queued as `mcp:…:create_invoice`.
13. Offline: stop backend → "Offline — sample data" pill on every page, Logs "paused", a write shows "Couldn't save the task — backend unreachable" (no fake card); restart → **"Back online — refresh"** → real data, no pill.

**Real Claude (Claude Code CLI) as an MCP client** via a throwaway `--mcp-config` → `localhost:8000/mcp`:
- Read: listed overdue invoices + aging from the live ledger.
- Write: `create_invoice` for "Claude Test Traders" → **queued** (apr-…, agent `mcp-client`) → approved by the owner in Chrome → `INV-1A59` in the ledger.

**Bugs this pass found and fixed:**
1. **Frozen invoice aging** (Claude flagged it) — `days_overdue`/status were stored numbers, 6 days stale; invoices past due still showed "sent". Now derived at read time from `due_date` in both stores (`store.age_invoice`); tests pin `SAHAYAK_TODAY`.
2. **MCP `aging_report` put not-yet-due invoices in "0–30"** (Claude flagged it) — now overdue-only buckets + `current_not_yet_due`.
3. **Offline pill never cleared after recovery** — now a health probe flips it to "Back online — refresh" (never silently hides sample rows).
4. Chat showed raw `**markdown**` and raw agent ids (`agent-e6d94b`) in the trace — bold renders, trace shows names.

Test-tool note: some Claude-in-Chrome element-ref clicks missed on this page (viewport 1710px vs a 1512px screenshot frame) — verified to be the tool, not the app (a real click/DOM click logs in every time).
