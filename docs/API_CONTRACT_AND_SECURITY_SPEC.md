# 05 — StaffHub API Contract & Security Hardening Specification

## 1. API Transport, Versioning & Global Pipeline

- **Base Path:** `/api/v1`
- **Content Types:**
  - Standard requests/responses: `application/json; charset=utf-8`
  - Document/CV uploads: `multipart/form-data`
  - Report/Payslip exports: `application/pdf` or `text/csv; charset=utf-8`
- **Global NestJS Input Validation (`main.ts`):**
  - Validate bodies and query parameters with strict Zod schemas exported from `packages/shared`; unknown keys are rejected.
  - **Effect:** Unexpected properties (e.g., `"role": "SYSTEM_ADMIN"` on a contact update) trigger `400 Bad Request`. Authorization and explicit update mappings remain mandatory; validation alone does not prevent mass assignment.
- **HTTP Security Headers (`helmet`):**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Strict-Transport-Security` (enabled when served over HTTPS)
- **CORS Policy:**
  - Strict origin allowlist from `CORS_ORIGIN` environment variable (`credentials: true` enabled for `HttpOnly` refresh cookies; wildcard `*` strictly forbidden).
  - Production must prefer same-site HTTPS origins (for example, `app.example.com` and `api.example.com`) so browser third-party-cookie blocking does not break refresh sessions. Use `SameSite=Lax; Secure` for that deployment. If cross-site hosting is unavoidable, use `SameSite=None; Secure` and verify cookie behavior in every supported browser; do not treat this as a reliable fallback where third-party cookies are blocked.
  - All cookie-setting or cookie-authenticated auth requests require an exact allowlisted `Origin`. Login, CSRF bootstrap, refresh, and logout reject missing, `null`, mismatched, or untrusted origins. Credentialed CORS must return the exact allowed origin, never `*`.
  - The CSRF token is `base64url(HMAC-SHA-256(CSRF_HMAC_SECRET, raw_refresh_token))`, compared in constant time and never logged or persisted. Login returns it in JSON; refresh rotates the refresh token and returns the matching new token. After a page reload, `POST /auth/csrf` (JSON body, refresh cookie, exact `Origin`) returns the current token so the client can keep it in memory. Cookie-authenticated refresh and logout require it in `X-CSRF-Token`. The independent `CSRF_HMAC_SECRET` must be a high-entropy secret-manager value.

---

## 2. Standard Error Response Envelope & Error Codes

Every non-2xx response MUST conform to one deterministic JSON schema:

```json
{
  "statusCode": 422,
  "errorCode": "LEAVE_OVERLAP",
  "message": "Your requested dates overlap with an existing pending or approved leave request.",
  "fieldErrors": [
    { "field": "startDate", "message": "Overlaps request #LV-2026-019 (18 Dec 2026)." }
  ],
  "timestampEat": "2026-11-18T08:04:00+03:00",
  "requestId": "7f3b9a12-4410-4b78-9d2a-1e8802a9b011"
}
```

### Canonical Domain Error Codes
| HTTP Status | `errorCode` | Trigger Condition |
| :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Missing required fields, non-whitelisted properties, invalid UGX/date format |
| `401` | `UNAUTHORIZED` / `TOKEN_EXPIRED` / `ACCOUNT_DEACTIVATED` | Missing/expired JWT, revoked session, or deactivated ex-employee |
| `403` | `FORBIDDEN_ROLE` / `FORBIDDEN_SCOPE` / `SELF_APPROVAL_FORBIDDEN` | Role not permitted, IDOR target outside `TEAM`/`SELF`, or attempting to approve own request |
| `403` | `PASSWORD_CHANGE_REQUIRED` | Account has `must_change_password = true`; only `/auth/change-password` allowed |
| `409` | `DUPLICATE_APPLICATION` | Same email already applied to this vacancy |
| `409` | `ASSET_ALREADY_ASSIGNED` | Asset currently held by another employee (`returned_at IS NULL`) |
| `409` | `ALREADY_CHECKED_IN` / `ALREADY_CHECKED_OUT` | Duplicate attendance action on the same `work_date` |
| `409` | `VERSION_CONFLICT` | Stale optimistic-lock `version` number |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Uploaded CV/document failed binary magic-byte inspection |
| `422` | `VACANCY_CLOSED` | Application submitted after `closing_at (EAT)` or vacancy not `PUBLISHED` |
| `422` | `NOT_SCHEDULED` | Check-in/out attempted on a date that is not a working day in the employee's assigned schedule |
| `422` | `ATTENDANCE_CONFLICT` | Check-in conflicts with approved leave, full-day leave conflicts with actual attendance, or actual attendance overlaps a requested half-shift |
| `422` | `MUST_CHECK_IN_FIRST` | Attempting Check-Out with no Check-In on `work_date` |
| `422` | `LEAVE_OVERLAP` / `INSUFFICIENT_LEAVE_BALANCE` / `ZERO_WORKING_DAYS` | Leave rule violation |
| `422` | `REASON_REQUIRED` | Rejecting, correcting, adjusting payroll, or logging asset damage/loss without reason |
| `422` | `CLEARANCE_BLOCKED` | Attempting to finalize exit while unreturned assets or unsettled loans remain |
| `423` | `PAYROLL_LOCKED_DIRECT_EDIT_FORBIDDEN` | Direct edit attempted on a `LOCKED` payroll run |
| `429` | `RATE_LIMIT_EXCEEDED` / `ACCOUNT_LOCKED` | Brute-force or public spam throttling triggered |

---

## 3. Authentication, Password Security & Session Lifecycle

### 3.1 Password Storage & First-Login Policy
- **Hashing:** `Argon2id` (`memoryCost: 65536` KiB, `timeCost: 3`, `parallelism: 1`).
- **Password Policy:** Minimum `10` characters, requiring uppercase, lowercase, digit, and symbol.
- **First-Login Forced Change:** Accounts provisioned by System Admin or Candidate Conversion start with `must_change_password = true`.
  - On `POST /auth/login`, if `must_change_password === true`, the API issues a **scoped temporary token** (`scope: 'PASSWORD_RESET_ONLY'`, 10-min TTL) that all normal guards reject with `403 PASSWORD_CHANGE_REQUIRED` until `POST /auth/change-password` succeeds.

### 3.2 Brute-Force Lockout
- Failed password checks increment `users.failed_login_attempts`.
- After **5 consecutive failures**, set `locked_until = now() + 15 minutes`, log `AUTH_ACCOUNT_LOCKED` to `audit_logs`, and return `423 ACCOUNT_LOCKED`. Successful login resets counter to `0`.

### 3.3 Token Architecture (Zero `localStorage` Refresh Risks)
- **Access Token (JWT):** `15-minute` TTL, held strictly **in React application memory** (never `localStorage`), passed via `Authorization: Bearer <token>`. Payload contains ONLY `{ sub: userId, role, employeeId, authzVersion, jti }`—never sensitive PII. Guards compare the token's authorization version and current account status/role with the database; role changes invalidate existing sessions.
- **Refresh Token:** `64-byte` cryptographically random opaque token, `SHA-256` hashed in `refresh_tokens`, delivered in an `HttpOnly`, `Secure` cookie (`Path=/api/v1/auth`, `7-day` TTL). Prefer same-site HTTPS production domains and `SameSite=Lax`; cross-site deployments may use `SameSite=None` only after supported-browser cookie behavior is verified. The CSRF token is derived from the raw cookie as specified in Section 1, so it rotates with the refresh token and requires no additional database column.
- **Silent Rotation & Reuse Detection:**
  - Calling `POST /auth/refresh` verifies the cookie hash, marks the old token `revoked_at = now()`, issues a fresh access token + new refresh cookie sharing the same `family_id`.
  - **Theft Mitigation:** If an already-revoked refresh token is presented, the backend immediately revokes **every** token in that `family_id`, logs `SECURITY_REFRESH_TOKEN_REUSE`, and returns `401 UNAUTHORIZED`.
- **Instant Deactivation Enforcement:** Both `JwtAuthGuard` and `/auth/refresh` verify `user.isActive === true`. Deactivating an exited employee immediately blocks all sessions with zero delay.

---

## 4. Rate Limiting & Public Job Applicant Defense

### 4.1 Throttler Tiers (`@nestjs/throttler`)
| Endpoint Group | Limit | Key |
| :--- | :--- | :--- |
| `POST /api/v1/auth/login` | `5 requests / 15 minutes` | IP + normalized email |
| `POST /api/v1/auth/forgot-password` | `3 requests / 15 minutes` | IP + email |
| `POST /api/v1/careers/vacancies/:id/apply` | `5 requests / 15 minutes` | IP address |
| `GET /api/v1/verify/payslips/:code` | `30 requests / 1 minute` | IP address |
| All Authenticated Endpoints | `120 requests / 1 minute` | Authenticated `userId` |

### 4.2 Public Careers Bot & Upload Hardening
1. **Cloudflare Turnstile:** Public `POST /careers/vacancies/:id/apply` validates the `turnstileToken` server-side via Cloudflare `siteverify` before processing file uploads or DB writes. Missing production configuration fails closed; only automated tests may bypass verification when no secret is set.
2. **File Upload Verification Pipeline (CVs, Bank Letters, Leave Proof):**
   - `multer` memory storage capped strictly at **`5 MB`** (`5 * 1024 * 1024` bytes).
   - Server reads the binary buffer header using `file-type` (`fromBuffer(file.buffer)`):
     - Allowed MIME signatures ONLY: `application/pdf` (`%PDF-`) and `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.docx` OOXML).
     - Reject any mismatched or executable payload (`415 UNSUPPORTED_MEDIA_TYPE`).
   - File is renamed to a UUID (`applications/<vacancyId>/<uuid>.pdf`)—user filenames are stored only as sanitized metadata, never used in file paths.
   - Stored in **private S3/MinIO/R2 bucket** (zero public bucket URLs). Authorized download endpoints verify RBAC/ABAC first, then return a **`120-second` pre-signed S3 URL** (`Content-Disposition: attachment`).

---

## 5. Application-Layer PII Encryption & Redacted Logging

### 5.1 Field-Level Encryption (`PiiCryptoService`)
- Uses `node:crypto` `aes-256-gcm` with 32-byte `PII_ENCRYPTION_KEY` and a fresh random `12-byte` IV per write.
- Applied to: `employees.bank_account_encrypted`, `employees.nin_encrypted`, and sensitive values inside `profile_change_requests` when `field_type IN ('BANK_DETAILS', 'NATIONAL_ID_NIN')`.
- Decrypted **only** inside authorized service methods (`HR_MANAGER`, `PAYROLL_OFFICER`, or `SELF` explicit reveal/export action)—never in directory listings or Line Manager views.

### 5.2 Structured Logging & Scrubbing (`nestjs-pino`)
- Every HTTP request gets a UUID `X-Request-Id` correlation header and logs JSON (`timestamp`, `requestId`, `method`, `path`, `statusCode`, `durationMs`, `userId`, `role`).
- Mandatory `redact` paths guarantee secrets/PII NEVER touch stdout or log files:
  - `req.headers.authorization`, `req.headers.cookie`, `res.headers['set-cookie']`
  - `*.password`, `*.currentPassword`, `*.newPassword`, `*.refreshToken`, `*.turnstileToken`
  - `*.bankAccountNumber`, `*.nin`, `*.baseSalaryUgx`, `*.netPayUgx`

---

## 6. Idempotency & Optimistic Concurrency Contracts

- **Idempotency Header (`Idempotency-Key: <uuid>`):** Required on high-impact mutations (`POST /offers/:id/convert`, `POST /payroll/runs`, `POST /payroll/runs/:id/lock`, `POST /leave/requests`, `POST /attendance/check-in`). Duplicate requests with the same key and identical payload hash within 24h replay the original response safely without double-executing side effects.
- **Optimistic Locking (`version` field):** Updating `employees`, `assets`, `payroll_runs`, or `offboarding_cases` requires sending the last-read `version`. Concurrent stale saves return `409 VERSION_CONFLICT`.
---

## 7. Complete REST Endpoint Catalog (`/api/v1`)

### 7.1 Authentication & Session Module (`/auth`)
| Method & Path | Access | Request Body / Params | Behavior & Response |
| :--- | :--- | :--- | :--- |
| `POST /auth/login` | `PUBLIC` (Rate-limited; exact `Origin`) | `{ email, password }` | Verifies `Argon2id` hash, checks lockout & `isActive`. If `mustChangePassword=true`, returns `{ passwordChangeRequired: true, tempToken }`. Else sets `HttpOnly` refresh cookie and returns `{ accessToken, csrfToken, user }`. |
| `POST /auth/csrf` | `PUBLIC` (valid refresh cookie; exact `Origin`) | JSON `{}` | Validates that the refresh cookie is active, unexpired, unrevoked, and belongs to an active user, then returns the current cookie-bound `{ csrfToken }` for page-reload recovery. Requires `Content-Type: application/json`; no session or business state is changed. |
| `POST /auth/refresh` | `PUBLIC` (refresh cookie; exact `Origin`, `X-CSRF-Token`) | Cookie: `staffhub_rt` | Validates CSRF and hashed refresh token, rotates token family, checks `user.isActive`, returns new `{ accessToken, csrfToken }`. |
| `POST /auth/logout` | `AUTHENTICATED` (exact `Origin`, `X-CSRF-Token`) | Cookie: `staffhub_rt` | Validates CSRF, revokes refresh token in DB, clears cookie, logs `AUTH_LOGOUT`. |
| `POST /auth/change-password` | `AUTHENTICATED` or `tempToken` | `{ currentPassword, newPassword }` | Validates password policy, updates `Argon2id` hash, sets `mustChangePassword=false`, revokes prior refresh tokens, logs `AUTH_PASSWORD_CHANGED`. |
| `POST /auth/forgot-password` | `PUBLIC` (Rate-limited) | `{ email }` | Always returns `200` (prevents user enumeration). Dispatches privacy-safe reset link if active account exists. |
| `POST /auth/reset-password` | `PUBLIC` | `{ token, newPassword }` | Validates single-use hashed token, updates password, revokes sessions. |
| `GET /auth/me` | `AUTHENTICATED` | — | Returns `{ user, employeeSummary, allowedNavRoutes, unreadActionCount }`. |
| `POST /auth/demo-login` | Isolated non-production demo environment only | `{ role }` | Returns `404` unless `DEMO_MODE=true` and `NODE_ENV !== 'production'`; startup fails if demo login is enabled in production. Uses a separate demo database and synthetic data. |

---

### 7.2 Public Careers & Verification Module (`/careers`, `/verify`)
| Method & Path | Access | Request Body / Params | Behavior & Response |
| :--- | :--- | :--- | :--- |
| `GET /careers/vacancies` | `PUBLIC` | `?search=&departmentId=` | Lists ONLY `status = 'PUBLISHED'` and `closingAt >= now()` vacancies (`UGX` band optional, `closingAt` in `EAT`). |
| `GET /careers/vacancies/:id` | `PUBLIC` | `:id` | Returns full vacancy details (`404` if `DRAFT`). Indicates `isClosed` if past closing date. |
| `POST /careers/vacancies/:id/apply` | `PUBLIC` (Turnstile + Rate-limit) | `multipart/form-data`: `fullName`, `email`, `phone`, `expectedGrossUgx?`, `earliestStartDate?`, `coverNote`, `turnstileToken`, `cv` (PDF/DOCX `<=5MB`) | Enforces `PUBLISHED` & `now <= closingAt` (`422`), unique `(vacancyId, lower(email))` (`409`), magic-byte CV inspection (`415`), private S3 upload, returns `{ applicationCode, submittedAtEat }`. |
| `GET /verify/payslips/:code` | `PUBLIC` (Rate-limited) | `:code` | Public tamper-verification endpoint for QR codes. Returns ONLY `{ isValid, payslipNumber, payPeriod, maskedEmployeeName, netPayHashVerified, publishedAtEat }`. Zero salary amounts exposed. |

---

### 7.3 Recruitment, Offers & Onboarding Module (`/recruitment`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /recruitment/requisitions` | `HR_MANAGER`, `RECRUITER`, `LINE_MANAGER` (`TEAM` own) | Filterable by `status`, `departmentId`. |
| `POST /recruitment/requisitions` | `LINE_MANAGER`, `HR_MANAGER` | `{ departmentId, jobTitle, headcount, employmentType, justification, targetStartDate }` $\rightarrow$ `PENDING_HR`. |
| `POST /recruitment/requisitions/:id/approve` | `HR_MANAGER` | Transitions `PENDING_HR` $\rightarrow$ `APPROVED` + audit log. |
| `POST /recruitment/requisitions/:id/reject` | `HR_MANAGER` | `{ reason }` (**Mandatory**) $\rightarrow$ `REJECTED` + audit log. |
| `POST /recruitment/requisitions/:id/cancel` | Original requester | Cancels only a `PENDING_HR` requisition, with version check and audit log. |
| `GET /recruitment/vacancies` | `HR_MANAGER`, `RECRUITER`, `LINE_MANAGER` (own reqs) | Lists internal & public vacancies with applicant counts. |
| `POST /recruitment/vacancies` | `RECRUITER`, `HR_MANAGER` | `{ requisitionId, title, location, description, requirements, salaryBandMinUgx?, salaryBandMaxUgx?, closingAt }` — **Blocked unless requisition `APPROVED`**. |
| `POST /recruitment/vacancies/:id/publish` | `RECRUITER`, `HR_MANAGER` | Transitions `DRAFT` $\rightarrow$ `PUBLISHED`. |
| `POST /recruitment/vacancies/:id/close` | `RECRUITER`, `HR_MANAGER` | Transitions `PUBLISHED` $\rightarrow$ `CLOSED`. |
| `GET /recruitment/vacancies/:id/applications` | `RECRUITER`, `HR_MANAGER`, `LINE_MANAGER` (own reqs) | Returns candidate pipeline grouped/filtered by `status`. |
| `GET /recruitment/applications/:id/cv-url` | `RECRUITER`, `HR_MANAGER`, `LINE_MANAGER` (shortlisted) | Returns `{ signedUrl, expiresInSeconds: 120 }`. |
| `PATCH /recruitment/applications/:id/stage` | `RECRUITER`, `HR_MANAGER` | `{ status, stageNotes? }` (`stageNotes` required when `REJECTED`). |
| `GET /recruitment/interviewers` | `RECRUITER`, `HR_MANAGER` | Lists active panelists for scheduling. |
| `POST /recruitment/applications/:id/interviews` | `RECRUITER`, `HR_MANAGER` | `{ scheduledAt, interviewMode, locationOrLink, interviewerUserIds }`; future interview, active panel members, shortlisted/interviewing candidate, HTTPS link for video. |
| `PATCH /recruitment/interviews/:id` | Assigned panelist | `{ score, feedback, outcome }`; upserts one independent review per panelist. |
| `POST /recruitment/applications/:id/offers` | `RECRUITER`, `HR_MANAGER` | Creates `DRAFT` offer (`offeredJobTitle`, `departmentId`, `reportingManagerId`, `offeredBaseSalaryUgx`, `offeredAllowancesUgx`, `proposedStartDate`, `offerExpiresAt`). |
| `POST /recruitment/offers/:id/submit` | `RECRUITER`, `HR_MANAGER` | `DRAFT`/`REJECTED` $\rightarrow$ `PENDING_APPROVAL`. |
| `POST /recruitment/offers/:id/approve` | `HR_MANAGER` | `PENDING_APPROVAL` $\rightarrow$ `APPROVED`; PDF generation is not yet implemented. |
| `POST /recruitment/offers/:id/reject` | `HR_MANAGER` | `{ reason }` (**Mandatory**) $\rightarrow$ `REJECTED`. |
| `POST /recruitment/offers/:id/send` | `RECRUITER`, `HR_MANAGER` | **Blocked unless `APPROVED`** $\rightarrow$ `SENT` + dispatches privacy-safe email. |
| `POST /recruitment/offers/:id/record-decision` | `RECRUITER`, `HR_MANAGER` | `{ decision: 'ACCEPTED' \| 'DECLINED', notes? }`. |
| `POST /careers/offers/respond` | Public, throttled | `{ token, decision: 'ACCEPTED' \| 'DECLINED', notes? }`; one-time expiring token, hash stored server-side. |
| `POST /recruitment/offers/:id/convert` | `HR_MANAGER` (`Idempotency-Key`) | `{ workEmail?, workScheduleId? }` — Atomic conversion to `User + Employee + LeaveBalances + 4-Role OnboardingChecklist`. |
| `GET /recruitment/onboarding` | `HR_MANAGER`, `LINE_MANAGER` (`TEAM`), `ASSET_OFFICER`, any linked staff user (`SELF`, own checklist only) | Returns role-scoped checklist + tasks. |
| `PATCH /recruitment/onboarding/tasks/:taskId` | Assigned Task Role (`HR`/`MGR`/`EMP`/`ASSET`) | `{ isCompleted }` — Verifies actor matches `task.assignedRole` & scope. Auto-activates employee when all tasks complete. |

