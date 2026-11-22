# 09 — StaffHub DevOps, Deployment & Presenter Handoff Guide

## 1. Local Container Architecture (`docker-compose.yml`)

Containerizing StaffHub makes the local environment reproducible. The Compose project runs five long-lived services plus the one-shot `minio-init` setup job:

| Service Name | Image / Build | Internal Port | Exposed Host Port | Responsibility |
| :--- | :--- | :---: | :---: | :--- |
| **`postgres`** | `postgres:16-alpine` | `5432` | `127.0.0.1:5432` | Primary relational database (persistent named volume `pgdata`). Healthchecked via `pg_isready`. |
| **`minio`** | `minio/minio:latest` | `9000` / `9001` | `127.0.0.1:9000` / `127.0.0.1:9001` | Local S3-compatible private object storage for future file workflows (Console UI on `:9001`). Includes automatic bucket-creation init step (`staffhub-private`). |
| **`minio-init`** | `minio/mc:latest` | — | — | One-shot idempotent creation of the private `staffhub-private` bucket after MinIO starts. |
| **`mailpit`** | `axllent/mailpit:latest` | `1025` / `8025` | `127.0.0.1:1025` / `127.0.0.1:8025` | Local SMTP catch-all server + browser inbox (`http://localhost:8025`). |
| **`api`** | `./apps/api/Dockerfile` | `4000` | `127.0.0.1:4000` | NestJS scaffold. Compose command applies the checked-in initial migration before starting. Domain seed data is not implemented yet; no seed runs automatically. |
| **`web`** | `./apps/web/Dockerfile` | `3000` | `127.0.0.1:3000` | Next.js scaffold served at `http://localhost:3000`. |

### 1.1 One-Click Offline Startup Scripts (`scripts/`)
- **`scripts/start-staffhub.bat` (Windows)** and **`scripts/start-staffhub.sh` (macOS / Linux)**:
  1. Checks that Docker Desktop is running (prints clear human instruction if stopped).
  2. Copies `.env.docker.example` to `.env.docker` if missing (pre-configured with local-only values for `postgres`, `minio`, and `mailpit`; `DEMO_MODE` remains false). This stays separate from the host-development `.env`.
  3. Runs `docker compose --env-file .env.docker up --build -d`.
  4. Polls `http://localhost:4000/api/v1/health` until `200 OK` (the initial migration has been applied; the scaffold does not seed demo data).
  5. Prints exact URLs and opens `http://localhost:3000` in the default browser.

---

## 2. GitHub Actions CI & Automated Cron Specifications (`.github/workflows/`)

### 2.1 Continuous Integration (`ci.yml`)
Runs on every `push` and `pull_request`:
1. Spins up ephemeral `postgres:16` service container.
2. Runs `npm ci`.
3. Generates and validates the Prisma client/schema, then applies the initial migration.
4. Validates the Compose manifest with `docker compose config`.
5. Runs ESLint and TypeScript checks across the workspaces.
6. Runs the current shared/API/web smoke tests. Expand these with the specified business, integration, and security suites as each domain module is implemented.
7. Builds the shared package, NestJS API, and Next.js app.

### 2.2 Future Scheduled Background Jobs
The following schedules are requirements for a later phase; do not enable a scheduler until each API job handler and its idempotency/security tests have been implemented. Use a scheduler that meets required latency and availability; hosted schedules and quotas are provider-dependent and must be verified:
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
1. Connect the GitHub repository. Build with `npm ci`, `npm run db:generate`, `npm run build --workspace=@staffhub/shared`, and `npm run build --workspace=@staffhub/api`; apply migrations as a release step with `npm run db:migrate`.
2. Start command: `npm run start:prod --workspace=@staffhub/api`.
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
2. Zip the clean repository (**excluding** `node_modules`, `.next`, `dist`, and personal `.env` / `.env.docker` files—keeping `.env.docker.example`, `docker-compose.yml`, and `scripts/start-staffhub.*`).
3. Test extracting and double-clicking `start-staffhub.bat` (or `.sh`) on the actual laptop beforehand. The Phase 1 scaffold starts without seeded users or demo records; do not promise a synthetic demo login until its isolated seed and auth flow are implemented.

### Tier 3 (Emergency Fail-Safe): Recorded Walkthrough Video
1. Record a crisp 3-minute `1080p` screen capture walking through the complete storyline below so even a projector/laptop failure cannot derail the presentation.

---

## 5. Future Presenter Demo Flow (Aligned to StaffHub Guide Section 5)

The following is a target workflow, not a capability of the Phase 1 scaffold. Authentication, seeded demo users, and the domain modules must be implemented and verified before presenting these steps as live functionality.

1. **Public Careers (`/careers` — No Account):** Browse `#VAC-2026-045`, explain `Africa/Kampala` closing cutoff, and test duplicate email blocking with synthetic addresses.
2. **Recruiter & HR Conversion (`/recruitment`):** Sign in (or switch) to `HR Manager` (**Julius Okello**), open `#VAC-2026-042`, click Accepted Candidate **Amina Nabakooza**, and trigger **1-Click `Convert to Employee`** (zero re-typing, creates 4-role onboarding checklist).
3. **Employee Daily Ops (`/home` & `/leave`):** Sign in as the synthetic Employee (**Brian Kato**). Show the fixed demo clock (zero biometrics/GPS), check in on the configured demo workday, acknowledge assigned MacBook `#AST-088`, reveal a masked illustrative payslip, and preview the Leave Working-Day calculation excluding weekends and Ugandan public holidays.
4. **Line Manager Privacy (`/manager`):** Switch to `Line Manager` (**Michael Kigozi**). Approve a team leave/correction request, and point out explicitly that **salary, bank account, and NIN columns are completely hidden**.
5. **Payroll & QR Verification (`/payroll`):** Sign in as the synthetic Payroll Officer (**Sarah Namubiru**). Open the test-only illustrative October payroll, demonstrate that direct editing is blocked (`Authorised Adjustment` requires a reason), and preview its clearly labeled demo PDF and verification flow.
6. **Asset Blocker & Offboarding (`/assets` & `/hr/offboarding`):** Switch to `HR Manager` and show exiting employee **Denis Mukasa** blocked from account deactivation by unreturned `#AST-064`; switch to `Asset Officer` (**Joseph Mukasa**), record return of `#AST-064`, then show HR's clearance progress unlock cleanly!
7. **System Admin & Audit Trail (`/audit`):** Switch to `System Admin` (**Raymond Mugisha**) and show every approval, rejection reason, bank change, and asset return permanently logged in `Africa/Kampala` time.