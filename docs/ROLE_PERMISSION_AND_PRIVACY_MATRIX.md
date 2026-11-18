

### Filename: `02_ROLE_PERMISSION_AND_PRIVACY_MATRIX.md`

```markdown
# 02 — StaffHub Role, Permission & Data Privacy Matrix

## 1. Authorization Architecture: Dual-Layer RBAC + ABAC

StaffHub enforces authorization using **two combined layers** on every API request:
1. **RBAC (Role-Based Access Control):** Checks the authenticated user’s assigned system role (`SYSTEM_ADMIN`, `HR_MANAGER`, `RECRUITER`, `LINE_MANAGER`, `PAYROLL_OFFICER`, `ASSET_OFFICER`, `EMPLOYEE`) or `PUBLIC` for unauthenticated `JOB_APPLICANT` routes.
2. **ABAC (Attribute/Relationship-Based Access Control):** Verifies *ownership*, *reporting hierarchy*, *active delegation*, and *separation of duties* before returning or mutating a record (preventing IDOR — Insecure Direct Object Reference).

### 1.1 Access Scope Tiers
| Scope Code | Meaning |
| :--- | :--- |
| **`NONE`** | Access strictly denied (`403 Forbidden`); routes and UI links hidden. |
| **`PUBLIC`** | Unauthenticated public internet access (rate-limited + bot-protected). |
| **`SELF`** | Permitted **only** where `target.employeeId === currentUser.employeeId`. |
| **`TEAM`** | Permitted **only** for direct reports (`target.managerId === currentUser.employeeId`) OR an active, valid `ActingDelegation` where `currentUser` is the delegate for that employee's manager. |
| **`ORG`** | Organization-wide access across all employees/records in the permitted module. |

### 1.2 Implicit Self-Service Rule for Staff Roles
Any internal user (`HR_MANAGER`, `LINE_MANAGER`, `RECRUITER`, `PAYROLL_OFFICER`, `ASSET_OFFICER`, `SYSTEM_ADMIN`) who is linked to an `employeeId` automatically inherits **`SELF`** employee capabilities (daily browser Check-In/Check-Out, viewing own payslips, submitting own leave requests, acknowledging own assigned assets, updating own permitted contact info).
**CRITICAL SEPARATION-OF-DUTIES RULE:** No user may ever approve **their own** leave request, attendance correction, staff requisition, sensitive profile change, payroll run, or exit clearance—even if they hold `LINE_MANAGER`, `HR_MANAGER`, or `SYSTEM_ADMIN` roles. Self-requests escalate to their assigned superior or another authorized peer approver.

---

## 2. Comprehensive Module Action Matrix (All 8 Roles)

Legend: **C** = Create | **R** = Read | **U** = Update | **A** = Approve / Reject / Finalize | **X** = Export | **D** = Deactivate / Retire (Never hard-delete)

### 2.1 Identity, Security, Settings & Audit
| Capability / Resource | System Admin | HR Manager | Recruiter | Line Manager | Payroll Officer | Asset Officer | Employee | Job Applicant |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Sign In / Refresh / Sign Out / Change Own Password | `SELF` | `SELF` | `SELF` | `SELF` | `SELF` | `SELF` | `SELF` | `NONE` |
| Create User Accounts & Assign Roles | `ORG (C,R,U)` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` |
| Force Password Reset / Manual Account Lock | `ORG (U)` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` |
| Deactivate Exited User Account | `ORG (D)` | `ORG (D via Exit)` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` |
| Work Schedules, Grace Periods & Public Holidays | `ORG (C,R,U)` | `ORG (C,R,U)` | `ORG (R)` | `ORG (R)` | `ORG (R)` | `ORG (R)` | `ORG (R)` | `NONE` |
| Statutory Tax Policy (PAYE, NSSF, LST Tables) | `ORG (C,R,U)` | `ORG (R)` | `NONE` | `NONE` | `ORG (C,R,U)` | `NONE` | `NONE` | `NONE` |
| Immutable Audit Trail Viewer & Signed Export | `ORG (R,X)` | `ORG (R)` *(HR scope)* | `NONE` | `NONE` | `ORG (R)` *(Payroll scope)* | `NONE` | `NONE` | `NONE` |

### 2.2 Recruitment, Hiring & Onboarding
| Capability / Resource | System Admin | HR Manager | Recruiter | Line Manager | Payroll Officer | Asset Officer | Employee | Job Applicant |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Staff Requisition (Create & View) | `NONE` | `ORG (C,R)` | `ORG (R)` | `TEAM (C,R)` | `NONE` | `NONE` | `NONE` | `NONE` |
| Staff Requisition (Approve / Reject with Reason) | `NONE` | `ORG (A)` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` |
| Publish & Manage Approved Vacancies | `NONE` | `ORG (R,U)` | `ORG (C,R,U)` | `TEAM (R)` | `NONE` | `NONE` | `NONE` | `PUBLIC (R Open Only)` |
| Submit Public Job Application (No Account) | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `PUBLIC (C)` |
| View Applications, Shortlist & Schedule Interviews | `NONE` | `ORG (R,U)` | `ORG (R,U)` | `TEAM (R)` *(own reqs)* | `NONE` | `NONE` | `NONE` | `NONE` |
| Download Applicant CVs (Signed URL) | `NONE` | `ORG (R)` | `ORG (R)` | `TEAM (R)` *(shortlisted)* | `NONE` | `NONE` | `NONE` | `NONE` |
| Prepare Draft Job Offer | `NONE` | `ORG (C,U)` | `ORG (C,U)` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` |
| Approve / Reject Job Offer (Before Sending) | `NONE` | `ORG (A)` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` |
| Send Approved Offer & Record Candidate Acceptance | `NONE` | `ORG (U)` | `ORG (U)` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` |
| Convert Accepted Offer $\rightarrow$ Employee Record | `NONE` | `ORG (C)` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` |
| Onboarding Checklist Tasks | `NONE` | `ORG (R,U)` | `ORG (R)` | `TEAM (R,U)` *(Mgr tasks)* | `NONE` | `ORG (R,U)` *(Asset tasks)* | `SELF (R,U)` *(Hire tasks)* | `NONE` |

### 2.3 Employee Records & Performance
| Capability / Resource | System Admin | HR Manager | Recruiter | Line Manager | Payroll Officer | Asset Officer | Employee | Job Applicant |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Employee Directory (Basic Work Info: Name, Title, Dept, Work Email) | `ORG (R)` | `ORG (C,R,U,X)` | `ORG (R)` | `TEAM (R)` | `ORG (R)` | `ORG (R)` | `ORG (R basic)` | `NONE` |
| Full Employee HR Profile (incl. Emergency Contact, Contract) | `NONE` | `ORG (C,R,U)` | `NONE` | `TEAM (R non-sensitive)` | `ORG (R pay-related)` | `NONE` | `SELF (R)` | `NONE` |
| Update Permitted Contact Details (Phone, Address, Emergency) | `SELF (U)` | `ORG (U)` | `SELF (U)` | `SELF (U)` | `SELF (U)` | `SELF (U)` | `SELF (U)` | `NONE` |
| Request Sensitive Profile Change (Legal Name, Bank, NIN) | `SELF (C)` | `ORG (C)` | `SELF (C)` | `SELF (C)` | `SELF (C)` | `SELF (C)` | `SELF (C)` | `NONE` |
| Approve / Reject Sensitive Profile Change | `NONE` | `ORG (A)` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` |
| Performance Reviews (Create, Submit, Review) | `NONE` | `ORG (R,X)` | `NONE` | `TEAM (C,R,U)` | `NONE` | `NONE` | `SELF (R,U self-eval)` | `NONE` |

### 2.4 Attendance & Leave
| Capability / Resource | System Admin | HR Manager | Recruiter | Line Manager | Payroll Officer | Asset Officer | Employee | Job Applicant |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Daily Browser Check-In / Check-Out | `SELF (C,U)` | `SELF (C,U)` | `SELF (C,U)` | `SELF (C,U)` | `SELF (C,U)` | `SELF (C,U)` | `SELF (C,U)` | `NONE` |
| View Attendance Records | `SELF (R)` | `ORG (R,X)` | `SELF (R)` | `TEAM (R)` | `ORG (R locked summary)` | `SELF (R)` | `SELF (R)` | `NONE` |
| Request Attendance Correction (Reason Required) | `SELF (C)` | `SELF (C)` | `SELF (C)` | `SELF (C)` | `SELF (C)` | `SELF (C)` | `SELF (C)` | `NONE` |
| Approve / Reject Attendance Correction (Reason Required on Reject) | `NONE` | `ORG (A override)` | `NONE` | `TEAM (A)` | `NONE` | `NONE` | `NONE` | `NONE` |
| Lock Monthly Attendance Period for Payroll | `NONE` | `ORG (A)` | `NONE` | `NONE` | `ORG (R,A)` | `NONE` | `NONE` | `NONE` |
| Submit / Cancel Own Leave Request | `SELF (C,U)` | `SELF (C,U)` | `SELF (C,U)` | `SELF (C,U)` | `SELF (C,U)` | `SELF (C,U)` | `SELF (C,U)` | `NONE` |
| Approve / Reject Leave Request (Stage 1: Manager) | `NONE` | `ORG (A fallback)` | `NONE` | `TEAM (A)` | `NONE` | `NONE` | `NONE` | `NONE` |
| Approve / Reject Leave Request (Stage 2: HR where required) | `NONE` | `ORG (A)` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` | `NONE` |
| Configure / Adjust Annual Leave Balances | `NONE` | `ORG (C,R,U)` | `NONE` | `TEAM (R)` | `ORG (R)` | `NONE` | `SELF (R)` | `NONE` |
| Configure Temporary Acting Approver Delegation | `ORG (C,R,U)` | `ORG (C,R,U)` | `NONE` | `TEAM (C own team)` | `NONE` | `NONE` | `NONE` | `NONE` |

### 2.5 Payroll, Assets & Offboarding
| Capability / Resource | System Admin | HR Manager | Recruiter | Line Manager | Payroll Officer | Asset Officer | Employee | Job Applicant |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Prepare Monthly Payroll Run (`DRAFT` $\rightarrow$ `PENDING_APPROVAL`) | `NONE` | `NONE` | `NONE` | `NONE` | `ORG (C,R,U)` | `NONE` | `NONE` | `NONE` |
| Review & Approve Payroll Run (`APPROVED` $\rightarrow$ `LOCKED`) | `NONE` | `ORG (A)` | `NONE` | `NONE` | `NONE` *(Separation of Duties)* | `NONE` | `NONE` | `NONE` |
| Create Authorised Adjustment on Locked Payroll | `NONE` | `ORG (A)` | `NONE` | `NONE` | `ORG (C,R)` | `NONE` | `NONE` | `NONE` |
| View / Download Payslips & Payment Reports | `SELF (R)` | `ORG (R,X)` | `SELF (R)` | `SELF (R own only)` | `ORG (R,X)` | `SELF (R own only)` | `SELF (R own only)` | `NONE` |
| Public Payslip QR Authenticity Verification | `PUBLIC` | `PUBLIC` | `PUBLIC` | `PUBLIC` | `PUBLIC` | `PUBLIC` | `PUBLIC` | `PUBLIC` *(validity + masked name only)* |
| Register Assets, Issue to Staff & Log Returns/Damage/Loss | `NONE` | `ORG (R)` | `NONE` | `TEAM (R list only)` | `NONE` | `ORG (C,R,U,D)` | `SELF (R assigned)` | `NONE` |
| Acknowledge Receipt of Assigned Asset | `SELF (U)` | `SELF (U)` | `SELF (U)` | `SELF (U)` | `SELF (U)` | `SELF (U)` | `SELF (U)` | `NONE` |
| Initiate Employee Offboarding Exit Process | `NONE` | `ORG (C,R,U)` | `NONE` | `TEAM (R handover)` | `ORG (R loan check)` | `ORG (R asset check)` | `SELF (R own exit)` | `NONE` |
| Sign Off Clearance Track (Handover / Assets / Loans / HR) | `NONE` | `ORG (A HR/Final)` | `NONE` | `TEAM (A handover)` | `ORG (A loans)` | `ORG (A assets)` | `NONE` | `NONE` |

---

## 3. Field-Level Privacy & DTO Projection Rules (Anti-Leak Contract)

Backend services MUST NEVER execute `SELECT *` and return raw Prisma objects to controllers. Every endpoint MUST pass data through an explicit **Role-Scoped Response Mapper (DTO)** adhering strictly to this field-visibility matrix:

| Data Field / Attribute | HR Manager | Payroll Officer | Employee (`SELF`) | Line Manager (`TEAM`) | Asset Officer | Recruiter | System Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Work Identity (`fullName`, `empCode`, `workEmail`, `jobTitle`, `dept`, `status`) | `FULL` | `FULL` | `FULL` | `FULL` | `FULL` | `FULL` | `FULL` |
| Contact Info (`phone`, `personalEmail`, `address`, `emergencyContact`) | `FULL` | `OMITTED` | `FULL` | `OMITTED` *(except emergency work contact if policy allows)* | `OMITTED` | `OMITTED` | `OMITTED` |
| **Base Salary & Allowances (`UGX`)** | `FULL` *(UI masked + Reveal)* | `FULL` | `FULL` *(UI masked + Reveal)* | **`OMITTED`** | **`OMITTED`** | **`OMITTED`** *(Offer prep only on candidate)* | **`OMITTED`** |
| **Bank Name, Branch & Account Number** | `MASKED + REVEAL` | `FULL` *(for EFT)* | `MASKED + REVEAL` | **`OMITTED`** | **`OMITTED`** | **`OMITTED`** | **`OMITTED`** |
| **National ID (`NIN`)** | `MASKED + REVEAL` | `MASKED + REVEAL` | `MASKED + REVEAL` | **`OMITTED`** | **`OMITTED`** | **`OMITTED`** | **`OMITTED`** |
| **URA TIN & NSSF Number** | `FULL` | `FULL` | `FULL` | **`OMITTED`** | **`OMITTED`** | **`OMITTED`** | **`OMITTED`** |
| **Leave Request Medical/Private Reason** | `FULL` | `OMITTED` | `FULL` | `FULL` *(direct manager review)* | `OMITTED` | `OMITTED` | `OMITTED` |
| **Own Payslips vs. Other Staff Payslips** | `ORG FULL` | `ORG FULL` | `SELF ONLY` | **`SELF ONLY`** | **`SELF ONLY`** | **`SELF ONLY`** | **`SELF ONLY`** |
| **Asset Book Value (`UGX`)** | `FULL` | `FULL` | `OMITTED` | `OMITTED` | `FULL` | `OMITTED` | `OMITTED` |
| **QR Verification Endpoint (`/verify/:code`)** | — | — | — | — | — | — | Returns ONLY: `isValid`, `payPeriod`, `maskedName` (`B*** K***`), `netPayHashMatch` |

> **`OMITTED`** means the key is **physically absent** from the HTTP JSON response payload—not merely hidden in React CSS.

---

## 4. Mandatory Server-Side Anti-IDOR & Security Checks

Every controller/service handling a resource ID (`:id`, `:employeeId`, `:payslipId`) MUST execute these server-side guards:

1. **Self-Only Guard (`SELF`):**
   - Check `target.employeeId === req.user.employeeId`. Reject mismatches with `403 Forbidden` (log security denial).
2. **Line Manager Hierarchy Guard (`TEAM`):**
   - Fetch `targetEmployee.managerId`. Allow access ONLY if:
     - `targetEmployee.managerId === req.user.employeeId`, **OR**
     - There exists an active `ActingDelegation` (`delegatorId = targetEmployee.managerId`, `delegateId = req.user.employeeId`, `isActive = true`, `startsAt <= now <= endsAt`).
   - Also block self-approval (`targetEmployee.id !== req.user.employeeId`).
3. **Mass Assignment Prevention:**
   - Global NestJS `ValidationPipe` configured with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.
   - Separate DTOs per role: e.g., `UpdateOwnContactDto` accepts ONLY `[phone, personalEmail, residentialAddress, emergencyContactName, emergencyContactPhone]`. Sending `role`, `baseSalaryUgx`, `managerId`, `status`, or `bankAccountNumber` triggers an immediate `400 Bad Request`.
4. **Deactivated User Lockout:**
   - Every authenticated request checks `user.isActive === true` (cached briefly or checked on DB/token revocation list). Once deactivated after `lastWorkingDay`, any existing JWT or Refresh Token is rejected with `401 Unauthorized`.
5. **Payroll Separation of Duties:**
   - On `approvePayrollRun(runId, actor)`, enforce `payrollRun.preparedByUserId !== actor.userId` (unless an emergency single-admin demo override is disabled—in standard enforcement, preparer and approver MUST be two distinct users).

---

## 5. Acting Approver Delegation Rules

1. **Who Can Delegate:** A `LINE_MANAGER` (for their team approvals), `HR_MANAGER`, or `SYSTEM_ADMIN` on their behalf.
2. **Who Can Receive Delegation:** Any active internal employee at peer or senior level (cannot delegate to an `EXITED` user or an employee reporting to the same request).
3. **Time-Bounded Scope:** Requires `startsAt` and `endsAt` (`EAT`). Expired delegations automatically cease to authorize requests.
4. **Audit Transparency:** Any approval/rejection executed under delegation stores both `actedByUserId` and `onBehalfOfUserId` in `audit_logs` and displays: *"Approved by Grace Akello (Acting for Michael Kigozi)"*.
```

---

### Ready for File 4?
Next up is **`03_DATABASE_SCHEMA_AND_CONSTRAINTS.md`**—which defines **every single PostgreSQL 16 table, column type, foreign key, partial unique index, `CHECK` constraint, optimistic-locking `version` column, encrypted PII column, and append-only audit table**.

Because the full database schema is extensive and we agreed never to summarize or truncate, I will split **`03_DATABASE_SCHEMA_AND_CONSTRAINTS.md`** cleanly into **Part 1 of 2** (Identity, Org, Audit, Recruitment, Employees) and **Part 2 of 2** (Attendance, Leave, Payroll, Assets, Offboarding, Notifications).

Shall I proceed to **`03_DATABASE_SCHEMA_AND_CONSTRAINTS.md` (Part 1 of 2)**?
Here is **File 4 of 10** (`03_DATABASE_SCHEMA_AND_CONSTRAINTS.md`), split cleanly into **Part 1 of 2** and **Part 2 of 2** so every column, PostgreSQL data type, `CHECK` constraint, and index is preserved in full detail.

---

### Filename: `03_DATABASE_SCHEMA_AND_CONSTRAINTS.md` *(Part 1 of 2)*

