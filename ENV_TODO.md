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

## 2. Web search / Deep research — set `TAVILY_API_KEY`
**Status:** plumbing done (`/chat` honors `mode: web|deep`; `web_search` tool on all agents). Keyless → returns "not configured".
**How:** get a free key at https://tavily.com → add to `.env`:
```
TAVILY_API_KEY=tvly-xxxxxxxx
```
Restart backend. No code change — the tool activates automatically.

---

## 3. SES — verify a demo recipient (for a real delivered email)
**Status:** sender `kkfahmin@gmail.com` verified. SES sandbox only delivers to **verified** recipients; unverified → auto-falls back to console log (demo still completes).
**How:**
```bash
aws ses verify-email-identity --email-address <recipient@example.com> --profile sahayak --region ap-south-1
```
Click the verification link in that inbox. (Or request SES production access to email anyone.)

---

## 4. Billing alert (safety)
Console → **Billing → Budgets → Create budget** → cost budget ~$5–10 → email alert. (One-time; protects the free credits.)

---

## 5. Rotate the exposed IAM key (do before/after judging)
The `AWSHACKATHON` secret was shown in chat/terminal. When convenient:
Console → **IAM → Users → `AWSHACKATHON` → Security credentials** → create a new access key → `aws configure --profile sahayak` with the new one → deactivate/delete the old key.

---

## 6. Real OAuth connectors (stretch — currently simulated)
Google Drive / Calendar connectors flip status + count local rows only; no real data leaves the app.
**To make real (Drive example):**
1. Google Cloud Console → create project → enable **Drive API** (and **Calendar API**).
2. **OAuth consent screen** (External, add your test users) → **Create credentials → OAuth client ID** (Web) → note client id/secret, set redirect URI.
3. Add to `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:8000/connectors/google_drive/callback
   ```
4. Backend work (not yet built): OAuth code-exchange + token store + real `sync` pulling files → `/context/upload`. **Ping Ayush to build the adapter once creds exist.**

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
| Item | Blocking demo? | Needs |
|---|---|---|
| Textract IAM | No (PDF fallback) | root console |
| Tavily key | No (graceful) | free API key |
| SES recipient | No (console fallback) | verify email |
| Billing alert | No | 1 click |
| Rotate key | No | housekeeping |
| OAuth connectors | No (simulated) | Google creds + backend adapter |
| Deploy | No (runs locally) | AWS console + a build |
