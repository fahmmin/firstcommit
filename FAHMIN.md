# FAHMIN.md — Fahmin's Handbook (READ FIRST — including your AI agent)

**You = Fahmin — owner of the entire frontend** (`frontend/` — zero merge risk,
Ayush never touches it). **Ayush owns the entire backend.** The seam is
`frontend/mocks/contract.json` — you build every screen against those shapes;
he implements until responses match. Stack currently runs **real AWS**
(`USE_AWS=1`, Bedrock + DynamoDB + S3 + SES) on ports 5173 (vite) + 8000 (api).

Existing pages: `#/` landing · `#/docs` · `#/app` workspace · `#/settings`.

---

## Round 2 — your build list (priority order, MVP-thin but REAL)

Shapes for every new call are already in `contract.json` — don't invent fields.

### 1. `#/login` — provider sign-in (the seam, not a fake)
Google button → account-chooser card → `POST /auth/login {provider:"google",
provider_id}` → store `token`+`user` in localStorage → `#/app` (or `#/onboarding`
if `!onboarded`). Phone → number → 6-digit OTP field (accept any, the provider
adapter is the thin part) → same login call. "Continue as guest" → `{provider:"guest"}`.
New file: `pages/Login.jsx` + `lib/auth.js` (token get/set/clear).

### 2. `#/onboarding` — first-run wizard
Steps: your name → business name → city → **"what eats your time?"** chips
(late payments / stock-outs / untracked deliveries / too many excels / cash-flow
surprises). Finish → `PATCH /settings {business:{name,owner,city}, onboarded:true}`
+ `POST /memories {text, source:"onboarding"}` **per chip** — those chips become
real agent memory (Ayush injects them into prompts). Land on `#/app`.
New file: `pages/Onboarding.jsx`.

### 3. Artifacts — the wow feature
- `pages/ArtifactView.jsx` at `#/a/:id` → `GET /artifacts/{id}` → render via a
  template registry `components/artifacts/{TrackingPage,InvoiceSummary,
  SupplierCompare,PaymentCard}.jsx` + `index.jsx` (switch on `template`, same
  pattern as `components/cards/`). Reuse existing card pieces where possible.
  Header: title + "built by {agent}" + **Copy share link** button (copies full URL).
- In Workspace chat: when `actions[]` has `artifact_created` → render a card
  "📄 {title} — Open" linking to `#/a/{id}`.
- Try each template against real Nova; ship only the ones that validate
  reliably — that subset is what the video shows.

### 4. Global search — enterprise search, title/meta scoped
Search input in Workspace header (magnifier, `⌘K` styling optional) →
`#/search?q=` page → `GET /search?q=` → grouped results (Invoices / Suppliers /
Carriers / Agents / Tasks / Memory / Documents) — each row: icon, title, meta,
click → `ref`. Empty group hidden. New file: `pages/Search.jsx`.

### 5. Business context — Settings section
List `GET /memories`, add box (`POST /memories`), delete (`DELETE /memories/{id}`).
One line under the title: *"Sahayak remembers this and uses it in every reply."*
Also add a quick-add in the workspace right rail Settings tab (optional).

### 6. Connectors upgrade (in Settings page)
- **Excel import card**: file picker → `POST /import/excel` (multipart) →
  result toast "34 rows imported to invoices". This is REAL — Ayush's importer.
- Gmail + Google Drive rows: same connect/disconnect/sync toggle as existing.
- MCP servers: move persistence from localStorage → `PATCH /settings
  {mcp_servers:[...]}` (list/add/remove; status stays "configured").

### 7. Skills toggles
Existing grouped tool list → real on/off switches → `PATCH /settings
{prefs:{disabled_tools:[...]}}`. Disabled = greyed chip.

### 8. `api.js` + `App.jsx` — append-only
Add methods (never reorder/edit Ayush-facing signatures):
`login(body)`, `memories()`, `addMemory(t)`, `delMemory(id)`, `search(q)`,
`artifacts()`, `artifact(id)`, `importExcel(file)`, `patchSettings(patch)`.
Routes: `login`, `onboarding`, `search`, `a/:id` — parse `:id` in the hash router.
Default route → `#/login` if no token, else `#/`.

## File map (merge-safe — all new or append-only)

```
pages/Login.jsx          pages/Onboarding.jsx    pages/Search.jsx
pages/ArtifactView.jsx   components/artifacts/*  lib/auth.js
api.js  (append-only)    App.jsx (append routes) lib/templates.js (exists)
Settings.jsx (extend)    Workspace.jsx (search bar + artifact card)
```

**Do NOT touch:** `backend/**`, `contract.json` (frozen — change = iteration
loop with Ayush), `seed.json`, `AYUSH.md`, `README.md`, `.env*`.

## What's stub vs real — know it before filming

| Real (say it proudly) | Thin seam (don't linger) |
|---|---|
| Excel → real ledger rows | Google/phone provider step |
| Memories → injected into agent prompts | OTP (any code accepted) |
| Artifacts → agent calls a real tool | MCP "configured" status |
| Search → real substring across live data | Gmail/Drive sync |
| Connect/disconnect, settings persist | PDF/semantic search (roadmap) |

## Video checklist (the shots that win)

1. Login w/ Google → onboarding chips → workspace
2. Upload the Excel → aging chart updates
3. Add memory "Sharma pays in 45d" → ask Vasool about Sharma → it references it
4. "Mera transporter nahi aaya" → agent hired → ask for tracking →
   **artifact card → open shareable tracking page**
5. Search "sharma" → grouped results
6. Settings sweep: context / skills / MCP / connectors

## Rules

1. `contract.json` is frozen — report mismatches to Ayush in the
   KIND/format from `AYUSH.md` §iteration-loop.
2. No new npm deps without asking. No new `.md` files.
3. Never commit `.env`/keys — check `git status` first.
4. Merge gate before pushing: `npm run build` clean + backend tests green.
