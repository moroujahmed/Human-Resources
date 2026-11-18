# 01 — StaffHub Product Requirements Document (PRD) & Business Rules

## 1. Product Purpose & Operational Boundaries

StaffHub is a unified, web-based Human Resource Management System (HRMS) built to manage an organization’s complete workforce lifecycle from initial job requisition and public application through onboarding, daily operations, monthly payroll, company asset custody, performance evaluation, and offboarding.

### 1.1 Core Localization & Platform Constraints
1. **Access Channel:** Responsive web application accessible via standard modern web browsers on **desktop computers, tablets, and mobile phones**.
2. **Currency:** All salaries, allowances, statutory taxes, deductions, adjustments, loan balances, and asset book values MUST be stored and displayed in **Ugandan Shillings (`UGX`)**.
3. **Time Zone:** All dates, work schedules, vacancy closing cutoffs, attendance check-in/check-out timestamps, grace periods, leave boundaries, and audit timestamps MUST operate in **`Africa/Kampala` (`EAT`, `UTC+3`)**.
4. **Prohibited Tracking Hardware:**
   - **No biometric devices** (no fingerprint scanners, facial recognition, or biometric hardware APIs).
   - **No GPS tracking** (no browser Geolocation API prompts, no latitude/longitude capture, no location maps).
5. **Single Source of Truth:** Data flows seamlessly across modules without duplicate manual entry (accepted candidate $\rightarrow$ employee record; approved leave $\rightarrow$ leave balance + attendance log; locked attendance + leave + pay details $\rightarrow$ monthly payroll; asset custody $\rightarrow$ offboarding exit clearance).

---

## 2. User Personas & Responsibilities (8 Roles)

| # | Role | Account Required | Core Functional Responsibilities |
| :--- | :--- | :--- | :--- |
| 1 | **System Administrator** | Yes | Creates user accounts, assigns/updates roles, manages system settings (work schedules, grace periods, Ugandan public holidays, configurable statutory tax/NSSF/LST policies), forces password resets, and inspects immutable audit trails. |
| 2 | **HR Manager** | Yes | Manages official employee records, HR policies, recruitment requisition approvals, offer approvals, sensitive employee profile-change approvals (legal name, bank details), dual-stage leave approvals where required, onboarding/offboarding exits, and HR reports. |
| 3 | **Recruiter** | Yes | Publishes HR-approved vacancies, reviews public job applications, shortlists candidates, schedules/tracks interviews, and prepares draft job offers for approval. |
| 4 | **Line Manager** | Yes | Manages direct-report team, requests new staff requisitions, reviews team attendance, approves/rejects attendance correction requests, approves/rejects leave requests, and conducts team performance reviews. **Strictly prohibited from viewing salary, bank, or sensitive ID details.** |
| 5 | **Payroll Officer** | Yes | Prepares monthly payroll runs from approved pay details, locked attendance summaries, and approved leave; verifies statutory/voluntary deductions; submits payroll for approval; initiates authorised post-lock adjustments; produces verifiable payslips and bank/statutory payment reports. |
| 6 | **Asset Officer** | Yes | Registers company property, assigns assets to employees (max 1 active assignee per asset), tracks employee acknowledgements, logs returns/damage/loss, and signs off asset clearance during offboarding. |
| 7 | **Employee** | Yes | Views own profile, updates permitted contact details, submits sensitive change requests, checks in and out daily via browser, requests attendance corrections, submits leave requests, views own payslips, acknowledges assigned assets, and participates in performance reviews/handovers. |
| 8 | **Job Applicant** | **No** | Public unauthenticated user: browses active advertised vacancies and submits applications (contact details + cover note + CV upload) **without creating a StaffHub account**. |

---

## 3. Detailed Functional Requirements Across All 8 Processes

### Process 1: Recruitment & Public Job Applications
1. **Staff Requisition:**
   - A **Line Manager** (or HR Manager) submits a Staff Requisition specifying Role Title, Department, Headcount (`>= 1`), Employment Type, Justification, and Target Start Date.
   - Requisition enters `PENDING_HR`.
   - **Rule:** Only an **HR Manager** may approve or reject a requisition. Rejection MUST include a non-empty `reason`.
