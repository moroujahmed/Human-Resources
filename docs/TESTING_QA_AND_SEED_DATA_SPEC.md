# 08 — StaffHub Testing, QA Matrix & Ugandan Demo Seed Specification

## 1. Automated Testing Strategy & Coverage Goals

Every business rule, statutory calculation, privacy boundary, and state transition MUST be backed by automated tests executed on every GitHub Actions CI push (`npm test`).

### 1.1 Test Layers
1. **Unit Tests (`*.spec.ts` via Jest / Vitest):** Pure domain logic (zero database required, `< 5s` execution).
2. **Backend Integration & Security Tests (`*.e2e-spec.ts` via NestJS Testing + Supertest + Test PostgreSQL):** Real Prisma/PostgreSQL transactions testing constraints, triggers, locks, RBAC/IDOR, and HTTP error codes.
3. **Frontend Component Tests (Vitest + React Testing Library):** `UGX` tabular formatters, `Africa/Kampala` date rendering, `<MaskedField />`, and `<MandatoryReasonModal />` disabled-until-reason validation.
4. **End-to-End Lifecycle Verification:** Full Section 5 workflow walkthrough against seeded Ugandan demo data.

---

## 2. Mandatory Unit Test Cases (Domain Math & Helpers)

### 2.1 Uganda Statutory Payroll Calculator (`StatutoryCalculatorService`)
Using the active FY 2026/27 resident policy (`0–335k: 0%`, `335k–410k: 20%`, `410k–485k: 25%`, `485k–10M: 30%`, `>10M: +10%`; NSSF `5%` employee / `10%` employer on gross pay; LST in July–October):
| Test ID | Gross Monthly Pay (`UGX`) | Month | Residency | Expected NSSF Emp (5%) | Expected NSSF Co. (10%) | Expected PAYE (`UGX`) | Expected LST (`UGX`) | Expected Net Pay (`UGX`) |
| :--- | ---: | :---: | :---: | ---: | ---: | ---: | ---: | ---: |
| `PAY-U01` | `300,000` | Nov | Resident | `15,000` | `30,000` | `0` | `0` | `285,000` |
| `PAY-U02` | `400,000` | Nov | Resident | `20,000` | `40,000` | `13,000` | `0` | `367,000` |
| `PAY-U03` | `485,000` | Nov | Resident | `24,250` | `48,500` | `33,750` | `0` | `427,000` |
| `PAY-U04` | `4,850,000` | **Oct** | Resident | `242,500` | `485,000` | `1,343,250` | `25,000` | `3,239,250` |
| `PAY-U05` | `4,850,000` | **Nov** | Resident | `242,500` | `485,000` | `1,343,250` | `0` | `3,264,250` |
| `PAY-U06` | `12,000,000` | Nov | Resident | `600,000` | `1,200,000` | `3,688,250` | `0` | `7,711,750` |

### 2.2 Working-Day & Holiday Leave Calculator (`LeaveCalculatorService`)
| Test ID | Schedule | Holidays in Range | Requested Range | Expected Calendar Days | Expected Working Days |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `LVE-U01` | Mon–Fri `[1..5]` | None | `Mon 16 Nov – Fri 20 Nov 2026` | `5` | `5` |
| `LVE-U02` | Mon–Fri `[1..5]` | None | `Thu 19 Nov – Tue 24 Nov 2026` | `6` | `4` *(skips Sat/Sun)* |
| `LVE-U03` | Mon–Fri `[1..5]` | `Fri 25 Dec` (Christmas) | `Thu 24 Dec – Mon 28 Dec 2026` | `5` | `2` *(skips 25 Dec, Sat 26, Sun 27)* |
| `LVE-U04` | Mon–Fri `[1..5]` | None | `Sat 21 Nov – Sun 22 Nov 2026` | `2` | `0` *(Triggers `422 ZERO_WORKING_DAYS`)* |

