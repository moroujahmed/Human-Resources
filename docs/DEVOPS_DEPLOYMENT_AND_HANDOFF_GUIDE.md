# 09 — StaffHub DevOps, $0 Deployment & Presenter Handoff Guide

## 1. Local & Offline Container Architecture (`docker-compose.yml`)

Containerizing StaffHub solves the *"it worked on my laptop, not on my friend's laptop"* problem cleanly. Whether running during local development or offline presentation, the full stack runs via **5 coordinated services**:

| Service Name | Image / Build | Internal Port | Exposed Host Port | Responsibility |
| :--- | :--- | :---: | :---: | :--- |
| **`postgres`** | `postgres:16-alpine` | `5432` | `5432` | Primary relational database (persistent named volume `pgdata`). Healthchecked via `pg_isready`. |
| **`minio`** | `minio/minio:latest` | `9000` / `9001` | `9000` / `9001` | Local S3-compatible private object storage for CVs, bank letters, and PDF payslips (Console UI on `:9001`). Includes automatic bucket-creation init step (`staffhub-private`). |
| **`mailpit`** | `axllent/mailpit:latest` | `1025` / `8025` | `1025` / `8025` | Local SMTP catch-all server + browser inbox (`http://localhost:8025`) to visually inspect offer emails and password resets offline. |
| **`api`** | `./apps/api/Dockerfile` | `4000` | `4000` | NestJS backend. Entrypoint automatically runs `npx prisma migrate deploy`, executes idempotent `npx prisma db seed` (when `AUTO_SEED=true`), and starts API server. |
| **`web`** | `./apps/web/Dockerfile` | `3000` | `3000` | Next.js production/dev web app served at `http://localhost:3000`. |

### 1.1 One-Click Offline Startup Scripts (`scripts/`)
- **`scripts/start-staffhub.bat` (Windows)** and **`scripts/start-staffhub.sh` (macOS / Linux)**:
  1. Checks that Docker Desktop is running (prints clear human instruction if stopped).
  2. Copies `.env.docker.example` to `.env` if missing (pre-configured for local `postgres`, `minio`, and `mailpit` with `DEMO_MODE=true`).
  3. Runs `docker compose up --build -d`.
  4. Polls `http://localhost:4000/api/v1/health` until `200 OK` (database migrated + seeded).
  5. Prints exact URLs and opens `http://localhost:3000` in the default browser.

---

## 2. GitHub Actions CI & Automated Cron Specifications (`.github/workflows/`)

### 2.1 Continuous Integration (`ci.yml`)
Runs on every `push` and `pull_request` to `main`:
1. Spins up ephemeral `postgres:16` service container.
2. Runs `npm ci`.
3. Executes `tsc --noEmit` across `packages/shared`, `apps/api`, and `apps/web`.
4. Executes `eslint` across all workspaces.
5. Validates Prisma schema (`npx prisma validate`) and applies migrations (`npx prisma migrate deploy`).
6. Runs Unit & Integration/Security Test Suites (`apps/api` Jest + Supertest, `apps/web` Vitest).
7. Runs `next build` and `nest build` to verify zero production build errors.

### 2.2 Scheduled Background Jobs (`scheduled-jobs.yml`)
Replaces paid 24/7 Redis worker dynos at **$0 cost**:
- **Job A — End-of-Day Attendance Reconciliation:**
  - Cron: `'55 20 * * *'` (`20:55 UTC` = **`23:55 EAT`** `Africa/Kampala`).
  - Action: `curl -f -X POST "$API_BASE_URL/api/v1/internal/jobs/reconcile-attendance" -H "X-Cron-Secret: $CRON_SHARED_SECRET"`.
- **Job B — Daily Lifecycle Transitions (Vacancies, Exits, Delegations):**
  - Cron: `'5 21 * * *'` (`21:05 UTC` = **`00:05 EAT`** `Africa/Kampala`).
  - Action: `curl -f -X POST "$API_BASE_URL/api/v1/internal/jobs/process-daily-transitions" -H "X-Cron-Secret: $CRON_SHARED_SECRET"`.
- *(Include `workflow_dispatch` on both so you can trigger them manually during testing or demos.)*

---

## 3. $0 Cloud Production / Live Demo Deployment Playbook

Deploy in this exact order—requiring **zero credit cards**:

### Step 1: PostgreSQL Database on **Neon** ($0 Free Tier)
1. Create project `staffhub-prod` in Neon (select nearest region, e.g., `eu-central-1` / Frankfurt for lowest latency to East Africa).
2. Copy **Pooled Connection String** $\rightarrow$ `DATABASE_URL` and **Direct Connection String** $\rightarrow$ `DIRECT_URL`.
3. Enable `pgcrypto` and `btree_gist` extensions in Neon SQL Editor (or inside initial Prisma migration).

### Step 2: Private File Storage on **Cloudflare R2** (10 GB Free) or **Supabase Storage** (1 GB Free)
1. Create a **private** bucket named `staffhub-private` (do NOT enable public bucket access).
2. Generate S3-compatible API Access Key & Secret Key + Endpoint URL.

### Step 3: Transactional Email on **Brevo** (300/day Free) or **Resend** (100/day Free)
1. Create free account, generate SMTP credentials (or API key), and configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.

