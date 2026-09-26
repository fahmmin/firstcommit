# COMPETITIVE_ANALYSIS — Sahayak vs the AI-employee field

> Category: **AI employee / enterprise knowledge-assistant.** Benchmarks cloned to
> `/Users/jochannnn/ai-employee-benchmark/`: **AnythingLLM** (MIT, self-host RAG+agents),
> **Onyx** (ex-Danswer; MIT core + EE; enterprise context layer, 55 connectors),
> **PipesHub** (Apache-2.0; permission-aware workplace-AI platform). Full per-repo
> profiles were produced by code-reading agents; this is the synthesis + backlog.

## TL;DR
Onyx and PipesHub have **already built the two things Sahayak claims as its gimmick**:
"hire a specialist on demand" (`spawn_agent(role, goal, tools)` / Persona templates) and
"every action approval-gated" (risk-tiered policy engine + durable approval ledger +
session-grants). Sahayak's versions are shallower (a Python allowlist + comms-only
draft→approve). **The opportunity: lift their patterns at SMB weight** while keeping our
real edges — SMB/Hinglish packaging, the *narrative* of hiring staff, approval-by-default,
artifacts/reports, and cheap serverless. Don't chase their enterprise heft (Neo4j+Kafka+
Vespa/OpenSearch, SAML/SCIM); it would sink an SMB product.

---

## Positioning
| Product | One-liner | Audience | Weight |
|---|---|---|---|
| **Sahayak** | AI back-office that *hires its own staff*; approval-gated actions | Indian SMBs (Hinglish) | Light (serverless) |
| AnythingLLM | Private ChatGPT-over-docs + agents, model-agnostic | Individuals/teams, self-host | Medium (3 Node procs, SQLite) |
| Onyx | "Context layer powered by all your apps" — agentic RAG + actions | Mid-market/enterprise | Heavy (~10 services) |
| PipesHub | Permission-aware workplace-AI platform w/ block-level citations | Enterprise/devs | Heavy (Neo4j+Qdrant+Kafka+7 svcs) |

## Capability matrix
Legend: ✅ strong · 🟡 partial/shallow · ❌ absent

| Capability | Sahayak | AnythingLLM | Onyx | PipesHub |
|---|:--:|:--:|:--:|:--:|
| **CONNECTORS / INGESTION** |
| # source connectors | 🟡 ~4 (Google SA, dormant) | 🟡 ~8 | ✅ ~55 | ✅ ~41 |
| Ingestion pipeline (parse/chunk) | 🟡 excerpt+filename | ✅ collector svc | ✅ chunker+mini/large | ✅ Docling+parsers |
| Incremental sync / watch-refresh | ❌ | ✅ sync queue | ✅ poll+checkpoint | ✅ delta sync |
| Source-permission sync (ACLs) | ❌ | ❌ | ✅ (EE) | ✅ graph edges |
| File types | 🟡 xlsx/csv/img/pdf | ✅ wide (+audio/video) | ✅ wide | ✅ wide |
| **RETRIEVAL / RAG** |
| Vector store | 🟡 in-proc cosine on Dynamo | ✅ LanceDB+10 | ✅ OpenSearch/Vespa | ✅ Qdrant/OpenSearch |
| Hybrid (keyword+vector) | ❌ substring *or* cosine | ❌ vector-only | ✅ α=0.5 | ✅ dense+sparse |
| Reranker | ❌ | 🟡 1 local | ✅ Cohere/LiteLLM/Bedrock | ✅ cross-encoder |
| Chunking strategy | ❌ whole-excerpt | 🟡 fixed 1000/20 | ✅ multi-vector | ✅ typed blocks |
| Citations | 🟡 none real | 🟡 sources[] | ✅ inline [n]→doc | ✅ block-level+bbox |
| Multi-provider embed/LLM | 🟡 Bedrock only | ✅ 40 LLM/14 embed | ✅ LiteLLM | ✅ LiteLLM |
| **AGENTS / ACTIONS** |
| Orchestrator + specialists | ✅ Strands + Nirmata factory | ✅ aibitat | ✅ Persona + deep-research | ✅ spawn_agent + domains |
| Hire/spawn agent at runtime | ✅ `create_spec` (our edge) | 🟡 toggle tools | 🟡 personas | ✅ `spawn_agent(role,goal,tools)` |
| Per-agent tool scoping | ✅ Cedar allowlist (our edge) | 🟡 whitelist | ✅ persona tools | ✅ role tool_names |
| **Per-ACTION approval gate** | 🟡 comms-only draft→approve | ❌ (only clarifying Qs) | ✅ egress policy+ledger | ✅ risk-tiered+HIL |
| Durable approval record | ❌ (alert rows) | ❌ | ✅ Postgres `ActionApproval` | 🟡 in-memory |
| Session-grants / pre-approvals | ❌ | ❌ | ✅ | ✅ ASK_ONCE |
| No-code workflow builder | ❌ | ✅ Agent Flows | 🟡 Craft | ✅ React-Flow builder |
| MCP client / server | ❌ (settings stub) | ✅ client (hypervisor) | ✅ both | ✅ both |
| Sandboxed code exec | ❌ | 🟡 open-computer WIP | ✅ egress-proxied | ✅ docker sandbox |
| Scheduled/proactive | ✅ EventBridge scheduler | ✅ cron jobs | ✅ tasks+AWAITING_APPROVAL | ✅ celery |
| Web search | 🟡 Tavily (needs key) | ✅ | ✅ 6 providers | ✅ |
| **ENTERPRISE / DEPLOY** |
| Auth / SSO | ❌ demo token + gate | 🟡 SimpleSSO | ✅ OIDC/SAML/SCIM (EE) | ✅ SAML/OAuth/OTP |
| RBAC | ❌ UI-dim only | 🟡 3 roles | ✅ perms+groups (EE) | ✅ org roles |
| Multi-tenant | ❌ hardcoded `ramesh_auto` | 🟡 workspaces | ✅ schema-per-tenant | ✅ org-scoped |
| Doc-level permissions | ❌ | ❌ | ✅ | ✅ |
| Observability / tracing | 🟡 activity log | 🟡 telemetry | ✅ spans+Sentry | ✅ OTel+Opik |
| Evals harness | 🟡 sim + contract tests | ❌ | ✅ Braintrust | ✅ rubric+golden |
| Deploy | ✅ Lambda+Amplify (light!) | ✅ Docker/Helm/desktop | ✅ heavy | ✅ heavy |