```markdown
# 03 — StaffHub PostgreSQL 16 Database Schema & Integrity Constraints (Part 1 of 2)

## 1. Global Database Standards & Invariants

- **Engine:** PostgreSQL 16 (`pgcrypto` extension enabled for `gen_random_uuid()`).
- **ORM Mapping:** Defined in `apps/api/prisma/schema.prisma`, paired with raw SQL migration adjustments for **partial unique indexes**, **functional case-insensitive indexes**, and **`CHECK` constraints** that Prisma syntax alone does not express natively.
- **Primary Keys:** `UUID` (`gen_random_uuid()`).
- **Timestamps:** `TIMESTAMPTZ` stored strictly in UTC; calendar-day business columns (`work_date`, `start_date`, `end_date`, `holiday_date`, `last_working_day`) use `DATE` interpreted strictly in `Africa/Kampala` (`EAT`, `UTC+3`).
- **Monetary Precision (`UGX`):** `NUMERIC(14, 2)` across all salary, allowance, tax, deduction, adjustment, loan, and asset-value columns. Never use floating-point (`REAL`, `DOUBLE PRECISION`).
- **Retention & Soft Deactivation:** Foreign keys on core workforce, payroll, asset, and audit tables MUST use `ON DELETE RESTRICT`—never `ON DELETE CASCADE`—making accidental permanent deletion of employee or financial history impossible at the database level.
- **Encrypted PII Storage:** Sensitive columns (`nin_encrypted`, `bank_account_encrypted`) store `AES-256-GCM` payloads formatted as `v1:<base64_iv>:<base64_auth_tag>:<base64_ciphertext>`.
- **Optimistic Concurrency Control:** High-contention mutable tables (`employees`, `leave_balances`, `payroll_runs`, `assets`, `offboarding_cases`) carry `version INTEGER NOT NULL DEFAULT 1`. Every update increments `version` inside `WHERE id = $1 AND version = $2`.

---

## 2. PostgreSQL Enumerated Types

```sql
CREATE TYPE user_role AS ENUM (
  'SYSTEM_ADMIN',
  'HR_MANAGER',
  'RECRUITER',
  'LINE_MANAGER',
  'PAYROLL_OFFICER',
  'ASSET_OFFICER',
  'EMPLOYEE'
);

CREATE TYPE employee_status AS ENUM (
  'ONBOARDING',
  'ACTIVE',
  'OFFBOARDING',
  'EXITED'
);

CREATE TYPE requisition_status AS ENUM (
  'PENDING_HR',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE vacancy_status AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'CLOSED',
  'FILLED'
);

CREATE TYPE application_status AS ENUM (
  'APPLIED',
  'SHORTLISTED',
  'INTERVIEWING',
  'OFFER_STAGE',
  'HIRED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TYPE offer_status AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SENT',
  'ACCEPTED',
  'DECLINED',
  'CONVERTED'
);

CREATE TYPE onboarding_task_role AS ENUM (
  'HR_MANAGER',
  'LINE_MANAGER',
  'EMPLOYEE',
  'ASSET_OFFICER'
);

CREATE TYPE sensitive_change_field AS ENUM (
  'LEGAL_NAME',
  'BANK_DETAILS',
  'NATIONAL_ID_NIN'
);

CREATE TYPE approval_status AS ENUM (
  'PENDING',
  'PENDING_HR',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE attendance_status AS ENUM (
  'PRESENT_ON_TIME',
  'PRESENT_GRACE',
  'LATE',
  'ABSENT',
  'ON_LEAVE',
  'HOLIDAY',
  'DAY_OFF'
);

CREATE TYPE tax_residency AS ENUM (
  'RESIDENT',
  'NON_RESIDENT'
);

CREATE TYPE payroll_run_status AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'LOCKED'
);

CREATE TYPE asset_condition AS ENUM (
  'NEW',
  'GOOD',
  'FAIR',
  'DAMAGED',
  'LOST',
  'RETIRED'
);

CREATE TYPE asset_assignment_status AS ENUM (
  'PENDING_ACKNOWLEDGEMENT',
  'ACKNOWLEDGED',
  'RETURNED',
  'CLOSED_DAMAGED',
  'CLOSED_LOST'
);

CREATE TYPE offboarding_exit_type AS ENUM (
  'RESIGNATION',
  'CONTRACT_EXPIRY',
  'TERMINATION',
  'RETIREMENT'
);

CREATE TYPE offboarding_status AS ENUM (
  'IN_PROGRESS',
  'CLEARED',
  'DEACTIVATED'
);

CREATE TYPE clearance_track_type AS ENUM (
  'ASSET_RETURN',
  'OPERATIONAL_HANDOVER',
  'FINANCE_LOANS',
  'HR_EXIT'
);

CREATE TYPE clearance_status AS ENUM (
  'PENDING',
  'BLOCKED',
  'CLEARED'
);
```

---

## 3. Domain 1: Identity, Authentication & Delegations

### 3.1 `users`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | User account ID |
| `email` | `VARCHAR(255)` | `NOT NULL` | Unique case-insensitive via functional index |
| `password_hash` | `TEXT` | `NOT NULL` | `Argon2id` hash |
| `role` | `user_role` | `NOT NULL` | Primary assigned system role |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT true` | Set `false` after exit `last_working_day` |
| `must_change_password` | `BOOLEAN` | `NOT NULL DEFAULT true` | Forced reset on first sign-in or admin reset |
| `failed_login_attempts` | `INTEGER` | `NOT NULL DEFAULT 0` | Brute-force lockout counter |
| `locked_until` | `TIMESTAMPTZ` | `NULL` | Temporary lock expiry on repeated failures |
| `last_login_at` | `TIMESTAMPTZ` | `NULL` | Audit reference |
| `deactivated_at` | `TIMESTAMPTZ` | `NULL` | Populated on offboarding account closure |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Indexes:**
  - `CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(TRIM(email)));`

### 3.2 `refresh_tokens`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Token record ID |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `token_hash` | `CHAR(64)` | `NOT NULL UNIQUE` | SHA-256 hex digest of opaque refresh token |
| `family_id` | `UUID` | `NOT NULL` | Detects refresh-token reuse attacks |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | 7 days TTL |
| `revoked_at` | `TIMESTAMPTZ` | `NULL` | Revoked on logout, password change, or exit |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Indexes:** `CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens (user_id) WHERE revoked_at IS NULL;`

