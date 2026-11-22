# 08 — StaffHub Testing, QA Matrix & Ugandan Demo Seed Specification

## 1. Automated Testing Strategy & Coverage Goals

Target coverage: every business rule, statutory calculation, privacy boundary, and state transition MUST have automated tests executed on every GitHub Actions CI push. The Phase 1 bootstrap currently runs shared/API/web smoke tests, identity database constraint checks, Prisma migration validation, and Compose startup checks; the acceptance cases below are not represented as implemented until their domain features and tests are added.

### 1.1 Test Layers
1. **Unit Tests (`*.spec.ts` via Jest / Vitest):** Pure domain logic (zero database required, `< 5s` execution).
2. **Backend Integration & Security Tests (`*.e2e-spec.ts` via NestJS Testing + Supertest + Test PostgreSQL):** Real Prisma/PostgreSQL transactions testing constraints, triggers, locks, RBAC/IDOR, and HTTP error codes.
3. **Frontend Component Tests (Vitest + React Testing Library):** `UGX` tabular formatters, `Africa/Kampala` date rendering, `<MaskedField />`, and `<MandatoryReasonModal />` disabled-until-reason validation.
4. **End-to-End Lifecycle Verification:** Full Section 5 workflow walkthrough against seeded Ugandan demo data.

---

## 2. Mandatory Unit Test Cases (Domain Math & Helpers)

### 2.1 Uganda Statutory Payroll Calculator (`StatutoryCalculatorService`)
Use a synthetic, test-only policy fixture (never a production statutory policy) with the sample bands below. Integration tests must also prove payroll fails closed when no approved operational policy covers the period:
| Test ID | Gross Monthly Pay (`UGX`) | Month | Residency | Expected NSSF Emp (5%) | Expected NSSF Co. (10%) | Expected PAYE (`UGX`) | Expected LST (`UGX`) | Expected Net Pay (`UGX`) |
| :--- | ---: | :---: | :---: | ---: | ---: | ---: | ---: | ---: |
| `PAY-U01` | `300,000` | Nov | Resident | `15,000` | `30,000` | `0` | `0` | `285,000` |
| `PAY-U02` | `400,000` | Nov | Resident | `20,000` | `40,000` | `13,000` | `0` | `367,000` |
| `PAY-U03` | `485,000` | Nov | Resident | `24,250` | `48,500` | `33,750` | `0` | `427,000` |
| `PAY-U04` | `4,850,000` | **Oct** | Resident | `242,500` | `485,000` | `1,343,250` | `25,000` | `3,239,250` |
| `PAY-U05` | `4,850,000` | **Nov** | Resident | `242,500` | `485,000` | `1,343,250` | `0` | `3,264,250` |
| `PAY-U06` | `12,000,000` | Nov | Resident | `600,000` | `1,200,000` | `3,688,250` | `0` | `7,711,750` |
| `PAY-U07` | `4,850,000` | Nov | Non-Resident | `242,500` | `485,000` | `1,376,750` | `0` | `3,230,750` |
| `PAY-U08` | `300,000` | Nov | Non-Resident | `15,000` | `30,000` | `30,000` | `0` | `255,000` |
| `PAY-U09` | `300,000` | Nov | Resident + `500,000` loan installment | `15,000` | `30,000` | `0` | `0` | `0`; cap loan deduction at `285,000` and carry the unpaid `215,000` installment |

