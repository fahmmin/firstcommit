# PARTNER.md — AWS Engineer's Handbook (READ THIS FIRST, INCLUDING YOUR AI AGENT)

You own the **engine slice**: AWS console setup, the AWS-side implementations,
and deploy. The app already runs end-to-end locally with `USE_AWS=0`.
**Your job is to make `USE_AWS=1` work identically — nothing more.**

---

## The Architecture Contract (why you can't break things)

Every AWS-touching capability sits behind an interface with a working local
implementation:

| Interface | Local (works today) | Your AWS impl | Flag |
|---|---|---|---|
| `Store` (`backend/app/store.py`) | `LocalStore` (JSON) | `DynamoStore` (DynamoDB) — **skeleton written, test it** | `USE_AWS` |
| `Notifier` (`backend/app/notifier.py`) | `ConsoleNotifier` | `SESNotifier` — **skeleton written, test it** | `USE_AWS` |
| Model (`backend/app/models.py`) | `MockModel` (deterministic) | `BedrockModel` (Nova) — auto-selected when creds exist | creds |
| Uploads (`/upload` endpoint) | `backend/uploads/` dir | S3 presigned | `USE_AWS` |
| Scheduler (`backend/app/scheduler.py`) | thread loop | EventBridge Scheduler | `USE_AWS` |
| Sessions (`backend/app/agents/registry.py`) | `FileSessionManager` | `S3SessionManager` | `USE_AWS` |

The store-parity test (`backend/tests/unit/test_store_parity.py`) runs the same
suite against `LocalStore` AND `DynamoStore`. **When that passes on AWS, your
job is done** — the whole app works on AWS automatically.

---

## YOUR TASKS (in order)

### 1. AWS console setup (~60–90 min)
- [ ] AWS account, region `us-east-1`, billing alert at $5
- [ ] Bedrock console → Model access → enable **Amazon Nova Lite + Nova Pro**
      (Amazon models auto-approve; do NOT request Anthropic — needs a form)
- [ ] IAM user `hackathon` + `AdministratorAccess` + access key →
      `aws configure --profile hackathon` (throwaway hackathon account — fine)
- [ ] DynamoDB, `PAY_PER_REQUEST`, PK `tenant_id` (S) + SK `id` (S):
      `sahayak-specs`, `sahayak-invoices`, `sahayak-suppliers`,
      `sahayak-carriers`, `sahayak-alerts`, `sahayak-payables`
- [ ] SES: verify sender email AND the demo recipient (sandbox only sends to verified)
- [ ] S3 bucket `sahayak-uploads` + CORS: `AllowedOrigins: ["*"]`, methods PUT/GET
- [ ] Smoke test: `aws sts get-caller-identity`, `aws dynamodb list-tables`,
      one `bedrock-runtime converse` call with `us.amazon.nova-lite-v1:0`

### 2. Hand the `.env` values to your teammate (never commit)
Fill a real `.env` matching `.env.example`. Walk them through: "set `USE_AWS=1`,
set `AWS_PROFILE=hackathon`, done." That is ALL they need to know.

### 3. Make AWS impls pass the same tests
```bash
cd backend
USE_AWS=1 pytest tests/unit/test_store_parity.py -v   # the money test
USE_AWS=1 python ../simulation/simulate_demo.py        # full demo on AWS
```
Skeletons already exist — fill/test them, don't redesign.

### 4. Deploy (ONLY if `simulate_demo.py` is green on local)
- Frontend: Amplify Hosting (connect repo or `npm run build` → drag `dist/`)
- Backend: Lambda zip via Mangum (`handler = Mangum(app)` already in main.py)
  or App Runner. Whichever is faster — do NOT build Docker locally.
- EventBridge Scheduler rules get created programmatically by `schedule_alert`
  — just ensure the Lambda/role has `scheduler:CreateSchedule`.

---

## DO NOT TOUCH — hard rules for you AND your AI agent

These exist because over-engineering kills hackathons. Violating them breaks
the local demo path that the whole team depends on.

1. **Do NOT modify `contract.json`** (`frontend/mocks/`). It's the single
   source of truth. If a shape seems wrong, flag it — don't change it.
2. **Do NOT modify the interfaces** (`Store`, `Notifier`) or any `Local*` impl.
   If you find a bug, report it — the local path must stay pristine.
3. **Do NOT add infrastructure tooling**: no CDK, SAM, Terraform, Serverless
   Framework, ECS, EKS, Docker builds, VPCs, NAT gateways, or "proper" IAM
   policy crafting. boto3 + zip + console clicks. `USE_AWS=1` either works or it doesn't.
4. **Do NOT add auth**: no Cognito, no JWT middleware, no OAuth. Demo uses a
   `tenant_id` header/selector. Auth is post-hackathon.
5. **Do NOT touch `backend/app/agents/`, `tools/`, or `main.py` endpoints** —
   that slice is owned elsewhere. If an endpoint needs an AWS hook, the hook
   goes behind the interface, not in the endpoint.
6. **Do NOT "fix" prompts or models** — Nova Lite/Pro IDs are already in
   `.env.example`. Don't switch to Claude/Premier "because it's better".
7. **Do NOT add dependencies** to `requirements.txt` or `package.json`.
   Everything needed is already there. (Exception: genuinely missing AWS lib —
   `boto3` is already included, so this should never fire.)
8. **Do NOT restructure the repo**, rename files, or "organize" folders.
9. **Do NOT write new .md docs** — README is the only doc. Put setup notes as
   comments in `.env.example` or here.
10. **Do NOT commit `.env`** or any AWS keys. Ever. Check `git status` before
    every commit.
11. **Do NOT delete or "clean up" seed data, mock behaviors, or tests** —
    they're the demo, not cruft.
12. **Do NOT build a "better" version of anything that already works.** If it
    passes tests, it's done. Time is the constraint, not code quality.

## Definition of done for your slice

- [ ] `USE_AWS=1 pytest tests/unit/test_store_parity.py` → all pass
- [ ] `USE_AWS=1 python simulation/simulate_demo.py` → all PASS
- [ ] One real email arrives in the demo inbox via SES
- [ ] `.env` handed to teammate + 5-min "here's how `USE_AWS` works" walkthrough
- [ ] (Stretch) deployed URL running the demo path cold

If AWS fights back at any point: **stop, tell the team, keep local.** A local
demo that works beats a cloud demo that's broken.
