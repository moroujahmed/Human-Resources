# 00 — StaffHub Project Charter, Architecture & Complete Technology Stack

## 1. Executive Charter & System Identity

- **Project Name:** StaffHub
- **System Type:** Web-Based Human Resource Management System (HRMS)
- **Target Geography & Localization:** Uganda (`UGX` currency, `Africa/Kampala` / `EAT` `UTC+3` time zone)
- **Supported Platforms:** Responsive web browser application across Desktop (`>= 1024px`), Tablet (`768px – 1023px`), and Mobile (`< 768px`)
- **Explicit Hardware Exclusions:** **Zero biometric devices** (no fingerprint, iris, or facial hardware integrations) and **zero GPS tracking** (no browser geolocation prompts, coordinate storage, or location maps).
- **Lifecycle Scope:** Unifies 8 interconnected organizational processes into a single source of truth:
  1. Recruitment & Public Job Applications (no applicant login required)
  2. Hiring & Multi-Role Onboarding Checklists
  3. Employee Records & HR-Approved Sensitive Profile Changes
  4. Web-Based Daily Attendance (Check-In/Check-Out & Correction Requests)
  5. Leave Management (Working-Day & Ugandan Holiday Calculations)
  6. Monthly Payroll (UGX, Statutory PAYE/NSSF/LST Deductions, Approvals, Locking, Adjustments, Payslips)
  7. Company Asset Inventory, Single-Assignee Custody & Employee Acknowledgement
  8. Offboarding Clearance, Hard Blockers & Soft Account Deactivation

---

## 2. Architectural Style: Modular Monolith

StaffHub MUST be implemented as a **Modular Monolith** (single Next.js frontend application + single NestJS backend API + single PostgreSQL database), **not** microservices.

### Why Modular Monolith (and Why Unified TypeScript Over Dual Go + Node.js)
1. **Atomic Cross-Domain Transactions:** Converting an accepted job applicant into an employee, deducting approved leave balances while updating attendance records, and locking payroll depend on strict ACID database transactions across modules. A monolith guarantees atomic commits and rollbacks without distributed saga complexity.
2. **Single-Language Type Safety:** Standardizing the backend on **TypeScript + Node.js (NestJS)** rather than running an additional **Go** service eliminates duplicate runtime memory usage on `$0` free-tier hosting containers and allows exact sharing of Zod validation schemas, enums, and formatting constants between frontend and backend via `packages/shared`.
3. **Clean Internal Module Boundaries:** Even inside one NestJS deployment, domain modules (`auth`, `audit`, `recruitment`, `employees`, `attendance`, `leave`, `payroll`, `assets`, `offboarding`, `admin`, `notifications`, `storage`, `jobs`) communicate only through exported NestJS services—never by bypassing another module's business rules.

---

## 3. Complete Technology Stack Manifest

Every programming language, runtime, framework, database, library, and infrastructure tool required to build, test, containerize, and deploy StaffHub at **$0 cost**:

### 3.1 Programming Languages & Markup
| Language / Format | Version / Standard | Role in System |
| :--- | :--- | :--- |
| **TypeScript** | `5.6+` (`strict: true`) | Primary language across Frontend (`apps/web`), Backend (`apps/api`), Shared Contracts (`packages/shared`), Seeds, and Automated Tests. `any` type is strictly forbidden (`@typescript-eslint/no-explicit-any: error`). |
| **SQL (PostgreSQL Dialect)** | PostgreSQL `16` | Database migrations, partial unique indexes, `CHECK` constraints, functional case-insensitive indexes, and analytical reporting queries. |
| **HTML5 / JSX & CSS3** | HTML5 / Tailwind CSS | Accessible semantic markup and utility styling compiled via Tailwind CSS. |
| **YAML** | `1.2` | `docker-compose.yml`, GitHub Actions CI/CD & cron workflows, and `DESIGN.md` token headers. |
| **Shell (`bash`) & Windows Batch (`.bat`)** | POSIX / CMD | One-command local startup scripts (`start-staffhub.sh`, `start-staffhub.bat`) for offline presentation handoff. |