## Where Sahayak already wins (protect these)
- **Serverless & cheap** — Lambda + Amplify + DynamoDB scales to zero; the others need a server farm. Decisive for SMB economics.
- **The "hires its own staff" narrative + live factory** (`create_spec`) is a sharper product story than "create a Persona in settings."
- **Approval-by-default philosophy** (nothing sends without a tap) — the competitors *can* gate but ship autonomous-by-default.
- **Cedar** per-agent authorization is a real, verifiable policy layer (PipesHub falls back to `in`-lists; AnythingLLM has none).
- **SMB packaging**: onboarding, Hinglish, artifacts, branded PDF reports, a curated demo — a *product*, not a platform to assemble.

## Where Sahayak is thin (the gaps to close)
1. **Retrieval is toy-grade** — in-process cosine or substring, no hybrid, no reranker, no chunking, no citations. This is the core "AI employee knows your business" muscle and it's the weakest.
2. **Approval is comms-only** — a real per-action policy engine + durable ledger is our *own gimmick*, under-built vs Onyx/PipesHub.
3. **Connectors are mostly stubs** — only Google (dormant) is real; no ingestion pipeline, no sync.
4. **Enterprise basics absent** — single-tenant hardcode, cosmetic RBAC, demo auth, no doc-permissions, thin observability/evals.

---

## Enhancement backlog (prioritized, code-mapped)
Each item: what · why (who proves it) · where in our code · effort.

### Track A — Agents & actions (our gimmick; highest ROI)
- **A1 · Per-action approval engine + durable ledger + session-grants** — generalize comms-only approval into a policy layer: classify every side-effecting tool by risk → `AUTO/ASK_ONCE/ASK_EACH/DENY` → pause/resume with a durable `approvals` collection. *Why:* Onyx `ActionApproval`+`EndpointPolicy`, PipesHub `ApprovalHook`. *Where:* wrap tool dispatch in `agents/registry.py`/`policy.py`; new `approvals` store + `/approvals` endpoints + Cedar risk tags. **P0.**
- **A2 · Specialist role registry + scoped-tool templates** — turn `create_spec` into named roles (data-driven) with per-role tool scope enforced by Cedar; support dependency-aware multi-hire. *Why:* PipesHub `spawn_agent`+role registry, Onyx Persona. *Where:* `templates_catalog.py` → real role registry; `registry.create_spec`. **P1.**
- **A3 · Real MCP client** (consume external MCP servers) + expose **Sahayak-as-MCP**. *Why:* all three. *Where:* new `tools/mcp.py`; Settings MCP list is already a stub to fill. **P2.**

