# ENV_TODO.md — environment / AWS setup left to do

> Code is done for all of these — they're **config/permission/credential** steps only.
> None block the core demo (graceful fallbacks everywhere). Ordered easy → involved.
> `.env` is gitignored — never commit real keys.

---

## 1. Textract IAM permission — ✅ DONE (inline policy `sahayak-demo-unblock`)
**Verified:** `detect_document_text` call succeeds — PDFs now OCR on ingest.
**Symptom:** dropping a **PDF** into Business context tags it by filename only (xlsx/CSV unaffected).
**Why blocked:** IAM user `AWSHACKATHON` lacks `iam:AttachUserPolicy`, so it can't grant itself this — needs a principal with IAM rights (**root user**).

**How (as the account root of `055533307288`):**
Console → **IAM → Users → `AWSHACKATHON` → Add permissions → Attach policies directly** → search **AmazonTextractFullAccess** → attach.
Tighter (least-privilege) alternative — **Create inline policy → JSON**:
```json
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["textract:DetectDocumentText","textract:AnalyzeDocument"],"Resource":"*"}]}
```
**Verify:** `aws iam list-attached-user-policies --user-name AWSHACKATHON --profile sahayak`
Then re-ingest a PDF (`simulation/seed_hardware.py`) and check extracted text ≠ filename.

---

## 2. Web search / Deep research — ✅ DONE
`TAVILY_API_KEY` set in `.env` + forwarded to the Lambda env by `deploy_aws.py`.
`web_search` tool active on all agents; `/chat` honors `mode: web|deep`.

---

## 3. SES — ✅ DONE
Sender `kkfahmin@gmail.com` verified (sender + recipient are the same inbox,
so sandbox-mode delivery works — real emails land). To email OTHER recipients:
`aws ses verify-email-identity --email-address <them>` → they click the link.
(Or request SES production access to email anyone.)

---

## 4. Billing alert — ✅ DONE
Budget + email alert created in Billing → Budgets.

---

## 5. Rotate the exposed IAM key (do before/after judging)
The `AWSHACKATHON` secret was shown in chat/terminal. When convenient:
Console → **IAM → Users → `AWSHACKATHON` → Security credentials** → create a new access key → `aws configure --profile sahayak` with the new one → deactivate/delete the old key.

---

## 6. Google connectors — ✅ REAL via service account (no OAuth needed)
GCP project `sahayak-connect-24b14f` (created via gcloud). Service account:
`sahayak-connector@sahayak-connect-24b14f.iam.gserviceaccount.com`.
APIs enabled: Drive, Sheets, Docs, Calendar. Backend: `app/gcp.py`.

**"Connect" = share, not OAuth.** The SA has no Drive of its own — it only sees
files/calendars the owner shares *to its email*:

| To make real | Owner action |
|---|---|
| `google_drive` | Share any Drive file/folder → `sahayak-connector@…` (Viewer) |
| `google_sheets` | Share a Google Sheet → same email |
| `google_docs` | Share a Google Doc → same email |
| `google_calendar` | Calendar Settings → Share with specific people → same email (See all event details) |

Then **Settings → connector → Sync** pulls them for real:
- Sheets/Docs/Drive text files → text → `ingest_document_impl` (auto-tag + embed + searchable)
- PDFs/xlsx in Drive → binary download → real extractors (Textract/openpyxl)
- Calendar → events merge into `/calendar/events` as `kind: google_calendar`

**Env:** `GOOGLE_SERVICE_ACCOUNT_JSON` (minified key JSON — set on Lambda by
`deploy_aws.py` automatically from `GOOGLE_SA_KEY_FILE`) or local dev:
`GOOGLE_SA_KEY_FILE=gcp-sa.json` (gitignored). Missing → connectors show
`available`, Connect returns `unconfigured` + note.

**Coming soon (no real integration, connect → `coming_soon`):** WhatsApp, Gmail,
Instagram, Airtable, Slack, Tally, Razorpay, Facebook Marketplace, IndiaMART,
Shopify. UI shows a COMING SOON chip; Connect is hidden.

---

## 7. Deploy — ✅ DONE (2026-09-20, `simulation/deploy_aws.py`)
> What shipped: Amplify frontend + Lambda `sahayak-api` + EventBridge
> `sahayak-scheduler` + demo gate (`DEMO_GATE_TOKEN` middleware).
>
> **Final URLs (custom domain live):**
> - App: `https://www.sahaayak.space/?gate=<DEMO_GATE_TOKEN>#/app`
>   (apex redirects → www; `main.dym7go4p5hfno.amplifyapp.com` still works)
> - API: `https://y23g76b3hmldyftusdfygbnxty0oemmp.lambda-url.ap-south-1.on.aws`
> - Public share: `https://www.sahaayak.space/#/a/art-fy26`
> - DNS: sahaayak.space NS → Route53 zone `Z08139571DBKMWY32OTWP` (set at registrar)
>
> Function-URL gotcha (cost 20 min): public access needs BOTH
> `lambda:InvokeFunctionUrl` AND `lambda:InvokeFunction` +
> `InvokedViaFunctionUrl` resource-policy statements — missing the second
> gives a bare `403 Forbidden`. `deploy_aws.py` adds both.
Do only when `simulate_demo.py` is green.
- **Frontend:** `cd frontend && npm run build` → host `dist/` on **Amplify Hosting** (or S3 + CloudFront).
- **Backend:** `Mangum(app)` handler already exists → zip + **Lambda** + **API Gateway** (or **App Runner** from the repo). Set the same env vars (`USE_AWS=1`, `AWS_REGION`, model ids, `S3_BUCKET`, table names) on the function; give its execution role DynamoDB/S3/SES/Bedrock/Textract access.
- **Scheduler:** **EventBridge** rule (rate 5 min) → invoke a small Lambda calling `scheduler.run_once`.
- **Auth gate (per team decision):** keep demo-only — front it with a **CloudFront/Lambda token or an unlisted URL**, not real auth.
- Point the frontend's `VITE_API_URL` at the deployed API.

---

### Quick status
| Item | Status |
|---|---|
| Textract IAM | ✅ done (inline policy) |
| Tavily key | ✅ set |
| SES sender+recipient | ✅ verified |
| Billing alert | ✅ created |
| Rotate AWSHACKATHON key | ⏳ housekeeping (was exposed in chat) |
| Google connectors | ✅ real via service account — owner shares files to SA email |
| Other connectors (Meta/Razorpay/…) | coming_soon by design — no fake OAuth |
| Deploy + custom domain | ✅ live on sahaayak.space |
