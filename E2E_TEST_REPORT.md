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