### 3.2 Frontend Stack (`apps/web`)
| Technology / Package | Purpose & Exact Responsibility |
| :--- | :--- |
| **Next.js (App Router)** | `15.x` — Routing, SSR/CSR hybrid rendering, environment configuration, and static asset optimization. |
| **React** | `19.x` — Component UI library. |
| **Tailwind CSS + PostCSS + Autoprefixer** | Utility-first styling configured strictly to `DESIGN.md` Savannah Editorial tokens (`#F5F3EE`, `#FFFFFF`, `#ECE8DF`, `#161513`, `#0B4F4E`, `#B85028`, `#D49B42`). |
| **Google Fonts (`next/font/google`)** | Loads `Bricolage Grotesque` (headings), `Inter` (body/UI), and `JetBrains Mono` (tabular currency, IDs, EAT clocks). |
| **TanStack Query (`@tanstack/react-query`)** | Server-state caching, automatic cache invalidation on approvals/mutations, optimistic UX feedback, and clean loading/error states (including Render cold-start wake-up indicator). |
| **TanStack Table (`@tanstack/react-table`)** | Sortable, filterable, paginated high-density tables (Payroll Run, Asset Registry, Audit Trail, Direct Reports). |
| **React Hook Form + `@hookform/resolvers`** | Performant controlled forms with schema validation shared from `packages/shared`. |
| **Zod** | Client-side validation mirroring server DTO validation (instant inline errors for duplicate email, overlapping dates, mandatory rejection reasons). |
| **Luxon (`luxon`)** | Strictly enforces `Africa/Kampala` (`UTC+3`) time zone formatting, live EAT clock display, and date math previews. |
| **Decimal.js (`decimal.js`)** | Exact decimal previews in forms (zero JavaScript floating-point math). |
| **Lucide React (`lucide-react`)** | Crisp architectural vector icons (zero broken external image dependencies; brand logo uses inline SVG `S` monogram). |
| **Cloudflare Turnstile React Widget** | Free invisible/managed bot protection on the unauthenticated Public Careers Application form. |

### 3.3 Backend Stack (`apps/api`)
| Technology / Package | Purpose & Exact Responsibility |
| :--- | :--- |
| **Node.js** | `22 LTS` (minimum `20 LTS`) — Server runtime. |
| **NestJS (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`)** | Modular Monolith REST framework providing Dependency Injection, Guards (`JwtAuthGuard`, `RolesGuard`), Pipes (`ValidationPipe`), Interceptors (`AuditInterceptor`), and Exception Filters. |
| **Prisma ORM (`prisma`, `@prisma/client`)** | Type-safe database client, declarative schema, versioned SQL migrations (`prisma migrate`), and `$transaction` support for atomic state transitions. |
| **Argon2 (`argon2`)** | Industry-standard `Argon2id` password hashing (memory-hard resistance against GPU brute-force attacks). |
| **Node.js Built-in `node:crypto`** | `AES-256-GCM` authenticated encryption/decryption for sensitive PII (Bank Account Numbers, National IDs / NIN) + `SHA-256` hashing for refresh tokens, idempotency keys, and payslip tamper-verification hashes. |
| **`@nestjs/jwt` + `cookie-parser`** | Short-lived JWT Access Tokens (`15m`) + rotating `HttpOnly`, `Secure`, `SameSite=Lax` Refresh Token cookies stored hashed in PostgreSQL. |
| **`class-validator` + `class-transformer`** | Strict DTO input validation with global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` to block Mass Assignment attacks. |
| **`helmet`** | Sets strict HTTP security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, CSP). |
| **`@nestjs/throttler`** | Endpoint rate limiting (strict limits on `/auth/login`, `/auth/refresh`, and public `/careers/vacancies/:id/apply`). |
| **`multer` + `file-type`** | Multipart CV file upload handling + **real binary magic-byte inspection** (accepting only valid PDF/DOCX signatures up to 5 MB; rejecting spoofed `.exe`/`.html` extensions). |
| **`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`** | S3-compatible file storage client supporting both **MinIO** (local Docker) and **Cloudflare R2 / Supabase Storage** (cloud) with private buckets and short-lived pre-signed download URLs (`120s` TTL). |
| **`pdfkit` + `qrcode`** | Server-side generation of printable, tamper-evident PDF Payslips, Offer Letters, and Clearance Certificates embedded with verification QR codes. |
| **`nodemailer`** | Transactional email dispatch (connects to local **Mailpit** during development/Docker demo and **Brevo / Resend SMTP** in cloud). |
| **`nestjs-pino` + `pino` + `pino-http`** | Structured JSON logging with request Correlation IDs and automatic field redaction (`password`, `token`, `authorization`, `cookie`, `bankAccount`, `nin`, `salary`). |
| **`@nestjs/swagger` + `swagger-ui-express`** | Auto-generated OpenAPI 3.0 API documentation (enabled in dev/staging; disabled or protected in strict production). |
| **`luxon` + `decimal.js`** | Authoritative `Africa/Kampala` date boundaries, working-day/holiday exclusions, grace-period comparisons, and exact `NUMERIC` payroll/PAYE/NSSF/LST arithmetic. |

### 3.4 Database, Local Services & DevOps Stack
| Component | Local Development / Docker | $0 Cloud Hosting Production / Demo |
| :--- | :--- | :--- |
| **Database** | **PostgreSQL 16** (Docker container) | **Neon** Free Tier (PostgreSQL 16, 1 GB storage, 100 CU-hours/mo, scales to zero, never expires, no card) |
| **Object Storage** | **MinIO** (Docker S3-compatible container) | **Cloudflare R2** (10 GB free, zero egress) or **Supabase Storage** (1 GB free) |
| **Email Testing / Delivery** | **Mailpit** (Docker SMTP + web UI on `:8025`) | **Brevo** (300 emails/day free) or **Resend** (100 emails/day free) |
| **Frontend Hosting** | `localhost:3000` (Next.js) | **Vercel** Hobby Tier (no card, global CDN, free HTTPS) |
| **Backend Hosting** | `localhost:4000` (NestJS API) | **Render** Free Web Service (750 hrs/mo, no card; sleeps after 15 min idle) |
| **CI/CD & Cron Jobs** | Local `npm test` + Docker Compose | **GitHub Actions** (CI lint/typecheck/tests + scheduled cron triggers at `23:55 EAT` & `00:05 EAT`) |

