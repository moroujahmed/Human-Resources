# 05 — StaffHub API Contract & Security Hardening Specification

## 1. API Transport, Versioning & Global Pipeline

- **Base Path:** `/api/v1`
- **Content Types:**
  - Standard requests/responses: `application/json; charset=utf-8`
  - Document/CV uploads: `multipart/form-data`
  - Report/Payslip exports: `application/pdf` or `text/csv; charset=utf-8`
- **Global NestJS Input Validation (`main.ts`):**
  - `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
  - **Effect:** Any unexpected property injected into a JSON body (e.g., `"role": "SYSTEM_ADMIN"` or `"baseSalaryUgx": 99999999` on an employee contact update) triggers an immediate `400 Bad Request`—completely preventing Mass Assignment vulnerabilities.
- **HTTP Security Headers (`helmet`):**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Strict-Transport-Security` (enabled when served over HTTPS)
- **CORS Policy:**
  - Strict origin allowlist from `CORS_ORIGIN` environment variable (`credentials: true` enabled for `HttpOnly` refresh cookies; wildcard `*` strictly forbidden).

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
  "timestampEat": "2026-11-18T01:27:00+03:00",
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
- **Access Token (JWT):** `15-minute` TTL, held strictly **in React application memory** (never `localStorage`), passed via `Authorization: Bearer <token>`. Payload contains ONLY `{ sub: userId, role, employeeId, jti }`—never sensitive PII.
- **Refresh Token:** `64-byte` cryptographically random opaque token, `SHA-256` hashed in `refresh_tokens`, delivered in an `HttpOnly`, `Secure` (`true` in prod), `SameSite=Lax`, `Path=/api/v1/auth` cookie (`7-day` TTL).
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
1. **Cloudflare Turnstile:** Public `POST /careers/vacancies/:id/apply` validates the `turnstileToken` server-side via Cloudflare `siteverify` before processing file uploads or DB writes (auto-bypassed only in local `NODE_ENV=test` / local Docker when secret is intentionally unset).
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
| `POST /auth/login` | `PUBLIC` (Rate-limited) | `{ email, password }` | Verifies `Argon2id` hash, checks lockout & `isActive`. If `mustChangePassword=true`, returns `{ passwordChangeRequired: true, tempToken }`. Else sets `HttpOnly` refresh cookie and returns `{ accessToken, user }`. |
| `POST /auth/refresh` | `PUBLIC` (Cookie) | Cookie: `staffhub_rt` | Validates hashed refresh token, rotates token family, checks `user.isActive`, returns new `{ accessToken }`. |
| `POST /auth/logout` | `AUTHENTICATED` | Cookie: `staffhub_rt` | Revokes refresh token in DB, clears cookie, logs `AUTH_LOGOUT`. |
| `POST /auth/change-password` | `AUTHENTICATED` or `tempToken` | `{ currentPassword, newPassword }` | Validates password policy, updates `Argon2id` hash, sets `mustChangePassword=false`, revokes prior refresh tokens, logs `AUTH_PASSWORD_CHANGED`. |
| `POST /auth/forgot-password` | `PUBLIC` (Rate-limited) | `{ email }` | Always returns `200` (prevents user enumeration). Dispatches privacy-safe reset link if active account exists. |
| `POST /auth/reset-password` | `PUBLIC` | `{ token, newPassword }` | Validates single-use hashed token, updates password, revokes sessions. |
| `GET /auth/me` | `AUTHENTICATED` | — | Returns `{ user, employeeSummary, allowedNavRoutes, unreadActionCount }`. |
| `POST /auth/demo-login` | `DEMO_MODE=true` ONLY | `{ role }` | Returns `404` when `DEMO_MODE !== 'true'`. Signs in seeded demo persona for live presentation. |

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
| `GET /recruitment/vacancies` | `HR_MANAGER`, `RECRUITER`, `LINE_MANAGER` (own reqs) | Lists internal & public vacancies with applicant counts. |
| `POST /recruitment/vacancies` | `RECRUITER`, `HR_MANAGER` | `{ requisitionId, title, location, description, requirements, salaryBandMinUgx?, salaryBandMaxUgx?, closingAt }` — **Blocked unless requisition `APPROVED`**. |
| `POST /recruitment/vacancies/:id/publish` | `RECRUITER`, `HR_MANAGER` | Transitions `DRAFT` $\rightarrow$ `PUBLISHED`. |
| `POST /recruitment/vacancies/:id/close` | `RECRUITER`, `HR_MANAGER` | Transitions `PUBLISHED` $\rightarrow$ `CLOSED`. |
| `GET /recruitment/vacancies/:id/applications` | `RECRUITER`, `HR_MANAGER`, `LINE_MANAGER` (own reqs) | Returns candidate pipeline grouped/filtered by `status`. |
| `GET /recruitment/applications/:id/cv-url` | `RECRUITER`, `HR_MANAGER`, `LINE_MANAGER` (shortlisted) | Returns `{ signedUrl, expiresInSeconds: 120 }`. |
| `PATCH /recruitment/applications/:id/stage` | `RECRUITER`, `HR_MANAGER` | `{ status, stageNotes? }` (`stageNotes` required when `REJECTED`). |
| `POST /recruitment/applications/:id/interviews` | `RECRUITER`, `HR_MANAGER` | `{ scheduledAt, interviewMode, locationOrLink, interviewerUserIds }` |
| `PATCH /recruitment/interviews/:id` | `RECRUITER`, `HR_MANAGER`, Panelist | `{ score, feedback, outcome }`. |
| `POST /recruitment/applications/:id/offers` | `RECRUITER`, `HR_MANAGER` | Creates `DRAFT` offer (`offeredJobTitle`, `departmentId`, `reportingManagerId`, `offeredBaseSalaryUgx`, `offeredAllowancesUgx`, `proposedStartDate`, `offerExpiresAt`). |
| `POST /recruitment/offers/:id/submit` | `RECRUITER`, `HR_MANAGER` | `DRAFT`/`REJECTED` $\rightarrow$ `PENDING_APPROVAL`. |
| `POST /recruitment/offers/:id/approve` | `HR_MANAGER` | `PENDING_APPROVAL` $\rightarrow$ `APPROVED` + generates Offer PDF. |
| `POST /recruitment/offers/:id/reject` | `HR_MANAGER` | `{ reason }` (**Mandatory**) $\rightarrow$ `REJECTED`. |
| `POST /recruitment/offers/:id/send` | `RECRUITER`, `HR_MANAGER` | **Blocked unless `APPROVED`** $\rightarrow$ `SENT` + dispatches privacy-safe email. |
| `POST /recruitment/offers/:id/record-decision` | `RECRUITER`, `HR_MANAGER` | `{ decision: 'ACCEPTED' \| 'DECLINED', notes? }`. |
| `POST /recruitment/offers/:id/convert` | `HR_MANAGER` (`Idempotency-Key`) | `{ workEmail?, workScheduleId? }` — Atomic conversion to `User + Employee + LeaveBalances + 4-Role OnboardingChecklist`. |
| `GET /recruitment/onboarding/:employeeId` | `HR_MANAGER`, `LINE_MANAGER` (`TEAM`), `ASSET_OFFICER`, `EMPLOYEE` (`SELF`) | Returns checklist + tasks. |
| `PATCH /recruitment/onboarding/tasks/:taskId` | Assigned Task Role (`HR`/`MGR`/`EMP`/`ASSET`) | `{ isCompleted }` — Verifies actor matches `task.assignedRole` & scope. Auto-activates employee when all tasks complete. |

