# BLOG_ASSETS.md — images & screenshots for the submission blog

Builder Center cover spec: **1200 × 675 px**, jpg/png/webp, ≤ 2 MB, **no text in image** (esp. the cover).

---

## A. Screenshots to capture (from `sahaayak.space` — the live AWS build)

| # | Page / moment | How to get there | Blog section | Caption |
|---|---|---|---|---|
| 1 | **Agentic trace** — "5 tasks running: Gathering business memory → Calling list_overdue via tally-mcp → Reading citations → Cooking response (Nova Pro)" | Workspace → click **"Show my overdue invoices"** → capture *while it's thinking* | "You talk, they work" | *One prompt, a whole back-office moves — routed by Nova Pro on Bedrock.* |
| 2 | **Routing + reply** — `sahayak → vasool` pill + the overdue list (₹2,60,200) | same chat, after the reply lands | "You talk, they work" | *Vasool answers with real ledger numbers; the route is always visible.* |
| 3 | **HIRED-BY-AI sidebar** — Digital Presence / Logistics / Compliance agents with the AI badge | left rail, any page | "It hires its own specialists" | *Agents the owner never coded — hired live by Nirmata, the factory.* |
| 4 | **The factory moment** — Nirmata proposing a spec, then the new agent in the sidebar | type "mera transporter nahi aaya" → then "haan, create it" | "It hires its own specialists" | *Describe a problem with no specialist; one arrives with a Cedar-scoped toolset.* |
| 5 | **Approvals** — Triggers rail with drafted reminders + "sent via SES" | right rail on Workspace | "Proactive, but the owner stays boss" | *Drafted overnight by an EventBridge loop; sent only on one tap — real SES email.* |
| 6 | **Business context** — Organized library (tax/finance/legal tags, "fed to agents") + Agent memory | left nav → **Business context** | "It reads his paperwork" | *Drop a PDF → Textract OCR → Titan embed → every agent remembers it.* |
| 7 | **Analytics** — KPI tiles + aging / cash-flow charts | left nav → **Analytics** | intro or "reports" | *Live dashboards built from DynamoDB rows, not mock data.* |
| 8 | **People / CRM** — Customers/Suppliers/Carriers, defaulter badges | left nav → **People** | optional | *Everyone the business touches, assembled from real invoices.* |
| 9 | **Reports → PDF** — a branded report / export | left nav → **Reports** | "Reports on real ledgers" | *Aging, cash-flow, GST — one click to a branded PDF he can WhatsApp his CA.* |
| 10 | **Login** (clean) | sign-in screen | header / fallback | *Demo-gated, one-tap "Continue as Ramesh."* |

**Tips:** use light mode for a clean look (or dark for drama — pick one and stay consistent). Full-window shots crop nicely to 1200-wide. Shot #1 (the thinking trace) is the strongest single image.

---

## B. AI-generated art prompts (for the cover + section breaks)

Style keywords to keep consistent: *clean editorial tech illustration, soft gradient background (violet→green→sky, our brand blobs), lots of white space, no text, no logos, subtle depth, flat-vector + soft shadow, 16:9.*

### Cover (1200×675) — recommended
> A calm, modern editorial illustration: a small Indian hardware-shop owner at a
> wooden counter, and rising softly behind him a translucent "team" of glowing
> abstract AI figures made of light — each a different soft gradient (violet,
> green, sky-blue, pink) — as if a staff materialized from thin air. Warm,
> optimistic, minimal, lots of negative space, flat-vector with soft shadows, no
> text, no logos, 16:9, muted pastel palette on off-white.

### Alt cover — "hires its own staff"
> Minimal isometric illustration of an org chart that is drawing *itself*: one
> central node blooms into new agent nodes along glowing connective lines,
> gradient orbs (violet/green/sky/pink) as the nodes, on a clean off-white
> canvas, soft depth, no text, no logos, 16:9.

### Section break — "reads his paperwork"
> Flat-vector illustration of paper documents (an invoice, a GST certificate, a
> rate list) dissolving into small glowing dots that flow into a soft rounded
> "memory" orb, pastel gradient palette, off-white background, no text, 16:9.

### Section break — "proactive but owner stays boss"
> Flat-vector night-to-morning scene: a tiny glowing agent works at a desk under
> a crescent moon on the left; on the right, morning light and a single large
> "Approve" checkmark button, calm pastel gradients, no text, no brand marks, 16:9.

**Where to generate:** any image model (the prompts are model-agnostic). Downscale/crop to 1200×675 for the cover; keep inline art ~1200 wide. If a model adds gibberish text, regenerate with "no text, no lettering" emphasized.

---

## C. Publishing checklist (AWS Builder Center → Create an article)
1. **Title:** *We built an AI back-office that hires its own staff — for the 63M shopkeepers the internet left behind*
2. **Description:** *How we used Amazon Bedrock Nova, Strands Agents, and Cedar to give India's smallest businesses an AI staff that hires its own specialists — the stack, the architecture, and what fought back.*
3. **Body:** paste `BLOG.md` (Builder Center takes Markdown). Insert screenshots #1–#6 under the matching sections.
4. **Cover:** the AI cover image (1200×675, no text).
5. **Tags (5 max):** `Amazon Bedrock`, `Generative AI`, `Serverless`, `AI Agents`, `Small Business`.
6. **Preview → Publish**, then paste the published URL into the hackathon submission.