### 2.2 Working-Day & Holiday Leave Calculator (`LeaveCalculatorService`)
| Test ID | Schedule | Holidays in Range | Requested Range | Expected Calendar Days | Expected Working Days |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `LVE-U01` | Mon–Fri `[1..5]` | None | `Mon 16 Nov – Fri 20 Nov 2026` | `5` | `5` |
| `LVE-U02` | Mon–Fri `[1..5]` | None | `Thu 19 Nov – Tue 24 Nov 2026` | `6` | `4` *(skips Sat/Sun)* |
| `LVE-U03` | Mon–Fri `[1..5]` | `Fri 25 Dec` (Christmas) | `Thu 24 Dec – Mon 28 Dec 2026` | `5` | `2` *(skips 25 Dec, Sat 26, Sun 27)* |
| `LVE-U04` | Mon–Fri `[1..5]` | None | `Sat 21 Nov – Sun 22 Nov 2026` | `2` | `0` *(Triggers `422 ZERO_WORKING_DAYS`)* |
| `LVE-U05` | Mon–Fri `[1..5]` | None | `Wed 18 Nov 2026`, half day | `1` | `0.5` |
| `LVE-U06` | Mon–Fri `[1..5]` | None | `Thu 31 Dec 2026 – Mon 4 Jan 2027` | `5` | `3`, allocated as `1` day in 2026 and `2` in 2027 |

### 2.3 Attendance Grace Period & `Africa/Kampala` Timezone (`AttendanceEvaluator`)
- `ATT-U01`: `08:00:00 EAT` on `08:00` shift (`15m` grace) $\rightarrow$ `PRESENT_ON_TIME`.
- `ATT-U02`: `08:15:00 EAT` on `08:00` shift (`15m` grace) $\rightarrow$ `PRESENT_GRACE`.
- `ATT-U03`: `08:15:01 EAT` on `08:00` shift (`15m` grace) $\rightarrow$ `LATE`.
- `ATT-U04`: Client browser in `America/New_York` (`UTC-5`) checking in at `00:04 EST` = `08:04 EAT` $\rightarrow$ evaluates strictly on `Africa/Kampala` date and `08:04 EAT`.
- `ATT-U05`: Sunday check-in on a Mon–Fri schedule $\rightarrow$ `422 NOT_SCHEDULED`, no attendance row created.
- `ATT-U06`: Check-in during approved full-day/half-day leave interval $\rightarrow$ `422 ATTENDANCE_CONFLICT`; check-in in the non-leave half persists the half-day leave allocation.

`PAY-U10`: If statutory deductions exceed gross, payroll submission is blocked with an explicit review error; statutory amounts are not silently clamped.

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
| `SEC-I08` | **Refresh CSRF Lifecycle** | Login returns a CSRF token; refresh/logout reject missing or mismatched tokens; refresh rotation invalidates the old token and returns the new cookie-bound token; page-reload bootstrap returns the current token only for the exact allowed origin. |
| `SEC-I09` | **Auth Origin Enforcement** | Login, CSRF bootstrap, refresh, and logout reject missing, `null`, or untrusted `Origin` values; credentialed CORS never emits `Access-Control-Allow-Origin: *`. |
| `SEC-I10` | **Self-Scoped Offboarding** | A linked employee can read only their own employee-safe exit summary; requesting another employee's case or internal clearance notes returns `403` or a non-enumerating `404`. |
| `SEC-I11` | **Consistent Self-Service Across Roles** | For every internal role linked to an employee record, own onboarding, attendance, leave, payslip, and loan reads succeed within `SELF`; the same requests against another employee are denied. |
| `SEC-I12` | **Demo Mode Isolation** | Startup fails when `NODE_ENV=production` and `DEMO_MODE=true`; production demo-login returns `404`, production seed refuses to run, and the frontend does not use a public environment flag as an authorization control. |

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
| `BIZ-I13` | Cross-year and half-day leave balances | A one-day half-day reserves `0.5`; a cross-year request reserves/releases/uses each calendar year's allocation exactly once. |
| `BIZ-I14` | Attendance cannot be overwritten by leave | Full-day leave conflicting with actual check-in/out, or half-day leave overlapping actual attendance, returns `422 ATTENDANCE_CONFLICT` and leaves attendance/balances unchanged; non-overlapping half-day leave preserves actual attendance. |
| `BIZ-I15` | Attendance period close boundary | Locking an incomplete/future month or a month with pending corrections is rejected; an eligible closed month locks atomically. |
| `BIZ-I16` | Payroll includes final-pay obligation | An employee whose employment period overlaps payroll month is included even if current `status = EXITED`. |
| `BIZ-I17` | Approved tax policy gate | Draft/missing/overlapping statutory policies prevent payroll preparation; creator cannot approve their own policy. |
| `BIZ-I18` | Payroll deduction floor | Loan/voluntary deductions are capped at available net pay; statutory deductions above gross block submission with an explicit error. |
| `BIZ-I19` | Payslip asynchronous publication | Lock creates pending slips/outbox entries; only a successfully rendered, hashed, privately stored `READY` slip can download/verify; retries do not duplicate slips or loan deductions. |
| `BIZ-I20` | Half-day leave constraints | A half-day spanning more than one date is rejected; a second active request on the same employee/date is rejected even when it asks for the complementary half. |
| `BIZ-I21` | Explicit leave entitlement configuration | Creating a leave type without `annual_entitlement_days` fails; configured entitlement values are sourced from an approved organizational policy, not an implicit 21-day default. |