2. **Vacancy Publication:**
   - **Rule:** A **Recruiter** can publish a vacancy ONLY against an **HR-approved** requisition (`APPROVED`).
   - Published vacancy displays Role Title, Department, Location, Employment Type, Description, Requirements, and `Closing Date/Time (Africa/Kampala EAT)`.
3. **Public Job Application (No Login):**
   - Job Applicants view open vacancies where `status = PUBLISHED` and `now_eat <= closing_at_eat`.
   - **Rule (Unique Email per Vacancy):** An applicant CANNOT apply more than once to the same vacancy using the same email address (case-insensitive comparison: `lower(trim(email))`). Duplicate attempts MUST be strictly blocked (`409 Conflict` + clear inline alert—never silently overwriting the previous application).
   - **Rule (Closing Date Enforcement):** Applications submitted after `closing_at_eat` MUST be rejected (`400/422` server-side, even if the browser form was kept open before midnight).
   - **CV Upload:** Required PDF/DOCX file (`<= 5 MB`), validated by binary magic bytes on the server, stored in private object storage.
4. **Shortlisting, Interviews & Offer Approval:**
   - Recruiter moves applicants through `APPLIED` $\rightarrow$ `SHORTLISTED` $\rightarrow$ `INTERVIEWING` (or `REJECTED` with logged reason/stage note).
   - Recruiter prepares a **Draft Job Offer** specifying Offered Gross Monthly Salary (`UGX`), Allowances (`UGX`), Proposed Start Date, Department, Reporting Line Manager, and Employment Terms.
   - **Rule:** Offer MUST be approved by an **HR Manager** (`OFFER_PENDING_APPROVAL` $\rightarrow$ `OFFER_APPROVED`) **before** it can be sent to the candidate (`OFFER_SENT`).
   - Offer acceptance records acceptance timestamp (`EAT`) and transitions to `OFFER_ACCEPTED`.

---

### Process 2: Hiring & Multi-Role Onboarding
1. **Candidate-to-Employee Conversion:**
   - **Rule:** An `OFFER_ACCEPTED` record converts into **exactly one** Employee Profile via a single atomic action (`Convert to Employee`).
   - **Rule:** Candidate information (Full Name, Personal Email, Phone, Offered Role, Department, Line Manager, Gross Pay, Start Date) MUST transfer automatically—HR MUST NOT re-enter candidate information manually.
   - System auto-generates unique Employee Code (`UG-EMP-XXXX`), creates a linked StaffHub User Account (status `ACTIVE`, `must_change_password = true`), and sends a privacy-safe welcome/onboarding email.
2. **4-Role Onboarding Checklist:**
   - Conversion automatically generates an Onboarding Checklist containing role-assigned tasks across:
     1. **HR Manager:** Contract sign-off, statutory TIN/NSSF file verification, policy orientation.
     2. **Line Manager:** 30-60-90 day objectives, peer buddy assignment, team onboarding.
     3. **New Employee:** Emergency contact completion, bank account submission (for payroll), policy acknowledgement.
     4. **Asset Officer:** Workstation/laptop preparation and initial asset issuance.
   - Checklist displays live completion progress (`X of Y tasks completed`).

---

### Process 3: Employee Records & Privacy Controls
1. **Profile Creation & Retention:**
   - HR creates and maintains official employee records.
   - **Rule:** Employee records are **never permanently deleted**. Departed staff retain read-only historical profiles (`status = EXITED`, `user.is_active = false`).
2. **Self-Service vs. HR-Approved Updates:**
   - Employees may directly update **permitted personal contact details** (Personal Phone, Personal Email, Residential Address, Emergency Contact Name/Phone). Changes log to the audit trail automatically.
   - **Rule (Sensitive Field Approval):** Changes to **Legal Name**, **Bank Name / Branch / Account Number**, or **National ID (NIN)** CANNOT take effect immediately. Submitting a change creates a `PENDING_HR` change request storing `old_value`, `new_value`, optional supporting proof document, and requester timestamp.
   - HR Manager approves (applying the new value atomically + logging audit history) or rejects (requiring a mandatory `reason`).
