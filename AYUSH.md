# AYUSH.md — Ayush's Handbook (READ FIRST — including your AI agent)

**You = Ayush** — AWS environment + AWS-side implementations + deploy.
**Fahmin** — UI, demo video, pitch. He builds against `USE_AWS=0` today; once you
deliver `.env`, **both of you run `USE_AWS=1`** — same code, same API shapes.

The app already runs end-to-end locally. **Your job: make `USE_AWS=1` behave
identically — nothing more.** When `test_store_parity` passes on DynamoDB and
`simulate_demo.py` is green on AWS, you're done.

---

## What already exists (don't rebuild it)

| File | What it is | Status |
|---|---|---|
| `backend/app/store.py` | `Store` interface + `LocalStore` (working) + `DynamoStore` (skeleton → **your job**) | impl needed |
| `backend/app/notifier.py` | `Notifier` interface + `ConsoleNotifier` (working) + `SESNotifier` (skeleton → **your job**) | impl needed |
| `backend/app/models.py` | `MockModel` (offline) ⇄ `BedrockModel` Nova — auto-selected when creds exist | done |
| `backend/app/agents/` | orchestrator, vasool, sourcer, khata, nirmata factory, registry, specs, mock_rules | done — Fahmin's |
| `backend/app/tools/` | all 17 domain tools | done — Fahmin's |
| `backend/app/main.py` | all contract endpoints + `handler = Mangum(app)` ready for Lambda | done |
| `backend/app/scheduler.py` | thread scheduler (local); EventBridge mapping is **yours if deploy happens** | partial |
| `backend/app/seed/seed.json` | demo data — **your DynamoDB tables mirror this schema exactly** | done |
| `backend/tests/` | unit + routing + contract + **store-parity** | done — keep green |
| `simulation/simulate_demo.py` | the demo-as-a-test (14 checks) | done — keep green |
| `frontend/` | working scaffold (chat + agents + alerts) — Fahmin's | in progress — NOT yours |
| `frontend/mocks/contract.json` | **API contract — single source of truth** | frozen |
| `.env.example` | every env var you must fill | done |

## The contract you work against

- `Store`/`Notifier` interfaces: implement AWS versions, local versions are off-limits
- `contract.json` shapes: your impls must return the same shapes (tests enforce)
- `USE_AWS` env flag selects impls in `get_store()`/`get_notifier()`/`make_model()` — already wired

---

## YOUR TASKS (in order)

### 1. AWS console (~60–90 min) — nothing here needs Fahmin
- [ ] AWS account → region `us-east-1` → billing alert $5
- [ ] Bedrock → Model access → enable **Nova Lite + Nova Pro** (auto-approve; skip Anthropic)
- [ ] IAM user `hackathon` + AdministratorAccess + access key → `aws configure --profile hackathon`
- [ ] DynamoDB `PAY_PER_REQUEST`, PK `tenant_id` (S) + SK `id` (S):
      `sahayak-specs` `sahayak-invoices` `sahayak-suppliers` `sahayak-carriers` `sahayak-alerts` `sahayak-payables`
- [ ] SES: verify sender **and the demo recipient** (sandbox sends only to verified)
- [ ] S3 bucket `sahayak-uploads`, CORS `["*"]` PUT/GET
- [ ] Smoke: `aws sts get-caller-identity`, `aws dynamodb list-tables`, one `bedrock-runtime converse` call on `us.amazon.nova-lite-v1:0`

### 2. Fill `.env` → hand to Fahmin (never commit it)
Copy `.env.example` → `.env`, fill real values. Tell Fahmin: "set `USE_AWS=1`,
`AWS_PROFILE=hackathon`, restart backend." That's all he needs to know.
**→ Fahmin is waiting on THIS to test the AWS path and shoot the AWS part of the demo video.**

### 3. Make your impls green
```bash
cd backend && pip install -r requirements.txt
USE_AWS=1 AWS_PROFILE=hackathon pytest tests/unit/test_store_parity.py -v   # the money test
USE_AWS=1 AWS_PROFILE=hackathon python ../simulation/simulate_demo.py       # full demo on AWS
USE_AWS=1 AWS_PROFILE=hackathon python -c "from app.notifier import SESNotifier; print(SESNotifier().send('VERIFIED@x.com','t','hi'))"
```

### 4. Deploy — ONLY if `simulate_demo.py` is green locally first
- Frontend: Amplify Hosting (repo connect or `npm run build` → drag `dist/`)
- Backend: Lambda zip (`handler = Mangum(app)` exists) or App Runner. No local Docker.
- EventBridge: `scheduler.py` logic maps 1:1 — schedule rules call the same check
- **→ You are waiting on Fahmin for: a buildable `frontend/dist` (exists now) and the final demo path being stable**

---

## Expected commits from you

```
feat(store): DynamoStore — parity suite green on AWS
feat(notify): SESNotifier verified, first real email sent
chore(env): .env handed to Fahmin (env itself NEVER committed)
feat(aws): nova-lite invoice parse verified via bedrock-runtime
chore(deploy): amplify frontend + lambda backend URL   ← stretch only
```

Each commit requires: `pytest` green AND `simulate_demo.py` green in BOTH modes.

## What Fahmin commits meanwhile (context, not your problem)

```
feat(ui): chat polish + routing badges        feat(ui): invoice panel + aging chart
feat(ui): factory-hiring animation            feat(ui): cashflow + alerts panels
docs: README + demo script + video
```

---

## DO NOT TOUCH — hard rules for you AND your AI agent

1. **`frontend/mocks/contract.json` is frozen.** Shape looks wrong → flag it, don't change it.
2. **Don't modify interfaces or any `Local*`/`Console*`/`Mock*` impl.** Bug → report it. The local path must stay pristine.
3. **No infra tooling**: no CDK, SAM, Terraform, Serverless Framework, ECS, EKS, Docker builds, VPC, NAT, custom IAM policies. boto3 + zip + console clicks.
4. **No auth**: no Cognito, JWT, OAuth. Demo uses `tenant_id`. Post-hackathon concern.
5. **Don't touch `agents/`, `tools/`, `main.py` endpoints** — Fahmin's slice. AWS hooks go behind interfaces, never in endpoints.
6. **Don't change models/prompts.** Nova Lite/Pro IDs are in `.env.example`. No "let's use Claude instead".
7. **No new dependencies** — `requirements.txt` and `package.json` are complete. (boto3 already covers AWS.)
8. **Don't restructure the repo** or rename anything.
9. **No new .md files** — README + this file are the only docs. Notes go in `.env.example` comments or here.
10. **NEVER commit `.env` or AWS keys.** Check `git status` before every commit.
11. **Don't delete seed data, mock behaviors, or tests** — they ARE the demo.
12. **If it passes tests, it's done.** Time is the constraint, not elegance.

## Definition of done

- [ ] `USE_AWS=1 pytest tests/unit/test_store_parity.py` → all pass
- [ ] `USE_AWS=1 python simulation/simulate_demo.py` → 14/14
- [ ] Real email in demo inbox via SES
- [ ] `.env` to Fahmin + 5-min "how `USE_AWS` works" walkthrough
- [ ] (stretch) deployed URL runs the demo cold

**If AWS fights back at any point: stop, tell Fahmin, stay local. A working local demo beats a broken cloud one.**
