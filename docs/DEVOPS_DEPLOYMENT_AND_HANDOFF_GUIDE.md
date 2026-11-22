# 09 — StaffHub DevOps, Deployment & Presenter Handoff Guide

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
  2. Copies `.env.docker.example` to `.env` if missing (pre-configured for local `postgres`, `minio`, and `mailpit`; demo mode is enabled only with the isolated synthetic-data database).
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
Use a scheduler that meets required latency and availability; hosted schedules and free quotas are provider-dependent and must be verified:
- **Job A — End-of-Day Attendance Reconciliation:**
  - Cron: `'55 20 * * *'` (`20:55 UTC` = **`23:55 EAT`** `Africa/Kampala`).
  - Action: `curl -f -X POST "$API_BASE_URL/api/v1/internal/jobs/reconcile-attendance" -H "X-Cron-Secret: $CRON_SHARED_SECRET"`.
- **Job B — Daily Lifecycle Transitions (Vacancies, Exits, Delegations):**
  - Cron: `'5 21 * * *'` (`21:05 UTC` = **`00:05 EAT`** `Africa/Kampala`).
  - Action: `curl -f -X POST "$API_BASE_URL/api/v1/internal/jobs/process-daily-transitions" -H "X-Cron-Secret: $CRON_SHARED_SECRET"`.
- **Job C — Annual Leave Balance Rollover:**
  - Cron: `'1 21 31 12 *'` (`21:01 UTC` on 31 Dec = **`00:01 EAT`** on 1 Jan).
  - Action: call `/api/v1/internal/jobs/rollover-leave-balances`.
- **Job D — Async Outbox:**
  - Cron: `'*/5 * * * *'`; call `/api/v1/internal/jobs/process-async-outbox` to claim and process durable work. Use an always-on worker instead where five-minute latency is not acceptable.
- Include `workflow_dispatch` for test environments only. Never expose cron secrets in logs; use secret-manager variables and fail the workflow on non-2xx responses.

---

## 3. Cloud Production / Isolated Demo Deployment Playbook

Provider setup below is illustrative; availability, pricing, service limits, and terms change. Confirm them before selecting or deploying a provider. Production and demo deployments must use separate databases and secrets.

### Step 1: Managed PostgreSQL
1. Select a provider and region after reviewing residency, backup/restore, connection limits, availability, and total cost.
2. Configure `DATABASE_URL` and `DIRECT_URL` with least-privilege credentials.
3. Enable required PostgreSQL extensions through versioned migrations and verify them in CI.

### Step 2: Private File Storage
1. Create a **private** bucket named `staffhub-private` (do NOT enable public bucket access).
2. Generate S3-compatible API Access Key & Secret Key + Endpoint URL.

### Step 3: Transactional Email
1. Select a provider, configure sender-domain authentication, and set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` from the secret manager.

### Step 4: Bot Protection
1. Register the actual frontend origins and local test origin; configure the public `Site Key` and private backend `Secret Key` separately.

### Step 5: NestJS Backend
1. Connect GitHub repository, set build command (`npm ci && npm run build --workspace=apps/api && npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma`).
2. Start command: `node dist/main`.
3. Configure `NODE_ENV=production`, `TZ=Africa/Kampala`, `DEMO_MODE=false`, exact `CORS_ORIGIN`, and independently generated secrets for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_HMAC_SECRET`, `PII_ENCRYPTION_KEY`, and `CRON_SHARED_SECRET`. Prefer app/API HTTPS origins under the same registrable domain and `SameSite=Lax; Secure`; cross-site refresh cookies require `SameSite=None; Secure`, exact-Origin plus CSRF checks, and supported-browser verification for third-party-cookie restrictions.
4. Do not enable the demo-login endpoint or seed demo accounts/data in production. Production startup must fail if demo mode or a demo clock is enabled.

### Step 6: Next.js Frontend
1. Connect GitHub repository, set Root Directory `apps/web`.
2. Set `NEXT_PUBLIC_API_URL=https://<your-api-domain>/api/v1`, `NEXT_PUBLIC_APP_TIMEZONE=Africa/Kampala`, and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Do not use a public frontend flag to enable privileged demo behavior.
3. Deploy and verify `/login` and `/careers` over HTTPS.