### 2.3 Attendance Grace Period & `Africa/Kampala` Timezone (`AttendanceEvaluator`)
- `ATT-U01`: `08:00:00 EAT` on `08:00` shift (`15m` grace) $\rightarrow$ `PRESENT_ON_TIME`.
- `ATT-U02`: `08:15:00 EAT` on `08:00` shift (`15m` grace) $\rightarrow$ `PRESENT_GRACE`.
- `ATT-U03`: `08:15:01 EAT` on `08:00` shift (`15m` grace) $\rightarrow$ `LATE`.
- `ATT-U04`: Client browser in `America/New_York` (`UTC-5`) checking in at `00:04 EST` = `08:04 EAT` $\rightarrow$ evaluates strictly on `Africa/Kampala` date and `08:04 EAT`.

---

## 3. Mandatory Integration & Security Tests (API + PostgreSQL)

### 3.1 Security, Privacy & Anti-IDOR Tests
| Test ID | Scenario | Expected Assertion |
| :--- | :--- | :--- |
| `SEC-I01` | **Line Manager Salary Privacy Leak** | `GET /api/v1/employees` & `GET /api/v1/employees/:directReportId` called as `LINE_MANAGER` MUST return `200`, and keys `baseSalaryUgx`, `recurringAllowancesUgx`, `bankAccountNumber`, `bankAccountEncrypted`, `ninEncrypted`, `uraTin`, `nssfNumber` MUST be physically absent (`undefined`). |
| `SEC-I02` | **Line Manager Cross-Team IDOR** | `LINE_MANAGER` A requests attendance or leave approval for an employee reporting to `LINE_MANAGER` B (no delegation) $\rightarrow$ `403 FORBIDDEN_SCOPE`. |
| `SEC-I03` | **Mass Assignment Attack** | `EMPLOYEE` sends `PATCH /api/v1/employees/:selfId/contact` with `{ "phone": "+256772000111", "role": "SYSTEM_ADMIN", "baseSalaryUgx": 99000000 }` $\rightarrow$ `400 VALIDATION_ERROR`. |
| `SEC-I04` | **Self-Approval Block** | `LINE_MANAGER` or `HR_MANAGER` calls `POST /leave/requests/:ownId/approve` or `POST /employees/change-requests/:ownId/approve` $\rightarrow$ `403 SELF_APPROVAL_FORBIDDEN`. |
| `SEC-I05` | **First-Login Forced Password Change** | Newly converted employee logs in with temp password $\rightarrow$ receives `passwordChangeRequired: true`; calling `GET /employees` with temp token returns `403 PASSWORD_CHANGE_REQUIRED`. |
| `SEC-I06` | **Deactivated Ex-Employee Lockout** | After offboarding deactivation, presenting old access token OR refresh cookie returns `401 ACCOUNT_DEACTIVATED`. |
| `SEC-I07` | **CV Upload Spoofed Extension** | Uploading an executable/text payload renamed to `malware.pdf` to `/careers/vacancies/:id/apply` $\rightarrow$ `415 UNSUPPORTED_MEDIA_TYPE`. |