---

### 7.4 Employees, Sensitive Profile Changes & Performance (`/employees`, `/performance`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /employees` | Internal Roles (`ORG` or `TEAM` for `LINE_MANAGER`) | Role-scoped projection! `LINE_MANAGER` receives direct reports ONLY, with `salary`, `bank`, `nin`, `tin`, `nssf` **physically omitted**. |
| `GET /employees/:id` | `HR_MANAGER`, `PAYROLL_OFFICER`, `LINE_MANAGER` (`TEAM`), any linked staff user (`SELF`) | Strict role-scoped projection. Optional `?reveal=true` allowed ONLY for `HR_MANAGER`, `PAYROLL_OFFICER`, or `SELF`—logs `PII_REVEALED` in audit trail. |
| `PATCH /employees/:id/contact` | Any linked staff user (`SELF`), `HR_MANAGER` (`ORG`) | Strict shared contact schema (`phone`, `personalEmail`, `residentialAddress`, `emergencyContactName`, `emergencyContactPhone`). |
| `PATCH /employees/:id/employment` | `HR_MANAGER` | `{ jobTitle, departmentId, managerId, workScheduleId, baseSalaryUgx, recurringAllowancesUgx, taxResidency, version }`. |
| `GET /employees/change-requests` | `HR_MANAGER` (`ORG`), any linked staff user (`SELF`) | Lists pending/historical sensitive change requests. |
| `POST /employees/:id/change-requests` | Any linked staff user (`SELF`), `HR_MANAGER` (`ORG`) | `multipart/form-data`: `fieldType`, `newValueJson`, `requestReason`, optional `supportingDoc` PDF. Encrypts bank/NIN payloads. |
| `POST /employees/change-requests/:reqId/approve` | `HR_MANAGER` (Anti-self-approval) | Atomically updates `employees`, increments `version`, writes redacted diff to `audit_logs`. |
| `POST /employees/change-requests/:reqId/reject` | `HR_MANAGER` | `{ reason }` (**Mandatory**). |
| `GET /performance/reviews` | `HR_MANAGER`, `LINE_MANAGER` (`TEAM`), `EMPLOYEE` (`SELF`) | Lists only role-scoped performance review cycles. |
| `POST /performance/reviews` | `LINE_MANAGER` (`TEAM`), `HR_MANAGER` | { employeeId, reviewPeriod, objectives[] }; one cycle per employee and period. |
| `PATCH /performance/reviews/:id/self-assessment` | `EMPLOYEE` (`SELF`) | `{ selfAssessment }`; only the linked employee can submit a pending self-review. |
| `PATCH /performance/reviews/:id/manager-review` | `LINE_MANAGER` (`TEAM`) | `{ managerFeedback, rating }` (1�5); completes a direct report review after self-assessment. |