### 3.3 `acting_delegations`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `delegator_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Principal manager/HR |
| `delegate_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Acting approver |
| `scope` | `VARCHAR(40)` | `NOT NULL DEFAULT 'APPROVALS'` | e.g., `LINE_APPROVALS`, `HR_APPROVALS` |
| `starts_at` | `TIMESTAMPTZ` | `NOT NULL` | Effective start |
| `ends_at` | `TIMESTAMPTZ` | `NOT NULL` | Effective end |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT true` | Can be revoked early |
| `reason` | `TEXT` | `NOT NULL` | e.g., Annual leave coverage |
| `created_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraints:** `CHECK (delegator_user_id <> delegate_user_id)`, `CHECK (ends_at > starts_at)`

---

## 4. Domain 2: Organization Structure & Configurable Policies

### 4.1 `departments`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `code` | `VARCHAR(24)` | `NOT NULL UNIQUE` | e.g., `FIN-OPS`, `ENG`, `HR-ADM` |
| `name` | `VARCHAR(120)` | `NOT NULL UNIQUE` | e.g., `Finance & Operations` |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT true` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 4.2 `work_schedules`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `name` | `VARCHAR(120)` | `NOT NULL UNIQUE` | e.g., `Kampala Standard Office (Mon–Fri)` |
| `shift_start_time` | `TIME` | `NOT NULL DEFAULT '08:00:00'` | Local `Africa/Kampala` time |
| `shift_end_time` | `TIME` | `NOT NULL DEFAULT '17:00:00'` | Local `Africa/Kampala` time |
| `grace_period_minutes` | `INTEGER` | `NOT NULL DEFAULT 15` | `CHECK (grace_period_minutes >= 0 AND grace_period_minutes <= 120)` |
| `working_days_bitmap` | `SMALLINT[]` | `NOT NULL DEFAULT '{1,2,3,4,5}'` | ISO weekday integers `1=Mon ... 7=Sun` |
| `is_default` | `BOOLEAN` | `NOT NULL DEFAULT false` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 4.3 `public_holidays`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `holiday_date` | `DATE` | `NOT NULL UNIQUE` | Calendar date in `Africa/Kampala` |
| `name` | `VARCHAR(150)` | `NOT NULL` | e.g., `Independence Day`, `NRM Liberation Day` |
| `year` | `INTEGER` | `NOT NULL` | Indexed for yearly calendar queries |
| `created_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 4.4 `statutory_tax_policies`
Versioned Ugandan statutory deduction configuration (never hardcoded in application logic):
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `policy_name` | `VARCHAR(120)` | `NOT NULL` | e.g., `Uganda FY 2026/27 Statutory Policy` |
| `effective_from` | `DATE` | `NOT NULL` | e.g., `2026-07-01` |
| `effective_to` | `DATE` | `NULL` | `NULL` = currently active |
| `nssf_employee_rate` | `NUMERIC(5,4)` | `NOT NULL DEFAULT 0.0500` | `5%` |
| `nssf_employer_rate` | `NUMERIC(5,4)` | `NOT NULL DEFAULT 0.1000` | `10%` |
| `paye_resident_brackets` | `JSONB` | `NOT NULL` | Array of `{minUgx, maxUgx, baseTaxUgx, rate}` |
| `paye_non_resident_brackets` | `JSONB` | `NOT NULL` | Non-resident monthly schedule |
| `lst_tiers` | `JSONB` | `NOT NULL` | Annual LST bands up to `100,000 UGX` |
| `lst_collection_months` | `SMALLINT[]` | `NOT NULL DEFAULT '{7,8,9,10}'` | Default Jul–Oct (4 equal instalments) |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT true` | |
| `created_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

---

## 5. Domain 3: Immutable Audit Trail & Idempotency

### 5.1 `audit_logs` *(Append-Only — Application Role Granted `INSERT, SELECT` Only)*
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `actor_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | `NULL` only for system cron/public actions |
| `actor_role` | `VARCHAR(40)` | `NOT NULL` | Role snapshot at time of action |
| `on_behalf_of_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Set when acting under delegation |
| `action` | `VARCHAR(80)` | `NOT NULL` | e.g., `LEAVE_REJECTED`, `PAYROLL_LOCKED`, `EXPORT_EFT` |
| `entity_type` | `VARCHAR(60)` | `NOT NULL` | e.g., `PayrollRun`, `LeaveRequest`, `Employee` |
| `entity_id` | `UUID` | `NULL` | Target primary key |
| `old_values` | `JSONB` | `NULL` | Redacted pre-change snapshot |
| `new_values` | `JSONB` | `NULL` | Redacted post-change snapshot |
| `reason` | `TEXT` | `NULL` | Mandatory for rejections, corrections, adjustments |
| `ip_address` | `INET` | `NULL` | Request origin IP |
| `request_id` | `UUID` | `NULL` | Correlation trace ID |
| `checksum_sha256` | `CHAR(64)` | `NOT NULL` | Integrity digest over payload + previous log link |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Indexes:**
  - `CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);`
  - `CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);`
  - `CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_user_id, created_at DESC);`

### 5.2 `idempotency_keys`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `key` | `VARCHAR(128)` | `PRIMARY KEY` | Client-supplied UUID key |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `endpoint` | `VARCHAR(150)` | `NOT NULL` | |
| `request_hash` | `CHAR(64)` | `NOT NULL` | |
| `response_status` | `INTEGER` | `NOT NULL` | |
| `response_body` | `JSONB` | `NOT NULL` | Cached deterministic replay |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | 24h TTL |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

---

## 6. Domain 4: Recruitment, Offers & Onboarding

### 6.1 `staff_requisitions`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `requisition_code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `REQ-2026-014` |
| `requested_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Line Manager or HR |
| `department_id` | `UUID` | `NOT NULL REFERENCES departments(id) ON DELETE RESTRICT` | |
| `job_title` | `VARCHAR(150)` | `NOT NULL` | |
| `headcount` | `INTEGER` | `NOT NULL DEFAULT 1` | `CHECK (headcount >= 1)` |
| `employment_type` | `VARCHAR(40)` | `NOT NULL` | `FULL_TIME`, `CONTRACT`, `INTERN` |
| `justification` | `TEXT` | `NOT NULL` | Business rationale |
| `target_start_date` | `DATE` | `NOT NULL` | |
| `status` | `requisition_status` | `NOT NULL DEFAULT 'PENDING_HR'` | |
| `reviewed_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | HR Manager |
| `reviewed_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Required if `REJECTED` |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 6.2 `vacancies`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `vacancy_code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `VAC-2026-042` |
| `requisition_id` | `UUID` | `NOT NULL UNIQUE REFERENCES staff_requisitions(id) ON DELETE RESTRICT` | 1 approved requisition $\rightarrow$ 1 vacancy |
| `published_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Recruiter |
| `title` | `VARCHAR(150)` | `NOT NULL` | |
| `location` | `VARCHAR(120)` | `NOT NULL DEFAULT 'Kampala HQ'` | |
| `description` | `TEXT` | `NOT NULL` | |
| `requirements` | `TEXT` | `NOT NULL` | |
| `salary_band_min_ugx` | `NUMERIC(14,2)` | `NULL` | Optional public range |
| `salary_band_max_ugx` | `NUMERIC(14,2)` | `NULL` | `CHECK (salary_band_max_ugx IS NULL OR salary_band_min_ugx IS NULL OR salary_band_max_ugx >= salary_band_min_ugx)` |
| `closing_at` | `TIMESTAMPTZ` | `NOT NULL` | Enforced in `Africa/Kampala` |
| `status` | `vacancy_status` | `NOT NULL DEFAULT 'DRAFT'` | |
| `published_at` | `TIMESTAMPTZ` | `NULL` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 6.3 `job_applications`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `application_code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `APP-84920` |
| `vacancy_id` | `UUID` | `NOT NULL REFERENCES vacancies(id) ON DELETE RESTRICT` | |
| `full_name` | `VARCHAR(150)` | `NOT NULL` | |
| `applicant_email` | `VARCHAR(255)` | `NOT NULL` | Stored trimmed; uniqueness enforced below |
| `phone` | `VARCHAR(40)` | `NOT NULL` | e.g., `+256 772 491 803` |
| `expected_gross_ugx` | `NUMERIC(14,2)` | `NULL` | |
| `earliest_start_date` | `DATE` | `NULL` | |
| `cover_note` | `TEXT` | `NOT NULL` | |
| `cv_storage_key` | `TEXT` | `NOT NULL` | Private S3/MinIO/R2 object key |
| `cv_original_filename` | `VARCHAR(255)` | `NOT NULL` | |
| `cv_mime_type` | `VARCHAR(100)` | `NOT NULL` | Validated via magic bytes |
| `status` | `application_status` | `NOT NULL DEFAULT 'APPLIED'` | |
| `stage_notes` | `TEXT` | `NULL` | Recruiter shortlisting notes / reject reason |
| `submitted_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **CRITICAL CONSTRAINT:** `CREATE UNIQUE INDEX uq_application_vacancy_email ON job_applications (vacancy_id, LOWER(TRIM(applicant_email)));` (Guarantees an applicant cannot apply twice to the same vacancy using the same email.)

### 6.4 `interviews`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `application_id` | `UUID` | `NOT NULL REFERENCES job_applications(id) ON DELETE RESTRICT` | |
| `scheduled_at` | `TIMESTAMPTZ` | `NOT NULL` | Kampala EAT |
| `interview_mode` | `VARCHAR(40)` | `NOT NULL` | `IN_PERSON`, `VIDEO_CALL`, `PANEL` |
| `location_or_link` | `VARCHAR(255)` | `NOT NULL` | |
| `interviewer_user_ids` | `UUID[]` | `NOT NULL` | Panel members |
| `score` | `NUMERIC(4,2)` | `NULL` | e.g., `4.50` / `5.00` |
| `feedback` | `TEXT` | `NULL` | |
| `outcome` | `VARCHAR(30)` | `NOT NULL DEFAULT 'SCHEDULED'` | `SCHEDULED`, `PASSED`, `FAILED`, `CANCELLED` |
| `created_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 6.5 `job_offers`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `application_id` | `UUID` | `NOT NULL UNIQUE REFERENCES job_applications(id) ON DELETE RESTRICT` | |
| `prepared_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Recruiter |
| `offered_job_title` | `VARCHAR(150)` | `NOT NULL` | |
| `department_id` | `UUID` | `NOT NULL REFERENCES departments(id) ON DELETE RESTRICT` | |
| `reporting_manager_id` | `UUID` | `NULL` | FK added to `employees(id)` after `employees` definition |
| `offered_base_salary_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (offered_base_salary_ugx > 0)` | |
| `offered_allowances_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0 CHECK (offered_allowances_ugx >= 0)` | |
| `proposed_start_date` | `DATE` | `NOT NULL` | |
| `offer_expires_at` | `TIMESTAMPTZ` | `NOT NULL` | |
| `status` | `offer_status` | `NOT NULL DEFAULT 'DRAFT'` | |
| `approved_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Must be `HR_MANAGER` |
| `approved_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Required if `REJECTED` |
| `sent_at` | `TIMESTAMPTZ` | `NULL` | |
| `accepted_at` | `TIMESTAMPTZ` | `NULL` | |
| `offer_pdf_storage_key` | `TEXT` | `NULL` | Private generated offer letter PDF |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraint:** `CHECK (status NOT IN ('APPROVED','SENT','ACCEPTED','CONVERTED') OR approved_by_user_id IS NOT NULL)` (Database-level guarantee that an offer CANNOT be sent or accepted without prior HR approval.)

---

## 7. Domain 5: Employee Records, Onboarding, Sensitive Changes & Performance

### 7.1 `employees`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `UG-EMP-0518` |
| `user_id` | `UUID` | `NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT` | Linked login account |
| `converted_from_offer_id` | `UUID` | `NULL UNIQUE REFERENCES job_offers(id) ON DELETE RESTRICT` | Enforces 1 accepted offer $\rightarrow$ max 1 employee |
| `legal_name` | `VARCHAR(160)` | `NOT NULL` | HR-approved legal name |
| `work_email` | `VARCHAR(255)` | `NOT NULL UNIQUE` | |
| `personal_email` | `VARCHAR(255)` | `NULL` | Self-service editable |
| `phone` | `VARCHAR(40)` | `NOT NULL` | Self-service editable |
| `residential_address` | `TEXT` | `NULL` | Self-service editable |
| `emergency_contact_name` | `VARCHAR(150)` | `NULL` | Self-service editable |
| `emergency_contact_phone` | `VARCHAR(40)` | `NULL` | Self-service editable |
| `job_title` | `VARCHAR(150)` | `NOT NULL` | |
| `employment_type` | `VARCHAR(40)` | `NOT NULL` | `FULL_TIME`, `CONTRACT`, `INTERN` |
| `department_id` | `UUID` | `NOT NULL REFERENCES departments(id) ON DELETE RESTRICT` | |
| `manager_id` | `UUID` | `NULL REFERENCES employees(id) ON DELETE RESTRICT` | Direct Line Manager |
| `work_schedule_id` | `UUID` | `NOT NULL REFERENCES work_schedules(id) ON DELETE RESTRICT` | |
| `hire_date` | `DATE` | `NOT NULL` | |
| `last_working_day` | `DATE` | `NULL` | Set during offboarding |
| `status` | `employee_status` | `NOT NULL DEFAULT 'ONBOARDING'` | |
| `tax_residency` | `tax_residency` | `NOT NULL DEFAULT 'RESIDENT'` | |
| `base_salary_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (base_salary_ugx >= 0)` | Restricted to HR, Payroll, Self |
| `recurring_allowances_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0 CHECK (recurring_allowances_ugx >= 0)` | Housing/transport etc. |
| `bank_name` | `VARCHAR(120)` | `NULL` | Restricted |
| `bank_branch` | `VARCHAR(120)` | `NULL` | Restricted |
| `bank_account_encrypted` | `TEXT` | `NULL` | `AES-256-GCM` ciphertext |
| `bank_account_last4` | `CHAR(4)` | `NULL` | Safe masked display suffix |
| `nin_encrypted` | `TEXT` | `NULL` | `AES-256-GCM` National ID ciphertext |
| `nin_last4` | `CHAR(4)` | `NULL` | Masked suffix |
| `ura_tin` | `VARCHAR(30)` | `NULL` | Restricted |
| `nssf_number` | `VARCHAR(30)` | `NULL` | Restricted |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | Optimistic lock |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraints:** `CHECK (manager_id IS NULL OR manager_id <> id)` (Prevents circular self-management).

### 7.2 `onboarding_checklists` & `onboarding_tasks`
- **`onboarding_checklists`:** `id (PK)`, `employee_id (UUID UNIQUE NOT NULL REFERENCES employees(id) ON DELETE RESTRICT)`, `status ('IN_PROGRESS' | 'COMPLETED')`, `completed_at (TIMESTAMPTZ NULL)`, `created_at`.
- **`onboarding_tasks`:** `id (PK)`, `checklist_id (UUID NOT NULL REFERENCES onboarding_checklists(id) ON DELETE RESTRICT)`, `assigned_role (onboarding_task_role NOT NULL)`, `assigned_user_id (UUID NULL REFERENCES users(id))`, `title (VARCHAR 200 NOT NULL)`, `is_completed (BOOLEAN DEFAULT false)`, `completed_by_user_id (UUID NULL)`, `completed_at (TIMESTAMPTZ NULL)`, `sort_order (INTEGER NOT NULL)`.

### 7.3 `profile_change_requests`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `field_type` | `sensitive_change_field` | `NOT NULL` | `LEGAL_NAME`, `BANK_DETAILS`, `NATIONAL_ID_NIN` |
| `old_value_json` | `JSONB` | `NOT NULL` | Snapshot (account/NIN encrypted or masked) |
| `new_value_json` | `JSONB` | `NOT NULL` | Requested update payload |
| `supporting_doc_key` | `TEXT` | `NULL` | Private S3 key (e.g., Bank Verification Letter PDF) |
| `request_reason` | `TEXT` | `NOT NULL` | |
| `status` | `approval_status` | `NOT NULL DEFAULT 'PENDING_HR'` | |
| `reviewed_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | HR Manager (must != employee's user_id) |
| `reviewed_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Required if `REJECTED` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 7.4 `performance_reviews`
- `id (PK)`, `employee_id (UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT)`, `reviewer_manager_id (UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT)`, `review_period (VARCHAR 60 NOT NULL)`, `objectives_json (JSONB NOT NULL)`, `self_assessment (TEXT NULL)`, `manager_feedback (TEXT NULL)`, `rating (NUMERIC(3,2) NULL CHECK (rating >= 1.00 AND rating <= 5.00))`, `status ('DRAFT' | 'SELF_REVIEW_SUBMITTED' | 'COMPLETED')`, `completed_at (TIMESTAMPTZ NULL)`, `created_at`, `updated_at`.
```

---

### Ready for Part 2 of 2?
Next is **`03_DATABASE_SCHEMA_AND_CONSTRAINTS.md` (Part 2 of 2)** covering **Attendance, Leave, Payroll & Adjustments & Payslips, Assets, Offboarding & Clearance Blockers, Notifications, and Essential Composite Indexes**.

Shall I output **Part 2 of 2** now?
Here is **Part 2 of 2** of **`03_DATABASE_SCHEMA_AND_CONSTRAINTS.md`**, completing all remaining domains, partial unique indexes, PostgreSQL exclusion constraints, and database-level immutability guards.

---

### Filename: `03_DATABASE_SCHEMA_AND_CONSTRAINTS.md` *(Part 2 of 2)*

```markdown
# 03 — StaffHub PostgreSQL 16 Database Schema & Integrity Constraints (Part 2 of 2)

*(Requires PostgreSQL extensions `pgcrypto` and `btree_gist` for range exclusion constraints.)*

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Deferred FK from Part 1 (now that `employees` exists)
ALTER TABLE job_offers
  ADD CONSTRAINT fk_job_offers_reporting_manager
  FOREIGN KEY (reporting_manager_id) REFERENCES employees(id) ON DELETE RESTRICT;
```

---

## 8. Domain 6: Attendance, Corrections & Period Locks

### 8.1 `attendance_records`
*(Strictly zero biometric or GPS coordinate columns.)*
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `work_date` | `DATE` | `NOT NULL` | Calendar day in `Africa/Kampala` (`EAT`) |
| `schedule_id` | `UUID` | `NOT NULL REFERENCES work_schedules(id) ON DELETE RESTRICT` | Snapshot of active schedule for that day |
| `check_in_at` | `TIMESTAMPTZ` | `NULL` | UTC timestamp of browser check-in |
| `check_out_at` | `TIMESTAMPTZ` | `NULL` | UTC timestamp of browser check-out |
| `worked_minutes` | `INTEGER` | `NULL` | Computed on check-out/correction |
| `status` | `attendance_status` | `NOT NULL` | `PRESENT_ON_TIME`, `PRESENT_GRACE`, `LATE`, `ABSENT`, `ON_LEAVE`, `HOLIDAY`, `DAY_OFF` |
| `is_manual_correction` | `BOOLEAN` | `NOT NULL DEFAULT false` | Flagged if adjusted by approved correction |
| `notes` | `TEXT` | `NULL` | e.g., System EOD reconciliation note |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraints & Indexes:**
  - `UNIQUE (employee_id, work_date)` — **Enforces at most 1 attendance record per employee per working day.**
  - `CHECK (check_out_at IS NULL OR check_in_at IS NOT NULL)` — **Enforces Check-Out ONLY after Check-In.**
  - `CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)` — Prevents invalid negative work duration.
  - `CREATE INDEX idx_attendance_work_date ON attendance_records (work_date DESC, status);`

### 8.2 `attendance_correction_requests`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `work_date` | `DATE` | `NOT NULL` | Target working day (`EAT`) |
| `attendance_record_id` | `UUID` | `NULL REFERENCES attendance_records(id) ON DELETE RESTRICT` | May be `NULL` if correcting a missed check-in marked `ABSENT` |
| `requested_check_in_at` | `TIMESTAMPTZ` | `NOT NULL` | |
| `requested_check_out_at` | `TIMESTAMPTZ` | `NULL` | `CHECK (requested_check_out_at IS NULL OR requested_check_out_at >= requested_check_in_at)` |
| `reason` | `TEXT` | `NOT NULL CHECK (length(trim(reason)) > 0)` | Mandatory employee explanation |
| `status` | `approval_status` | `NOT NULL DEFAULT 'PENDING'` | `PENDING` $\rightarrow$ `APPROVED` / `REJECTED` |
| `reviewed_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Line Manager (or delegate) |
| `reviewed_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Mandatory if `REJECTED` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 8.3 `attendance_period_locks`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `year` | `INTEGER` | `NOT NULL` | |
| `month` | `SMALLINT` | `NOT NULL CHECK (month BETWEEN 1 AND 12)` | |
| `locked_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `locked_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraint:** `UNIQUE (year, month)`

---

## 9. Domain 7: Leave Management & Working-Day Balances

### 9.1 `leave_types`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | `ANNUAL`, `SICK`, `COMPASSIONATE`, `MATERNITY`, `PATERNITY`, `STUDY`, `UNPAID` |
| `name` | `VARCHAR(100)` | `NOT NULL` | |
| `annual_entitlement_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 21.00` | Uganda Employment Act baseline |
| `is_paid` | `BOOLEAN` | `NOT NULL DEFAULT true` | Feeds payroll deduction rules |
| `requires_hr_approval` | `BOOLEAN` | `NOT NULL DEFAULT false` | True for special leaves or above threshold |
| `hr_approval_threshold_days` | `NUMERIC(5,2)` | `NULL` | e.g., `> 5` days routes to HR after Line Manager |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT true` | |

### 9.2 `leave_balances`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `leave_type_id` | `UUID` | `NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT` | |
| `year` | `INTEGER` | `NOT NULL` | Leave calendar year |
| `entitled_days` | `NUMERIC(5,2)` | `NOT NULL CHECK (entitled_days >= 0)` | |
| `carried_over_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 0 CHECK (carried_over_days >= 0)` | |
| `used_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 0 CHECK (used_days >= 0)` | Incremented on final `APPROVED` |
| `pending_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 0 CHECK (pending_days >= 0)` | Reserved while `PENDING_*` |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | Optimistic lock |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraints:**
  - `UNIQUE (employee_id, leave_type_id, year)`
  - `CHECK (used_days + pending_days <= entitled_days + carried_over_days)` — **Database-level guarantee that leave requests can never exceed available balance (for paid capped leave types).**

### 9.3 `leave_requests`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `leave_type_id` | `UUID` | `NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT` | |
| `start_date` | `DATE` | `NOT NULL` | Inclusive (`Africa/Kampala`) |
| `end_date` | `DATE` | `NOT NULL CHECK (end_date >= start_date)` | Inclusive (`Africa/Kampala`) |
| `working_days` | `NUMERIC(5,2)` | `NOT NULL CHECK (working_days > 0)` | Excludes weekends/days-off & public holidays |
| `reason` | `TEXT` | `NOT NULL CHECK (length(trim(reason)) > 0)` | Mandatory |
| `handover_employee_id` | `UUID` | `NULL REFERENCES employees(id) ON DELETE RESTRICT` | Optional backup colleague |
| `attachment_key` | `TEXT` | `NULL` | Optional medical/exam timetable PDF |
| `status` | `VARCHAR(30)` | `NOT NULL DEFAULT 'PENDING_MANAGER'` | `PENDING_MANAGER`, `PENDING_HR`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `manager_reviewed_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `manager_reviewed_at` | `TIMESTAMPTZ` | `NULL` | |
| `hr_reviewed_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `hr_reviewed_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Required if `REJECTED` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **CRITICAL POSTGRESQL EXCLUSION CONSTRAINT (Prevents Overlapping Pending/Approved Leave):**
```sql
ALTER TABLE leave_requests
  ADD CONSTRAINT excl_leave_no_overlap
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
  WHERE (status IN ('PENDING_MANAGER', 'PENDING_HR', 'APPROVED'));
```

---

## 10. Domain 8: Payroll (`UGX`), Loans, Adjustments & Verifiable Payslips

### 10.1 `staff_loans`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `loan_reference` | `VARCHAR(40)` | `NOT NULL UNIQUE` | e.g., `LN-2026-008` |
| `description` | `VARCHAR(180)` | `NOT NULL` | Salary Advance / Staff SACCO Loan |
| `principal_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (principal_ugx > 0)` | |
| `monthly_installment_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (monthly_installment_ugx > 0)` | |
| `remaining_balance_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (remaining_balance_ugx >= 0)` | Checked by Offboarding Clearance! |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'ACTIVE'` | `ACTIVE`, `SETTLED` |
| `created_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 10.2 `payroll_runs`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `run_code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `PR-UG-2026-11` |
| `year` | `INTEGER` | `NOT NULL` | |
| `month` | `SMALLINT` | `NOT NULL CHECK (month BETWEEN 1 AND 12)` | |
| `policy_id` | `UUID` | `NOT NULL REFERENCES statutory_tax_policies(id) ON DELETE RESTRICT` | Snapshots active tax rules |
| `attendance_lock_id` | `UUID` | `NOT NULL REFERENCES attendance_period_locks(id) ON DELETE RESTRICT` | Enforces locked attendance input |
| `status` | `payroll_run_status` | `NOT NULL DEFAULT 'DRAFT'` | `DRAFT` $\rightarrow$ `PENDING_APPROVAL` $\rightarrow$ `APPROVED` $\rightarrow$ `LOCKED` |
| `total_gross_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `total_nssf_employee_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `total_nssf_employer_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `total_paye_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `total_lst_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `total_net_pay_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `prepared_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Payroll Officer |
| `submitted_at` | `TIMESTAMPTZ` | `NULL` | |
| `approved_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Authorised Approver |
| `approved_at` | `TIMESTAMPTZ` | `NULL` | |
| `locked_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `locked_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Required if returned to draft/rejected |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraints:**
  - `UNIQUE (year, month)`
  - `CHECK (approved_by_user_id IS NULL OR approved_by_user_id <> prepared_by_user_id)` — **Enforces Separation of Duties.**

### 10.3 `payroll_items`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `payroll_run_id` | `UUID` | `NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `working_days_in_month` | `INTEGER` | `NOT NULL` | Locked attendance snapshot |
| `days_present` | `INTEGER` | `NOT NULL` | |
| `paid_leave_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 0` | |
| `absent_or_unpaid_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 0` | |
| `base_salary_ugx` | `NUMERIC(14,2)` | `NOT NULL` | |
| `allowances_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | |
| `bonus_or_arrears_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | |
| `unpaid_deduction_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | |
| `gross_pay_ugx` | `NUMERIC(14,2)` | `NOT NULL` | |
| `nssf_employee_ugx` | `NUMERIC(14,2)` | `NOT NULL` | `5%` of gross |
| `nssf_employer_ugx` | `NUMERIC(14,2)` | `NOT NULL` | `10%` employer cost |
| `paye_ugx` | `NUMERIC(14,2)` | `NOT NULL` | Calculated from `policy_id` |
| `lst_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | Local Service Tax |
| `loan_deduction_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | |
| `other_deductions_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | |
| `net_pay_ugx` | `NUMERIC(14,2)` | `NOT NULL` | `gross - nssf_emp - paye - lst - loan - other` |
| `notes` | `TEXT` | `NULL` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraint:** `UNIQUE (payroll_run_id, employee_id)`

### 10.4 `payroll_adjustments` *(Post-Lock Authorised Corrections)*
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `payroll_item_id` | `UUID` | `NOT NULL REFERENCES payroll_items(id) ON DELETE RESTRICT` | Target locked item |
| `adjustment_type` | `VARCHAR(20)` | `NOT NULL CHECK (adjustment_type IN ('ADDITION', 'DEDUCTION'))` | |
| `category` | `VARCHAR(60)` | `NOT NULL` | e.g., `OVERTIME_ARREARS`, `TAX_CORRECTION` |
| `amount_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (amount_ugx > 0)` | |
| `reason` | `TEXT` | `NOT NULL CHECK (length(trim(reason)) > 0)` | Mandatory audit justification |
| `status` | `approval_status` | `NOT NULL DEFAULT 'PENDING'` | `PENDING` $\rightarrow$ `APPROVED` / `REJECTED` |
| `requested_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Payroll Officer |
| `approved_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Authorised Approver (`<> requested_by_user_id`) |
| `approved_at` | `TIMESTAMPTZ` | `NULL` | |
| `applied_in_run_id` | `UUID` | `NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT` | Settled in next run or off-cycle |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 10.5 `payslips`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `payroll_item_id` | `UUID` | `NOT NULL UNIQUE REFERENCES payroll_items(id) ON DELETE RESTRICT` | |
| `payslip_number` | `VARCHAR(40)` | `NOT NULL UNIQUE` | e.g., `PAY-202611-0412` |
| `verification_code` | `VARCHAR(32)` | `NOT NULL UNIQUE` | Embedded in QR Code URL |
| `document_sha256` | `CHAR(64)` | `NOT NULL` | Cryptographic digest of payslip numbers |
| `pdf_storage_key` | `TEXT` | `NOT NULL` | Private S3 key |
| `published_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

---

## 11. Domain 9: Company Asset Custody

### 11.1 `assets`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `asset_tag` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `#AST-064` |
| `serial_number` | `VARCHAR(100)` | `NULL UNIQUE` | |
| `name` | `VARCHAR(150)` | `NOT NULL` | e.g., `Lenovo ThinkPad T14 Gen 3` |
| `category` | `VARCHAR(60)` | `NOT NULL` | `LAPTOP`, `MONITOR`, `MOBILE`, `VEHICLE`, `BADGE` |
| `purchase_value_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0 CHECK (purchase_value_ugx >= 0)` | |
| `condition` | `asset_condition` | `NOT NULL DEFAULT 'GOOD'` | |
| `notes` | `TEXT` | `NULL` | |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 11.2 `asset_assignments`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `asset_id` | `UUID` | `NOT NULL REFERENCES assets(id) ON DELETE RESTRICT` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `issued_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Asset Officer |
| `issued_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `status` | `asset_assignment_status` | `NOT NULL DEFAULT 'PENDING_ACKNOWLEDGEMENT'` | |
| `acknowledged_at` | `TIMESTAMPTZ` | `NULL` | Employee confirmation timestamp |
| `returned_at` | `TIMESTAMPTZ` | `NULL` | |
| `received_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Asset Officer receiving return |
| `return_condition` | `asset_condition` | `NULL` | |
| `incident_notes` | `TEXT` | `NULL` | Mandatory if `DAMAGED` or `LOST` |

- **CRITICAL PARTIAL UNIQUE INDEX (Enforces Maximum 1 Active Assignee Per Asset):**
```sql
CREATE UNIQUE INDEX uq_asset_single_active_custody
  ON asset_assignments (asset_id)
  WHERE returned_at IS NULL
    AND status IN ('PENDING_ACKNOWLEDGEMENT', 'ACKNOWLEDGED');
```

---

## 12. Domain 10: Offboarding, Clearances & Notifications

### 12.1 `offboarding_cases`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL UNIQUE REFERENCES employees(id) ON DELETE RESTRICT` | |
| `exit_type` | `offboarding_exit_type` | `NOT NULL` | |
| `notice_date` | `DATE` | `NOT NULL` | |
| `last_working_day` | `DATE` | `NOT NULL CHECK (last_working_day >= notice_date)` | |
| `exit_reason` | `TEXT` | `NOT NULL` | |
| `status` | `offboarding_status` | `NOT NULL DEFAULT 'IN_PROGRESS'` | `IN_PROGRESS` $\rightarrow$ `CLEARED` $\rightarrow$ `DEACTIVATED` |
| `initiated_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | HR Manager |
| `finalized_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `finalized_at` | `TIMESTAMPTZ` | `NULL` | |
| `deactivated_at` | `TIMESTAMPTZ` | `NULL` | Set after `last_working_day` |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 12.2 `offboarding_clearance_items`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `offboarding_case_id` | `UUID` | `NOT NULL REFERENCES offboarding_cases(id) ON DELETE RESTRICT` | |
| `track_type` | `clearance_track_type` | `NOT NULL` | `ASSET_RETURN`, `OPERATIONAL_HANDOVER`, `FINANCE_LOANS`, `HR_EXIT` |
| `assigned_role` | `user_role` | `NOT NULL` | |
| `status` | `clearance_status` | `NOT NULL DEFAULT 'PENDING'` | `PENDING`, `BLOCKED`, `CLEARED` |
| `blocker_summary` | `TEXT` | `NULL` | e.g., `Unreturned #AST-064 ThinkPad T14` |
| `cleared_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `cleared_at` | `TIMESTAMPTZ` | `NULL` | |
| `notes` | `TEXT` | `NULL` | |

- **Constraint:** `UNIQUE (offboarding_case_id, track_type)`

### 12.3 `notifications`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Recipient |
| `category` | `VARCHAR(40)` | `NOT NULL` | `ACTION_REQUIRED`, `INFO`, `ALERT` |
| `title` | `VARCHAR(180)` | `NOT NULL` | Privacy-safe headline |
| `message` | `TEXT` | `NOT NULL` | No salary/medical details |
| `action_url` | `VARCHAR(255)` | `NULL` | Target route inside app |
| `entity_type` | `VARCHAR(60)` | `NULL` | |
| `entity_id` | `UUID` | `NULL` | |
| `is_read` | `BOOLEAN` | `NOT NULL DEFAULT false` | |
| `resolved_at` | `TIMESTAMPTZ` | `NULL` | Auto-resolved when approval/ack completes |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Index:** `CREATE INDEX idx_notifications_user_unread ON notifications (user_id, created_at DESC) WHERE is_read = false;`

---

## 13. Database-Level Immutability Triggers (Safety Net)

In addition to NestJS service checks, add PostgreSQL triggers in migrations to enforce strict immutability:

1. **`audit_logs` Append-Only Trigger:** Rejects any `UPDATE` or `DELETE` SQL statement on `audit_logs` with `RAISE EXCEPTION 'audit_logs is immutable'`.
2. **`payroll_items` Lock Protection Trigger:** Rejects `UPDATE` or `DELETE` on `payroll_items` whenever the parent `payroll_runs.status = 'LOCKED'`—forcing all post-lock corrections exclusively into `payroll_adjustments`.
```

---

### Ready for File 5?
Next up is **`04_WORKFLOW_STATE_MACHINES_AND_CRONS.md`**, which specifies every state transition, precondition, mandatory `reason` rule, atomic database transaction side effect, hard clearance blocker, working-day calculation algorithm, and scheduled background cron job (`23:55 EAT` and `00:05 EAT`).

Because of its depth, I will present it cleanly in **Part 1 of 2** and **Part 2 of 2**. Shall I proceed to **`04_WORKFLOW_STATE_MACHINES_AND_CRONS.md` (Part 1 of 2)**?
Here is **File 5 of 10** (`04_WORKFLOW_STATE_MACHINES_AND_CRONS.md`), split into **Part 1 of 2** and **Part 2 of 2** so every workflow rule, atomic transaction step, calculation algorithm, and cron specification is captured without shortcuts.

---

### Filename: `04_WORKFLOW_STATE_MACHINES_AND_CRONS.md` *(Part 1 of 2)*

```markdown
# 04 — StaffHub Workflow State Machines, Transactions & Scheduled Jobs (Part 1 of 2)

All state transitions in StaffHub MUST execute inside an explicit backend service method wrapped in a **PostgreSQL ACID transaction (`prisma.$transaction`)** that:
1. Verifies the actor’s role, relationship scope (`TEAM`/`SELF`/`ORG`), and acting delegation validity.
2. Validates the current state (plus optimistic-lock `version` where applicable).
3. Enforces mandatory `reason` strings whenever rejecting, correcting, adjusting locked payroll, or logging asset damage/loss.
4. Executes all cross-module side effects atomically (either everything commits or everything rolls back).
5. Appends an immutable entry to `audit_logs` and resolves/creates `notifications`.

---

## 1. Recruitment, Offer Approval & Candidate Conversion Workflows

### 1.1 Staff Requisition State Machine
| From State | Event / Action | To State | Allowed Actor | Preconditions & Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `SUBMIT_REQUISITION` | `PENDING_HR` | `LINE_MANAGER`, `HR_MANAGER` | Validates `headcount >= 1`, valid `department_id`, `target_start_date >= today_eat`. Notifies HR Manager(s). |
| `PENDING_HR` | `APPROVE_REQUISITION` | `APPROVED` | `HR_MANAGER` | Sets `reviewed_by_user_id`, `reviewed_at`. Cannot self-approve if HR Manager was requester unless no other HR exists (prefer peer HR). Logs `REQUISITION_APPROVED`. |
| `PENDING_HR` | `REJECT_REQUISITION` | `REJECTED` | `HR_MANAGER` | **Mandatory `decision_reason`**. Logs `REQUISITION_REJECTED`. Notifies requester. |
| `PENDING_HR` | `CANCEL_REQUISITION` | `CANCELLED` | Original Requester | Allowed only before HR decision. |

### 1.2 Job Vacancy State Machine
| From State | Event / Action | To State | Allowed Actor | Preconditions & Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `CREATE_VACANCY` | `DRAFT` | `RECRUITER`, `HR_MANAGER` | **Hard Rule:** Linked `requisition.status` MUST equal `APPROVED`. |
| `DRAFT` | `PUBLISH_VACANCY` | `PUBLISHED` | `RECRUITER`, `HR_MANAGER` | Validates `closing_at > now()`, required description/requirements present. Sets `published_at`. Appears on Public Careers Portal immediately. |
| `PUBLISHED` | `CLOSE_VACANCY` | `CLOSED` | `RECRUITER`, `HR_MANAGER`, `SYSTEM_CRON` | Auto-transitions when `now_eat > closing_at` or closed manually. Public application submissions immediately rejected. |
| `PUBLISHED` / `CLOSED` | `MARK_FILLED` | `FILLED` | `SYSTEM_TX` (Conversion) | Automatically transitions once `hired_count >= requisition.headcount`. |

### 1.3 Public Application Submission Guardrails (No Account)
1. Validate Cloudflare Turnstile token (unless disabled in local test mode).
2. Fetch `vacancy`: MUST have `status === 'PUBLISHED'` AND `now_eat <= vacancy.closing_at` (reject late applications with `422 VACANCY_CLOSED`).
3. Normalize `applicant_email = email.trim().toLowerCase()`. Check uniqueness against `(vacancy_id, applicant_email)` (catching both pre-check and DB unique index `uq_application_vacancy_email` -> return `409 DUPLICATE_APPLICATION`).
4. Validate uploaded CV file via `file-type` binary magic bytes (allow `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, max `5 MB`). Upload to private S3/MinIO bucket under `applications/<vacancy_id>/<uuid>.<ext>`.
5. Insert `job_applications` (`status = 'APPLIED'`), log `APPLICATION_SUBMITTED`, and dispatch confirmation email (containing tracking code `APP-XXXXX`—no account created).