### 3.2 Business Rule & Constraint Integration Tests
| Test ID | Rule Under Test | Expected Assertion |
| :--- | :--- | :--- |
| `BIZ-I01` | Vacancy requires HR-approved requisition | Creating vacancy from `PENDING_HR` requisition $\rightarrow$ `422`. |
| `BIZ-I02` | Unique applicant email per vacancy | Applying twice to same vacancy with `Test@Example.com` and `test@example.com` $\rightarrow$ second request returns `409 DUPLICATE_APPLICATION`. Applying to a *different* vacancy with same email succeeds (`201`). |
| `BIZ-I03` | Application after closing date | Applying to closed/expired vacancy $\rightarrow$ `422 VACANCY_CLOSED`. |
| `BIZ-I04` | Offer must be HR-approved before sending | Sending `DRAFT` or `PENDING_APPROVAL` offer $\rightarrow$ `422`. |
| `BIZ-I05` | 1 Accepted offer $\rightarrow$ 1 Employee | Calling `/offers/:id/convert` twice without same `Idempotency-Key` creates **only 1** employee (`409` on second attempt). |
| `BIZ-I06` | 1 Attendance/day & Check-Out after Check-In | Check-Out before Check-In $\rightarrow$ `422 MUST_CHECK_IN_FIRST`; second Check-In same day $\rightarrow$ `409 ALREADY_CHECKED_IN`. |
| `BIZ-I07` | Leave overlap & balance guard | Submitting overlapping dates $\rightarrow$ `422 LEAVE_OVERLAP`; requesting 20 days with 14 available $\rightarrow$ `422 INSUFFICIENT_LEAVE_BALANCE`. |
| `BIZ-I08` | Mandatory reason enforcement | Rejecting leave, requisition, offer, profile change, attendance correction, or creating payroll adjustment with empty/whitespace `reason` $\rightarrow$ `422 REASON_REQUIRED`. |
| `BIZ-I09` | Payroll separation of duties & lock immutability | Same `PAYROLL_OFFICER` trying to approve own run $\rightarrow$ `403`; `PATCH` on item in `LOCKED` run $\rightarrow$ `423 PAYROLL_LOCKED_DIRECT_EDIT_FORBIDDEN`. |
| `BIZ-I10` | Max 1 active assignee per asset | Issuing already-assigned `#AST-064` to second employee $\rightarrow$ `409 ASSET_ALREADY_ASSIGNED`. |
| `BIZ-I11` | Offboarding hard clearance blocker | Attempting to clear `ASSET_RETURN` or finalize exit while `#AST-064` unreturned $\rightarrow$ `422 CLEARANCE_BLOCKED`. After logging return, sign-off and finalization succeed (`200`). |
| `BIZ-I12` | EOD cron idempotency | Running `/internal/jobs/reconcile-attendance` twice for same date creates 0 duplicate records and preserves `ON_LEAVE`, `HOLIDAY`, `DAY_OFF`, and existing check-ins. |

---

## 4. Pre-Seeded Ugandan Demo Dataset (`apps/api/prisma/seed.ts`)

`seed.ts` MUST be **idempotent** (safe to run repeatedly on container restart without duplicating rows) and initialize a complete live demo storyline for **StaffHub Uganda Ltd** (`Plot 14 Lumumba Avenue, Nakasero, Kampala`).

### 4.1 Seeded User Accounts (All 7 Internal Roles)
*(Demo password for all seeded non-production accounts: `StaffHub@2026!`, hashed via `Argon2id`, `must_change_password = false` for demo smoothness—plus 1 separate un-logged-in newly converted employee when triggered live to show forced password reset.)*
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
   - Base `4,200,000` + Allowances `650,000` (`4,850,000` Gross); Bank: Stanbic Bank (`••••8492`); 7 prior workdays seeded; **no check-in today** so presenter can click `Check In Now` live.
   - `14` working days annual leave remaining; Asset `#AST-088` (`MacBook Pro 16" M3 Pro`) in `PENDING_ACKNOWLEDGEMENT` ready for live acknowledgement.
3. **Manager Queue Demo (Michael Kigozi):**
   - Pending Leave Request from Rebecca Kisakye (`2` working days Study Leave) + Pending Attendance Correction from Fiona Namatovu.
4. **Payroll Demo:**
   - **October 2026 Payroll (`PR-UG-2026-10`):** `LOCKED` & published (Brian Kato Net Pay `UGX 3,239,250` incl. `25,000` Oct LST) with downloadable QR-verified PDF payslips.
   - **November 2026 Attendance Lock + Draft Payroll (`PR-UG-2026-11`):** Ready to submit and approve live (`Net Pay UGX 3,264,250` for Brian Kato with `0` Nov LST).
5. **Offboarding Blocker & Bank Change Demo (Denis Mukasa `UG-EMP-0291`):**
   - Status `OFFBOARDING`, `last_working_day: 30 Nov 2026`, holding unreturned `#AST-064` (`Lenovo ThinkPad T14 Gen 3`) and `#AST-092` (`ThinkPad Dock`), blocking `ASSET_RETURN` clearance.
   - Pending Bank Change Request (`Stanbic ••••2019` $\rightarrow$ `Centenary Bank ••••9104`) awaiting HR Manager Julius Okello's review.
6. **Audit Trail Seed:** Initial 10 realistic audit entries (Payroll Oct Lock, Asset Issue, Offer Acceptance, etc.) with valid SHA-256 checksums.