---

### 7.5 Attendance & Corrections (`/attendance`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /attendance/today` | `AUTHENTICATED` (`SELF`) | Returns `nowEat`, employee's `workSchedule`, today's `attendanceRecord` (if any), and allowed button state (`CAN_CHECK_IN`, `CAN_CHECK_OUT`, `NOT_SCHEDULED`, `COMPLETED`). Approved leave intervals also gate the button state. |
| `POST /attendance/check-in` | `AUTHENTICATED` (`SELF`, `Idempotency-Key`) | Zero client time/GPS accepted; server evaluates `Africa/Kampala` against schedule + grace period. |
| `POST /attendance/check-out` | `AUTHENTICATED` (`SELF`) | Blocked (`422 MUST_CHECK_IN_FIRST`) unless checked in today. Computes `workedMinutes`. |
| `GET /attendance/records` | `HR_MANAGER` (`ORG`), `PAYROLL_OFFICER` (locked summary only), `LINE_MANAGER` (`TEAM`), any linked staff user (`SELF`) | `?from=&to=&employeeId=&status=`. `SELF` applies to every internal user linked to an employee record. |
| `GET /attendance/corrections` | `HR_MANAGER`, `LINE_MANAGER` (`TEAM`), any linked staff user (`SELF`) | Lists pending and historical correction requests. |
| `POST /attendance/corrections` | Any linked staff user (`SELF`) | `{ workDate, requestedCheckInAt, requestedCheckOutAt?, reason }` (**Mandatory `reason`**). Blocked if period locked. |
| `POST /attendance/corrections/:id/approve` | `LINE_MANAGER` (`TEAM`/delegate), `HR_MANAGER` | Anti-self-approval. Updates attendance record, recalculates `PRESENT`/`LATE`, logs audit entry. |
| `POST /attendance/corrections/:id/reject` | `LINE_MANAGER` (`TEAM`/delegate), `HR_MANAGER` | `{ reason }` (**Mandatory**). |
| `GET /attendance/period-locks` | `HR_MANAGER`, `PAYROLL_OFFICER` | Lists locked `(year, month)` attendance periods. |
| `POST /attendance/period-locks` | `HR_MANAGER`, `PAYROLL_OFFICER` | `{ year, month }` — Allowed only after month end in EAT, EOD reconciliation completion, and resolution of all pending corrections; locks attendance/leave mutations for that period. |

