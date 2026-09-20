# We built an AI back-office that hires its own staff — for the 63 million shopkeepers the internet left behind

*First Commit hackathon · Built on AWS Bedrock + Strands Agents · Team: Ayush & Fahmin*

> **TL;DR** — Sahayak is an AI *staff*, not another dashboard, for Indian small
> businesses. You talk to it in plain Hinglish; an orchestrator routes you to
> specialist agents; and when no specialist exists for your problem, a factory
> agent **interviews you and hires a new one, live.** It runs on Amazon Bedrock
> Nova, Strands Agents, Cedar, and a serverless AWS stack — and the whole thing
> also runs fully offline behind one feature flag. Live: **sahaayak.space**.

---

## The problem: the internet gave big retailers a software army, and the shopkeeper a warning

Walk into a components shop in Faridabad and you'll meet Ramesh. He knows exactly
who owes him money, which supplier is reliable, and when the transporter is going
to flake — all of it in a notebook and his own head. What he doesn't have is what
every large retailer got for free during the e-commerce boom: a collections team,
a logistics desk, an analytics department, a compliance officer.

There are **63 million** businesses like Ramesh's in India. The reason they still
run on paper isn't that they're behind — it's that **every tool ever built for
them assumes an IT department.** SaaS dashboards ask a shopkeeper to become a data
analyst. We didn't want to build another dashboard he'd have to learn. We wanted
to build the *staff* he could never afford.

## What we built: you talk, they work — and they hire their own

Sahayak is a group chat with an AI back-office.

- **An orchestrator routes every request.** "Show me who hasn't paid," "should I
  take this 90-day order?", "cheapest pickup to Ludhiana?" — Ramesh types it in
  plain words. **Sahayak** (Nova Pro) reads intent and hands off to a specialist:
  **Vasool** chases receivables, **Khata** watches cash flow and the 90-day-terms
  trap, **Sourcer** knows suppliers and MOQs. Every reply shows *which* agent
  answered and how it was routed — no black box.