---

## 4. Pre-Seeded Ugandan Demo Dataset (`apps/api/prisma/seed.ts`)

`seed.ts` MUST be **idempotent** (safe to run repeatedly on container restart without duplicating rows) and initialize synthetic, non-production demo data for **StaffHub Uganda Ltd**. Seed execution is prohibited in production. Test/demo outbound mail must be captured by Mailpit or a non-delivering sink; never send to the public internet.

### 4.1 Seeded User Accounts (All 7 Internal Roles)
Seeded demo accounts use unique credentials supplied outside source control. The seed must refuse missing/weak credential configuration and must never contain a password, token, or precomputed password hash. `must_change_password = false` is permitted only for this isolated synthetic-data demo; conversion tests must still exercise the forced-reset flow.
| Role | Full Name | Email | Employee Code | Department |
| :--- | :--- | :--- | :--- | :--- |
| `SYSTEM_ADMIN` | Raymond Mugisha | `raymond.mugisha@example.invalid` | `UG-ADM-0001` | IT & Governance |
| `HR_MANAGER` | Julius Okello | `julius.okello@example.invalid` | `UG-HR-0012` | People & Culture |
| `HR_MANAGER` | Grace Akello | `grace.akello@example.invalid` | `UG-HR-0013` | People & Culture (Peer HR / Escalation Approver) |
| `RECRUITER` | Grace Apio | `grace.apio@example.invalid` | `UG-REC-0019` | People & Culture |
| `LINE_MANAGER` | Michael Kigozi | `michael.kigozi@example.invalid` | `UG-MGR-0089` | Finance & Operations |
| `PAYROLL_OFFICER` | Sarah Namubiru | `sarah.namubiru@example.invalid` | `UG-PAY-0034` | Finance & Operations |
| `ASSET_OFFICER` | Joseph Mukasa | `joseph.mukasa@example.invalid` | `UG-AST-0021` | Infrastructure & Security |
| `EMPLOYEE` | Brian Kato | `brian.kato@example.invalid` | `UG-EMP-0412` | Finance & Operations (Reports to Michael Kigozi) |

*(Plus 4 additional direct reports under Michael Kigozi: **Rebecca Kisakye** `UG-EMP-0449`, **Fiona Namatovu** `UG-EMP-0405`, **Ivan Tumusiime** `UG-EMP-0512`, and exiting employee **Denis Mukasa** `UG-EMP-0291`, plus 1 read-only already-deactivated ex-employee **Samuel Ssebunya** `UG-EMP-0104` to demonstrate record retention.)*