### 3.5 Testing & Quality Tooling
| Tool | Role |
| :--- | :--- |
| **Jest (`jest`, `ts-jest`)** | Unit tests (PAYE/NSSF/LST formulas, working-day calculation, grace period rules, AES encryption) & NestJS integration tests. |
| **Supertest (`supertest`)** | Full HTTP endpoint tests verifying status codes, RBAC/IDOR protection, duplicate email blocks, payroll locking, and mandatory reason enforcement. |
| **Vitest + React Testing Library** | Frontend component & formatter unit tests (`UGX` formatting, masking behavior, Kampala clock). |
| **ESLint + Prettier** | Code formatting and static security/type linting across the monorepo. |

---

## 4. Monorepo Directory Structure

Use a clean npm/pnpm workspace monorepo so Antigravity can build and verify frontend, backend, and shared types together:

```text
staffhub/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # Lint, typecheck, Prisma validate, unit & integration tests
│       └── scheduled-jobs.yml         # Cron triggers for 23:55 EAT attendance & 00:05 EAT offboarding
├── apps/
│   ├── web/                           # Next.js 15 App Router + React 19 + Tailwind CSS
│   │   ├── src/
│   │   │   ├── app/                   # Routes: (public)/careers, (auth)/login, (dashboard)/*
│   │   │   ├── components/
│   │   │   │   ├── layout/            # Single shared <AppShell>, <Sidebar>, <TopBar>
│   │   │   │   ├── ui/                # <Button>, <StatusBadge>, <DataTable>, <OverlayDrawer>, <Modal>
│   │   │   │   └── domain/            # <CurrencyUGX>, <KampalaClock>, <MaskedField>, <MandatoryReasonModal>
│   │   │   ├── config/                # Role navigation map, Tailwind theme extensions
│   │   │   ├── lib/                   # API client (auto token refresh), formatters, query client
│   │   │   └── hooks/                 # useAuth, usePermissions, useKampalaTime
│   │   ├── Dockerfile
│   │   └── .env.example
│   └── api/                           # NestJS 10+ Modular Monolith Backend
│       ├── prisma/
│       │   ├── schema.prisma          # Complete PostgreSQL schema
│       │   ├── migrations/            # Versioned SQL migrations
│       │   └── seed.ts                # Idempotent Ugandan demo company seed script
│       ├── src/
│       │   ├── common/                # Guards, decorators, interceptors, crypto, filters, logger
│       │   ├── modules/
│       │   │   ├── auth/              # Login, first-login reset, refresh rotation, session revocation
│       │   │   ├── audit/             # Append-only audit trail writer & admin query endpoint
│       │   │   ├── recruitment/       # Requisitions, public careers, applications, offers, conversion
│       │   │   ├── employees/         # Profiles, contact updates, HR-approved sensitive diffs
│       │   │   ├── attendance/        # Check-in/out, shift schedules, grace period, corrections
│       │   │   ├── leave/             # Leave balances, working-day engine, dual-stage approvals
│       │   │   ├── payroll/           # Payroll runs, PAYE/NSSF/LST engine, lock, adjustments, PDF/QR
│       │   │   ├── assets/            # Asset registry, single-custody issuing, ack, return/damage/loss
│       │   │   ├── offboarding/       # Exit initiation, clearance checklist, blockers, deactivation
│       │   │   ├── admin/             # User/role creation, holidays, shifts, statutory tax policies
│       │   │   ├── notifications/     # In-app "Pending My Action" inbox + privacy-safe email alerts
│       │   │   ├── storage/           # S3/MinIO/R2 private uploads & pre-signed URLs
│       │   │   └── jobs/              # Internal secret-protected cron endpoints (reconciliation/exits)
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── test/                      # Integration & RBAC/IDOR test suites
│       ├── Dockerfile
│       └── .env.example
├── packages/
│   └── shared/                        # Shared TypeScript enums, role constants, Zod schemas
│       └── src/
│           ├── enums.ts
│           ├── roles.ts
│           └── schemas/
├── design-reference/                  # Exported Stitch AI HTML/PNG files + original DESIGN.md
├── docs/                              # These 10 Master Blueprint Markdown files (00 through 09)
├── scripts/
│   ├── start-staffhub.sh              # One-command Linux/macOS Docker startup
│   └── start-staffhub.bat             # One-command Windows Docker startup
├── docker-compose.yml                 # Local Postgres 16 + MinIO + Mailpit + API + Web
├── package.json                       # Workspace root scripts
└── .gitignore                         # Strictly ignores .env, node_modules, dist, .next