### Step 4: Bot Protection on **Cloudflare Turnstile** ($0 Free)
1. Register domain (including Vercel URL + `localhost` for testing) and copy `Site Key` (Frontend) + `Secret Key` (Backend).

### Step 5: NestJS Backend on **Render** ($0 Free Web Service)
1. Connect GitHub repository, set build command (`npm ci && npm run build --workspace=apps/api && npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma`).
2. Start command: `node dist/main`.
3. Configure all Backend Environment Variables (`NODE_ENV=production`, `TZ=Africa/Kampala`, `DEMO_MODE=true` for live presentation / `false` for strict production, `CORS_ORIGIN=https://<your-vercel-domain>.vercel.app`, generated 64-hex secrets for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PII_ENCRYPTION_KEY`, `CRON_SHARED_SECRET`).
4. Note Render Free Tier behavior: Sleeps after 15 minutes of inactivity (~30–60s cold wake-up on first call); frontend `<ServerWakeupBanner />` handles this cleanly.

### Step 6: Next.js Frontend on **Vercel** ($0 Hobby Tier)
1. Connect GitHub repository, set Root Directory `apps/web`.
2. Set `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com/api/v1`, `NEXT_PUBLIC_APP_TIMEZONE=Africa/Kampala`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_DEMO_MODE`.
3. Deploy and verify `/login` and `/careers` over HTTPS.

### Step 7: Wire GitHub Repository Secrets
Add `API_BASE_URL` and `CRON_SHARED_SECRET` to **GitHub Actions Secrets** so the `23:55 EAT` and `00:05 EAT` cron workflows execute automatically.

---

## 4. Friend Presentation & Handoff Playbook

Since **you** are building the system and **your friend** is presenting it, never rely on sending a raw un-containerized ZIP folder. Follow this **3-Tier Handoff Protocol**:

### Tier 1 (Primary Demo Method): Live Cloud URL
1. Send your friend the live Vercel URL (`https://...vercel.app`), `/careers` link, and the seeded demo credentials table.
2. **Mandatory 5-Minute Pre-Demo Warm-Up:** Your friend opens the live URL **5 minutes before** their presentation slot (and clicks one login/careers link) so Render’s backend and Neon’s database wake up completely before evaluators watch.
3. Verify `DEMO_MODE=true` is active for effortless role switching on `/login` during the demo.

### Tier 2 (Offline Backup): Dockerized ZIP Package
In case presentation venue Wi-Fi fails:
1. Install **Docker Desktop** on your friend's laptop at least **2 days before** the presentation.
2. Zip the clean repository (**excluding** `node_modules`, `.next`, `dist`, and personal `.env`—keeping `.env.docker.example`, `docker-compose.yml`, and `scripts/start-staffhub.*`).
3. Test extracting and double-clicking `start-staffhub.bat` (or `.sh`) on his actual laptop beforehand, confirming `http://localhost:3000` loads with seeded data and Mailpit works at `http://localhost:8025` completely offline (disconnect Wi-Fi to prove it!).

### Tier 3 (Emergency Fail-Safe): Recorded Walkthrough Video
1. Record a crisp 3-minute `1080p` screen capture walking through the complete storyline below so even a projector/laptop failure cannot derail the presentation.

---

## 5. Presenter's 5-Minute Live Demo Script (Aligned to StaffHub Guide Section 5)

1. **Public Careers (`/careers` — No Account):** Browse `#VAC-2026-045`, explain `Africa/Kampala` closing cutoff, test duplicate email block (`amina.nabakooza@outbox.co.ug` on `#VAC-2026-042`).
2. **Recruiter & HR Conversion (`/recruitment`):** Sign in (or switch) to `HR Manager` (**Julius Okello**), open `#VAC-2026-042`, click Accepted Candidate **Amina Nabakooza**, and trigger **1-Click `Convert to Employee`** (zero re-typing, creates 4-role onboarding checklist).
3. **Employee Daily Ops (`/home` & `/leave`):** Switch to `Employee` (**Brian Kato**). Show live `EAT` clock (zero biometrics/GPS!), click **`Check In Now`**, acknowledge assigned MacBook `#AST-088`, reveal masked Net Pay (`UGX 3,239,250`), and preview Leave Working-Day calculation excluding weekends & Ugandan public holidays.
4. **Line Manager Privacy (`/manager`):** Switch to `Line Manager` (**Michael Kigozi**). Approve a team leave/correction request, and point out explicitly that **salary, bank account, and NIN columns are completely hidden**.
5. **Payroll & QR Verification (`/payroll`):** Switch to `Payroll Officer` (**Sarah Namubiru**). Open Locked October Payroll (`PR-UG-2026-10`), demonstrate that direct editing is blocked (`Authorised Adjustment` required with mandatory reason), preview Brian Kato's PDF payslip, and open its QR Verification link (`/verify/...`).
6. **Asset Blocker & Offboarding (`/assets` & `/hr/offboarding`):** Switch to `HR Manager` and show exiting employee **Denis Mukasa** blocked from account deactivation by unreturned `#AST-064`; switch to `Asset Officer` (**Joseph Mukasa**), record return of `#AST-064`, then show HR's clearance progress unlock cleanly!
7. **System Admin & Audit Trail (`/audit`):** Switch to `System Admin` (**Raymond Mugisha**) and show every approval, rejection reason, bank change, and asset return permanently logged in `Africa/Kampala` time.