---

### 7.6 Leave Management & Delegations (`/leave`, `/delegations`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /leave/types` | `AUTHENTICATED` | Returns active leave types & HR threshold rules. |
| `GET /leave/balances` | `HR_MANAGER` (`ORG`), `PAYROLL_OFFICER` (`ORG`), `LINE_MANAGER` (`TEAM`), any linked staff user (`SELF`) | `?year=&employeeId=`. |
| `POST /leave/calculate-working-days` | Authenticated internal staff | `{ startDate, endDate, halfDayPeriod? }` $\rightarrow$ returns `{ calendarDays, workingDays, excludedDates, annualAllocations }`. |
| `GET /leave/requests` | `HR_MANAGER`, `LINE_MANAGER` (`TEAM`), any linked staff user (`SELF`) | Supports queue filters (`pendingMyApproval=true`). |
| `POST /leave/requests` | Any linked staff user (`SELF`, `Idempotency-Key`) | `multipart/form-data`: `leaveTypeId`, `startDate`, `endDate`, `halfDayPeriod?`, `reason`, `handoverEmployeeId?`, `attachment?`. Enforces no-overlap by calendar date (only one active request per employee/date, even for complementary half-days), per-year balance, and schedule rules. A half-day must be a single scheduled work date; use `FULL` to request both halves. |
| `POST /leave/requests/:id/approve` | `LINE_MANAGER` (`TEAM`/delegate) or `HR_MANAGER` | Anti-self-approval. Routes to `PENDING_HR` or `APPROVED` (atomic balance + attendance update). |
| `POST /leave/requests/:id/reject` | `LINE_MANAGER` (`TEAM`/delegate) or `HR_MANAGER` | `{ reason }` (**Mandatory**). Releases `pendingDays`. |
| `POST /leave/requests/:id/cancel` | Any linked staff user (`SELF`) or `HR_MANAGER` (revoke) | `{ reason? }` (mandatory if HR revoking approved leave). |
| `GET /delegations` / `POST /delegations` / `POST /delegations/:id/revoke` | `SYSTEM_ADMIN`, `HR_MANAGER`, `LINE_MANAGER` (own team) | `{ delegateUserId, startsAt, endsAt, reason }`. |