---

### 7.4 Employees, Sensitive Profile Changes & Performance (`/employees`, `/performance`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /employees` | Internal Roles (`ORG` or `TEAM` for `LINE_MANAGER`) | Role-scoped projection! `LINE_MANAGER` receives direct reports ONLY, with `salary`, `bank`, `nin`, `tin`, `nssf` **physically omitted**. |
| `GET /employees/:id` | `HR_MANAGER`, `PAYROLL_OFFICER`, `LINE_MANAGER` (`TEAM`), `EMPLOYEE` (`SELF`) | Strict DTO masking. Optional `?reveal=true` allowed ONLY for `HR_MANAGER`, `PAYROLL_OFFICER`, or `SELF`—logs `PII_REVEALED` in audit trail! |
| `PATCH /employees/:id/contact` | `EMPLOYEE` (`SELF`), `HR_MANAGER` | Strict `UpdateOwnContactDto` (`phone`, `personalEmail`, `residentialAddress`, `emergencyContactName`, `emergencyContactPhone`). |
| `PATCH /employees/:id/employment` | `HR_MANAGER` | `{ jobTitle, departmentId, managerId, workScheduleId, baseSalaryUgx, recurringAllowancesUgx, taxResidency, version }`. |
| `GET /employees/change-requests` | `HR_MANAGER` (`ORG`), `EMPLOYEE` (`SELF`) | Lists pending/historical sensitive change requests. |
| `POST /employees/:id/change-requests` | `EMPLOYEE` (`SELF`), `HR_MANAGER` | `multipart/form-data`: `fieldType`, `newValueJson`, `requestReason`, optional `supportingDoc` PDF. Encrypts bank/NIN payloads. |
| `POST /employees/change-requests/:reqId/approve` | `HR_MANAGER` (Anti-self-approval) | Atomically updates `employees`, increments `version`, writes redacted diff to `audit_logs`. |
| `POST /employees/change-requests/:reqId/reject` | `HR_MANAGER` | `{ reason }` (**Mandatory**). |
| `GET /performance/reviews` | `HR_MANAGER`, `LINE_MANAGER` (`TEAM`), `EMPLOYEE` (`SELF`) | Lists performance appraisal cycles. |
| `POST /performance/reviews` | `LINE_MANAGER` (`TEAM`), `HR_MANAGER` | Initiates review cycle for direct report. |
| `PATCH /performance/reviews/:id/self-assessment` | `EMPLOYEE` (`SELF`) | `{ selfAssessment }` $\rightarrow$ `SELF_REVIEW_SUBMITTED`. |
| `PATCH /performance/reviews/:id/manager-review` | `LINE_MANAGER` (`TEAM`) | `{ managerFeedback, rating }` (`1.00–5.00`) $\rightarrow$ `COMPLETED`. |