3. **Strict Field-Level Privacy:**
   - **Salary, Allowances, Bank Details, URA TIN, NSSF Number, and National ID (NIN)** are restricted strictly to:
     - Authorised **HR Manager**
     - Authorised **Payroll Officer**
     - The **concerned Employee** (their own record only, masked by default in UI with a `Reveal` toggle)
   - **Line Managers** MUST NEVER view salary, bank, or sensitive ID details for their direct reports.

---

### Process 4: Web Attendance & Correction Workflows
1. **Daily Check-In & Check-Out:**
   - **Rule:** An employee may have **at most one attendance record per working day** (`work_date` in `Africa/Kampala`).
   - **Rule:** An employee can **Check Out ONLY after Checking In** on that same `work_date`.
   - No biometrics or GPS coordinates are collected; the browser records the authenticated server timestamp in `Africa/Kampala` (`EAT`).
2. **Schedule & Grace Period Evaluation:**
   - Each employee is linked to an assigned **Work Schedule** (e.g., Mon–Fri `08:00 – 17:00 EAT`, with configurable `grace_period_minutes`, e.g., `15` minutes, plus support for non-standard/shift schedules).
   - Check-in `<= shift_start + grace_period` $\rightarrow$ `PRESENT_ON_TIME` (or `PRESENT_GRACE` if after `shift_start` and `<= shift_start + grace_period`, still counted as non-late).
   - Check-in `> shift_start + grace_period` $\rightarrow$ `LATE`.
3. **Automated End-of-Day Absence Reconciliation:**
   - **Rule:** At end of working day (`23:55 EAT`), if an active employee has **no check-in recorded** for `work_date`, the system marks them **`ABSENT`** *unless* one of the following holds:
     - Employee has an **`APPROVED` Leave** covering `work_date` (record shows `ON_LEAVE`).
     - `work_date` is a configured **Public Holiday** (record shows `HOLIDAY`).
     - `work_date` is a **Scheduled Day Off** in the employee’s Work Schedule (record shows `DAY_OFF`).
4. **Attendance Correction Requests:**
   - Employees can request a correction (e.g., missed check-out or system/network issue) by specifying requested `check_in_at` / `check_out_at` (`EAT`) and a **mandatory `reason`**.
   - Routes to **Line Manager** (`PENDING_MANAGER`). Line Manager approves (updates attendance record + recalculates `LATE`/`PRESENT` status + logs audit entry) or rejects (requires mandatory `reason`).
5. **Attendance Locking for Payroll:**
   - Before payroll runs for a pay period, HR/Payroll locks the period's attendance summary (`attendance_period_lock`) so approved payroll numbers cannot drift retroactively.

---

### Process 5: Leave Management & Working-Day Engine
1. **Leave Types & Balances:**
   - Configurable leave types (e.g., Annual Leave, Sick Leave, Compassionate Leave, Maternity/Paternity Leave, Study Leave).
   - Balances tracked in **working days** per leave year (`entitled_days`, `carried_over_days`, `used_days`, `pending_days`, `available_days = entitled + carried_over - used - pending`).
2. **Working-Day Calculation Engine:**
   - **Rule:** Leave duration is counted **exclusively in working days** based on the employee’s assigned Work Schedule (excluding scheduled days off/weekends) AND excluding configured **Ugandan Public Holidays**.
   - If a requested range contains `0` working days (e.g., only a weekend/holiday), submission is blocked.
3. **Validation Rules on Leave Submission:**
   - **Rule (No Overlaps):** Employees MUST NOT submit a leave request whose date range overlaps any of their existing `PENDING_*` or `APPROVED` leave requests.
   - **Rule (Sufficient Balance):** Employees MUST NOT request more working days than their current `available_days` for that leave type.
   - Mandatory `reason` required on submission.