---

### 7.7 Payroll, Loans, Adjustments & Payslips (`/payroll`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /payroll/runs` & `GET /payroll/runs/:id` | `PAYROLL_OFFICER`, `HR_MANAGER` | Returns run metadata, stepper state, totals (`UGX`), and items. |
| `POST /payroll/runs` | `PAYROLL_OFFICER` (`Idempotency-Key`) | Returns `422 PAYROLL_CALCULATOR_NOT_CONFIGURED` until reviewed statutory rules and payroll arithmetic are implemented. Demo arithmetic is deliberately blocked from creating payroll runs. |
| `PATCH /payroll/runs/:runId/items/:itemId` | `PAYROLL_OFFICER` | `{ bonusOrArrearsUgx?, otherDeductionsUgx?, notes? }` — **Blocked (`423`) unless `run.status === 'DRAFT'`**. |
| `POST /payroll/runs/:id/submit` | `PAYROLL_OFFICER` | `DRAFT` $\rightarrow$ `PENDING_APPROVAL`. |
| `POST /payroll/runs/:id/return` | `HR_MANAGER` | `{ reason }` (**Mandatory**) $\rightarrow$ `DRAFT`. |
| `POST /payroll/runs/:id/approve` | `HR_MANAGER` | Separation of duties (`actor !== preparedBy`) $\rightarrow$ `APPROVED`. |
| `POST /payroll/runs/:id/lock` | `HR_MANAGER`, `PAYROLL_OFFICER` (`Idempotency-Key`) | `APPROVED` $\rightarrow$ `LOCKED`; settles loan installments, inserts pending payslip records and durable outbox jobs. PDF render, hash, and private upload run post-commit; only `READY` slips can be downloaded or verified. |
| `GET /payroll/runs/:id/export/bank-eft` | `PAYROLL_OFFICER`, `HR_MANAGER` | Returns CSV bank disbursement schedule (decrypts account numbers only in export stream) + logs `EXPORT_BANK_EFT` in `audit_logs`. |
| `GET /payroll/runs/:id/export/statutory` | `PAYROLL_OFFICER`, `HR_MANAGER` | Returns URA PAYE & NSSF schedule CSV + logs `EXPORT_STATUTORY`. |
| `GET /payroll/adjustments` | `PAYROLL_OFFICER`, `HR_MANAGER` | Lists post-lock adjustment requests. |
| `POST /payroll/items/:itemId/adjustments` | `PAYROLL_OFFICER` | `{ adjustmentType, category, amountUgx, reason }` (**Mandatory `reason`**). |
| `POST /payroll/adjustments/:id/approve` / `reject` | `HR_MANAGER` | Distinct from requester; reject requires `reason`. |
| `GET /payroll/my-payslips` & `GET /payroll/payslips/:id/pdf-url` | Any linked staff user (`SELF`) or `PAYROLL_OFFICER`/`HR_MANAGER` (`ORG`) | Enforces `SELF` or HR/Payroll scope; only `READY` payslips return a 120s pre-signed URL. |
| `GET /payroll/loans` | `PAYROLL_OFFICER`, `HR_MANAGER` (`ORG`), any linked staff user (`SELF`, own schedule/balance only) | Returns role-scoped loan schedules and balances. |
| `POST /payroll/loans` | `PAYROLL_OFFICER`, `HR_MANAGER` | Creates a staff salary advance or loan under the approved policy. |

