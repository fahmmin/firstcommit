# MODEL_TEST_REPORT — Sahayak on real OpenAI (gpt-4o-mini), top to bottom

_Generated from `simulation/model_e2e_results.json` · run 2026-09-26T14:18:14Z · branch `hardening`_

## Summary

| | |
|---|---|
| Provider | OpenAI — chat `gpt-4o-mini` (orchestrator + workers), embeddings `text-embedding-3-small` |
| Final battery | **28/28 jobs passed** across 12 flows |
| Final battery cost | **$0.05251** · 276,169 tokens (264,061 in / 12,108 out) |
| Avg per chat turn | ~12,553 tokens · ~$0.00213 |
| Whole session spend (bake-off + 7 battery runs + probes + debugging) | **$0.4695** of a $0.50 hard cap (`MODEL_BUDGET_USD`) |
| Also on OpenAI | demo sim **30/30** ($0.0100) · golden evals **8/8** ($0.0109) |

Cost per job = change in the backend's spend counter across the job, so it includes hidden calls (document auto-tag, embeddings, invoice vision), not only chat. Prices are estimates from the public per-token rates in `backend/app/tracing.py` — your OpenAI dashboard is the final word.

## Model choice — bake-off (8-case golden eval: routing, tools, factory, approvals)

| Model | Score | Cost | Time | Verdict |
|---|---|---|---|---|
| **gpt-4o-mini** | 8/8 | **$0.0109** | 75 s | ✅ chosen — same quality, 5× cheaper, 2× faster |
| gpt-5-mini (reasoning_effort=minimal) | 8/8 | $0.0552 | 137 s | good, but hidden reasoning tokens are billed as output |

gpt-4.1-nano / gpt-5-nano were skipped: cheaper, but weaker at choosing among ~15 tools, which is the core of every flow here.
gpt-5 models are supported (`OPENAI_WORKER_MODEL=gpt-5-mini`): the provider drops `temperature` and sends `reasoning_effort`.

## Cost by flow (final run)

| Flow | Jobs | Pass | Tokens (in / out) | Cost | Total latency |
|---|---|---|---|---|---|
| Routing | 5 | 5/5 | 35,990 (33,148 / 2,842) | $0.00668 | 35.7 s |
| Accuracy | 3 | 3/3 | 54,495 (51,669 / 2,826) | $0.00945 | 15.5 s |
| Factory | 5 | 5/5 | 61,956 (59,151 / 2,805) | $0.01056 | 27.4 s |
| Approvals | 4 | 4/4 | 99,314 (96,218 / 3,096) | $0.01629 | 12.1 s |
| Memory | 1 | 1/1 | 4,445 (4,323 / 122) | $0.00072 | 5.8 s |
| Context | 3 | 3/3 | 3,644 (3,568 / 76) | $0.00062 | 7.5 s |
| Vision | 1 | 1/1 | 0 (0 / 0) | $0.00560 | 3.1 s |
| Artifacts | 1 | 1/1 | 5,635 (5,513 / 122) | $0.00090 | 3.0 s |
| Tasks | 1 | 1/1 | 0 (0 / 0) | $0.00000 | 3.3 s |
| Web | 1 | 1/1 | 4,483 (4,417 / 66) | $0.00070 | 4.6 s |
| MCP | 2 | 2/2 | 3,170 (3,086 / 84) | $0.00051 | 3.3 s |
| Onboarding | 1 | 1/1 | 3,037 (2,968 / 69) | $0.00049 | 6.4 s |

## Every job — output, tokens, cost