4. **Approval Workflow & Side Effects:**
   - Submits to **Line Manager** (`PENDING_MANAGER`).
   - Configurable organization rule per Leave Type / duration threshold: either Line Manager approval finalizes (`APPROVED`), or routes to **HR Manager** (`PENDING_HR`) for secondary approval (e.g., leave > 5 working days, or Study/Unpaid/Maternity leave).
   - **Rule:** Rejecting a leave request MUST include a mandatory `reason`.
   - **Rule (Atomic Approval Side Effects):** On final `APPROVED`, the system atomically:
     1. Deducts `working_days` from `leave_balances` (`used_days`).
     2. Creates or updates `attendance_records` for each covered working day to `ON_LEAVE`.
     3. Logs the approval to `audit_logs`.
   - Employees may cancel a `PENDING_*` request (restoring pending balance); cancelling an already `APPROVED` future leave requires HR/Manager reversal with reason.

---

### Process 6: Monthly Payroll (`UGX`), Statutory Deductions, Locking & Payslips
1. **Inputs & Preparation:**
   - Prepared monthly (`year`, `month`) by **Payroll Officer** using:
     - Employee’s HR-approved Base Salary & Recurring Allowances (`UGX`)
     - **Locked Attendance Summary** for that month (working days present, approved leave days, unexcused absent days for pro-rata unpaid deduction if applicable)
     - Approved Leave (paid vs. unpaid leave)
     - Any active staff loan / advance / SACCO deduction schedules.
2. **Configurable Uganda Statutory Deduction Engine (Default FY 2026/27 Policy):**
   - All tax brackets and statutory rates are stored in versioned, effective-dated **Payroll Policy Tables** (never hardcoded constants), editable only by authorized Admin/Payroll policy stewards:
   - **NSSF (National Social Security Fund):**
     - **Employee Deduction:** `5%` of Gross Monthly Pay (deducted from employee pay).
     - **Employer Contribution:** `10%` of Gross Monthly Pay (recorded as employer cost on payslip/reports; **never** deducted from employee Net Pay).
     - Employee NSSF is **not** subtracted before calculating Uganda PAYE.
   - **PAYE (Pay As You Earn — URA Resident Monthly Bands, effective 1 July 2026):**
     - `UGX 0 – 335,000`: `0` (`0%`)
     - `UGX 335,001 – 410,000`: `20%` of amount exceeding `335,000`
     - `UGX 410,001 – 485,000`: `UGX 15,000` + `25%` of amount exceeding `410,000`
     - `UGX 485,001 – 10,000,000`: `UGX 33,750` + `30%` of amount exceeding `485,000`
     - `Above UGX 10,000,000`: above calculation + additional `10%` on amount exceeding `10,000,000`
     - *(Non-resident tax schedule also supported via employee tax-residency flag.)*
   - **Local Service Tax (LST):**
     - Banded by monthly gross income (up to `UGX 100,000/year` max for salaries `> UGX 1,000,000/month`).
     - Deducted per configurable schedule (default: **4 equal monthly instalments in July, August, September, and October**; `UGX 0` in November–June unless configured otherwise).
3. **Approval, Locking & Post-Lock Adjustments:**
   - Pipeline: `DRAFT` $\rightarrow$ `PENDING_APPROVAL` $\rightarrow$ `APPROVED` $\rightarrow$ `LOCKED` (Payslips Published).
   - **Rule:** Payroll MUST be reviewed and approved by an **authorised approver** (e.g., HR Manager / Finance Approver distinct from the Payroll Officer preparer—separation of duties!) before payslips are published.
   - **Rule (Immutability After Lock):** Once `LOCKED`, payroll line items CANNOT be edited directly (`UPDATE` blocked by application service & DB rules).
   - **Rule (Authorised Adjustment):** Any post-lock correction MUST be recorded as a separate **`payroll_adjustment`** entry (linked to the locked payroll run/item, requiring authorised approval and a **mandatory `reason`**), either settled off-cycle or carried into the next payroll cycle with full audit history.
4. **Payslips, Reports & Tamper Verification:**
   - Generates printable PDF Payslips in `UGX` containing Earnings, Statutory Deductions (Employee NSSF 5%, PAYE, LST), Voluntary/Loan Deductions, Net Pay, Employer NSSF (10% informational), and a **Verification Code / QR Code** backed by a SHA-256 document verification hash.
   - Generates Bank Payment Schedule (masked/authorized view + CSV/EFT export—logged in audit trail) and URA/NSSF statutory summary reports.

---