---

### 7.8 Company Assets (`/assets`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /assets` & `POST /assets` & `PATCH /assets/:id` | `ASSET_OFFICER`, `HR_MANAGER` (read) | Register/update items (`assetTag`, `serialNumber`, `name`, `category`, `purchaseValueUgx`, `condition`, `version`). |
| `POST /assets/:id/issue` | `ASSET_OFFICER` | `{ employeeId }` — Enforces max 1 active assignee (`409 ASSET_ALREADY_ASSIGNED`). |
| `GET /assets/my-assets` | Any linked staff user (`SELF`) | Lists employee's assigned items & pending acknowledgements. |
| `POST /assets/assignments/:id/acknowledge` | Assigned staff user (`SELF`) | Marks receipt `ACKNOWLEDGED` + timestamp. |
| `POST /assets/assignments/:id/return` | `ASSET_OFFICER` | `{ returnCondition, notes? }` (`notes` required if `DAMAGED`). Frees custody lock & refreshes offboarding blockers. |
| `POST /assets/assignments/:id/incident` | `ASSET_OFFICER` | `{ outcome: 'CLOSED_DAMAGED' \| 'CLOSED_LOST', incidentNotes }` (**Mandatory `incidentNotes`**). |

---

### 7.9 Offboarding & Clearance (`/offboarding`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /offboarding/cases` | `HR_MANAGER`, `ASSET_OFFICER` (assets track), `PAYROLL_OFFICER` (loans track), `LINE_MANAGER` (`TEAM` handover) | Returns role-scoped case lists; never includes employee-only cases outside the caller's `ORG`/`TEAM` scope. |
| `GET /offboarding/cases/:id` | Same operational roles, plus any linked employee user (`SELF`, own case only) | Returns role-scoped case details; `SELF` receives only their own exit status and employee-safe checklist, never internal notes or other employees' data. |
| `POST /offboarding/cases` | `HR_MANAGER` | `{ employeeId, exitType, noticeDate, lastWorkingDay, exitReason }` — Creates 4 clearance tracks with live asset/loan blocker detection. |
| `POST /offboarding/cases/:id/clearances/:trackType/sign-off` | Role owning track (`ASSET_OFFICER`, `LINE_MANAGER`, `PAYROLL_OFFICER`, `HR_MANAGER`) | `{ notes? }` — Physically blocked (`422 CLEARANCE_BLOCKED`) if unreturned assets or unsettled loans exist. Clearance can continue after account deactivation. |
| `POST /offboarding/cases/:id/finalize` | `HR_MANAGER` | Transitions `IN_PROGRESS` $\rightarrow$ `CLEARED` ONLY when all 4 tracks are `CLEARED`. |
| `POST /offboarding/cases/:id/deactivate` | `HR_MANAGER` | Allowed once `today_eat > last_working_day` and `deactivatedAt` is unset, regardless of clearance status: sets `users.isActive=false`, revokes sessions, sets `employees.status='EXITED'`, and sets `offboarding_cases.deactivated_at` without changing clearance status. This does not block final-pay processing. |