### Step 7: Wire Scheduler Secrets
Add `API_BASE_URL` and `CRON_SHARED_SECRET` to the scheduler's secret manager so attendance, lifecycle, rollover, and outbox jobs execute. Use unique secrets per environment, and verify current scheduler quotas and delivery guarantees.

### Step 8: Production Readiness Gate
Before any real HR or payroll data is processed, complete privacy/retention review, verify statutory payroll rules against official current sources, approve the effective-dated policy through the separate reviewer workflow, and test backup restore and incident response. The repository's provisional tax figures and mockups are not operational authority.

---

## 4. Friend Presentation & Handoff Playbook

Since **you** are building the system and **your friend** is presenting it, never rely on sending a raw un-containerized ZIP folder. Follow this **3-Tier Handoff Protocol**:

### Tier 1 (Primary Demo Method): Isolated Demo Environment
1. Share only a demo deployment backed by a separate synthetic-data database and unique demo credentials delivered out of band.
2. Verify its clock, role permissions, private storage, and scheduler behavior before presenting. Provider wake-up/cold-start guarantees vary.
3. Never enable demo login or role switching in production; sign in using the appropriate synthetic account.

### Tier 2 (Offline Backup): Dockerized ZIP Package
In case presentation venue Wi-Fi fails:
1. Install **Docker Desktop** on your friend's laptop at least **2 days before** the presentation.
2. Zip the clean repository (**excluding** `node_modules`, `.next`, `dist`, and personal `.env`—keeping `.env.docker.example`, `docker-compose.yml`, and `scripts/start-staffhub.*`).
3. Test extracting and double-clicking `start-staffhub.bat` (or `.sh`) on his actual laptop beforehand, confirming `http://localhost:3000` loads with seeded data and Mailpit works at `http://localhost:8025` completely offline (disconnect Wi-Fi to prove it!).

### Tier 3 (Emergency Fail-Safe): Recorded Walkthrough Video
1. Record a crisp 3-minute `1080p` screen capture walking through the complete storyline below so even a projector/laptop failure cannot derail the presentation.

---

## 5. Presenter's 5-Minute Live Demo Script (Aligned to StaffHub Guide Section 5)

1. **Public Careers (`/careers` — No Account):** Browse `#VAC-2026-045`, explain `Africa/Kampala` closing cutoff, and test duplicate email blocking with synthetic addresses.
2. **Recruiter & HR Conversion (`/recruitment`):** Sign in (or switch) to `HR Manager` (**Julius Okello**), open `#VAC-2026-042`, click Accepted Candidate **Amina Nabakooza**, and trigger **1-Click `Convert to Employee`** (zero re-typing, creates 4-role onboarding checklist).
3. **Employee Daily Ops (`/home` & `/leave`):** Sign in as the synthetic Employee (**Brian Kato**). Show the fixed demo clock (zero biometrics/GPS), check in on the configured demo workday, acknowledge assigned MacBook `#AST-088`, reveal a masked illustrative payslip, and preview the Leave Working-Day calculation excluding weekends and Ugandan public holidays.
4. **Line Manager Privacy (`/manager`):** Switch to `Line Manager` (**Michael Kigozi**). Approve a team leave/correction request, and point out explicitly that **salary, bank account, and NIN columns are completely hidden**.
5. **Payroll & QR Verification (`/payroll`):** Sign in as the synthetic Payroll Officer (**Sarah Namubiru**). Open the test-only illustrative October payroll, demonstrate that direct editing is blocked (`Authorised Adjustment` requires a reason), and preview its clearly labeled demo PDF and verification flow.
6. **Asset Blocker & Offboarding (`/assets` & `/hr/offboarding`):** Switch to `HR Manager` and show exiting employee **Denis Mukasa** blocked from account deactivation by unreturned `#AST-064`; switch to `Asset Officer` (**Joseph Mukasa**), record return of `#AST-064`, then show HR's clearance progress unlock cleanly!
7. **System Admin & Audit Trail (`/audit`):** Switch to `System Admin` (**Raymond Mugisha**) and show every approval, rejection reason, bank change, and asset return permanently logged in `Africa/Kampala` time.