---

### 7.5 Attendance & Corrections (`/attendance`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /attendance/today` | `AUTHENTICATED` (`SELF`) | Returns `nowEat`, employee's `workSchedule`, today's `attendanceRecord` (if any), and allowed button state (`CAN_CHECK_IN`, `CAN_CHECK_OUT`, `COMPLETED`). |
| `POST /attendance/check-in` | `AUTHENTICATED` (`SELF`, `Idempotency-Key`) | Zero client time/GPS accepted; server evaluates `Africa/Kampala` against schedule + grace period. |
| `POST /attendance/check-out` | `AUTHENTICATED` (`SELF`) | Blocked (`422 MUST_CHECK_IN_FIRST`) unless checked in today. Computes `workedMinutes`. |
| `GET /attendance/records` | `HR_MANAGER` (`ORG`), `LINE_MANAGER` (`TEAM`), `EMPLOYEE` (`SELF`) | `?from=&to=&employeeId=&status=`. |
| `GET /attendance/corrections` | `HR_MANAGER`, `LINE_MANAGER` (`TEAM`), `EMPLOYEE` (`SELF`) | Lists pending and historical correction requests. |
| `POST /attendance/corrections` | `AUTHENTICATED` (`SELF`) | `{ workDate, requestedCheckInAt, requestedCheckOutAt?, reason }` (**Mandatory `reason`**). Blocked if period locked. |
| `POST /attendance/corrections/:id/approve` | `LINE_MANAGER` (`TEAM`/delegate), `HR_MANAGER` | Anti-self-approval. Updates attendance record, recalculates `PRESENT`/`LATE`, logs audit entry. |
| `POST /attendance/corrections/:id/reject` | `LINE_MANAGER` (`TEAM`/delegate), `HR_MANAGER` | `{ reason }` (**Mandatory**). |
| `GET /attendance/period-locks` | `HR_MANAGER`, `PAYROLL_OFFICER` | Lists locked `(year, month)` attendance periods. |
| `POST /attendance/period-locks` | `HR_MANAGER`, `PAYROLL_OFFICER` | `{ year, month }` — Locks period prior to payroll run. |

---