---

### 7.10 System Admin, Audit Trail, Notifications & Internal Crons
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /admin/users` / `POST /admin/users` / `PATCH /admin/users/:id/role` | `SYSTEM_ADMIN` | User creation (`mustChangePassword=true`), role updates, force password reset. |
| `GET /admin/schedules` / `POST /admin/schedules` / `PATCH /admin/schedules/:id` | `SYSTEM_ADMIN`, `HR_MANAGER` | Manage shifts & grace periods (`GET` open to all authenticated users). |
| `GET /admin/holidays` / `POST /admin/holidays` / `DELETE /admin/holidays/:id` | `SYSTEM_ADMIN`, `HR_MANAGER` | Manage Ugandan public holidays (`GET` open to all authenticated users). |
| `GET /admin/tax-policies` / `POST /admin/tax-policies` | `SYSTEM_ADMIN`, `PAYROLL_OFFICER` | Create/read versioned PAYE, NSSF, and LST configuration; new policies start `DRAFT` and are never used for payroll. |
| `POST /admin/tax-policies/:id/approve` | Authorized statutory policy reviewer (`SYSTEM_ADMIN` or `HR_MANAGER`, not creator) | `{ legalSourceReference, supersedesPolicyId? }` — Requires verification against current official sources; records approver/time and transitions `DRAFT` to `APPROVED`. If superseding an approved version, atomically set its `effective_to` to the day before the new policy starts and audit both changes; reject any remaining effective-date overlap. |
| `GET /audit/logs` / `GET /audit/logs/export` | `SYSTEM_ADMIN` (full), `HR_MANAGER` (HR scope), `PAYROLL_OFFICER` (Payroll scope) | Read-only filterable audit stream (`from`, `to`, `actorId`, `action`, `entityType`). |
| `GET /notifications/inbox` / `PATCH /notifications/:id/read` | `AUTHENTICATED` (`SELF`) | Returns `"Pending My Action"` items + unread count. |
| `POST /internal/jobs/reconcile-attendance` | `X-Cron-Secret` header ONLY | Executes `23:55 EAT` idempotent EOD absence marking. |
| `POST /internal/jobs/process-daily-transitions` | `X-Cron-Secret` header ONLY | Executes `00:05 EAT` vacancy closing, post-last-working-day exit deactivation (even with open clearance items), and delegation expiry. |
| `POST /internal/jobs/rollover-leave-balances` | `X-Cron-Secret` header ONLY | Executes idempotent annual leave-balance rollover at `00:01 EAT` on 1 January. |
| `POST /internal/jobs/process-async-outbox` | `X-Cron-Secret` header ONLY | Claims durable post-commit work with `FOR UPDATE SKIP LOCKED`; handlers (including payslip PDF generation) must be idempotent, retryable, and emit only sanitized errors. |