### Process 7: Company Asset Management
1. **Asset Registration:**
   - **Asset Officer** registers items with unique `Asset Tag` (e.g., `#AST-064`), Item Name, Category (Laptop, Monitor, Mobile, Vehicle, Access Badge, etc.), Serial Number, Purchase Value (`UGX`), and Condition (`NEW`, `GOOD`, `FAIR`, `DAMAGED`, `LOST`, `RETIRED`).
2. **Single-Assignee Custody Rule:**
   - **Rule:** A company asset can be assigned to **at most ONE employee at a time** (enforced via partial unique DB index on active assignments where `returned_at IS NULL`).
   - Reassigning an active asset is strictly blocked until the current assignment is recorded as `RETURNED`.
3. **Issuance & Employee Acknowledgement:**
   - When Asset Officer issues an asset, assignment status starts as `PENDING_ACKNOWLEDGEMENT`.
   - Employee sees a `"Pending My Action"` prompt to digitally **Acknowledge Receipt** (`ACKNOWLEDGED` + timestamp).
4. **Returns, Damage & Loss:**
   - Asset Officer records asset returns (`returned_at`, condition on return, inspection notes) or flags an asset as `DAMAGED` / `LOST` with **mandatory notes/reason** (triggering audit log and optional recovery flag for offboarding/payroll).

---

### Process 8: Offboarding, Clearance Blockers & Account Deactivation
1. **Initiating Exit Process:**
   - **HR Manager** opens an exit process for an employee (`OFFBOARDING_IN_PROGRESS`), setting Exit Type (Resignation, Contract Expiry, Termination, Retirement), Notice Date, `Last Working Day (EAT)`, and mandatory Exit Reason.
2. **Multi-Departmental Clearance Checklist & Hard Blockers:**
   - System generates clearance tracks:
     1. **Asset Return Clearance** (Asset Officer verifies all active `asset_assignments` are `RETURNED` or formally settled).
     2. **Operational Handover** (Line Manager confirms handover tasks/successor transfer).
     3. **Finance / Loan Settlement Clearance** (Payroll/Finance confirms `outstanding_loans_ugx = 0` or deduction scheduled in final terminal pay).
     4. **HR Exit Clearance** (Exit interview & Certificate of Service).
   - **Rule (Hard Clearance Blocker):** System MUST physically **block** HR from finalizing clearance (`Finalize Exit`) if any unreturned assets or unsettled loans remain open (unless an authorized emergency override with mandatory written justification is explicitly logged where policy permits—and never silently).
3. **Account Deactivation & Record Preservation:**
   - **Rule:** After the employee’s `Last Working Day` passes (or upon finalized exit post-last-working-day via the `00:05 EAT` scheduled job / manual finalize), the user account is **deactivated** (`user.is_active = false`, all active refresh tokens immediately revoked).
   - **Rule:** Employee profile, attendance history, leave history, payslips, asset history, and audit records remain preserved read-only (`status = EXITED`) and are **never permanently deleted**.

---

## 4. Professional Governance & Resilience Extensions

1. **Acting Approver Delegation:**
   - A Line Manager or HR Manager may delegate approval authority to an Acting Approver for a bounded `[starts_at, ends_at]` window. Every delegated approval logs **both** the acting actor and the delegating principal (`"Approved by Grace Akello (Acting for Michael Kigozi)"`).
2. **Privacy-Safe Notifications:**
   - In-app `"Pending My Action"` items guide each role immediately after sign-in.
   - Outbound emails (offer alerts, password resets, approval reminders) MUST NOT expose confidential salaries, medical leave reasons, or rejection details in email bodies—only a generic action prompt and secure link to sign in.
3. **Export Accountability:**
   - Downloading sensitive CSV/PDF reports (Payroll EFT schedules, Statutory schedules, Audit bundles, Employee Directories) logs an `EXPORT` event in `audit_logs` (`actor`, `report_type`, `filters`, `timestamp_eat`) and stamps exported PDFs with *"Confidential — Exported by [Name] at [EAT Timestamp]"*.
4. **Demo Mode Safeguard:**
   - `DEMO_MODE=true` enables non-production quick-switch demo login helpers for academic/client presentations. In real production (`DEMO_MODE=false`), all demo endpoints return `404 Not Found` and are physically disabled.