| # | Flow | Job | ✓ | Agent / tools | Tokens in / out | Cost | Latency | What it returned |
|---|---|---|---|---|---|---|---|---|
| 1 | Routing | Overdue invoices → Vasool | ✅ | vasool · vasool | 2,284 / 389 | $0.00058 | 12.6 s | You have 7 overdue invoices totalling ₹351,000. Here's the breakdown:  1. **Om Sai Electric Works**    - Invoice No: INV-1026    - Amount: ₹28,700    - Days Overdue: 118  2. **Sharma Constructions**    - Invoice No: INV-1029    - Amount: ₹36,200    - Days Over |
| 2 | Routing | Hinglish money question | ✅ | vasool · vasool | 4,021 / 466 | $0.00088 | 1.6 s | Sabse purana udhaar Om Sai Electric Works ka hai — Invoice No: INV-1026, jo 118 din se overdue hai. Amount ₹28,700 hai.   Sharma Constructions ka udhaar bhi hai, lekin wo 44 din se overdue hai.   Agar aap reminders bhejna chahte hain, toh mujhe bataiye! |
| 3 | Routing | Cheapest supplier → Sourcer | ✅ | sourcer · vasool, sourcer | 7,900 / 674 | $0.00159 | 8.2 s | Here are the cheapest suppliers for MCB switches:  1. **Rathi Copper House** — ₹2.1/unit (MOQ 2000, trust score 3.9) 2. **Bharat Bolts** — ₹2.8/unit (MOQ 2000, trust score 3.3) 3. **National Fastener Co** — ₹3.2/unit (MOQ 1000, trust score 4.7) 4. **Vishnu Pac |
| 4 | Routing | 90-day terms → Khata | ✅ | khata · vasool, sourcer, khata | 10,981 / 780 | $0.00212 | 9.7 s | Taking the 90-day credit on a ₹2,00,000 order is **WORTH IT**.   - **Margin**: ₹40,000 (20% margin) - **Cost of financing the gap**: ~₹7,101 (assuming an 18% short-term borrowing rate) - **Net gain**: ₹32,899  You can proceed with the order! |
| 5 | Routing | Aging report tool | ✅ | vasool · list_overdue, aging_report | 7,962 / 533 | $0.00151 | 3.6 s | Here's the receivables aging report:  - **0-30 days overdue:** ₹286,100 - **31-60 days overdue:** ₹36,200 - **61-90 days overdue:** ₹0 - **90+ days overdue:** ₹28,700  **Overdue by customer:** 1. **Sharma Constructions:** ₹152,700 2. **Patel Furniture House:** |
| 6 | Accuracy | Top debtor: bhai sabse zyada paisa kis customer pe a | ✅ | khata · vasool, sourcer, khata | 14,333 / 852 | $0.00266 | 4.1 s | Sabse zyada paisa Sharma Constructions pe atka hai, with a total overdue of **₹152,700**.   Agar aap kisi specific customer ke liye reminder draft karna chahte hain, toh mujhe bataiye! |
| 7 | Accuracy | Top debtor: which customer owes me the most money in | ✅ | khata · vasool, sourcer, khata | 17,261 / 920 | $0.00314 | 5.3 s | Sharma Constructions owes you the most money, with a total outstanding amount of **₹152,700**.   Agar aap in amounts ke liye koi action lena chahte hain, toh mujhe bataiye! |
| 8 | Accuracy | Top debtor: rank my customers by how much overdue mo | ✅ | khata · vasool, sourcer, khata | 20,075 / 1,054 | $0.00364 | 6.0 s | Aapke customers ko overdue money ke hisaab se rank kiya gaya hai:  1. **Sharma Constructions:** ₹152,700 2. **Patel Furniture House:** ₹78,800 3. **Khanna Builders:** ₹56,000 4. **Verma Interiors:** ₹34,800 5. **Om Sai Electric Works:** ₹28,700  Agar aap kisi  |
| 9 | Factory | Problem → hiring preview | ✅ | nirmata · vasool, sourcer, khata, nirmata | 22,942 / 1,153 | $0.00413 | 7.1 s | Maine ek logistics specialist hire karne ka plan banaya hai:  **Logistics Agent**   Kaam: Backup transport dhoondhna aur scheduled carriers ke nahi aane par pickups book karna.    Agar aap isko hire karna chahte hain, toh 'haan' ya 'yes' karke confirm karein! |
| 10 | Factory | 'haan' → agent hired | ✅ | nirmata · vasool, sourcer, khata, nirmata | 25,790 / 1,218 | $0.00460 | 4.6 s | Logistics Agent hire ho gaya hai aur aapke dashboard par ready hai. Yeh backup transport dhoondh kar aapke stranded order ke liye pickups book karega. |
| 11 | Factory | New hire answers | ✅ | hired agent · quote_pickup | 1,996 / 90 | $0.00035 | 3.1 s | Cheapest reliable option for pickup to Ludhiana tomorrow for 500 kg is SafeRoad Carriers at ₹3.9/kg, which totals around ₹1,950. Pickup is scheduled for tomorrow at 2:00 PM (reliability rating 3.8/5). Would you like to book this pickup? |
| 12 | Factory | Multi-role ask → team preview | ✅ | nirmata · nirmata | 2,793 / 130 | $0.00050 | 5.9 s | Maine do specialists hire karne ka plan banaya hai:  1. **Compliance Agent**      Kaam: GST/TDS filing deadlines track karna aur due dates se pehle yaad dilana.  2. **Digital Presence Agent**      Kaam: Aapke products ko online IndiaMART par list karna.  Agar  |
| 13 | Factory | 'yes' → team hired | ✅ | nirmata · nirmata | 5,630 / 214 | $0.00097 | 6.7 s | **Compliance Agent** aur **Digital Presence Agent** hire ho gaye hain aur aapke dashboard par ready hain. Yeh GST filing deadlines ka dhyan rakhenge aur aapke products ko IndiaMART par online list karenge.  \| hired: ['Compliance Agent/compliance', 'Digital Pr |
| 14 | Approvals | Create invoice from free text → queued | ✅ | vasool · list_overdue, aging_report, create_invoice | 26,506 / 922 | $0.00453 | 2.9 s | The invoice for Kapoor Hardware Stores for ₹18,500 (50 MCB boxes) has been queued for your approval. Please check the Approvals section to approve it. Let me know if you need anything else!  \| ledger: Invoice ₹18,500 to Kapoor Hardware Stores, due 2026-11-10  |
| 15 | Approvals | Owner approves → invoice written | ✅ | — | 0 / 0 | $0.00000 | 0.0 s | executed → {'kind': 'invoice', 'id': 'inv-9c8348', 'label': 'INV-4FB0'}; invoices 16→17; buyer=Kapoor Hardware Stores |
| 16 | Approvals | Schedule a reminder → queued | ✅ | vasool · list_overdue, aging_report, create_invoice, schedule_alert | 31,556 / 1,008 | $0.00534 | 4.8 s | The reminder to call Sharma Constructions about INV-1029 on 2026-10-01 has been queued for your approval. Please check the Approvals section to approve it. Let me know if you need anything else! |
| 17 | Approvals | Draft a payment reminder (draft only) | ✅ | vasool · list_overdue, aging_report, create_invoice, schedule_alert, draft_reminder | 38,156 / 1,166 | $0.00642 | 4.4 s | I've drafted a polite WhatsApp reminder for the oldest overdue invoice (INV-1026) for Om Sai Electric Works. Here are the details:  **Message:** ``` Namaste Om Sai Electric Works ji,  This is a gentle reminder that invoice INV-1026 for ₹28,700 was due on 2026- |
| 18 | Memory | Agent uses owner memory | ✅ | nirmata · nirmata | 4,323 / 122 | $0.00072 | 5.8 s | Falcon Traders cash-only buyer hain, isliye unhe credit extend nahi karna chahiye. Aapko unhe advance payment ki zaroorat batani chahiye. Kya aap unhe response draft karne mein madad chahenge? |
| 19 | Context | Upload note → model auto-tag + embed | ✅ | — | 0 / 0 | $0.00004 | 1.9 s | tags=['procurement', 'general'] summary='This document outlines the rate card for TMT bars and binding wire from Balaji Steel.' |
| 20 | Context | Semantic search (no keyword overlap) | ✅ | — | 0 / 0 | $0.00000 | 0.7 s | mode=hybrid top=['note.txt'] |
| 21 | Context | Agent answers from documents | ✅ | sourcer · recall_context | 3,568 / 76 | $0.00058 | 4.9 s | Balaji Steel's rate for TMT bars (Fe500) is ₹58/kg, with a minimum order quantity (MOQ) of 2 tonnes. The delivery time to Faridabad is 4 days, and this rate is valid until Diwali. |
| 22 | Vision | Invoice photo → structured fields | ✅ | — | 0 / 0 | $0.00560 | 3.1 s | parsed buyer='Kapoor Hardware Stores, Ludhiana' amount=49560 no=INV-7781 due=2026-10-20 |
| 23 | Artifacts | Ask for a shareable tracking page → queued | ✅ | vasool · create_artifact | 5,513 / 122 | $0.00090 | 3.0 s | The shareable tracking page for order ORD-1042 going to Ludhiana with SafeRoad has been queued for your approval. Please check the Approvals section to approve it. Let me know if you need anything else! |
| 24 | Tasks | Run a kanban task with its agent | ✅ | sourcer · — | 0 / 0 | $0.00000 | 3.3 s | sourcer: Here are the quotes for 2" GI pipes under ₹62/kg:  1. **Khurana Metals** — ₹58/kg (MOQ 1000, trust score 3.6) 2. **Balaji Steel Traders** — ₹62/kg (MOQ 500, trust score 4.2)  Please note that the cheapest option isn't always the best, so consider the  |
| 25 | Web | Web mode without Tavily key → honest | ✅ | sahayak · web_search | 4,417 / 66 | $0.00070 | 4.6 s | Web search tool abhi configured nahi hai, isliye main aaj ke steel price Delhi mein nahi de sakta. |
| 26 | MCP | Handshake | ✅ | — | 0 / 0 | $0.00000 | 0.0 s | connected |
| 27 | MCP | Model picks an MCP tool by itself | ✅ | khata · mcp_ledger_cashflow_summary | 3,086 / 84 | $0.00051 | 3.3 s | Your cash flow summary is as follows:  - **Expected In**: ₹9,22,760 - **Owed Out**: ₹1,81,800 - **Net Cash Flow**: ₹7,40,960  This indicates a healthy cash position, with a significant amount expected in compared to what you owe. |
| 28 | Onboarding | New tenant: wizard → auto-hire → memory used | ✅ | nirmata | 2,968 / 69 | $0.00049 | 6.4 s | tenant=919890432288 hired=['Collections Agent', 'Compliance Agent'] memories=1 \| chat: Your slow payer is Joshi Builders. If you need assistance in managing follow-ups or reminders for them, please let me know! |

Jobs with 0 tokens but a cost are non-chat model calls: **document upload** (auto-tag completion + embeddings) and **invoice photo vision** (the single most expensive job, ~$0.0056 — image input tokens). Jobs with 0 tokens and $0 are pure backend (search over stored vectors, report/approval execution, MCP handshake).

## What real-model testing found (and what was fixed)

The offline mock model follows scripted rules, so it never exposed these. Each was reproduced on gpt-4o-mini, fixed, and re-verified:

| # | Found on the real model | Root cause | Fix |
|---|---|---|---|
| 1 | **Hires silently failed** — 'haan' after a preview re-showed the preview | the router paraphrased: after a 'forward the full message' rule it re-sent the *original* problem instead of 'haan'; on multi-part asks it split the request and told the owner the rest was 'being processed' | Nirmata now always receives the owner's own words for that turn (`deps.current_user_text`), never the router's paraphrase |
| 2 | **Wrong 'who owes the most'** — named the *oldest* debtor (Om Sai ₹28,700) instead of the largest (Sharma ₹1,52,700) | tool replies listed invoices; the model had to add them up and mixed up 'oldest' vs 'largest' | `list_overdue` + `aging_report` aggregate per buyer in code (`by_buyer`); personas: never add up figures yourself |
| 3 | **Front desk answered from stale history** with zero tool calls, even with wrong arithmetic (₹1,52,500) | long persisted router session tempted the model to reuse earlier replies | sliding window on router (8) + agents (12) and a grounding guard: a tool-less reply gets one 'route to a specialist' retry. Also cut tokens per turn |
| 4 | **Owner memory ignored** — 'who are my slow payers?' → 'none' for a new tenant whose owner named Joshi Builders | the model trusted an empty ledger tool over the prompt notes (flaky: ~1 in 3) | money tools attach the owner's payment notes to their own result (`payment_notes`); prompt says notes stay true when tools show nothing — 4/4 + 28/28 after |
| 5 | **Web mode hired a 'Market Price Search Agent'** when Tavily isn't configured | router worked around a disabled tool | router rule: say it isn't configured, never hire around it |
| 6 | **Transient DNS error → raw 500** | no retry on provider/network errors | one retry for transient errors, then a clean 503 |
| 7 | gpt-5 models rejected requests | reasoning models refuse `temperature` | provider sends `reasoning_effort` for gpt-5/o-series instead |
| 8 | **Task runs cost $0 in the report** (row "Tasks") though an agent ran | `/tasks/{id}/run` never recorded usage → invisible to `/metrics` **and bypassed the budget cap** | task runs are now traced, counted toward `MODEL_BUDGET_USD`, and return `usage` — re-measured: **5,945 tokens · $0.00096** per task run |

Battery history: 21/25 → 22/25 → 25/25 → 25/25 (repeatability) → +3 accuracy jobs → 27/28 → **28/28**. (The final table's Tasks row predates fix #8, hence $0 there.)

## Budget + cost controls built for this
- `MODEL_BUDGET_USD` hard cap — persisted spend counter (chat runs + OpenAI REST usage); when reached, `/chat` returns 402 and one-shot calls fall back to heuristics. `GET /metrics` shows spent/remaining; `POST /metrics/spend/reset` zeroes it.
- Sliding conversation windows (router 8, agents 12) keep per-turn tokens bounded instead of growing with the session.

## What $ buys at this rate
- ~$0.00213 per chat turn → **$1 ≈ 469 chat turns**; your $4.85 ≈ 2,276 turns.
- Invoice photo (vision) ≈ $0.0056 each; document upload (tag + embed) ≈ $0.00004 each.

## Reproduce
```bash
# backend on OpenAI with a cap
cd backend && USE_AWS=0 MODEL_PROVIDER=openai EMBED_PROVIDER=openai MODEL_BUDGET_USD=0.50 \
  .venv/bin/python -m uvicorn app.main:app --port 8000
# then, from the repo root
backend/.venv/bin/python simulation/model_e2e.py      # writes simulation/model_e2e_results.json
```
OpenAI SDK for chat agents: `pip install -r backend/requirements-providers.txt`. Default (Bedrock / offline mock) paths are unchanged.