### 7.6 Leave Management & Delegations (`/leave`, `/delegations`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /leave/types` | `AUTHENTICATED` | Returns active leave types & HR threshold rules. |
| `GET /leave/balances` | `HR_MANAGER` (`ORG`), `LINE_MANAGER` (`TEAM`), `EMPLOYEE` (`SELF`) | `?year=&employeeId=`. |
| `POST /leave/calculate-working-days` | `AUTHENTICATED` | `{ startDate, endDate }` $\rightarrow$ returns `{ calendarDays, workingDays, excludedDates }`. |
| `GET /leave/requests` | `HR_MANAGER`, `LINE_MANAGER` (`TEAM`), `EMPLOYEE` (`SELF`) | Supports queue filters (`pendingMyApproval=true`). |
| `POST /leave/requests` | `AUTHENTICATED` (`SELF`, `Idempotency-Key`) | `multipart/form-data`: `leaveTypeId`, `startDate`, `endDate`, `reason`, `handoverEmployeeId?`, `attachment?`. Enforces no-overlap & sufficient balance. |
| `POST /leave/requests/:id/approve` | `LINE_MANAGER` (`TEAM`/delegate) or `HR_MANAGER` | Anti-self-approval. Routes to `PENDING_HR` or `APPROVED` (atomic balance + attendance update). |
| `POST /leave/requests/:id/reject` | `LINE_MANAGER` (`TEAM`/delegate) or `HR_MANAGER` | `{ reason }` (**Mandatory**). Releases `pendingDays`. |
| `POST /leave/requests/:id/cancel` | `EMPLOYEE` (`SELF`) or `HR_MANAGER` (revoke) | `{ reason? }` (mandatory if HR revoking approved leave). |
| `GET /delegations` / `POST /delegations` / `POST /delegations/:id/revoke` | `SYSTEM_ADMIN`, `HR_MANAGER`, `LINE_MANAGER` (own team) | `{ delegateUserId, startsAt, endsAt, reason }`. |

---

### 7.7 Payroll, Loans, Adjustments & Payslips (`/payroll`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /payroll/runs` & `GET /payroll/runs/:id` | `PAYROLL_OFFICER`, `HR_MANAGER` | Returns run metadata, stepper state, totals (`UGX`), and items. |
| `POST /payroll/runs` | `PAYROLL_OFFICER` (`Idempotency-Key`) | `{ year, month }` — Requires locked attendance period; computes PAYE, NSSF, LST, Loans via active policy. |
| `PATCH /payroll/runs/:runId/items/:itemId` | `PAYROLL_OFFICER` | `{ bonusOrArrearsUgx?, otherDeductionsUgx?, notes? }` — **Blocked (`423`) unless `run.status === 'DRAFT'`**. |
| `POST /payroll/runs/:id/submit` | `PAYROLL_OFFICER` | `DRAFT` $\rightarrow$ `PENDING_APPROVAL`. |
| `POST /payroll/runs/:id/return` | `HR_MANAGER` | `{ reason }` (**Mandatory**) $\rightarrow$ `DRAFT`. |
| `POST /payroll/runs/:id/approve` | `HR_MANAGER` | Separation of duties (`actor !== preparedBy`) $\rightarrow$ `APPROVED`. |
| `POST /payroll/runs/:id/lock` | `HR_MANAGER`, `PAYROLL_OFFICER` (`Idempotency-Key`) | `APPROVED` $\rightarrow$ `LOCKED`, settles loan installments, generates & stores verifiable PDF payslips. |
| `GET /payroll/runs/:id/export/bank-eft` | `PAYROLL_OFFICER`, `HR_MANAGER` | Returns CSV bank disbursement schedule (decrypts account numbers only in export stream) + logs `EXPORT_BANK_EFT` in `audit_logs`. |
| `GET /payroll/runs/:id/export/statutory` | `PAYROLL_OFFICER`, `HR_MANAGER` | Returns URA PAYE & NSSF schedule CSV + logs `EXPORT_STATUTORY`. |
| `GET /payroll/adjustments` | `PAYROLL_OFFICER`, `HR_MANAGER` | Lists post-lock adjustment requests. |
| `POST /payroll/items/:itemId/adjustments` | `PAYROLL_OFFICER` | `{ adjustmentType, category, amountUgx, reason }` (**Mandatory `reason`**). |
| `POST /payroll/adjustments/:id/approve` / `reject` | `HR_MANAGER` | Distinct from requester; reject requires `reason`. |
| `GET /payroll/my-payslips` & `GET /payroll/payslips/:id/pdf-url` | `EMPLOYEE` (`SELF`) or `PAYROLL_OFFICER`/`HR_MANAGER` | `pdf-url` enforces `SELF` or HR/Payroll scope, returns 120s pre-signed URL. |
| `GET /payroll/loans` / `POST /payroll/loans` | `PAYROLL_OFFICER`, `HR_MANAGER`, `EMPLOYEE` (`SELF` read) | Manage staff salary advances & loans. |

---