### 4.2 Seeded Organization Configuration
- **Work Schedule:** `Kampala Standard Office (Mon–Fri)`, `08:00 – 17:00 EAT`, `15-minute` grace period, working days `[1,2,3,4,5]`.
- **Ugandan Public Holidays (2026):** `New Year's Day (01 Jan)`, `NRM Liberation Day (26 Jan)`, `Janani Luwum Day (16 Feb)`, `International Women's Day (08 Mar)`, `Good Friday (03 Apr)`, `Easter Monday (06 Apr)`, `Labour Day (01 May)`, `Uganda Martyrs' Day (03 Jun)`, `National Heroes' Day (09 Jun)`, `Independence Day (09 Oct)`, `Christmas Day (25 Dec)`, `Boxing Day (26 Dec)`.
- **Test-Only Payroll Policy:** Synthetic FY 2026/27 calculation fixture, explicitly non-legal and non-production. It cannot be used to approve or execute operational payroll.
- **Synthetic leave fixture only:** Annual (`21` days), Sick (`14` days), Compassionate (`5` days), Maternity (`60` working days, HR required), Paternity (`4` working days), Study (`5` days, HR required), Unpaid (`0` entitlement, HR required). These values are not legal defaults and MUST NOT be inserted into production; production entitlements require explicit approval and configuration.

### 4.3 Seeded Live Storyline Records (Ready for Presentation)
1. **Recruitment Demo:**
   - Approved Requisition `#REQ-2026-042` $\rightarrow$ Published Vacancy `#VAC-2026-042` (`Senior Payroll Compliance Specialist`, closes `28 Nov 2026, 23:59 EAT`).
   - Synthetic applicant **Amina Florence Nabakooza** (`amina.nabakooza@example.invalid`) with `OFFER_ACCEPTED` (`UGX 7,500,000` gross), ready for live **1-Click Convert to Employee**.
   - Open Vacancy `#VAC-2026-045` (`Treasury Analyst`, closes `15 Dec 2026`) ready for live Public Job Application demo.
   - Expired Vacancy `#VAC-2026-011` (`Office Coordinator`, closed `01 Nov 2026`) for testing late rejection.
2. **ESS & Attendance Demo (Brian Kato `UG-EMP-0412`):**
   - Base `4,200,000` + Allowances `650,000` (`4,850,000` Gross); Bank: Stanbic Bank (`••••8492`); 7 prior workdays seeded; **no check-in today** so presenter can click `Check In Now` live.
   - `14` working days annual leave remaining; Asset `#AST-088` (`MacBook Pro 16" M3 Pro`) in `PENDING_ACKNOWLEDGEMENT` ready for live acknowledgement.
3. **Manager Queue Demo (Michael Kigozi):**
   - Pending Leave Request from Rebecca Kisakye (`2` working days Study Leave) + Pending Attendance Correction from Fiona Namatovu.
4. **Payroll Demo:**
   - Use a test-only illustrative October 2026 run generated from the synthetic policy fixture; label every screen and PDF as a demo calculation, not legal or disbursement output. The fixture's example net pay is `UGX 3,239,250`, including `UGX 25,000` illustrative October LST.
   - Do not seed a November 2026 attendance lock or payroll run: the month is not closed on the fixed demo clock, so the payroll close guard must reject it.
5. **Offboarding Blocker & Bank Change Demo (Denis Mukasa `UG-EMP-0291`):**
   - Status `OFFBOARDING`, `last_working_day: 30 Nov 2026`, holding unreturned `#AST-064` (`Lenovo ThinkPad T14 Gen 3`) and `#AST-092` (`ThinkPad Dock`), blocking `ASSET_RETURN` clearance.
   - Pending Bank Change Request (`Stanbic ••••2019` $\rightarrow$ `Centenary Bank ••••9104`) awaiting HR Manager Julius Okello's review.
6. **Deterministic Demo Clock:** Inject a clock into date-dependent services. Set `DEMO_CLOCK=2026-11-18T08:04:00+03:00` only in the isolated local/demo environment; production rejects this override. November 18 is a scheduled Wednesday, and 08:04 demonstrates the configured grace period; vacancy/exit dates remain future relative to the demo.
7. **Reference Assets:** Stitch PNGs and HTML are historical visual references, not canonical requirements or production UI. Generated prototype content must be sanitized and never treated as real payroll, legal, tax, or employee data.
8. **Audit Trail Seed:** Initial audit entries are synthetic test data with valid SHA-256 checksums; they must not contain credentials, actual IP addresses, or unmasked identifiers.