# StaffHub

StaffHub is a proposed web-based HRMS for Uganda, using UGX and the `Africa/Kampala` time zone. Its requirements cover recruitment, onboarding, employee records and performance, attendance, leave, payroll, assets, and offboarding.

## Project status

This repository currently contains product, architecture, API, database, workflow, testing, deployment, and UI-reference documentation. It does **not** yet contain the application, database migrations, package manifests, CI workflows, or executable tests. The project is therefore a specification baseline, not a runnable application.

## Start implementation

The selected implementation conventions are:

- npm workspaces with a committed `package-lock.json`
- Node.js 22 LTS
- TypeScript with strict type checking
- Next.js / React frontend and NestJS modular-monolith API
- PostgreSQL with Prisma migrations
- Canonical shared Zod schemas in `packages/shared`
- Local Docker development with PostgreSQL, MinIO, and Mailpit

Read the [project charter and tech stack](docs/PROJECT_CHARTER_AND_TECH_STACK.md) first, then the [database schema](docs/DATABASE_SCHEMA_AND_CONSTRAINTS.md), [API contract](docs/API_CONTRACT_AND_SECURITY_SPEC.md), [workflow specification](docs/WORKFLOW_STATE_MACHINES_AND_CRONS.md), and [testing and seed specification](docs/TESTING_QA_AND_SEED_DATA_SPEC.md).

## Important implementation gates

- Verify payroll rates and statutory rules against current official sources and approve an effective-dated policy before operational payroll. Numeric tax examples are test fixtures, not legal or payroll authority.
- Obtain privacy/legal review and approve retention and deletion/anonymization schedules before storing real applicant or employee data.
- Keep demo mode and synthetic seed data isolated from production. Never commit credentials or secrets.
- Treat files under `docs/staffhub-stitch-input/` as historical visual references only. Their HTML/PNG content is not canonical behavior or production-ready UI.
- Hosting providers, service quotas, availability, and pricing are deployment choices that must be revalidated.

No application setup or run command is available until the implementation bootstrap is added.