### 1.4 Candidate Pipeline & Offer State Machine
- **Application Stages:** `APPLIED` $\rightarrow$ `SHORTLISTED` $\rightarrow$ `INTERVIEWING` $\rightarrow$ `OFFER_STAGE` $\rightarrow$ `HIRED` (or `REJECTED` from any non-terminal stage with `stage_notes` reason, or `WITHDRAWN`).
- **Job Offer Pipeline:**

| From State | Event / Action | To State | Allowed Actor | Preconditions & Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `DRAFT_OFFER` | `DRAFT` | `RECRUITER`, `HR_MANAGER` | Application must be in `INTERVIEWING` or `OFFER_STAGE`. Sets `offered_base_salary_ugx > 0`. |
| `DRAFT` / `REJECTED` | `SUBMIT_OFFER_APPROVAL` | `PENDING_APPROVAL` | `RECRUITER`, `HR_MANAGER` | Notifies HR Manager(s) for review. |
| `PENDING_APPROVAL` | `APPROVE_OFFER` | `APPROVED` | `HR_MANAGER` | Sets `approved_by_user_id`, `approved_at`. Generates official Offer PDF stored privately. |
| `PENDING_APPROVAL` | `REJECT_OFFER` | `REJECTED` | `HR_MANAGER` | **Mandatory `decision_reason`**. Recruiter may revise and resubmit. |
| `APPROVED` | `SEND_OFFER` | `SENT` | `RECRUITER`, `HR_MANAGER` | **Hard Rule:** Physically blocked unless `status === 'APPROVED'`. Sets `sent_at`, emails candidate privacy-safe offer notice/link. |
| `SENT` | `RECORD_ACCEPTANCE` | `ACCEPTED` | `RECRUITER`, `HR_MANAGER` | Sets `accepted_at`. Unlocks `Convert to Employee` action. |
| `SENT` | `RECORD_DECLINED` | `DECLINED` | `RECRUITER`, `HR_MANAGER` | Optional reason logged; vacancy remains open. |

### 1.5 Atomic "Convert to Employee" Transaction (`ACCEPTED` $\rightarrow$ `CONVERTED`)
Triggered by `HR_MANAGER` with an `Idempotency-Key` header:
1. Lock `job_offers` row (`FOR UPDATE`). Assert `status === 'ACCEPTED'` and no `employees` row exists with `converted_from_offer_id = offer.id`.
2. Auto-provision institutional `work_email` (or HR-confirmed work email), generate temporary password, hash with `Argon2id`, and insert `users` (`role = 'EMPLOYEE'`, `is_active = true`, `must_change_password = true`).
3. Generate sequential `employee_code` (`UG-EMP-XXXX`) and insert `employees` transferring **automatically** from `job_applications` + `job_offers` (zero manual re-typing):
   - `legal_name` = `application.full_name`
   - `personal_email` = `application.applicant_email`
   - `phone` = `application.phone`
   - `job_title` = `offer.offered_job_title`
   - `department_id` = `offer.department_id`
   - `manager_id` = `offer.reporting_manager_id`
   - `base_salary_ugx` = `offer.offered_base_salary_ugx`
   - `recurring_allowances_ugx` = `offer.offered_allowances_ugx`
   - `hire_date` = `offer.proposed_start_date`
   - `status` = `'ONBOARDING'`
4. Initialize current year `leave_balances` for active `leave_types` (prorated or full policy entitlement).
5. Create `onboarding_checklists` (`status = 'IN_PROGRESS'`) and seed default 4-role `onboarding_tasks` (`HR_MANAGER`, `LINE_MANAGER`, `EMPLOYEE`, `ASSET_OFFICER`).
6. Update `job_offers.status = 'CONVERTED'`, `job_applications.status = 'HIRED'`. If `hired_count >= requisition.headcount`, mark `vacancies.status = 'FILLED'`.
7. Write `CANDIDATE_CONVERTED_TO_EMPLOYEE` to `audit_logs`.
8. Create `"Pending My Action"` notifications for HR, Line Manager, New Employee, and Asset Officer; send welcome email with login link + temporary password notice (without exposing salary in email).

*(Onboarding Checklist Completion: Once all tasks in `onboarding_tasks` have `is_completed = true`, the checklist marks `COMPLETED` and `employees.status` transitions `ONBOARDING` $\rightarrow$ `ACTIVE`.)*

---

## 2. Employee Profile & Sensitive Change Workflows

### 2.1 Permitted Self-Service Updates (Immediate)
- **Allowed Fields:** `personal_email`, `phone`, `residential_address`, `emergency_contact_name`, `emergency_contact_phone`.
- **Execution:** `EMPLOYEE` (`SELF`) updates validated fields via `UpdateOwnContactDto`. Logs `EMPLOYEE_CONTACT_UPDATED` with old/new diff in `audit_logs`.

### 2.2 Sensitive Field Change Requests (`LEGAL_NAME`, `BANK_DETAILS`, `NATIONAL_ID_NIN`)
| From State | Event / Action | To State | Allowed Actor | Preconditions & Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `SUBMIT_SENSITIVE_CHANGE` | `PENDING_HR` | `EMPLOYEE` (`SELF`), `HR_MANAGER` | Requires `request_reason` and new value payload (e.g., `bankName`, `bankBranch`, `accountNumber` + optional supporting PDF letter). Encrypts sensitive values before saving request. |
| `PENDING_HR` | `APPROVE_SENSITIVE_CHANGE` | `APPROVED` | `HR_MANAGER` | **Anti-Self-Approval:** `reviewed_by_user_id !== employee.user_id`. Atomically updates `employees` (`legal_name` or encrypted `bank_account_encrypted` + `bank_account_last4` or `nin_encrypted` + `nin_last4`), increments `employees.version`, writes redacted diff to `audit_logs`. |
| `PENDING_HR` | `REJECT_SENSITIVE_CHANGE` | `REJECTED` | `HR_MANAGER` | **Mandatory `decision_reason`**. Employee profile remains unchanged. |

---

## 3. Attendance & Correction State Machines

### 3.1 Daily Check-In & Check-Out (`Africa/Kampala` Evaluated)
1. Compute `today_eat = DateTime.now().setZone('Africa/Kampala').toISODate()`.
2. **Check-In Action (`POST /attendance/check-in`):**
   - Verify employee status is `ACTIVE`, `ONBOARDING`, or `OFFBOARDING` (not `EXITED`).
   - Check `attendance_period_locks` for `(today_eat.year, today_eat.month)` is NOT locked.
   - Check no existing `attendance_records` row exists for `(employee_id, today_eat)` (DB unique constraint also prevents race conditions). Reject duplicates (`409 ALREADY_CHECKED_IN`).
   - Compare `now_eat` against `work_schedule.shift_start_time` on `today_eat`:
     - If `now_eat <= shift_start`: `status = 'PRESENT_ON_TIME'`
     - Else if `now_eat <= shift_start + grace_period_minutes`: `status = 'PRESENT_GRACE'`
     - Else: `status = 'LATE'`
   - Insert `attendance_records` with `check_in_at = now_utc` (server clock only—no client-supplied timestamp).
3. **Check-Out Action (`POST /attendance/check-out`):**
   - Fetch `attendance_records` for `(employee_id, today_eat)`.
   - **Hard Rules:** Must exist with `check_in_at IS NOT NULL` (`422 MUST_CHECK_IN_FIRST`) AND `check_out_at IS NULL` (`409 ALREADY_CHECKED_OUT`).
   - Set `check_out_at = now_utc`, compute `worked_minutes = floor((check_out_at - check_in_at) / 60000)`.

### 3.2 Attendance Correction State Machine
| From State | Event / Action | To State | Allowed Actor | Preconditions & Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `SUBMIT_CORRECTION` | `PENDING` | `EMPLOYEE` (`SELF`) | Target `work_date` must NOT be in a locked attendance period. **Mandatory `reason`**. Cannot submit for future dates (`work_date > today_eat`). |
| `PENDING` | `APPROVE_CORRECTION` | `APPROVED` | `LINE_MANAGER` (`TEAM` or active delegate), `HR_MANAGER` (fallback) | **Anti-Self-Approval:** reviewer `<> employee.user_id`. Verifies period still unlocked. Upserts `attendance_records` (`check_in_at`, `check_out_at`, `worked_minutes`, `is_manual_correction = true`), recalculates `PRESENT_ON_TIME` / `PRESENT_GRACE` / `LATE` from `work_schedule`, logs `ATTENDANCE_CORRECTION_APPROVED` with old/new timestamps. |
| `PENDING` | `REJECT_CORRECTION` | `REJECTED` | `LINE_MANAGER` (`TEAM`), `HR_MANAGER` | **Mandatory `decision_reason`**. Original attendance record unchanged. |
```

---

### Ready for Part 2 of 2?
Next is **`04_WORKFLOW_STATE_MACHINES_AND_CRONS.md` (Part 2 of 2)** covering:
- **Leave Working-Day Calculation Algorithm & State Machine**
- **Monthly Payroll Run, PAYE/NSSF/LST Math Pipeline, Locking & Authorised Adjustments**
- **Asset Custody & Acknowledgement State Machine**
- **Offboarding Hard Blockers & Account Deactivation**
- **Scheduled Background Cron Jobs (`23:55 EAT` & `00:05 EAT`)**

Shall I proceed to **Part 2 of 2**?
Here is **Part 2 of 2** of **`04_WORKFLOW_STATE_MACHINES_AND_CRONS.md`**, completing Leave, Payroll, Assets, Offboarding, and all Automated Scheduled Jobs.

---

### Filename: `04_WORKFLOW_STATE_MACHINES_AND_CRONS.md` *(Part 2 of 2)*

```markdown
# 04 — StaffHub Workflow State Machines, Transactions & Scheduled Jobs (Part 2 of 2)

## 4. Leave Management & Ugandan Working-Day Engine

### 4.1 Deterministic Working-Day Calculation Algorithm (`Africa/Kampala`)
Given `employee_id`, `start_date` (`DATE`), and `end_date` (`DATE`):
1. Load `employee.work_schedule.working_days_bitmap` (e.g., `[1, 2, 3, 4, 5]` for Mon–Fri, ISO weekday `1 = Monday ... 7 = Sunday`).
2. Query `public_holidays` where `holiday_date BETWEEN start_date AND end_date` into a lookup Set.
3. Iterate calendar day `d` from `start_date` to `end_date` inclusive (interpreted strictly as `Africa/Kampala` dates):
   - Increment `working_days` by `1` **only if** `d.weekday IN working_days_bitmap` **AND** `d NOT IN holidaySet`.
4. Return `{ calendarDays, workingDays, excludedDates: [{ date, reason: 'DAY_OFF' | 'PUBLIC_HOLIDAY', label }] }`.
5. **Rule:** If `workingDays === 0`, block submission (`422 ZERO_WORKING_DAYS`).

### 4.2 Leave Request State Machine
| From State | Event / Action | To State | Allowed Actor | Preconditions & Atomic Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `SUBMIT_LEAVE` | `PENDING_MANAGER` | `EMPLOYEE` (`SELF`) | 1. Compute `workingDays > 0`.<br>2. **Mandatory `reason`**.<br>3. Check no overlapping `PENDING_MANAGER`, `PENDING_HR`, or `APPROVED` request (backed by `excl_leave_no_overlap`).<br>4. Lock `leave_balances` row (`FOR UPDATE`). If `leave_type` is capped (`annual_entitlement_days > 0`), assert `(entitled + carried_over - used - pending) >= workingDays`.<br>5. Increment `leave_balances.pending_days += workingDays`.<br>6. Notify Line Manager (or active delegate). |
| `PENDING_MANAGER` | `MANAGER_APPROVE` | `PENDING_HR` *(if HR step required)* **OR** `APPROVED` | `LINE_MANAGER` (`TEAM` or active delegate) | **Anti-Self-Approval:** reviewer `<> employee.user_id`. Checks `leave_type.requires_hr_approval === true` OR (`hr_approval_threshold_days !== null && workingDays > hr_approval_threshold_days`). If true $\rightarrow$ routes to `PENDING_HR`; else $\rightarrow$ triggers **Final Approval Side Effects** below. |
| `PENDING_HR` | `HR_APPROVE` | `APPROVED` | `HR_MANAGER` | **Anti-Self-Approval:** reviewer `<> employee.user_id`. Triggers **Final Approval Side Effects**. |
| `PENDING_MANAGER` / `PENDING_HR` | `REJECT_LEAVE` | `REJECTED` | Approver (`TEAM`/`HR`) | **Mandatory `decision_reason`**. Atomically releases `leave_balances.pending_days -= workingDays`. Logs `LEAVE_REJECTED`. |
| `PENDING_MANAGER` / `PENDING_HR` | `CANCEL_LEAVE` | `CANCELLED` | `EMPLOYEE` (`SELF`) | Atomically releases `leave_balances.pending_days -= workingDays`. Logs `LEAVE_CANCELLED`. |
| `APPROVED` | `HR_REVOKE_LEAVE` | `CANCELLED` | `HR_MANAGER` | Allowed only for future/current un-payrolled dates (`attendance_period_locks` not locked). **Mandatory `decision_reason`**. Restores `used_days -= workingDays` and removes/resets generated `ON_LEAVE` attendance rows. |

### 4.3 Final Approval Atomic Side Effects
Inside the single transaction when transitioning to `APPROVED`:
1. Lock `leave_balances` (`FOR UPDATE`): `pending_days -= workingDays`, `used_days += workingDays`.
2. For each working day `d` in `[start_date, end_date]` (where `d` is a scheduled workday and not a public holiday):
   - Upsert `attendance_records` for `(employee_id, d)` setting `status = 'ON_LEAVE'`, `notes = 'Approved Leave #' + request.id`.
3. Resolve manager/HR pending notifications, create employee notification, write `LEAVE_APPROVED` to `audit_logs`.

---

## 5. Monthly Payroll Run, Calculation Pipeline & Post-Lock Adjustments

