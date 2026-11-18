# 07 — StaffHub Screen-by-Screen & Interaction Blueprint

This document maps every Next.js App Router page to its allowed roles, visual layout, Stitch reference (where applicable), interactive states, and backend `/api/v1` calls.

---

## 1. Authentication & Public Routes (`<PublicHeader>` / Standalone)

### 1.1 Sign-In, Password Reset & Demo Switcher (`/login`, `/change-password`, `/forgot-password`, `/reset-password`)
- **Access:** `PUBLIC` (authenticated users redirect automatically to their role landing page).
- **UI Layout:** Centered Crisp Ivory card (`max-w-[460px]`) on Warm Limestone (`#F5F3EE`) canvas with `S` monogram badge and live `Kampala • EAT` badge.
- **States & Interactions:**
  - **Standard Login:** Email + Password (with reveal toggle) $\rightarrow$ `POST /api/v1/auth/login`. Displays inline errors for invalid credentials (`401`), temporary lockout (`423`), or deactivated ex-employee account (`401 ACCOUNT_DEACTIVATED`).
  - **First-Login Forced Reset (`/change-password`):** Triggered automatically when `passwordChangeRequired === true`. Displays security rule notice (*"Users must not share passwords"*), live password-policy checklist, and blocks navigation elsewhere until `POST /api/v1/auth/change-password` succeeds.
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
- **Stitch Reference:** `public_careers_portal_job_application` (apply Defect Fix #4: strict duplicate block, remove user avatar next to `Staff Sign In`, copyright `© 2026`).
- **Access:** `PUBLIC` (Job Applicant — zero account creation required).
- **UI Layout:** Split desktop view (`55%` searchable/filterable open vacancy cards on left; `45%` sticky `"Apply Without Account"` form on right; stacked on mobile).
- **Interactions & API Wiring:**
  - Load open jobs: `GET /api/v1/careers/vacancies?search=&departmentId=`. Each card displays `Closes: DD MMM YYYY, HH:mm EAT`.
  - Selecting a card updates the active job details and binds the form to `vacancy.id`.
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
- **Stitch Reference:** `employee_self_service_home_desktop` & `_mobile` (apply Defect Fixes #1, #2, #3: remove all `"biometric"` wording, sync Net Pay to calculated FY 2026/27 net pay `UGX 3,239,250` Oct / `UGX 3,264,250` Nov, inline SVG `S` logo).
- **Interactions & API Wiring:**
  - **Attendance Hero Card (`GET /api/v1/attendance/today`):**
    - Displays live `<KampalaClock />`, shift window (`08:00 – 17:00 EAT • 15m grace`), and current status pill.
    - `Check In Now` (`POST /api/v1/attendance/check-in` with `Idempotency-Key`) $\rightarrow$ switches CTA to `Check Out` (`POST /api/v1/attendance/check-out`). Once both recorded, card shows `Shift Completed` with total worked hours.
  - **3 Summary Cards:**
    1. `Pending My Action` (`GET /api/v1/notifications/inbox`): highlights pending asset acknowledgements (`#AST-088`) or onboarding tasks with direct action link.
    2. `Annual Leave Balance` (`GET /api/v1/leave/balances`): shows remaining working days + `"Request Leave"` link to `/leave`.
    3. `Latest Payslip` (`GET /api/v1/payroll/my-payslips?limit=1`): uses `<MaskedField />` defaulting to `UGX •••••••` (revealing exact Net Pay) + `"View PDF"` (`GET /api/v1/payroll/payslips/:id/pdf-url`).
  - **7-Day Attendance History Table (`GET /api/v1/attendance/records?days=7`):**
    - Shows Date, Shift, Check-In (`EAT`), Check-Out (`EAT`), Hours, Status Badge, and `"Request Correction"` link opening `<AttendanceCorrectionModal>` (`POST /api/v1/attendance/corrections` requiring `requestedCheckInAt`, `requestedCheckOutAt?`, and mandatory `reason`).

### 2.2 Leave Management & Calendar (`/leave`)
- **UI Layout:** 2-column desktop layout (`2/3` Request Form + History Table; `1/3` Leave Balances + Uganda Public Holiday Mini-Calendar). Includes top tabs (`My Leave` | `Team / HR Approvals` shown only to `LINE_MANAGER` / `HR_MANAGER`).
- **Interactions & API Wiring:**
  - Changing `leaveTypeId`, `startDate`, or `endDate` calls `POST /api/v1/leave/calculate-working-days` and updates a live summary pill: *"Selected: 7 Calendar Days $\rightarrow$ 5 Working Days (Excludes Sat/Sun & Public Holidays)"*.
  - Submit (`POST /api/v1/leave/requests` with `Idempotency-Key`, mandatory `reason`, optional supporting PDF). Shows inline validation banners for `LEAVE_OVERLAP` or `INSUFFICIENT_LEAVE_BALANCE`.
  - `Cancel` button on pending requests calls `POST /api/v1/leave/requests/:id/cancel`.
  - Approvals tab lists pending queue (`GET /api/v1/leave/requests?pendingMyApproval=true`) with `Approve` (`POST .../approve`) and `Reject` (opens `<MandatoryReasonModal>` $\rightarrow$ `POST .../reject`).

### 2.3 My Assets, My Payslips & My Profile (`/my-assets`, `/my-payslips`, `/profile`)
- **`/my-assets` (`GET /api/v1/assets/my-assets`):** Cards/rows for currently assigned items. Items in `PENDING_ACKNOWLEDGEMENT` show a Nile Petrol `"Acknowledge Receipt"` button (`POST /api/v1/assets/assignments/:id/acknowledge`).
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
- **Stitch Reference:** `recruitment_pipeline_candidate_to_employee_conversion` (apply Defect Fixes #7 & #8: active Warm Brass sidebar border, render Conversion Drawer inside `<OverlayDrawer>`).
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

- **Stitch Reference:** `monthly_payroll_run_locked_payslip_drawer_november_2026` (apply Defect Fix #7: make Printable Payslip Drawer an `<OverlayDrawer>` so `Status` and `Slip` columns never clip).
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

- **Stitch Reference:** `system_admin_immutable_audit_trail` (apply Defect Fixes #7 & #8: light Ivory `<TopBar>`, System Admin `<Sidebar>` with active Warm Brass bar, visible horizontal scroll on Audit table).
- **Admin Tabs (`/admin`):**
  1. `User Accounts & Roles`: Create accounts (`POST /api/v1/admin/users`), assign roles (`PATCH .../role`), Force Password Reset, and view read-only deactivated ex-employee accounts.
  2. `Work Schedules & Grace Periods`: Manage shifts (`08:00 – 17:00 EAT`, `15m` grace, `workingDaysBitmap`).
  3. `Ugandan Public Holidays`: Add/manage `holiday_date` entries (`POST /api/v1/admin/holidays`).
  4. `Statutory Tax Policy`: View/create effective-dated PAYE, NSSF, and LST tables (`POST /api/v1/admin/tax-policies`).
- **Immutable Audit Trail (`/audit`):**
  - Filterable by Date Range (`EAT`), Action Category, Actor, and Entity ID (`GET /api/v1/audit/logs`).
  - Displays Timestamp (`EAT`), Actor & Role (plus `Acting for...` attribution if delegated), Target, Old-to-New Diff, Mandatory Logged Reason, and SHA-256 checksum, plus `"Export Audit Bundle"` (`GET /api/v1/audit/logs/export`).
  