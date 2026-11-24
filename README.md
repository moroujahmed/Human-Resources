# StaffHub

StaffHub is a proposed web-based HRMS for Uganda, using UGX and the `Africa/Kampala` time zone. Its requirements cover recruitment, onboarding, employee records and performance, attendance, leave, payroll, assets, and offboarding.

## Project status

Phase 0 specifications and the formal audit are in [`docs/PHASE_0_COMPLETION_AUDIT.md`](docs/PHASE_0_COMPLETION_AUDIT.md). Phase 1 adds a runnable monorepo scaffold: Next.js web app, NestJS API with exact-origin CORS and Helmet headers, shared Zod contracts, an initial Prisma identity/session schema, Docker Compose services, CI, and smoke tests. See the [Phase 1 completion audit](docs/PHASE_1_COMPLETION_AUDIT.md) for validation evidence and remaining limits. Phase 2 adds the PostgreSQL domain migration and isolated synthetic demo seed; see the [Phase 2 completion audit](docs/PHASE_2_COMPLETION_AUDIT.md).

The repository now includes working slices for authentication/session refresh, self-service, attendance, leave, employee directory, recruitment, performance reviews, assets, offboarding, administration, and audit review. See the [construction readiness report](docs/CONSTRUCTION_READINESS_REPORT.md) for verified checks, remaining implementation gaps, and external approval gates.

This is **not a complete or production-ready HRMS**. Payroll processing is deliberately blocked until reviewed statutory rules and a verified calculator are implemented. Recruitment requisition cancellation, vacancy closure/headcount fill tracking, interview scheduling/panel reviews, offer approval, candidate email decisions, conversion, and onboarding invitations are implemented; formal document generation, durable workers, database-backed end-to-end acceptance, deployment configuration, and legal/privacy approvals remain incomplete. The synthetic seed is for local development only.

## Development setup

The selected implementation conventions are:

- npm workspaces with a committed `package-lock.json`
- Node.js 22.22.3 or later in the 22.x LTS line
- TypeScript with strict type checking
- Next.js / React frontend and NestJS modular-monolith API
- PostgreSQL with Prisma migrations
- Canonical shared Zod schemas in `packages/shared`
- Local Docker development with PostgreSQL, MinIO, and Mailpit

1. Install Node.js 22.22.3 or later in the 22.x LTS line and npm 10 or later.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` for host development. Values in the example are placeholders/local-only; generate independent secrets before running the API. `NEXT_PUBLIC_API_URL` is the API origin only; the client adds `/api/v1`.
4. Run `npm run dev` to start the web app and API in watch mode. The API requires PostgreSQL for application workflows; Docker Compose applies migrations and starts the local services.
5. To start PostgreSQL, MinIO, and Mailpit with the apps, run `scripts/start-staffhub.bat` on Windows or `scripts/start-staffhub.sh` on macOS/Linux. The script creates a separate local `.env.docker`, runs the identity migrations, and opens the web app. No demo accounts or seed records are created.

Useful checks: `npm test`, `npm run lint`, `npm run typecheck`, `npm run db:validate`, and `npm run build`. Applying migrations with `npm run db:migrate` requires a reachable PostgreSQL instance and a valid `DATABASE_URL`.

Read the [project charter and tech stack](docs/PROJECT_CHARTER_AND_TECH_STACK.md) first, then the [database schema](docs/DATABASE_SCHEMA_AND_CONSTRAINTS.md), [API contract](docs/API_CONTRACT_AND_SECURITY_SPEC.md), [workflow specification](docs/WORKFLOW_STATE_MACHINES_AND_CRONS.md), and [testing and seed specification](docs/TESTING_QA_AND_SEED_DATA_SPEC.md).

## Important implementation gates

- Verify payroll rates and statutory rules against current official sources and approve an effective-dated policy before operational payroll. Numeric tax examples are test fixtures, not legal or payroll authority.
- Obtain privacy/legal review and approve retention and deletion/anonymization schedules before storing real applicant or employee data.
- Keep demo mode and synthetic seed data isolated from production. Never commit credentials or secrets.
- Treat files under `docs/staffhub-stitch-input/` as historical visual references only. Their HTML/PNG content is not canonical behavior or production-ready UI.
- Hosting providers, service quotas, availability, and pricing are deployment choices that must be revalidated.
- The initial Prisma migrations cover identity/session foundations only, including employee links, refresh tokens, and password-reset tokens. They do not implement the complete documented data model.
- CI currently checks the scaffold, database constraints, and Docker Compose startup. Add domain and security tests alongside each implemented workflow; see the acceptance matrix in the testing specification.
- The local MinIO container is built from a pinned upstream source revision for development only. MinIO Community is source-only and no longer maintained upstream; review its AGPL-3.0 obligations and choose a supported storage service before distributing or using it with real data.