### 5.1 Preconditions for Creating a Payroll Run
1. Target `(year, month)` must not already have a `payroll_runs` row.
2. An `attendance_period_locks` row MUST exist for `(year, month)` (or HR/Payroll explicitly locks the period's attendance first so figures cannot change mid-payroll).
3. Load the active `statutory_tax_policies` row whose `[effective_from, effective_to]` covers the pay period end date.

### 5.2 Deterministic Calculation Pipeline Per Employee (`Decimal.js`, `ROUND_HALF_UP` to 2 decimals / nearest integer UGX per policy)
For every employee active during `[period_start, period_end]` (`status IN ('ONBOARDING', 'ACTIVE', 'OFFBOARDING')`, `hire_date <= period_end`):
1. **Attendance Summary Snapshot (from locked `attendance_records`):**
   - `working_days_in_month` = count of scheduled workdays excluding public holidays in `(year, month)`.
   - `days_present` = count of `PRESENT_ON_TIME` + `PRESENT_GRACE` + `LATE`.
   - `paid_leave_days` = count of `ON_LEAVE` where leave type `is_paid = true`.
   - `absent_or_unpaid_days` = count of `ABSENT` + `ON_LEAVE` (where `is_paid = false`) + non-employed days if hired/exited mid-month.
2. **Gross Pay (`UGX`):**
   - `unpaid_deduction_ugx = round((base_salary_ugx / working_days_in_month) * absent_or_unpaid_days)` *(only if `absent_or_unpaid_days > 0`)*.
   - `gross_pay_ugx = max(0, base_salary_ugx + recurring_allowances_ugx + bonus_or_arrears_ugx - unpaid_deduction_ugx)`.
3. **NSSF (Computed on Gross Pay):**
   - `nssf_employee_ugx = round(gross_pay_ugx * policy.nssf_employee_rate)` *(default `5%`)*.
   - `nssf_employer_ugx = round(gross_pay_ugx * policy.nssf_employer_rate)` *(default `10%`, employer expense only—NOT subtracted from Net Pay)*.
4. **PAYE Income Tax (Uganda Statutory Progressive Bands):**
   - Evaluated against `gross_pay_ugx` (per Ugandan law, employee NSSF is **not** deducted prior to PAYE calculation) using `policy.paye_resident_brackets` or `policy.paye_non_resident_brackets` based on `employee.tax_residency`:
     - Default Resident Monthly Bands (effective 1 Jul 2026):
       - `0 – 335,000`: `0`
       - `335,001 – 410,000`: `(gross - 335,000) * 0.20`
       - `410,001 – 485,000`: `15,000 + (gross - 410,000) * 0.25`
       - `485,001 – 10,000,000`: `33,750 + (gross - 485,000) * 0.30`
       - `> 10,000,000`: `33,750 + (gross - 485,000) * 0.30 + (gross - 10,000,000) * 0.10`
5. **Local Service Tax (`LST`):**
   - If `month IN policy.lst_collection_months` (default `[7, 8, 9, 10]` = July–October): look up `gross_pay_ugx` in `policy.lst_tiers` and divide annual amount by `lst_collection_months.length` (e.g., `100,000 / 4 = 25,000 UGX/month`). Otherwise `0`.
6. **Staff Loan Deduction:**
   - Sum active `staff_loans` (`status = 'ACTIVE'`), taking `min(monthly_installment_ugx, remaining_balance_ugx)`.
7. **Net Pay:**
   - `net_pay_ugx = gross_pay_ugx - nssf_employee_ugx - paye_ugx - lst_ugx - loan_deduction_ugx - other_deductions_ugx`.

### 5.3 Payroll Run State Machine
| From State | Event / Action | To State | Allowed Actor | Preconditions & Atomic Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `PREPARE_PAYROLL` | `DRAFT` | `PAYROLL_OFFICER` | Requires `attendance_period_locks` for `(year, month)`. Generates `payroll_items` & totals. |
| `DRAFT` | `UPDATE_DRAFT_EXTRAS` | `DRAFT` | `PAYROLL_OFFICER` | Can edit `bonus_or_arrears_ugx` or `other_deductions_ugx` and recalculate totals. |
| `DRAFT` | `SUBMIT_PAYROLL` | `PENDING_APPROVAL` | `PAYROLL_OFFICER` | Sets `submitted_at`. Notifies HR Manager / Approver. |
| `PENDING_APPROVAL` | `RETURN_PAYROLL` | `DRAFT` | `HR_MANAGER` | **Mandatory `decision_reason`**. Returns to Payroll Officer for edits. |
| `PENDING_APPROVAL` | `APPROVE_PAYROLL` | `APPROVED` | `HR_MANAGER` | **Separation of Duties:** `actor.userId !== run.prepared_by_user_id`. Sets `approved_by_user_id`, `approved_at`. Logs `PAYROLL_APPROVED`. |
| `APPROVED` | `LOCK_AND_PUBLISH` | `LOCKED` | `HR_MANAGER` or `PAYROLL_OFFICER` | Inside transaction:<br>1. Set `status = 'LOCKED'`, `locked_at`, `locked_by_user_id`.<br>2. Decrement `staff_loans.remaining_balance_ugx` (marking `SETTLED` if `0`).<br>3. Generate PDF payslips with `verification_code`, QR code, and `document_sha256` hash; store in private S3.<br>4. Insert `payslips` rows.<br>5. Notify employees (`"Your payslip for [Month] is available"`—no UGX figures in email). |

### 5.4 Post-Lock Authorised Adjustments (`LOCKED` Payroll Protection)
- **Rule:** Direct `PUT`/`PATCH` on `payroll_items` belonging to a `LOCKED` run returns `423 Locked` (`PAYROLL_LOCKED_DIRECT_EDIT_FORBIDDEN`).
- **Adjustment Flow:**
  1. `PAYROLL_OFFICER` creates `payroll_adjustments` (`status = 'PENDING'`, `amount_ugx > 0`, `adjustment_type`, **mandatory `reason`**).
  2. `HR_MANAGER` (`actor.userId !== requested_by_user_id`) approves (`APPROVED`) or rejects (`REJECTED` + **mandatory `reason`**).
  3. Approved adjustment is applied as a line item (`bonus_or_arrears_ugx` or `other_deductions_ugx`) in the next open payroll run (or recorded as off-cycle settlement) with full audit reference linking back to `payroll_adjustments.id`.

---

## 6. Company Asset Custody & Acknowledgement Workflow

| From State | Event / Action | To State | Allowed Actor | Preconditions & Atomic Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(Asset Available)* | `ISSUE_ASSET` | `PENDING_ACKNOWLEDGEMENT` | `ASSET_OFFICER` | Assert `asset.condition NOT IN ('DAMAGED','LOST','RETIRED')`. Partial unique index `uq_asset_single_active_custody` guarantees zero other active assignees (`409 ASSET_ALREADY_ASSIGNED`). Creates `"Pending My Action"` notification for employee. |
| `PENDING_ACKNOWLEDGEMENT` | `ACKNOWLEDGE_ASSET` | `ACKNOWLEDGED` | Assigned `EMPLOYEE` (`SELF`) | Sets `acknowledged_at = now()`. Resolves employee action notification. Logs `ASSET_ACKNOWLEDGED`. |
| `PENDING_ACKNOWLEDGEMENT` / `ACKNOWLEDGED` | `RECORD_RETURN` | `RETURNED` | `ASSET_OFFICER` | Sets `returned_at = now()`, `received_by_user_id`, `return_condition`. Updates `assets.condition`. If `return_condition = 'DAMAGED'`, requires `incident_notes`. Frees asset for future assignment and recalculates any active offboarding `ASSET_RETURN` clearance track! |
| `PENDING_ACKNOWLEDGEMENT` / `ACKNOWLEDGED` | `REPORT_DAMAGE_OR_LOSS` | `CLOSED_DAMAGED` / `CLOSED_LOST` | `ASSET_OFFICER` | **Mandatory `incident_notes`**. Sets `returned_at = now()` (closing active assignment slot), updates `assets.condition` (`DAMAGED`/`LOST`), writes `ASSET_INCIDENT_LOGGED`, and flags HR/Offboarding if applicable. |

---

## 7. Offboarding, Hard Clearance Blockers & Account Deactivation

### 7.1 Exit Initiation (`ACTIVE` $\rightarrow$ `OFFBOARDING`)
Triggered by `HR_MANAGER`:
1. Validates `last_working_day >= notice_date` and **mandatory `exit_reason`**.
2. Updates `employees.status = 'OFFBOARDING'`, `employees.last_working_day = last_working_day`.
3. Inserts `offboarding_cases` (`status = 'IN_PROGRESS'`).
4. Dynamically evaluates initial blockers and inserts 4 `offboarding_clearance_items`:
   - `ASSET_RETURN` (`ASSET_OFFICER`): Automatically set to `BLOCKED` (listing unreturned `#AST-...` tags) if employee has any active `asset_assignments` where `returned_at IS NULL`; else `PENDING` (ready for Asset Officer sign-off).
   - `OPERATIONAL_HANDOVER` (`LINE_MANAGER`): `PENDING`.
   - `FINANCE_LOANS` (`PAYROLL_OFFICER`): Automatically set to `BLOCKED` (listing `UGX` balance) if employee has `staff_loans` with `remaining_balance_ugx > 0`; else `PENDING`.
   - `HR_EXIT` (`HR_MANAGER`): `PENDING`.

### 7.2 Dynamic Blocker Enforcement & Track Sign-Off
- Whenever `ASSET_OFFICER` attempts to clear `ASSET_RETURN`: system queries `asset_assignments WHERE employee_id = X AND returned_at IS NULL`. If count `> 0`, **physically blocks** sign-off (`422 UNRETURNED_ASSETS_BLOCKER`).
- Whenever `PAYROLL_OFFICER` attempts to clear `FINANCE_LOANS`: system checks `staff_loans WHERE employee_id = X AND remaining_balance_ugx > 0`. If balance `> 0`, **physically blocks** sign-off unless marked settled in final payroll (`422 UNSETTLED_LOAN_BLOCKER`).
- **Finalizing Exit (`IN_PROGRESS` $\rightarrow$ `CLEARED`):** Allowed ONLY when all 4 `offboarding_clearance_items.status === 'CLEARED'`.

### 7.3 Account Deactivation (`CLEARED` $\rightarrow$ `DEACTIVATED`)
- **Rule:** Cannot occur before `last_working_day` passes (unless `today_eat > last_working_day` OR HR executes immediate termination post-last-working-day).
- Inside transaction:
  1. `offboarding_cases.status = 'DEACTIVATED'`, `deactivated_at = now()`.
  2. `employees.status = 'EXITED'`.
  3. `users.is_active = false`, `users.deactivated_at = now()`.
  4. `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = emp.user_id AND revoked_at IS NULL`.
  5. Audit log `EMPLOYEE_ACCOUNT_DEACTIVATED`. All employee, attendance, leave, payslip, and asset records remain read-only forever.

---

## 8. Automated Scheduled Jobs (Cron Specifications)

Protected via `X-Cron-Secret: <CRON_SHARED_SECRET>` (constant-time timingSafeEqual comparison) and triggered by **GitHub Actions `schedule`** (or manual admin trigger in demo/testing):

### Job 1: End-of-Day Attendance Absence Reconciliation
- **Schedule:** Daily at **`23:55 EAT`** (`20:55 UTC`).
- **Endpoint:** `POST /api/v1/internal/jobs/reconcile-attendance`
- **Idempotent Logic for `target_date = today_eat`:**
  1. Check if `target_date` is in `public_holidays`.
  2. Fetch all employees where `status IN ('ONBOARDING', 'ACTIVE', 'OFFBOARDING')` AND `hire_date <= target_date` AND (`last_working_day IS NULL OR last_working_day >= target_date`).
  3. For each employee (ignoring if `attendance_records` already has `(employee_id, target_date)`):
     - If `target_date` is a public holiday $\rightarrow$ insert `status = 'HOLIDAY'`.
     - Else if `target_date.weekday NOT IN employee.work_schedule.working_days_bitmap` $\rightarrow$ insert `status = 'DAY_OFF'`.
     - Else if an `APPROVED` leave exists covering `target_date` $\rightarrow$ insert `status = 'ON_LEAVE'`.
     - Else $\rightarrow$ insert `status = 'ABSENT'`, `notes = 'Auto-marked absent at 23:55 EAT EOD reconciliation'`.
  4. Write summary audit entry (`CRON_ATTENDANCE_RECONCILED`).

### Job 2: Daily Lifecycle Transitions (`Vacancies`, `Offboarding`, `Delegations`)
- **Schedule:** Daily at **`00:05 EAT`** (`21:05 UTC`).
- **Endpoint:** `POST /api/v1/internal/jobs/process-daily-transitions`
- **Idempotent Logic:**
  1. **Close Expired Vacancies:** `UPDATE vacancies SET status = 'CLOSED' WHERE status = 'PUBLISHED' AND closing_at < now()`.
  2. **Deactivate Cleared Exits Past Last Working Day:** Find `offboarding_cases` where `status = 'CLEARED'` AND `last_working_day < today_eat` $\rightarrow$ execute Section 7.3 Account Deactivation transaction for each.
  3. **Alert Overdue Un-cleared Exits:** For `offboarding_cases` where `status = 'IN_PROGRESS'` AND `last_working_day < today_eat`, create high-priority notification for HR Manager (`"Exit overdue with unresolved clearance blockers"`).
  4. **Expire Acting Delegations:** `UPDATE acting_delegations SET is_active = false WHERE is_active = true AND ends_at < now()`.
```

---

### Ready for File 6?
Next up is **`05_API_CONTRACT_AND_SECURITY_SPEC.md`**, which specifies every `/api/v1/...` REST endpoint across all modules, request/response DTOs, HTTP error taxonomy, Argon2id + JWT/Cookie auth flows, Public Applicant Turnstile + CV magic-byte security, idempotency headers, redacted logging, and the QR Payslip verification endpoint.

Shall I proceed to **`05_API_CONTRACT_AND_SECURITY_SPEC.md`**?

Here is **File 6 of 10** (`05_API_CONTRACT_AND_SECURITY_SPEC.md`), split cleanly into **Part 1 of 2** (Security Hardening, Auth Lifecycle, File Upload Defense, Error Envelope & Logging) and **Part 2 of 2** (Complete `/api/v1/...` Endpoint Catalog, DTO Rules, QR Verification & Cron Endpoints).

---

### Filename: `05_API_CONTRACT_AND_SECURITY_SPEC.md` *(Part 1 of 2)*

```markdown
# 05 — StaffHub API Contract & Security Hardening Specification (Part 1 of 2)

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
  "timestampEat": "2026-11-18T00:52:10+03:00",
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
- **Instant Deactivation Enforcement:** Both `JwtAuthGuard` and `/auth/refresh` verify `user.isActive === true`. Deactivating an exited employee immediately blocks all sessions within zero delay.

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
1. **Cloudflare Turnstile:** Public `POST /careers/vacancies/:id/apply` validates the `turnstileToken` server-side via Cloudflare `siteverify` before processing file uploads or DB writes (auto-bypassed only in local `NODE_ENV=test` / local Docker when secret is omitted).
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
```

---

### Ready for Part 2 of 2?
Next is **`05_API_CONTRACT_AND_SECURITY_SPEC.md` (Part 2 of 2)**, which lists **every single `/api/v1/...` REST endpoint** across all 12 domain modules—complete with HTTP method, path, allowed roles, query/body fields, response projections, and audit/notification triggers.

Shall I proceed to **Part 2 of 2**?
thought
Let's write **File 6 (`05_API_CONTRACT_AND_SECURITY_SPEC.md` — Part 2 of 2)** with complete precision across every domain module, matching every entity in File `03` and every workflow in File `04`!

Let's verify every module's endpoints so nothing is left out:
1. **Auth & Session Module (`/auth`)**
   - `POST /auth/login`
   - `POST /auth/refresh`
   - `POST /auth/logout`
   - `POST /auth/change-password`
   - `POST /auth/forgot-password` & `POST /auth/reset-password`
   - `GET /auth/me` (returns user, role, `employee` summary, allowed navigation permissions, unread notification count)
   - `POST /auth/demo-login` *(Registered ONLY when `DEMO_MODE=true`—returns `404` otherwise)*
2. **Public Careers & Verification Module (`/careers`, `/verify`)**
   - `GET /careers/vacancies` (only `PUBLISHED` & `closing_at >= now()`)
   - `GET /careers/vacancies/:id`
   - `POST /careers/vacancies/:id/apply` (`multipart/form-data`, Turnstile + duplicate email check + closing date check + CV magic bytes)
   - `GET /verify/payslips/:verificationCode` (public tamper-check returning `isValid`, `payPeriod`, `maskedEmployeeName`, `netPayHashVerified`, `issuedAtEat`—no sensitive salaries leaked!)
3. **Recruitment, Offers & Onboarding Module (`/recruitment`)**
   - `GET /recruitment/requisitions` (`HR_MANAGER`, `RECRUITER`, `LINE_MANAGER` own)
   - `POST /recruitment/requisitions` (`LINE_MANAGER`, `HR_MANAGER`)
   - `POST /recruitment/requisitions/:id/approve` & `POST /recruitment/requisitions/:id/reject` (`HR_MANAGER`, reject requires `reason`)
   - `GET /recruitment/vacancies`, `POST /recruitment/vacancies`, `PATCH /recruitment/vacancies/:id`, `POST /recruitment/vacancies/:id/publish`, `POST /recruitment/vacancies/:id/close`
   - `GET /recruitment/vacancies/:id/applications`, `GET /recruitment/applications/:id`, `GET /recruitment/applications/:id/cv-url` (120s signed URL)
   - `PATCH /recruitment/applications/:id/stage` (`APPLIED` $\rightarrow$ `SHORTLISTED` $\rightarrow$ `INTERVIEWING` $\rightarrow$ `REJECTED`)
   - `POST /recruitment/applications/:id/interviews`, `PATCH /recruitment/interviews/:id`
   - `POST /recruitment/applications/:id/offers`, `POST /recruitment/offers/:id/submit`, `POST /recruitment/offers/:id/approve`, `POST /recruitment/offers/:id/reject`, `POST /recruitment/offers/:id/send`, `POST /recruitment/offers/:id/record-decision`
   - `POST /recruitment/offers/:id/convert-to-employee` (`HR_MANAGER`, `Idempotency-Key` required)
   - `GET /recruitment/onboarding`, `GET /recruitment/onboarding/:employeeId`, `PATCH /recruitment/onboarding/tasks/:taskId`
4. **Employees, Sensitive Changes & Performance Module (`/employees`, `/performance`)**
   - `GET /employees` (role-projected DTO! Line Manager gets `TEAM` only with zero salary/bank/NIN!)
   - `GET /employees/:id` (role-projected DTO + optional `?reveal=true` logged audit event for HR/Payroll/Self)
   - `POST /employees` (direct HR creation if not from recruitment)
   - `PATCH /employees/:id/contact` (`SELF` or `HR_MANAGER` — strict `UpdateOwnContactDto`)
   - `PATCH /employees/:id/employment` (`HR_MANAGER` — job title, dept, manager, schedule, base salary, allowances, version check)
   - `GET /employees/change-requests`, `POST /employees/:id/change-requests` (`multipart/form-data` optional proof), `POST /employees/change-requests/:requestId/approve`, `POST /employees/change-requests/:requestId/reject` (mandatory `reason`)
   - `GET /performance/reviews`, `POST /performance/reviews`, `PATCH /performance/reviews/:id/self-assessment`, `PATCH /performance/reviews/:id/manager-review`
5. **Attendance & Corrections Module (`/attendance`)**
   - `GET /attendance/today` (`SELF`)
   - `POST /attendance/check-in` (`SELF`, `Idempotency-Key`)
   - `POST /attendance/check-out` (`SELF`)
   - `GET /attendance/records` (`SELF`, `TEAM` for Line Manager, `ORG` for HR)
   - `GET /attendance/corrections`, `POST /attendance/corrections` (mandatory `reason`), `POST /attendance/corrections/:id/approve`, `POST /attendance/corrections/:id/reject` (mandatory `reason`)
   - `GET /attendance/period-locks`, `POST /attendance/period-locks` (`HR_MANAGER` / `PAYROLL_OFFICER` locks `(year, month)`)
6. **Leave Management & Delegations Module (`/leave`, `/delegations`)**
   - `GET /leave/types`, `GET /leave/balances` (`SELF` or `TEAM` or `ORG`)
   - `POST /leave/calculate-working-days` (live preview endpoint returning `workingDays` & excluded weekends/holidays)
   - `GET /leave/requests`, `POST /leave/requests` (`Idempotency-Key`, mandatory `reason`, optional supporting PDF)
   - `POST /leave/requests/:id/approve`, `POST /leave/requests/:id/reject` (mandatory `reason`), `POST /leave/requests/:id/cancel`
   - `GET /delegations`, `POST /delegations`, `POST /delegations/:id/revoke`
7. **Payroll, Loans, Adjustments & Payslips Module (`/payroll`)**
   - `GET /payroll/runs`, `GET /payroll/runs/:id`
   - `POST /payroll/runs` (`PAYROLL_OFFICER`, `Idempotency-Key`, requires locked attendance period)
   - `PATCH /payroll/runs/:runId/items/:itemId` (`PAYROLL_OFFICER`, allowed ONLY when `run.status === 'DRAFT'`)
   - `POST /payroll/runs/:id/submit`, `POST /payroll/runs/:id/return` (mandatory `reason`), `POST /payroll/runs/:id/approve` (`HR_MANAGER` distinct from preparer), `POST /payroll/runs/:id/lock` (`Idempotency-Key`, publishes verifiable PDFs)
   - `GET /payroll/runs/:id/export/bank-eft` (CSV export + `EXPORT` audit log), `GET /payroll/runs/:id/export/statutory` (URA PAYE & NSSF summary + `EXPORT` audit log)
   - `GET /payroll/adjustments`, `POST /payroll/items/:itemId/adjustments` (mandatory `reason`), `POST /payroll/adjustments/:id/approve`, `POST /payroll/adjustments/:id/reject` (mandatory `reason`)
   - `GET /payroll/my-payslips`, `GET /payroll/payslips/:id`, `GET /payroll/payslips/:id/pdf-url` (120s signed URL + audit log)
   - `GET /payroll/loans`, `POST /payroll/loans`
8. **Assets Module (`/assets`)**
   - `GET /assets`, `POST /assets`, `PATCH /assets/:id` (`ASSET_OFFICER`)
   - `POST /assets/:id/issue` (`ASSET_OFFICER` — enforces max 1 active assignee)
   - `POST /assets/assignments/:assignmentId/acknowledge` (Assigned `EMPLOYEE`)
   - `POST /assets/assignments/:assignmentId/return` (`ASSET_OFFICER` — optional/mandatory notes on damage)
   - `POST /assets/assignments/:assignmentId/incident` (`ASSET_OFFICER` — `DAMAGED`/`LOST` with mandatory `incidentNotes`)
   - `GET /assets/my-assets` (`SELF`)
9. **Offboarding Module (`/offboarding`)**
   - `GET /offboarding/cases`, `GET /offboarding/cases/:id`
   - `POST /offboarding/cases` (`HR_MANAGER`)
   - `POST /offboarding/cases/:caseId/clearances/:trackType/sign-off` (role-specific: `ASSET_OFFICER`, `LINE_MANAGER`, `PAYROLL_OFFICER`, `HR_MANAGER` — enforces real-time asset/loan blockers!)
   - `POST /offboarding/cases/:caseId/finalize` (`HR_MANAGER` — blocked unless all 4 tracks `CLEARED`)
   - `POST /offboarding/cases/:caseId/deactivate` (`HR_MANAGER` — allowed post-`last_working_day`)
10. **Admin Settings, Audit Trail, Notifications & Internal Crons (`/admin`, `/audit`, `/notifications`, `/internal/jobs`)**
    - `GET /admin/users`, `POST /admin/users`, `PATCH /admin/users/:id/role`, `POST /admin/users/:id/force-password-reset`, `POST /admin/users/:id/toggle-active`
    - `GET /admin/departments`, `POST /admin/departments`
    - `GET /admin/schedules`, `POST /admin/schedules`, `PATCH /admin/schedules/:id`
    - `GET /admin/holidays`, `POST /admin/holidays`, `DELETE /admin/holidays/:id`
    - `GET /admin/tax-policies`, `POST /admin/tax-policies`
    - `GET /audit/logs`, `GET /audit/logs/export` (`SYSTEM_ADMIN`, scoped `HR_MANAGER`/`PAYROLL_OFFICER`)
    - `GET /notifications/inbox`, `PATCH /notifications/:id/read`
    - `POST /internal/jobs/reconcile-attendance`, `POST /internal/jobs/process-daily-transitions` (Secret-header protected)

Let's write **`05_API_CONTRACT_AND_SECURITY_SPEC.md` (Part 2 of 2)** cleanly and completely!Here is **Part 2 of 2** of **`05_API_CONTRACT_AND_SECURITY_SPEC.md`**, documenting every single `/api/v1/...` endpoint across all 10 domain modules, their exact role gates, request requirements, and security behaviors.

---

### Filename: `05_API_CONTRACT_AND_SECURITY_SPEC.md` *(Part 2 of 2)*

```markdown
# 05 — StaffHub API Contract & Security Hardening Specification (Part 2 of 2)

## 7. Complete REST Endpoint Catalog (`/api/v1`)

---

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
```

---

### Ready for File 7?
Next up is **`06_DESIGN_SYSTEM_AND_UI_ARCHITECTURE.md`**, which pairs your **Savannah Editorial Design System** (`DESIGN.md` tokens) with your **React/Next.js Component Architecture** and the complete **Stitch-to-React Defect Fix Checklist** (so Antigravity eliminates every visual, consistency, and business-rule bug we caught in the Stitch screens).

Shall I proceed to **`06_DESIGN_SYSTEM_AND_UI_ARCHITECTURE.md`**?

Here is **File 7 of 10** (`06_DESIGN_SYSTEM_AND_UI_ARCHITECTURE.md`), ready to copy and paste directly into `/docs/06_DESIGN_SYSTEM_AND_UI_ARCHITECTURE.md`.

---

### Filename: `06_DESIGN_SYSTEM_AND_UI_ARCHITECTURE.md`

```markdown
# 06 — StaffHub Design System & React/Next.js UI Architecture

## 1. Visual Identity: "Savannah Editorial" Design Tokens

StaffHub uses an architectural, glare-free, mineral-and-ledger aesthetic engineered for long HR, Payroll, and operational sessions across desktop, tablet, and mobile browsers.

### 1.1 Color Tokens (`apps/web/tailwind.config.ts`)
| Token Name | Hex Value | Semantic UI Role |
| :--- | :--- | :--- |
| `canvas` | `#F5F3EE` | Warm Mineral Limestone — primary application viewport background |
| `surface` | `#FFFFFF` | Crisp Ivory White — cards, tables, modals, slide-over drawers, inputs |
| `surface-low` | `#FAF8F4` | Soft Parchment — subtle summary strips and secondary sub-cards |
| `surface-header` | `#ECE8DF` | Pale Travertine — sticky table headers (`thead`) and grouped dividers |
| `rail` | `#161513` | Smoked Obsidian — fixed desktop left navigation sidebar |
| `rail-hover` | `#22201D` | Active/hover navigation background inside Smoked Obsidian rail |
| `border-default` | `#E2DDD3` | Warm Stone Hairline — crisp `1px` borders on cards, tables, top bar |
| `border-strong` | `#C9C2B6` | Input borders and high-definition structural dividers |
| `brand-primary` | `#0B4F4E` | Deep Nile Petrol — primary action buttons, key links, progress fills |
| `brand-primary-hover` | `#083E3D` | Hover/pressed state for primary buttons |
| `brand-primary-soft` | `#E6F0EF` | Soft jewel tint for active filter chips and info callouts |
| `brand-copper` | `#B85028` | Terracotta Copper — high-priority conversions, urgency cues |
| `brand-brass` | `#D49B42` | Warm Brass — `3px` active sidebar indicator, approval badges |
| `ink-primary` | `#181715` | Warm Charcoal Ink — page titles, table values, primary body text |
| `ink-secondary` | `#57534E` | Warm Stone 600 — field labels, secondary metadata |
| `ink-muted` | `#736E67` | Muted Umber — helper text, placeholders (WCAG AA compliant on `#FFFFFF`) |
| `ink-on-rail` | `#E8E2D7` | Warm Bone — navigation labels inside `#161513` sidebar |
| `status-success` | Text `#2E5932` / Bg `#EDF3EB` / Border `#B7DFC5` | Approved, On-Time, Active, Cleared, Disbursed |
| `status-warning` | Text `#8A6014` / Bg `#FBF3E4` / Border `#E6CA8A` | Pending Approval, Grace Window, Pending Acknowledgement |
| `status-danger` | Text `#A43916` / Bg `#F9EBE6` / Border `#E8B8A8` | Rejected, Absent, Late, Locked, Offboarding Blocker, Exited |

### 1.2 Typography Tokens (`next/font/google`)
- **Display & Headings:** `Bricolage Grotesque` (`600`, `700`, tight tracking `-0.02em`)
- **UI, Forms & Body:** `Inter` (`400`, `500`, `600`)
- **Numbers, Currency, IDs & Clocks:** `JetBrains Mono` (`500`, `600`, `700`) with `font-variant-numeric: tabular-nums` enforced on **every** `UGX` figure, deduction column, leave count, employee code, and `EAT` timestamp.

### 1.3 Shape, Borders & Elevation Rules
- Prefer crisp **`1px solid #E2DDD3` borders** over heavy drop shadows.
- Border radii: `4px` (`rounded`) on inputs, buttons, and rectangular ledger-stamp status badges; `8px` (`rounded-lg`) on cards and table wrappers; `12px` (`rounded-xl`) on modals and slide-over drawers.
- **Single Primary CTA Rule:** Maximum **one** filled `#0B4F4E` (or `#B85028` for Conversion) button per toolbar, card, or modal. Secondary actions use Ivory `#FFFFFF` with `#C9C2B6` borders.
- **Zero Non-Break Wrapping Bugs:** All buttons and status pills MUST carry `whitespace-nowrap` so labels never split awkwardly across lines.

---

## 2. React / Next.js Component Architecture (`apps/web/src/components/`)

Treat the Stitch HTML exports in `/design-reference/` strictly as visual blueprints—NEVER copy-paste repeated sidebars or headers across pages. Build these **10 reusable core components**:

### 2.1 Layout & Navigation Components
1. **`<AppShell>` (`layout/AppShell.tsx`):**
   - Renders **one unified shell** for all authenticated routes:
     - **Desktop (`>= 1024px`):** Fixed `256px` Smoked Obsidian (`#161513`) `<Sidebar>` + sticky `64px` **Light Ivory (`#FFFFFF` / `#F5F3EE`)** `<TopBar>` (never dark top bars).
     - **Tablet (`768px – 1023px`):** Collapsible slide-out sidebar drawer.
     - **Mobile (`< 768px`):** Clean mobile header + docked bottom navigation tab bar (`Home`, `Attendance`, `Leave`, `Payslips`, `More/Menu`) with minimum `44x44px` touch targets.
   - **Inline SVG Brand Mark:** Renders a crisp inline SVG `S` monogram badge—zero external `<img>` URLs that can break offline.
2. **`<Sidebar>` (`layout/Sidebar.tsx`):**
   - Driven exclusively by a centralized **`ROLE_NAVIGATION_MAP`** in `apps/web/src/config/navigation.ts` keyed to `user.role`:
     - **`EMPLOYEE`:** Home, Attendance, Leave, My Payslips, My Assets, My Profile.
     - **`LINE_MANAGER`:** Team Operations, Leave & Correction Approvals, Staff Requisitions, Performance Reviews, *(plus `My Self-Service` divider)*. **Zero Organization Settings.**
     - **`RECRUITER`:** Vacancies & Pipeline, Candidate Pool, Interviews, Offers & Approvals, Onboarding Queues.
     - **`HR_MANAGER`:** HR Overview, Employee Directory, Pending Approvals, Recruitment & Onboarding, Leave & Attendance, Offboarding & Exits, Reports.
     - **`PAYROLL_OFFICER`:** Payroll Runs, Adjustments, Statutory & Tax Schedules, Staff Loans, Employee Pay Profiles.
     - **`ASSET_OFFICER`:** Asset Registry, Issue & Returns, Damaged / Lost Log, Exit Asset Clearances. *(Zero URA/NSSF payroll widgets.)*
     - **`SYSTEM_ADMIN`:** User Accounts & Roles, Schedules & Holidays, Tax Policy Rules, Immutable Audit Trail.
   - Active route automatically displays the `3px` Warm Brass (`#D49B42`) left indicator bar.
3. **`<TopBar>` (`layout/TopBar.tsx`):**
   - Left: Dynamic route breadcrumb.
   - Right: Live `<KampalaClock />` pill (`Kampala • HH:mm EAT`), `"Pending My Action"` notification bell popover with unread count, and User Persona Badge (`Full Name • Role`).
4. **`<PublicHeader>` (`layout/PublicHeader.tsx`):**
   - Used only on `/careers` and `/verify/*`. Clean Ivory bar with `S` monogram, `"Open Vacancies"`, `Kampala • EAT (UTC+3)` pill, and `"Staff Sign In"` button—**no logged-in user avatar**.

### 2.2 Reusable UI & Domain Primitives
5. **`<DataTable>` (`ui/DataTable.tsx`):**
   - Built on `@tanstack/react-table` with Pale Travertine (`#ECE8DF`) headers, `48px` rows, zero zebra clutter, search/filter toolbar, and **visible horizontal scrollbars** whenever columns exceed narrow viewports (remove `::-webkit-scrollbar{display:none}` globally!).
6. **`<OverlayDrawer>` (`ui/OverlayDrawer.tsx`):**
   - Replaces cramped side-by-side split panels (`xl:col-span-4`) with a smooth right-anchored **overlay slide-over drawer** (`max-w-[540px]`, subtle `#161513/40` matte scrim, `Esc` to close). Prevents tables from ever clipping columns on desktop screens!
7. **`<MandatoryReasonModal>` (`domain/MandatoryReasonModal.tsx`):**
   - Shared confirmation modal used by Reject Requisition, Reject Offer, Reject Leave, Request/Reject Attendance Correction, Reject Sensitive Profile Change, Create/Reject Authorised Payroll Adjustment, and Report Asset Damage/Loss.
   - Confirm CTA stays **disabled** until trimmed reason length `>= 10` characters (configurable minimum), clearly labeled `"Required for Immutable Audit Trail"`.
8. **`<CurrencyUGX>` & `<MaskedField>` (`domain/MaskedField.tsx`):**
   - `<CurrencyUGX value={amount} align="right" />` renders right-aligned `JetBrains Mono` tabular `UGX 3,372,500`.
   - `<MaskedField maskedValue="UGX •••••••" onReveal={...} />` defaults to masked for Salary, Bank Account (`••••2019`), and NIN; calls backend `?reveal=true` only when permitted (`HR_MANAGER`, `PAYROLL_OFFICER`, `SELF`).
9. **`<KampalaClock>` (`domain/KampalaClock.tsx`):**
   - Uses `Luxon` locked to `Africa/Kampala` regardless of the user's laptop/phone OS timezone setting.
10. **`<ServerWakeupBanner>` (`ui/ServerWakeupBanner.tsx`):**
    - Detects slow initial API ping (`> 3 seconds`) on Render's `$0` free tier and displays a calm notice: *"Connecting to StaffHub server (waking from idle, ~30s)..."* so presenters and evaluators never mistake cold-start wake-up for a crash.

---

## 3. Mandatory Stitch-to-React Defect Fix Checklist

When converting the exported Stitch screens in `/design-reference/` into Next.js components, Antigravity MUST verify every item below:

| # | Stitch Screen Affected | Defect Found in Stitch Output | Permanent Fix in Next.js Implementation |
| :-: | :--- | :--- | :--- |
| **1** | `employee_self_service_home_desktop` | Contains forbidden `"biometric override"` and `"biometric & subnet gateway"` text | Purge all `"biometric"` and `"GPS"` wording; replace with `"Web Browser Check-In • Africa/Kampala (EAT)"` |
| **2** | `employee_self_service_home_desktop` & `_mobile` | `"Show Net Pay"` reveals `UGX 4,850,000` (which is Gross, not Net) | Wire directly to real latest payslip Net Pay (`UGX 3,372,500` for Brian Kato's seeded data) |
| **3** | `ess_desktop`, `ess_mobile`, `line_manager` | External `<img>` logo URL failed to load (`StaffHub Logo` alt text) | Replace all `<img>` brand logos with shared inline SVG `S` monogram inside `<AppShell>` |
| **4** | `public_careers_portal` | Duplicate email alert says `"Submitting again will update your existing docket"`, footer says `© 2025`, and header shows a user avatar | Change alert to strictly **block** duplicate email submissions (`409`), disable Submit button, remove user avatar next to `Staff Sign In`, update copyright to `© 2026` |
| **5** | `hr_employee_profile_offboarding_clearance` | Wrong sidebar/header (`Talent & Recruitment` / `HR Recruiter`), unmasked bank account numbers (`9030018492019`), clipped tabs (`Docum...`) | Render inside `<AppShell>` with `HR_MANAGER` role config, wrap bank/NIN in `<MaskedField />`, shorten tab names so all 6 fit cleanly |
| **6** | `line_manager_team_dashboard` | Sidebar includes `Organization Settings` and omits `Staff Requisitions`; `Actions` column clipped slightly | Update `LINE_MANAGER` nav config to include `Staff Requisitions` and exclude `Organization Settings`; widen table container padding |
| **7** | `company_asset_registry` & `system_admin_audit_trail` | Dark `#161513` top header drift, `"Office of the Registrar"` persona, URA/NSSF payroll widget inside Asset sidebar, clipped table columns, button text wrapping | Standardize light Ivory `<TopBar>`, enforce role-specific `<Sidebar>` items, use `<OverlayDrawer>` instead of permanent side splits, restore scrollbars on wide tables, add `whitespace-nowrap` on buttons/badges |
| **8** | `recruitment_pipeline` & `audit_trail` | Active sidebar navigation link missing the `3px` Warm Brass (`#D49B42`) left border | Enforce automatic active-route matching inside `<Sidebar>` via Next.js `usePathname()` |
```

---

### Ready for File 8?
Next up is **`07_SCREENS_AND_INTERACTION_BLUEPRINT.md`**, which maps **every single route/screen across the entire application** (`/login`, `/careers`, `/verify/[code]`, `/employee/*`, `/leave`, `/manager/*`, `/recruitment/*`, `/hr/*`, `/payroll/*`, `/assets/*`, `/admin/*`)—connecting every button, table column, drawer, modal, validation banner, and API endpoint together.

Shall I proceed to **`07_SCREENS_AND_INTERACTION_BLUEPRINT.md`**?

Here is **File 8 of 10** (`07_SCREENS_AND_INTERACTION_BLUEPRINT.md`), ready to copy and paste directly into `/docs/07_SCREENS_AND_INTERACTION_BLUEPRINT.md`.

---

### Filename: `07_SCREENS_AND_INTERACTION_BLUEPRINT.md`

```markdown
# 07 — StaffHub Screen-by-Screen & Interaction Blueprint

This document maps every Next.js App Router page to its allowed roles, visual layout, Stitch reference (where applicable), interactive states, and backend `/api/v1` calls.

---

## 1. Authentication & Public Routes (`<PublicHeader>` / Standalone)

### 1.1 Sign-In, Password Reset & Demo Switcher (`/login`, `/change-password`, `/forgot-password`)
- **Access:** Public (`PUBLIC`), redirects authenticated users to their role landing page.
- **UI Layout:** Centered Warm Ivory card (`max-w-[460px]`) on Warm Limestone (`#F5F3EE`) canvas with `S` monogram badge and live `Kampala • EAT` badge.
- **States & Interactions:**
  - **Standard Login:** Email + Password (with reveal toggle) $\rightarrow$ `POST /api/v1/auth/login`. Displays inline errors for invalid credentials (`401`), temporary lockout (`423`), or deactivated ex-employee account (`401 ACCOUNT_DEACTIVATED`).
  - **First-Login Forced Reset (`/change-password`):** Triggered automatically when `passwordChangeRequired === true`. Displays security rule notice (*"Users must not share passwords"*), password strength checklist, and blocks navigation elsewhere until `POST /api/v1/auth/change-password` succeeds.
  - **Demo Quick-Access (Conditional):** Rendered **only** when `NEXT_PUBLIC_DEMO_MODE === 'true'`. Expandable accordion showing 7 role chips (`Employee`, `Line Manager`, `HR Manager`, `Recruiter`, `Payroll Officer`, `Asset Officer`, `System Admin`) calling `POST /api/v1/auth/demo-login`.
- **Role Default Landing Routes After Login:**
  - `EMPLOYEE` $\rightarrow$ `/home`
  - `LINE_MANAGER` $\rightarrow$ `/manager`
  - `RECRUITER` $\rightarrow$ `/recruitment`
  - `HR_MANAGER` $\rightarrow$ `/hr/employees`
  - `PAYROLL_OFFICER` $\rightarrow$ `/payroll`
  - `ASSET_OFFICER` $\rightarrow$ `/assets`
  - `SYSTEM_ADMIN` $\rightarrow$ `/admin`

### 1.2 Public Careers Portal (`/careers`)
- **Stitch Reference:** `public_careers_portal_job_application` (apply Defect Fixes #4: strict duplicate block, remove user avatar, `© 2026`).
- **Access:** `PUBLIC` (Job Applicant — zero account creation required).
- **UI Layout:** Split desktop view (`55%` searchable/filterable open vacancy cards on left; `45%` sticky `"Apply Without Account"` form on right; stacked on mobile).
- **Interactions & API Wiring:**
  - Load open jobs: `GET /api/v1/careers/vacancies?search=&departmentId=`. Each card displays `Closes: DD MMM YYYY, HH:mm EAT`.
  - Selecting a card updates URL query/detail view and binds the form to `vacancy.id`.
  - Form submits `multipart/form-data` (`fullName`, `email`, `phone`, `expectedGrossUgx`, `earliestStartDate`, `coverNote`, `cv`, `turnstileToken`) to `POST /api/v1/careers/vacancies/:id/apply`.
  - **Error States:**
    - `409 DUPLICATE_APPLICATION` $\rightarrow$ red alert banner inside form blocking submission (*"An application with this email has already been submitted for this vacancy. Multiple applications with the same email are not permitted."*).
    - `422 VACANCY_CLOSED` $\rightarrow$ disables form and displays closing timestamp in `EAT`.
    - `415 UNSUPPORTED_MEDIA_TYPE` $\rightarrow$ inline CV validation message (*"Only genuine PDF or DOCX files up to 5 MB are accepted."*).
  - **Success State:** Confirmation card showing tracking code (`APP-XXXXX`), Kampala timestamp, and summary (no account prompt).

### 1.3 Public Payslip Authenticity Verifier (`/verify/[verificationCode]`)
- **Access:** `PUBLIC` (opened by scanning the QR code on any StaffHub PDF payslip).
- **API Wiring:** `GET /api/v1/verify/payslips/:verificationCode`.
- **UI:** Clean official verification stamp card displaying `VERIFIED AUTHENTIC` (green) or `UNRECOGNIZED / INVALID` (red), Payslip Number, Pay Period, Masked Employee Name (`B*** K***`), Hash Integrity Match, and Issued Timestamp (`EAT`).

---

## 2. Employee Self-Service Routes (Available to All Staff Linked to `employeeId`)

### 2.1 Employee Self-Service Home (`/home`)
- **Stitch Reference:** `employee_self_service_home_desktop` & `_mobile` (apply Defect Fixes #1, #2, #3: remove "biometric", sync Net Pay `UGX 3,372,500`, inline SVG `S` logo).
- **Interactions & API Wiring:**
  - **Attendance Hero Card (`GET /api/v1/attendance/today`):**
    - Displays live `<KampalaClock />`, shift window (`08:00 – 17:00 EAT • 15m grace`), and current status pill.
    - `Check In Now` (`POST /api/v1/attendance/check-in` with `Idempotency-Key`) $\rightarrow$ switches CTA to `Check Out` (`POST /api/v1/attendance/check-out`). Once both recorded, card shows `Shift Completed` with total worked hours.
  - **3 Summary Cards:**
    1. `Pending My Action` (`GET /api/v1/notifications/inbox`): highlights pending asset acknowledgements or onboarding tasks with direct action link.
    2. `Annual Leave Balance` (`GET /api/v1/leave/balances`): shows remaining working days + `"Request Leave"` link to `/leave`.
    3. `Latest Payslip` (`GET /api/v1/payroll/my-payslips?limit=1`): uses `<MaskedField />` defaulting to `UGX •••••••` (revealing exact Net Pay e.g., `UGX 3,372,500`) + `"View PDF"` (`GET /api/v1/payroll/payslips/:id/pdf-url`).
  - **7-Day Attendance History Table (`GET /api/v1/attendance/records?days=7`):**
    - Shows Date, Shift, Check-In (`EAT`), Check-Out (`EAT`), Hours, Status Badge, and `"Request Correction"` link opening `<AttendanceCorrectionModal>` (`POST /api/v1/attendance/corrections` requiring `requestedCheckInAt`, `requestedCheckOutAt?`, and mandatory `reason`).

### 2.2 Leave Management & Calendar (`/leave`)
- **UI Layout:** 2-column desktop layout (`2/3` Request Form + History Table; `1/3` Leave Balances + Uganda Public Holiday Mini-Calendar). Includes top tabs (`My Leave` | `Team / HR Approvals` shown only to `LINE_MANAGER` / `HR_MANAGER`).
- **Interactions & API Wiring:**
  - Changing `leaveTypeId`, `startDate`, or `endDate` calls `POST /api/v1/leave/calculate-working-days` and updates a live summary pill: *"Selected: 7 Calendar Days $\rightarrow$ 5 Working Days (Excludes Sat/Sun & Jamhuri/Holiday)"*.
  - Submit (`POST /api/v1/leave/requests` with `Idempotency-Key`, mandatory `reason`, optional supporting PDF). Shows inline validation banners for `LEAVE_OVERLAP` or `INSUFFICIENT_LEAVE_BALANCE`.
  - `Cancel` button on pending requests calls `POST /api/v1/leave/requests/:id/cancel`.
  - Approvals tab lists pending queue (`GET /api/v1/leave/requests?pendingMyApproval=true`) with `Approve` (`POST .../approve`) and `Reject` (opens `<MandatoryReasonModal>` $\rightarrow$ `POST .../reject`).

### 2.3 My Assets, My Payslips & My Profile (`/my-assets`, `/my-payslips`, `/profile`)
- **`/my-assets` (`GET /api/v1/assets/my-assets`):** Cards/rows for currently assigned items. Items in `PENDING_ACKNOWLEDGEMENT` show an explicit Nile Petrol `"Acknowledge Receipt"` button (`POST /api/v1/assets/assignments/:id/acknowledge`).
- **`/my-payslips` (`GET /api/v1/payroll/my-payslips`):** List of monthly published payslips with masked net pay toggle and `"Open Payslip Preview"` `<OverlayDrawer>` (`GET .../pdf-url`).
- **`/profile` (`GET /api/v1/employees/:myId`):**
  - Permitted section (`Phone`, `Personal Email`, `Residential Address`, `Emergency Contact`) edits inline (`PATCH /api/v1/employees/:id/contact`).
  - Sensitive section (`Legal Name`, `Bank Name/Branch/Account`, `National ID NIN`) displays `<MaskedField />` + `"Request Change"` modal (`POST /api/v1/employees/:id/change-requests` with supporting document upload and reason) + status tracker of pending HR requests.

---

## 3. Line Manager Workspace (`/manager`)

### 3.1 Line Manager Team Operations (`/manager`)
- **Stitch Reference:** `line_manager_team_dashboard` (apply Defect Fixes #3, #6: inline SVG logo, replace `Organization Settings` with `Staff Requisitions`, ensure zero table clipping).
- **STRICT PRIVACY GUARANTEE:** Zero `UGX` salary, bank account, or NIN columns appear anywhere in UI or API responses.
- **Tabs & Interactions:**
  1. **Team Attendance & Approval Inbox (Default):** 4 KPI cards (`Present On-Duty`, `On Approved Leave`, `Pending My Approvals`, `30D Shift Compliance`), Approval Queue (Leave + Attendance Corrections with `Approve` / `Reject` via `<MandatoryReasonModal>`), and Direct Reports Roster (`GET /api/v1/employees`, `GET /api/v1/attendance/records`).
  2. **Staff Requisitions Tab:** Button `"+ Request New Staff"` (`POST /api/v1/recruitment/requisitions`) + status table (`PENDING_HR`, `APPROVED`, `REJECTED` with HR reason).
  3. **Performance Reviews Tab:** Create review cycles (`POST /api/v1/performance/reviews`), submit manager feedback & `1.00–5.00` rating (`PATCH .../manager-review`).
  4. **Acting Delegation Modal:** Accessible from top bar/tab to temporarily delegate team approvals (`POST /api/v1/delegations`).

---

## 4. Recruiter & HR Lifecycle Routes (`/recruitment`, `/hr/*`)

### 4.1 Recruitment Pipeline & Conversion (`/recruitment`)
- **Stitch Reference:** `recruitment_pipeline_candidate_to_employee_conversion` (apply Defect Fix #8: active Warm Brass sidebar border; Defect Fix #7: convert Conversion Drawer to `<OverlayDrawer>`).
- **Tabs:** `Requisition Approvals` (`HR_MANAGER` approves/rejects Line Manager requests) | `Vacancies` (publish `APPROVED` reqs via `POST /api/v1/recruitment/vacancies/:id/publish`) | `Pipeline Board` | `Onboarding Queues`.
- **Pipeline & Conversion Interaction:**
  - Filterable 6-stage pipeline (`Applied`, `Shortlisted`, `Interviewing`, `Offer Approval`, `Offer Sent`, `Accepted`).
  - Clicking a candidate opens `<OverlayDrawer>` showing CV signed download link (`GET .../cv-url`), interview scores (`POST .../interviews`), and Offer actions:
    - Recruiter prepares Draft Offer (`POST .../offers`) $\rightarrow$ submits (`POST .../submit`).
    - HR Manager approves/rejects (`POST .../approve` | `.../reject` with `<MandatoryReasonModal>`).
    - Recruiter sends approved offer (`POST .../send`) and records candidate acceptance (`POST .../record-decision`).
    - On `ACCEPTED`, HR Manager clicks Terracotta CTA **`Convert to Employee`** (`POST /api/v1/recruitment/offers/:id/convert` with `Idempotency-Key`), transitioning smoothly to the auto-generated 4-role Onboarding Checklist.

### 4.2 HR Employee Directory, Sensitive Changes & Offboarding (`/hr/employees`, `/hr/employees/[id]`, `/hr/offboarding`)
- **Stitch Reference:** `hr_employee_profile_offboarding_clearance` (apply Defect Fix #5: proper `HR_MANAGER` `<AppShell>` sidebar, `<MaskedField />` on bank/NIN, shortened 6 tab labels).
- **Employee Detail Tabs:** `Overview` | `Statutory` | `Bank & Pay` (Masked + `Reveal` toggle + Pending Bank Diff card `Old` vs `Requested` with `Approve`/`Reject`) | `Attendance & Leave` | `Assets` | `Offboarding`.
- **Offboarding & Clearance View (`/hr/offboarding` or Profile Offboarding Tab):**
  - Initiate Exit Modal (`POST /api/v1/offboarding/cases` with `exitType`, `noticeDate`, `lastWorkingDay`, `exitReason`).
  - 4-Track Clearance Progress Bar (`Asset Return`, `Operational Handover`, `Finance/Loans`, `HR Exit`) showing explicit red **Blocker Cards** (e.g., `Blocked: Unreturned #AST-064 ThinkPad T14`).
  - `"Finalize Clearance"` and `"Deactivate Account"` buttons stay visibly **disabled with explanatory tooltip** until blockers clear and `lastWorkingDay` passes.

---

## 5. Payroll Officer & HR Approver Workspace (`/payroll`)

- **Stitch Reference:** `monthly_payroll_run_locked_payslip_drawer_november_2026` (apply Defect Fix #7: make Printable Payslip Drawer an `<OverlayDrawer>` so `Status` and `Slip` columns never clip!).
- **Top Controls:** Month/Year selector, Attendance Period Lock check/button (`POST /api/v1/attendance/period-locks`), `"Prepare Monthly Payroll"` button (`POST /api/v1/payroll/runs`).
- **Workflow Stepper:** `1. Draft` $\rightarrow$ `2. Pending Approval` $\rightarrow$ `3. Approved` $\rightarrow$ `4. Locked & Published`.
- **4 `UGX` Summary Cards:** `Total Gross`, `NSSF Pool (10% Co. + 5% Staff)`, `URA PAYE & LST`, `Total Net Payable`.
- **Action Flows:**
  - In `DRAFT`: Payroll Officer can edit bonus/other deductions (`PATCH .../items/:itemId`), then click `Submit for Approval`.
  - In `PENDING_APPROVAL`: Distinct `HR_MANAGER` clicks `Approve Payroll` (`POST .../approve`) or `Return to Draft` (opens `<MandatoryReasonModal>`).
  - In `APPROVED`: `Lock & Publish Payslips` (`POST .../lock`) locks the run and generates QR-verified PDFs.
  - In `LOCKED`: Displays amber `"Payroll Locked — Direct edits disabled"` banner + `"Create Authorised Adjustment"` button (opens adjustment modal $\rightarrow$ `POST /api/v1/payroll/items/:itemId/adjustments` with mandatory `reason`) + `Export Bank EFT CSV` / `Export URA & NSSF CSV`.
  - Clicking `Slip` opens `<OverlayDrawer>` with itemized UGX breakdown, Verification QR Code, and `"Download Official PDF"` button.

---

## 6. Asset Officer Workspace (`/assets`)

- **Stitch Reference:** `company_asset_registry_equipment_custody` (apply Defect Fix #7: light Ivory `<TopBar>`, Asset Officer `<Sidebar>` with zero URA/NSSF payroll widgets, `<OverlayDrawer>` for Custody Docket so `Book Value` and `Action` columns never clip, `whitespace-nowrap` on `+ Register & Allocate Hardware`).
- **Interactions & API Wiring:**
  - Register new item (`POST /api/v1/assets`).
  - `Assign Staff` drawer (`POST /api/v1/assets/:id/issue`) — dropdown disables employees if asset already assigned; DB index enforces max 1 assignee.
  - `Record Return` drawer (`POST /api/v1/assets/assignments/:id/return`) — selects `returnCondition` (`GOOD`, `FAIR`, `DAMAGED`) and refreshes offboarding blockers automatically.
  - `Report Damage / Loss` drawer (`POST /api/v1/assets/assignments/:id/incident`) — requires mandatory `incidentNotes`.

---

## 7. System Administrator Workspace (`/admin`, `/audit`)

- **Stitch Reference:** `system_admin_immutable_audit_trail` (apply Defect Fix #7 & #8: light Ivory `<TopBar>`, System Admin `<Sidebar>` with active Warm Brass bar, visible horizontal scroll on Audit table).
- **Admin Tabs (`/admin`):**
  1. `User Accounts & Roles`: Create accounts (`POST /api/v1/admin/users`), assign roles (`PATCH .../role`), Force Password Reset, and view read-only deactivated ex-employee accounts.
  2. `Work Schedules & Grace Periods`: Manage shifts (`08:00 – 17:00 EAT`, `15m` grace, `workingDaysBitmap`).
  3. `Ugandan Public Holidays`: Add/manage `holiday_date` entries (`POST /api/v1/admin/holidays`).
  4. `Statutory Tax Policy`: View/create effective-dated PAYE, NSSF, and LST tables (`POST /api/v1/admin/tax-policies`).
- **Immutable Audit Trail (`/audit`):**
  - Filterable by Date Range (`EAT`), Action Category, Actor, and Entity ID (`GET /api/v1/audit/logs`).
  - Displays Timestamp (`EAT`), Actor & Role (plus `Acting for...` attribution if delegated), Target, Old-to-New Diff, Mandatory Logged Reason, and SHA-256 checksum, plus `"Export Audit Bundle"` (`GET /api/v1/audit/logs/export`).
```

---

### Ready for File 9?
Next up is **`08_TESTING_QA_AND_SEED_DATA_SPEC.md`**, which specifies:
1. The complete **Automated Test Suite Matrix** (Unit tests for Uganda 2026 PAYE/NSSF/LST math & working-day calculations, Integration tests for every single business rule & edge case, RBAC/IDOR security leakage tests, and E2E lifecycle tests).
2. The complete **Pre-Seeded Ugandan Organization Dataset (`prisma/seed.ts` spec)**—including all 7 internal user accounts, Ugandan public holidays, shift schedules, statutory tax policy, open vacancy + accepted candidate Amina Nabakooza, employee Brian Kato (`UGX 3,372,500` net pay), locked payroll run, assets, and exiting employee Denis Mukasa with unreturned `#AST-064` laptop blocker!

Shall I proceed to **`08_TESTING_QA_AND_SEED_DATA_SPEC.md`**?

Here is **File 9 of 10** (`08_TESTING_QA_AND_SEED_DATA_SPEC.md`), ready to copy and paste directly into `/docs/08_TESTING_QA_AND_SEED_DATA_SPEC.md`.

*(Note: The seeded payroll test vectors below follow Uganda’s **Income Tax (Amendment) Act, 2026** monthly resident PAYE bands effective 1 July 2026, 5%/10% NSSF on gross pay, and July–October Local Service Tax instalments so every `UGX` calculation is mathematically exact to the shilling during live audits.)*

---

### Filename: `08_TESTING_QA_AND_SEED_DATA_SPEC.md`

```markdown
# 08 — StaffHub Testing, QA Matrix & Ugandan Demo Seed Specification

## 1. Automated Testing Strategy & Coverage Goals

Every business rule, calculation, privacy boundary, and state transition MUST be backed by automated tests executed on every GitHub Actions CI push (`npm test`).

### 1.1 Test Layers
1. **Unit Tests (`*.spec.ts` via Jest / Vitest):** Pure domain logic (zero DB required, `< 5s` run time).
2. **Backend Integration & Security Tests (`*.e2e-spec.ts` via NestJS Testing + Supertest + Test PostgreSQL):** Real Prisma/PostgreSQL transactions testing constraints, triggers, locks, RBAC/IDOR, and HTTP error codes.
3. **Frontend Component Tests (Vitest + React Testing Library):** `UGX` tabular formatters, `Africa/Kampala` date rendering, `<MaskedField />`, `<MandatoryReasonModal />` disabled-until-reason state.
4. **End-to-End Smoke Verification:** Full Section 5 lifecycle walkthrough against seeded database.

---

## 2. Mandatory Unit Test Cases (Domain Math & Helpers)

### 2.1 Uganda Statutory Payroll Calculator (`StatutoryCalculatorService`)
Using the active FY 2026/27 resident policy (`0–335k: 0%`, `335k–410k: 20%`, `410k–485k: 25%`, `485k–10M: 30%`, `>10M: +10%`; NSSF `5%` emp / `10%` co.; LST in Jul–Oct):
| Test ID | Gross Monthly Pay (`UGX`) | Month | Residency | Expected NSSF Emp (5%) | Expected NSSF Co. (10%) | Expected PAYE (`UGX`) | Expected LST (`UGX`) | Expected Net Pay (`UGX`) |
| :--- | ---: | :---: | :---: | ---: | ---: | ---: | ---: | ---: |
| `PAY-U01` | `300,000` | Nov | Resident | `15,000` | `30,000` | `0` | `0` | `285,000` |
| `PAY-U02` | `400,000` | Nov | Resident | `20,000` | `40,000` | `13,000` | `0` | `367,000` |
| `PAY-U03` | `485,000` | Nov | Resident | `24,250` | `48,500` | `33,750` | `0` | `427,000` |
| `PAY-U04` | `4,850,000` | **Oct** | Resident | `242,500` | `485,000` | `1,343,250` | `25,000` | `3,239,250` |
| `PAY-U05` | `4,850,000` | **Nov** | Resident | `242,500` | `485,000` | `1,343,250` | `0` | `3,264,250` |
| `PAY-U06` | `12,000,000` | Nov | Resident | `600,000` | `1,200,000` | `3,688,250` | `0` | `7,711,750` |

*(Verify `PAY-U06` breakdown: `33,750 + (12,000,000 - 485,000)*0.30 + (12,000,000 - 10,000,000)*0.10 = 33,750 + 3,454,500 + 200,000 = 3,688,250`.)*

### 2.2 Working-Day & Holiday Leave Calculator (`LeaveCalculatorService`)
| Test ID | Schedule | Holidays in Range | Requested Range | Expected Calendar Days | Expected Working Days |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `LVE-U01` | Mon–Fri `[1..5]` | None | `Mon 16 Nov – Fri 20 Nov 2026` | `5` | `5` |
| `LVE-U02` | Mon–Fri `[1..5]` | None | `Thu 19 Nov – Tue 24 Nov 2026` | `6` | `4` *(skips Sat/Sun)* |
| `LVE-U03` | Mon–Fri `[1..5]` | `Fri 25 Dec` (Christmas) | `Thu 24 Dec – Mon 28 Dec 2026` | `5` | `2` *(skips 25 Dec, Sat 26, Sun 27)* |
| `LVE-U04` | Mon–Fri `[1..5]` | `Sat 21 Nov` & `Sun 22 Nov` | `Sat 21 Nov – Sun 22 Nov 2026` | `2` | `0` *(Triggers rejection)* |

### 2.3 Attendance Grace Period & Kampala Timezone (`AttendanceEvaluator`)
- `ATT-U01`: `08:00:00 EAT` on `08:00` shift (`15m` grace) $\rightarrow$ `PRESENT_ON_TIME`.
- `ATT-U02`: `08:15:00 EAT` on `08:00` shift (`15m` grace) $\rightarrow$ `PRESENT_GRACE`.
- `ATT-U03`: `08:15:01 EAT` on `08:00` shift (`15m` grace) $\rightarrow$ `LATE`.
- `ATT-U04`: Client running in `America/New_York` (`UTC-5`) checking in at `00:04 EST` = `08:04 EAT` $\rightarrow$ evaluates strictly on `Africa/Kampala` date & `08:04 EAT`.

---

## 3. Mandatory Integration & Security Tests (API + PostgreSQL)

### 3.1 Security, Privacy & Anti-IDOR Tests
| Test ID | Scenario | Expected Assertion |
| :--- | :--- | :--- |
| `SEC-I01` | **Line Manager Salary Privacy Leak** | `GET /api/v1/employees` & `GET /api/v1/employees/:directReportId` called as `LINE_MANAGER` MUST return `200`, and JSON keys `baseSalaryUgx`, `recurringAllowancesUgx`, `bankAccountNumber`, `bankAccountEncrypted`, `ninEncrypted`, `uraTin`, `nssfNumber` MUST be `undefined` (omitted). |
| `SEC-I02` | **Line Manager Cross-Team IDOR** | `LINE_MANAGER` A requests attendance or leave approval for an employee reporting to `LINE_MANAGER` B (with no delegation) $\rightarrow$ `403 FORBIDDEN_SCOPE`. |
| `SEC-I03` | **Mass Assignment Attack** | `EMPLOYEE` sends `PATCH /api/v1/employees/:selfId/contact` with `{ "phone": "+256772000111", "role": "SYSTEM_ADMIN", "baseSalaryUgx": 99000000 }` $\rightarrow$ `400 VALIDATION_ERROR` (strictly rejected). |
| `SEC-I04` | **Self-Approval Block** | `LINE_MANAGER` or `HR_MANAGER` calls `POST /leave/requests/:ownId/approve` or `POST /employees/change-requests/:ownId/approve` $\rightarrow$ `403 SELF_APPROVAL_FORBIDDEN`. |
| `SEC-I05` | **First-Login Forced Password Change** | Newly converted employee logs in with temp password $\rightarrow$ receives `passwordChangeRequired: true`; calling `GET /employees` with temp token returns `403 PASSWORD_CHANGE_REQUIRED`. |
| `SEC-I06` | **Deactivated Ex-Employee Lockout** | After offboarding deactivation, using old access token OR refresh cookie returns `401 ACCOUNT_DEACTIVATED`. |
| `SEC-I07` | **CV Upload Spoofed Extension** | Uploading an executable/text file renamed to `malware.pdf` to `/careers/vacancies/:id/apply` $\rightarrow$ `415 UNSUPPORTED_MEDIA_TYPE`. |

### 3.2 Business Rule & Constraint Integration Tests
| Test ID | Rule Under Test | Expected Assertion |
| :--- | :--- | :--- |
| `BIZ-I01` | Vacancy requires HR-approved requisition | Creating vacancy from `PENDING_HR` requisition $\rightarrow$ `422`. |
| `BIZ-I02` | Unique applicant email per vacancy | Applying twice to same vacancy with `Test@Example.com` and `test@example.com` $\rightarrow$ second request returns `409 DUPLICATE_APPLICATION`. Applying to a *different* vacancy with same email succeeds (`201`). |
| `BIZ-I03` | Application after closing date | Applying to closed/expired vacancy $\rightarrow$ `422 VACANCY_CLOSED`. |
| `BIZ-I04` | Offer must be HR-approved before sending | Sending `DRAFT` or `PENDING_APPROVAL` offer $\rightarrow$ `422`. |
| `BIZ-I05` | 1 Accepted offer $\rightarrow$ 1 Employee | Calling `/offers/:id/convert` twice (without/with different keys) creates **only 1** employee (`409` on second attempt without replay key). |
| `BIZ-I06` | 1 Attendance/day & Check-Out after Check-In | Check-Out before Check-In $\rightarrow$ `422 MUST_CHECK_IN_FIRST`; second Check-In same day $\rightarrow$ `409 ALREADY_CHECKED_IN`. |
| `BIZ-I07` | Leave overlap & balance guard | Submitting overlapping dates $\rightarrow$ `422 LEAVE_OVERLAP`; requesting 20 days with 14 available $\rightarrow$ `422 INSUFFICIENT_LEAVE_BALANCE`. |
| `BIZ-I08` | Mandatory reason enforcement | Rejecting leave, requisition, offer, profile change, attendance correction, or creating payroll adjustment with empty/whitespace `reason` $\rightarrow$ `422 REASON_REQUIRED`. |
| `BIZ-I09` | Payroll separation of duties & lock immutability | Same `PAYROLL_OFFICER` trying to approve own run $\rightarrow$ `403`; `PATCH` on item in `LOCKED` run $\rightarrow$ `423 PAYROLL_LOCKED_DIRECT_EDIT_FORBIDDEN`. |
| `BIZ-I10` | Max 1 active assignee per asset | Issuing already-assigned `#AST-064` to second employee $\rightarrow$ `409 ASSET_ALREADY_ASSIGNED`. |
| `BIZ-I11` | Offboarding hard clearance blocker | Attempting to clear `ASSET_RETURN` or finalize exit while `#AST-064` unreturned $\rightarrow$ `422 CLEARANCE_BLOCKED`. After logging return, sign-off and finalization succeed (`200`). |
| `BIZ-I12` | EOD cron idempotency | Running `/internal/jobs/reconcile-attendance` twice for same date creates 0 duplicate records and preserves `ON_LEAVE`, `HOLIDAY`, `DAY_OFF`, and existing check-ins. |

---

## 4. Pre-Seeded Ugandan Demo Dataset (`prisma/seed.ts`)

`seed.ts` MUST be **idempotent** (safe to run repeatedly without crashing or duplicating data) and initialize a complete live demo story for **StaffHub Uganda Ltd** (`Plot 14 Lumumba Avenue, Nakasero, Kampala`).

### 4.1 Seeded User Accounts (All 7 Internal Roles)
*(Demo password for all seeded non-production accounts: `StaffHub@2026!`, hashed via `Argon2id`.)*
| Role | Full Name | Email | Employee Code | Department |
| :--- | :--- | :--- | :--- | :--- |
| `SYSTEM_ADMIN` | Raymond Mugisha | `raymond.mugisha@staffhub.ug` | `UG-ADM-0001` | IT & Governance |
| `HR_MANAGER` | Julius Okello | `julius.okello@staffhub.ug` | `UG-HR-0012` | People & Culture |
| `RECRUITER` | Grace Apio | `grace.apio@staffhub.ug` | `UG-REC-0019` | People & Culture |
| `LINE_MANAGER` | Michael Kigozi | `michael.kigozi@staffhub.ug` | `UG-MGR-0089` | Finance & Operations |
| `PAYROLL_OFFICER` | Sarah Namubiru | `sarah.namubiru@staffhub.ug` | `UG-PAY-0034` | Finance & Operations |
| `ASSET_OFFICER` | Joseph Mukasa | `joseph.mukasa@staffhub.ug` | `UG-AST-0021` | Infrastructure & Security |
| `EMPLOYEE` | Brian Kato | `brian.kato@staffhub.ug` | `UG-EMP-0412` | Finance & Operations (Reports to Michael Kigozi) |

*(Plus 4 additional direct reports under Michael Kigozi: **Rebecca Kisakye** `UG-EMP-0449`, **Fiona Namatovu** `UG-EMP-0405`, **Ivan Tumusiime** `UG-EMP-0512`, and exiting employee **Denis Mukasa** `UG-EMP-0291`, plus 1 read-only already-deactivated ex-employee **Samuel Ssebunya** `UG-EMP-0104` to demonstrate record retention.)*

### 4.2 Seeded Organization Configuration
- **Work Schedule:** `Kampala Standard Office (Mon–Fri)`, `08:00 – 17:00 EAT`, `15-minute` grace period, working days `[1,2,3,4,5]`.
- **Ugandan Public Holidays (2026):** `New Year's Day (01 Jan)`, `NRM Liberation Day (26 Jan)`, `Janani Luwum Day (16 Feb)`, `International Women's Day (08 Mar)`, `Good Friday (03 Apr)`, `Easter Monday (06 Apr)`, `Labour Day (01 May)`, `Uganda Martyrs' Day (03 Jun)`, `National Heroes' Day (09 Jun)`, `Independence Day (09 Oct)`, `Christmas Day (25 Dec)`, `Boxing Day (26 Dec)`.
- **Statutory Tax Policy:** `Uganda FY 2026/27 Statutory Policy` (`effective_from: 2026-07-01`), exact PAYE brackets, `5%` / `10%` NSSF, and Jul–Oct LST tiers.
- **Leave Types:** Annual (`21` days), Sick (`14` days), Compassionate (`5` days), Maternity (`60` working days, HR required), Paternity (`4` working days), Study (`5` days, HR required), Unpaid (`0` entitlement, HR required).

### 4.3 Seeded Live Storyline Records (Ready for Presentation)
1. **Recruitment Demo:**
   - Approved Requisition `#REQ-2026-042` $\rightarrow$ Published Vacancy `#VAC-2026-042` (`Senior Payroll Compliance Specialist`, closes `28 Nov 2026, 23:59 EAT`).
   - Applicant **Amina Florence Nabakooza** (`amina.nabakooza@outbox.co.ug`) with `OFFER_ACCEPTED` (`UGX 7,500,000` gross), ready for live **1-Click Convert to Employee**.
   - Open Vacancy `#VAC-2026-045` (`Treasury Analyst`, closes `15 Dec 2026`) ready for live Public Job Application demo.
   - Expired Vacancy `#VAC-2026-011` (`Office Coordinator`, closed `01 Nov 2026`) for testing late rejection.
2. **ESS & Attendance Demo (Brian Kato `UG-EMP-0412`):**
   - Base `4,200,000` + Allowances `650,000` (`4,850,000` Gross); Bank: Stanbic Bank (`••••8492`); 7 past workdays seeded; **no check-in today** so presenter can click `Check In Now` live!
   - `14` working days annual leave remaining; Asset `#AST-088` (`MacBook Pro 16" M3 Pro`) in `PENDING_ACKNOWLEDGEMENT` ready for live acknowledgement.
3. **Manager Queue Demo (Michael Kigozi):**
   - Pending Leave Request from Rebecca Kisakye (`2 working days` Study Leave) + Pending Attendance Correction from Fiona Namatovu.
4. **Payroll Demo:**
   - **October 2026 Payroll (`PR-UG-2026-10`):** `LOCKED` & published (Brian Kato Net Pay `UGX 3,239,250` incl. `25,000` Oct LST) with downloadable QR-verified PDF payslips!
   - **November 2026 Attendance Lock + Draft Payroll (`PR-UG-2026-11`):** Ready to submit and approve live (`Net Pay UGX 3,264,250` for Brian Kato with `0` Nov LST).
5. **Offboarding Blocker & Bank Change Demo (Denis Mukasa `UG-EMP-0291`):**
   - Status `OFFBOARDING`, `last_working_day: 30 Nov 2026`, holding unreturned `#AST-064` (`Lenovo ThinkPad T14 Gen 3`) and `#AST-092` (`ThinkPad Dock`), blocking `ASSET_RETURN` clearance!
   - Pending Bank Change Request (`Stanbic ••••2019` $\rightarrow$ `Centenary Bank ••••9104`) awaiting HR Manager Julius Okello's review.
6. **Audit Trail Seed:** Initial 10 realistic audit entries (Payroll Oct Lock, Asset Issue, Offer Acceptance, etc.) with valid SHA-256 checksums.
```

---

### Ready for the Final File (File 10 of 10)?
Next up is **`09_DEVOPS_DEPLOYMENT_AND_HANDOFF_GUIDE.md`**, which specifies:
1. Complete **Docker Compose** local development & offline presentation architecture (Postgres 16 + MinIO + Mailpit + NestJS API + Next.js Web + auto-migrate/seed + `start-staffhub.sh`/`.bat`).
2. Complete **GitHub Actions CI & Scheduled Cron** pipeline specs (`23:55 EAT` & `00:05 EAT`).
3. Complete **$0 Cloud Deployment Playbook** (Neon + Render + Vercel + Cloudflare R2/Supabase + Brevo).
4. **Friend Presentation & ZIP/Docker Handoff Playbook** (live URL warm-up checklist, offline Docker fallback, backup screen-recording checklist, and a timed 5-minute demo script walking through all 8 StaffHub workflows!).

Shall I proceed to **`09_DEVOPS_DEPLOYMENT_AND_HANDOFF_GUIDE.md`**?

Here is **File 10 of 10** (`09_DEVOPS_DEPLOYMENT_AND_HANDOFF_GUIDE.md`), completing your entire Master Blueprint Documentation Suite.

---

### Filename: `09_DEVOPS_DEPLOYMENT_AND_HANDOFF_GUIDE.md`

```markdown
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
- *(Include `workflow_dispatch` on both so you can trigger them manually during testing or demos!)*

---

## 3. $0 Cloud Production / Live Demo Deployment Playbook

Deploy in this exact order—requiring **zero credit cards**:

### Step 1: PostgreSQL Database on **Neon** ($0 Free Tier)
1. Create project `staffhub-prod` in Neon (select nearest region, e.g., `eu-central-1` / Frankfurt for best latency to East Africa).
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
1. Connect GitHub repository, set Root Directory `apps/api` (or monorepo build command `npm ci && npm run build --workspace=apps/api && npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma`).
2. Start command: `node dist/main`.
3. Configure all Backend Environment Variables (`NODE_ENV=production`, `TZ=Africa/Kampala`, `DEMO_MODE=true` for live presentation / `false` for strict production, `CORS_ORIGIN=https://<your-vercel-domain>.vercel.app`, generated 64-hex secrets for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PII_ENCRYPTION_KEY`, `CRON_SHARED_SECRET`).
4. Note Render Free Tier behavior: Sleeps after 15 minutes of inactivity (~30–60s cold wake-up on first call); frontend `<ServerWakeupBanner />` handles this gracefully.

### Step 6: Next.js Frontend on **Vercel** ($0 Hobby Tier)
1. Connect GitHub repository, set Root Directory `apps/web`.
2. Set `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com/api/v1`, `NEXT_PUBLIC_APP_TIMEZONE=Africa/Kampala`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_DEMO_MODE`.
3. Deploy and verify `/login` and `/careers` over HTTPS.

### Step 7: Wire GitHub Repository Secrets
Add `API_BASE_URL` and `CRON_SHARED_SECRET` to **GitHub Actions Secrets** so the `23:55 EAT` and `00:05 EAT` cron workflows execute automatically.

---

## 4. Friend Presentation & Handoff Playbook

Since **you** are building the system and **your friend** is presenting it, never rely on sending a raw un-containerized ZIP folder. Follow this **2-Tier Handoff Protocol**:

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
2. **Recruiter & HR Conversion (`/recruitment`):** Sign in (or switch) to `HR Manager` (Julius Okello), open `#VAC-2026-042`, click Accepted Candidate **Amina Nabakooza**, and trigger **1-Click `Convert to Employee`** (zero re-typing, creates 4-role onboarding checklist).
3. **Employee Daily Ops (`/home` & `/leave`):** Switch to `Employee` (**Brian Kato**). Show live `EAT` clock (zero biometrics/GPS!), click **`Check In Now`**, acknowledge assigned MacBook `#AST-088`, reveal masked Net Pay (`UGX 3,264,250`), and preview Leave Working-Day calculation excluding weekends & Ugandan public holidays.
4. **Line Manager Privacy (`/manager`):** Switch to `Line Manager` (**Michael Kigozi**). Approve a team leave/correction request, and point out explicitly that **salary, bank account, and NIN columns are completely hidden**.
5. **Payroll & QR Verification (`/payroll`):** Switch to `Payroll