### 7.8 Company Assets (`/assets`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /assets` & `POST /assets` & `PATCH /assets/:id` | `ASSET_OFFICER`, `HR_MANAGER` (read) | Register/update items (`assetTag`, `serialNumber`, `name`, `category`, `purchaseValueUgx`, `condition`, `version`). |
| `POST /assets/:id/issue` | `ASSET_OFFICER` | `{ employeeId }` — Enforces max 1 active assignee (`409 ASSET_ALREADY_ASSIGNED`). |
| `GET /assets/my-assets` | `AUTHENTICATED` (`SELF`) | Lists employee's assigned items & pending acknowledgements. |
| `POST /assets/assignments/:id/acknowledge` | Assigned `EMPLOYEE` (`SELF`) | Marks receipt `ACKNOWLEDGED` + timestamp. |
| `POST /assets/assignments/:id/return` | `ASSET_OFFICER` | `{ returnCondition, notes? }` (`notes` required if `DAMAGED`). Frees custody lock & refreshes offboarding blockers. |
| `POST /assets/assignments/:id/incident` | `ASSET_OFFICER` | `{ outcome: 'CLOSED_DAMAGED' \| 'CLOSED_LOST', incidentNotes }` (**Mandatory `incidentNotes`**). |

---

### 7.9 Offboarding & Clearance (`/offboarding`)
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /offboarding/cases` & `GET /offboarding/cases/:id` | `HR_MANAGER`, `ASSET_OFFICER` (assets track), `PAYROLL_OFFICER` (loans track), `LINE_MANAGER` (`TEAM` handover) | Returns case, progress (`X of 4`), and live blocker details. |
| `POST /offboarding/cases` | `HR_MANAGER` | `{ employeeId, exitType, noticeDate, lastWorkingDay, exitReason }` — Creates 4 clearance tracks with live asset/loan blocker detection. |
| `POST /offboarding/cases/:id/clearances/:trackType/sign-off` | Role owning track (`ASSET_OFFICER`, `LINE_MANAGER`, `PAYROLL_OFFICER`, `HR_MANAGER`) | `{ notes? }` — Physically blocked (`422 CLEARANCE_BLOCKED`) if unreturned assets or unsettled loans exist. |
| `POST /offboarding/cases/:id/finalize` | `HR_MANAGER` | Transitions `IN_PROGRESS` $\rightarrow$ `CLEARED` ONLY when all 4 tracks are `CLEARED`. |
| `POST /offboarding/cases/:id/deactivate` | `HR_MANAGER` | Allowed once `CLEARED` and `today_eat > last_working_day`: sets `users.isActive=false`, revokes sessions, sets `employees.status='EXITED'`. |

---

### 7.10 System Admin, Audit Trail, Notifications & Internal Crons
| Method & Path | Access | Key Payload / Rules |
| :--- | :--- | :--- |
| `GET /admin/users` / `POST /admin/users` / `PATCH /admin/users/:id/role` | `SYSTEM_ADMIN` | User creation (`mustChangePassword=true`), role updates, force password reset. |
| `GET /admin/schedules` / `POST /admin/schedules` / `PATCH /admin/schedules/:id` | `SYSTEM_ADMIN`, `HR_MANAGER` | Manage shifts & grace periods (`GET` open to all authenticated users). |
| `GET /admin/holidays` / `POST /admin/holidays` / `DELETE /admin/holidays/:id` | `SYSTEM_ADMIN`, `HR_MANAGER` | Manage Ugandan public holidays (`GET` open to all authenticated users). |
| `GET /admin/tax-policies` / `POST /admin/tax-policies` | `SYSTEM_ADMIN`, `PAYROLL_OFFICER` | Versioned PAYE, NSSF, and LST configuration (`HR_MANAGER` read). |
| `GET /audit/logs` / `GET /audit/logs/export` | `SYSTEM_ADMIN` (full), `HR_MANAGER` (HR scope), `PAYROLL_OFFICER` (Payroll scope) | Read-only filterable audit stream (`from`, `to`, `actorId`, `action`, `entityType`). |
| `GET /notifications/inbox` / `PATCH /notifications/:id/read` | `AUTHENTICATED` (`SELF`) | Returns `"Pending My Action"` items + unread count. |
| `POST /internal/jobs/reconcile-attendance` | `X-Cron-Secret` header ONLY | Executes `23:55 EAT` idempotent EOD absence marking. |
| `POST /internal/jobs/process-daily-transitions` | `X-Cron-Secret` header ONLY | Executes `00:05 EAT` vacancy closing, cleared exit deactivation, and delegation expiry. |