- **It hires specialists it doesn't have.** This is the moment that makes people
  lean in. Ramesh says "mera transporter nahi aaya" (my transporter didn't show).
  No logistics agent exists — so **Nirmata**, the factory agent, interviews him,
  proposes a spec, and on "haan, create it" a brand-new **Logistics Agent**
  materializes in his sidebar with its own tools and its own guardrails. Describe
  "I want to sell online" and it builds a digital-presence agent. The org chart
  writes itself.

- **It works while he sleeps — but he keeps the keys.** An EventBridge rule wakes
  the agents every minute. Overdue reminders get *drafted*, cash gaps get flagged.
  Nothing is ever sent. Ramesh wakes up, taps **Approve**, and a real email goes
  out over SES. AI does the labor; the human holds the authority.

- **It reads his paperwork.** Drop a rent agreement, a GST certificate, a rate
  list — Textract OCRs it, Titan embeds it, and it's folded into every agent's
  memory and made searchable. Ask Vasool about a buyer you mentioned once, and it
  remembers.

## The stack: "build it" open source, "ship it" on AWS

The hackathon had two tracks — build it on your machine with AWS open source, and
ship it on AWS. **We did both, and made them the same code.**

**Build it:**
- **Strands Agents SDK** is the entire agent layer — the orchestrator, the
  specialists, the tool loop, `Agent.as_tool` sub-agent composition, and
  `S3SessionManager` for durable memory. Nirmata's "hire an agent" is literally
  Strands creating a new `Agent` from a validated spec at runtime.
- **Cedar** (AWS's open-source policy language, via `cedarpy`) gives every agent a
  real **default-deny** tool allowlist. A hired agent physically cannot call a
  tool we didn't grant it — the authorization decision is a Cedar policy
  evaluation, not an `if` statement we hope holds.

**Ship it:**
- **Amazon Bedrock** — Nova Pro orchestrates, Nova Lite powers the specialists,
  **Titan Embed v2** drives semantic document search, and Nova's vision parses
  invoice photos into ledger rows.
- **AWS Lambda + Function URL** — the whole FastAPI backend runs serverless via
  **Mangum**. Zero idle cost; it scales to zero between demo clicks.
- **DynamoDB** — 14 tenant-scoped tables, everything keyed `(tenant_id, id)`.
- **S3** (session memory + document bytes), **Textract** (OCR), **SES** (approved
  email), **EventBridge** (the `rate(1 minute)` proactive loop), **Amplify**
  (frontend + the `sahaayak.space` domain), **IAM** (a scoped execution role).

The design decision we're proudest of: **one seam, two backends.** A single flag,
`USE_AWS`, swaps every cloud dependency for a local twin — `DynamoStore` ⇄
`LocalStore` (JSON), `SESNotifier` ⇄ `ConsoleNotifier`, and `BedrockModel` ⇄ a
`MockModel` that drives the *real* Strands tool loop with deterministic rules. A
parity test runs the same suite against both. The payoff: the demo never depends
on the cloud being up, contributors need no AWS account, and the exact code path
we test offline is the one that runs on Bedrock. The cloud doesn't change the
logic — it just makes it real.

## What fought back

Every honest build has a graveyard of small wars. Here are ours.

- **Nova's tool-use stream occasionally lies.** Under load, Bedrock would emit a
  malformed `toolUse` event mid-stream and the agent turn would blow up. A blanket
  retry would double-charge tokens, so we scoped a single retry to exactly that
  signature (`"ToolUse" in str(e)` / `modelStreamError`) and let everything else
  raise. Flakiness gone, cost unchanged.

- **DynamoDB refuses floats.** Every rupee amount and trust score is a float in
  our JSON world and a hard error in DynamoDB. We wrote a recursive
  `Decimal`-in / native-`float`-out codec at the store boundary so `LocalStore`
  and `DynamoStore` return byte-identical shapes — which is the only reason the
  parity test passes and the AWS swap is provably safe.

- **Making "offline" actually exercise the real loop.** The easy mock returns a
  canned string. That would have meant our offline demo tested nothing real. So
  `MockModel` implements Bedrock's Converse streaming shape — it emits genuine
  `contentBlockStart`/`toolUse`/`messageStop` events — and Strands can't tell it
  from Nova. Offline mode runs the same agent → tool → store path as production.

- **Textract needs a permission the hackathon key can't grant.** Our IAM user
  could create tables and buckets but not `iam:AttachUserPolicy` — so it couldn't
  grant *itself* Textract. Classic bootstrap problem; the fix has to come from an
  admin principal. We made PDF ingest **degrade gracefully** (fall back to
  filename tagging) so a missing permission never breaks the demo — xlsx ingest
  runs on `openpyxl` and never needed it anyway.

- **The rupee sign came out as `â‚¹`.** FastAPI's default JSON escapes non-ASCII;
  on Windows and curl our `₹` mojibaked. A tiny custom `UTF8JSONResponse`
  (`ensure_ascii=False`, `charset=utf-8`) fixed it everywhere — a one-class change
  we only caught because we test the raw bytes on the wire, not the parsed object.

- **Lambda's filesystem is read-only.** Our upload/seed code wrote next to the
  package; on Lambda that's a crash. Everything writable moved to `/tmp`, gated on
  `AWS_LAMBDA_FUNCTION_NAME`.

- **Shipping Python to manylinux.** `pip` backtracked forever until we pinned
  `strands-agents==1.56.0`, and a transitive `pywin32` had to be stubbed for the
  Linux build. Deploy also fought us with double CORS headers (middleware +
  Function URL both adding them) until we let exactly one own it.

- **"Auth stays demo-only" vs. a public URL.** The project rule forbade real auth,
  but an open URL invites crawlers. Our answer: a shared **demo gate** token
  (`DEMO_GATE_TOKEN`) on every route, with `/health` and public artifact shares
  exempt — judges get a link with the passcode baked in, bots get a 401. A
  pragmatic gate beats a fake login.

## The line we refused to cross: no demo that lies

It would have been easy to fake the integrations. We didn't. Google
Drive/Sheets/Docs/Calendar connect for real through a service account; everything
we haven't built says **"coming soon."** Excel import produces real ledger rows.
Memories are genuinely injected into agent prompts — the agent quotes them back.
Artifacts are built by a real tool call. A demo that lies is worse than a feature
that isn't finished, because the whole pitch is *trust the AI with your shop.*

## Try it

- **Live:** `https://www.sahaayak.space/?gate=WJecxdO_WdjZ#/app` → **Continue as Ramesh**
- **Offline in 60 seconds:** `uvicorn app.main:app` + `npm run dev` — zero AWS, deterministic
- **Proof it works:** `pytest tests -q` (81 green) and `simulate_demo.py`, our
  demo-as-a-test that asserts state (not wording) end-to-end on both backends.

## Team

- **Ayush** — team lead, backend + AWS platform: provisioning from zero, the Cedar
  authorization layer, the Textract→Titan business-context brain, store parity,
  and the API contract.
- **Fahmin** — frontend + backend + deployment: the entire React workspace and
  design system, the reports/PDF engine and Google connector layer, and the whole
  Lambda + Amplify + EventBridge deploy.

We set out to give the smallest business the one thing only the biggest ever had:
a staff. Turns out you can build it with an agent framework, a policy engine, and
a language model that's cheap enough to give away — which is exactly the point.

*Built with Amazon Bedrock, Strands Agents, Cedar, DynamoDB, S3, Textract, SES,
EventBridge, Lambda, and Amplify.*