### Track B — Retrieval / RAG (biggest capability gap)
- **B1 · Hybrid retrieval + reranker + chunking + citations** — chunk docs on ingest; fuse keyword(substring) + Titan cosine (α-weighted); add a Bedrock/cross-encoder rerank; return inline `[n]→source` citations. *Why:* Onyx (α=0.5, rerank, citation_processor), PipesHub (sparse+dense, block citations). *Where:* `tools/documents.py` (ingest+search), `main.py:/search` + `recall_context`. **P0.**
- **B2 · Provider-agnostic embed/LLM/vector abstraction** — thin interface so we can swap Titan/Bedrock for local or other providers (and optionally a real vector store later). *Why:* AnythingLLM/LiteLLM everywhere. *Where:* `models.py`, `tools/documents.py`. **P2.**

### Track C — Connectors & ingestion
- **C1 · Connector factory + activate Google (Drive/Sheets/Docs/Calendar)** — the `gcp.py` code is real but dormant; wire a `ConnectorBuilder`-style registry and turn Google on with a service-account key; add incremental sync into the document brain. *Why:* PipesHub `ConnectorBuilder`+code-generator, AnythingLLM collector+resync, Onyx poll/checkpoint. *Where:* `main.py` connectors, `gcp.py`, `tools/documents.py`. **P1.**
- **C2 · One real messaging connector (Slack or Gmail) via the factory** — proves the pattern beyond Google; ingest threads into context. **P2.**

### Track D — Enterprise & deploy (SMB-appropriate slice only)
- **D1 · Real multi-tenant** — carry `tenant_id` from the session instead of hardcoding `ramesh_auto`; per-tenant seed on first login. *Why:* everyone; fixes our #1 QA gap. *Where:* `auth/login`, `api.js` TENANT, every endpoint default. **P1.**
- **D2 · Evals harness + agent-run tracing/cost** — golden Q&A over the seed + per-run token/cost/trace log surfaced in Logs. *Why:* Onyx Braintrust, PipesHub rubric/Opik. *Where:* new `backend/tests/evals/`, `deps.log_activity` → structured trace. **P1.**
- **D3 · Doc-level visibility (SMB-lite)** — tag documents/memories with visibility and filter retrieval; groundwork for later real RBAC. *Why:* Onyx/PipesHub ACL sync. **P2.**
- **D4 · Real light auth** (replace demo token; keep it simple) — only if we go multi-tenant for real. **P2.**

## Strategic recommendation
Do **B1 + A1 first** — they're the two capabilities that (a) close the biggest gap (retrieval) and (b) deepen our actual differentiator (approval). Both are liftable near-verbatim from Onyx/PipesHub at SMB weight and both are demoable. Then C1 (turn Google on — real connectors story) and D1 (multi-tenant, fixes the headline QA bug). Everything stays serverless; we do **not** adopt Neo4j/Kafka/Vespa/SAML/SCIM — that's how these tools became un-SMB.

## Proposed execution order (one-by-one, each tested + both modes green)
1. **B1** retrieval upgrade (hybrid + rerank + chunk + citations)
2. **A1** per-action approval engine + ledger + session-grants
3. **C1** connector factory + Google live + sync
4. **D1** real multi-tenant
5. **A2** role registry / scoped specialists → **D2** evals+tracing → **A3/C2/B2** as time allows

Reference code to study while building (in `/Users/jochannnn/ai-employee-benchmark/`):
- Approval: `onyx/backend/onyx/sandbox_proxy/`, `onyx/backend/onyx/external_apps/`, `pipeshub/backend/python/app/agent_loop_lib/modules/stores/approval/`
- Retrieval: `onyx/backend/onyx/indexing/chunker.py`, `context/search/`, `chat/citation_processor.py`; `pipeshub/.../modules/{retrieval,reranker}/`
- Connectors: `pipeshub/.../connectors/core/registry/`, `anything-llm/collector/`
- Spawn/roles: `pipeshub/.../agent_loop_lib/tools/builtin/coordination/spawn_agent.py`, `onyx/.../db/models.py: Persona`
