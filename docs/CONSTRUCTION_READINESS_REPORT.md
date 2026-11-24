# StaffHub Construction Readiness Report

## Decision

StaffHub has a partial application implementation with several usable workflow slices.

This report does not claim operational payroll approval, production launch approval, or that every HR workflow is implemented.

## Construction gates passed

| Gate | Evidence |
| :--- | :--- |
| Monorepo baseline | npm workspaces, Node 22.22.3 pin, strict TypeScript, lint, tests, and builds are configured. |
| Construction command | `npm run check:construction` passes: Prisma validation, ESLint, shared/API/web TypeScript checks, 37 tests, and API/web production builds, including `/offer-response`. |
| Fresh PostgreSQL migration replay | All 3 migrations applied successfully to an isolated PostgreSQL 18 database. |
| Identity database constraints | `scripts/check-db-constraints.sql` passes transactionally. |
| Phase 2 database constraints | `scripts/check-phase2-db.sql` passes transactionally on clean and seeded databases. |
| Demo seed replay | `npm run db:seed` passed repeatedly against isolated PostgreSQL with external, synthetic credentials. |
| Dependency audit | `npm audit --omit=dev` reports zero vulnerabilities. |
| Docker Compose | Not executable in the current environment because Docker CLI is not installed; compose startup remains unverified here. |
| CI database coverage | GitHub Actions runs PostgreSQL 16, both constraint fixtures, demo seeding, lint, typecheck, tests, builds, and Docker Compose startup. |
| Repository integrity | `git diff --check` passes. |

## Implemented application slices

Current working tree includes session refresh, protected routes, self-service profile and payslips, live HR and manager dashboards, attendance and corrections, leave requests and approvals, employee directory, recruitment intake and pipeline, role-scoped four-party onboarding checklists with account setup invitations, asset issue/return, offboarding clearance, account/schedule/holiday administration, role-scoped audit review, private CV storage, and public application verification. Automated tests cover foundational schemas and representative API/web behavior; full end-to-end acceptance coverage remains outstanding.

Payroll run creation, edits, submission, approval, and locking return `PAYROLL_CALCULATOR_NOT_CONFIGURED`. The current arithmetic is synthetic and must not create payroll outputs.

## Authentication foundation

- Shared Zod login, password, forgot-password, and reset-password contracts.
- Argon2id password hashing with the documented cost parameters.
- JWT access-token payload and 15-minute expiry.
- 64-byte opaque rotating refresh tokens, SHA-256 storage, cookie delivery, and family reuse detection.
- Exact-Origin enforcement and cookie-bound HMAC-SHA-256 CSRF tokens.
- Forced password-change temporary tokens.
- Brute-force lockout and account-deactivation checks.
- JWT authentication guard and role guard.
- Login, CSRF bootstrap, refresh, logout, change-password, forgot-password, reset-password, and `/auth/me` endpoints.
- Demo seed password storage migrated from test-only Scrypt format to Argon2id.
- Employee self-service read and contact update endpoints.
- Strict mass-assignment rejection with HTTP 400 Zod validation responses.
- SMTP/Mailpit password-reset delivery wiring.
- Database-backed HTTP smoke verification for login, `/auth/me`, refresh rotation, reuse detection, and employee contact updates.
- Leave working-day, holiday, half-day, cross-year, balance, overlap, approval, rejection, cancellation, and attendance side-effect implementation.

## Resolved readiness defects

- Identity constraint fixture now supplies the required `work_email`.
- Phase 2 fixture is isolated from seeded tax-policy and payroll periods.
- Locked payroll items can be seeded and rerun safely.
- Prisma validation/generation now work without requiring a live database URL.
- CI verifies the demo seed with ephemeral credentials rather than committed credentials.
- CI verifies production dependency vulnerabilities.

## Remaining construction backlog

Construction should proceed in this order:

1. Finish recruitment workflows: panel interview scheduling/scoring and requisition headcount tracking remain incomplete. Offer approval, candidate email decisions, and onboarding conversion invitations are implemented.
2. Implement reviewed and tested payroll calculations before enabling payroll transitions.
3. Complete payslip, formal offer PDF, clearance, and report generation/delivery.
4. Implement policy-approved leave rollover and durable, idempotent outbox handlers. Daily attendance reconciliation, vacancy closing, and due offboarding deactivation are implemented.
5. Add comprehensive database-backed integration and end-to-end lifecycle/security tests.
6. Validate deployment, observability, recovery, secrets, and CI against the selected production host.

## External approval gates

The following are not code blockers for construction but are mandatory before operational use:

- Qualified approval of Uganda statutory payroll rules and effective-dated policies.
- Privacy/legal approval of employee and applicant retention, deletion/anonymization, encrypted PII handling, and key custody.
- Provider and hosting security, backup, residency, availability, and cost approval.
- PostgreSQL 16 and Docker Compose hosted execution.

## Explicit non-goal

The repository contains implemented application workflows but is not an operational HRMS or production-deployment approval. Payroll remains disabled; deployment and full database-backed end-to-end acceptance remain unverified.
