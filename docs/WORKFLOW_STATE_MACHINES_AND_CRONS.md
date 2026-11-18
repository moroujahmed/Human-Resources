# 04 — StaffHub Workflow State Machines, Transactions & Scheduled Jobs

All state transitions in StaffHub MUST execute inside an explicit backend service method wrapped in a **PostgreSQL ACID transaction (`prisma.$transaction`)** that:
1. Verifies the actor’s role, relationship scope (`SELF`, `TEAM`, or `ORG`), active acting delegation (if applicable), and anti-self-approval rule.
2. Validates the current state (and checks optimistic-lock `version` where applicable).
3. Enforces a non-empty `reason` string whenever rejecting, correcting, adjusting locked payroll, revoking leave, or reporting asset damage/loss.
4. Executes all cross-module side effects atomically (either everything commits or everything rolls back).
5. Appends an immutable entry to `audit_logs` and creates/resolves `notifications`.

---

## 1. Recruitment, Offer Approval & Candidate Conversion Workflows

### 1.1 Staff Requisition State Machine
| From State | Event / Action | To State | Allowed Actor | Preconditions & Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `SUBMIT_REQUISITION` | `PENDING_HR` | `LINE_MANAGER`, `HR_MANAGER` | Validates `headcount >= 1`, valid `department_id`, `target_start_date >= today_eat`. Notifies HR Manager(s) (`ACTION_REQUIRED`). |
| `PENDING_HR` | `APPROVE_REQUISITION` | `APPROVED` | `HR_MANAGER` | Sets `reviewed_by_user_id`, `reviewed_at`. Enforces anti-self-approval if HR Manager was requester (routes to peer HR). Increments `version`, logs `REQUISITION_APPROVED`. |
| `PENDING_HR` | `REJECT_REQUISITION` | `REJECTED` | `HR_MANAGER` | **Mandatory `decision_reason`**. Increments `version`, logs `REQUISITION_REJECTED`, notifies requester. |
| `PENDING_HR` | `CANCEL_REQUISITION` | `CANCELLED` | Original Requester | Allowed only while `PENDING_HR`. Logs `REQUISITION_CANCELLED`. |

### 1.2 Job Vacancy State Machine
| From State | Event / Action | To State | Allowed Actor | Preconditions & Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `CREATE_VACANCY` | `DRAFT` | `RECRUITER`, `HR_MANAGER` | **Hard Rule:** Linked `staff_requisitions.status` MUST equal `APPROVED`. |
| `DRAFT` | `PUBLISH_VACANCY` | `PUBLISHED` | `RECRUITER`, `HR_MANAGER` | Validates `closing_at > now()`, required description & requirements present. Sets `published_at = now()`, `published_by_user_id`. Visible on `/careers`. |
| `PUBLISHED` | `CLOSE_VACANCY` | `CLOSED` | `RECRUITER`, `HR_MANAGER`, `SYSTEM_CRON` | Triggered manually or automatically at `00:05 EAT` once `closing_at < now()`. Immediately blocks further public submissions. |
| `PUBLISHED` / `CLOSED` | `MARK_FILLED` | `FILLED` | `SYSTEM_TX` (Conversion) | Automatically transitions once converted hires for this requisition reach `requisition.headcount`. |

### 1.3 Public Job Application Guardrails (No Login Account Required)
On `POST /api/v1/careers/vacancies/:id/apply`:
1. Verify Cloudflare Turnstile `turnstileToken` server-side (auto-bypassed only in local test/dev when secret is intentionally unset).
2. Load `vacancies` row: MUST satisfy `status === 'PUBLISHED'` AND `now_utc <= closing_at` (`closing_at` evaluated in `Africa/Kampala`). Otherwise reject with `422 VACANCY_CLOSED`.
3. Normalize `applicant_email = email.trim().toLowerCase()`. Pre-check `(vacancy_id, applicant_email)` and handle unique index `uq_application_vacancy_email` conflict by returning `409 DUPLICATE_APPLICATION`—**never silently overwriting an earlier application**.
4. Inspect uploaded CV file buffer via `file-type` binary magic bytes: allow ONLY `application/pdf` (`%PDF-`) and `.docx` OOXML up to `5 MB` (`415 UNSUPPORTED_MEDIA_TYPE` otherwise).
5. Upload CV to private S3/MinIO/R2 bucket under key `applications/<vacancy_id>/<uuid>.<ext>`.
6. Insert `job_applications` (`status = 'APPLIED'`), log `APPLICATION_SUBMITTED`, notify assigned Recruiter, and send confirmation email with tracking code `APP-XXXXX` (no StaffHub account created).

### 1.4 Candidate Pipeline & Offer State Machine
- **Application Stages:** `APPLIED` $\rightarrow$ `SHORTLISTED` $\rightarrow$ `INTERVIEWING` $\rightarrow$ `OFFER_STAGE` $\rightarrow$ `HIRED` (or `REJECTED` from any non-terminal stage with logged `stage_notes` reason, or `WITHDRAWN`).
- **Job Offer State Machine:**

| From State | Event / Action | To State | Allowed Actor | Preconditions & Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `DRAFT_OFFER` | `DRAFT` | `RECRUITER`, `HR_MANAGER` | Application must be in `INTERVIEWING` or `OFFER_STAGE`. Validates `offered_base_salary_ugx > 0` and valid `reporting_manager_id`. |
| `DRAFT` / `REJECTED` | `SUBMIT_OFFER_APPROVAL` | `PENDING_APPROVAL` | `RECRUITER`, `HR_MANAGER` | Notifies HR Manager(s) for offer approval. |
| `PENDING_APPROVAL` | `APPROVE_OFFER` | `APPROVED` | `HR_MANAGER` | Sets `approved_by_user_id`, `approved_at`. Generates official Offer PDF stored in private S3 bucket. Logs `OFFER_APPROVED`. |
| `PENDING_APPROVAL` | `REJECT_OFFER` | `REJECTED` | `HR_MANAGER` | **Mandatory `decision_reason`**. Recruiter may revise and resubmit. |
| `APPROVED` | `SEND_OFFER` | `SENT` | `RECRUITER`, `HR_MANAGER` | **Hard Rule:** Physically blocked (`422`) unless `status === 'APPROVED'`. Sets `sent_at`, dispatches privacy-safe offer email. |
| `SENT` | `RECORD_ACCEPTANCE` | `ACCEPTED` | `RECRUITER`, `HR_MANAGER` | Sets `accepted_at`. Unlocks `Convert to Employee`. |
| `SENT` | `RECORD_DECLINED` | `DECLINED` | `RECRUITER`, `HR_MANAGER` | Optional reason logged; vacancy remains open. |

### 1.5 Atomic "Convert to Employee" Transaction (`ACCEPTED` $\rightarrow$ `CONVERTED`)
Triggered by `HR_MANAGER` with an `Idempotency-Key` header:
1. Lock `job_offers` row (`FOR UPDATE`). Assert `status === 'ACCEPTED'` and verify no `employees` record exists with `converted_from_offer_id = offer.id`.
2. Auto-provision institutional `work_email` (or use HR-confirmed `workEmail`), generate strong temporary password, hash with `Argon2id`, and insert `users` (`role = 'EMPLOYEE'`, `is_active = true`, `must_change_password = true`).
3. Generate unique `employee_code` (`UG-EMP-XXXX`) and insert `employees` copying **automatically** from `job_applications` + `job_offers` (zero manual re-entry):
   - `legal_name` = `application.full_name`
   - `personal_email` = `application.applicant_email`
   - `phone` = `application.phone`
   - `job_title` = `offer.offered_job_title`
   - `department_id` = `offer.department_id`
   - `manager_id` = `offer.reporting_manager_id`
   - `work_schedule_id` = default `Kampala Standard Office` (or HR-selected schedule)
   - `base_salary_ugx` = `offer.offered_base_salary_ugx`
   - `recurring_allowances_ugx` = `offer.offered_allowances_ugx`
   - `hire_date` = `offer.proposed_start_date`
   - `status` = `'ONBOARDING'`
4. Initialize current-year `leave_balances` for active `leave_types` based on company policy.
5. Insert `onboarding_checklists` (`status = 'IN_PROGRESS'`) and default 4-role `onboarding_tasks` across `HR_MANAGER`, `LINE_MANAGER`, `EMPLOYEE`, and `ASSET_OFFICER`.
6. Update `job_offers.status = 'CONVERTED'`, `job_applications.status = 'HIRED'`. If converted hires equal `requisition.headcount`, transition `vacancies.status = 'FILLED'`.
7. Append `CANDIDATE_CONVERTED_TO_EMPLOYEE` to `audit_logs`.
8. Create `"Pending My Action"` inbox items for HR, Line Manager, New Employee, and Asset Officer; send privacy-safe welcome email (containing login link without exposing salary figures).

*(Onboarding Completion: Whenever any `onboarding_tasks` row is marked `is_completed = true`, if 0 incomplete tasks remain on that `checklist_id`, update `onboarding_checklists.status = 'COMPLETED'`, `completed_at = now()`, and transition `employees.status = 'ACTIVE'`.)*

---

## 2. Employee Records & Sensitive Change Workflows

### 2.1 Permitted Self-Service Contact Updates (Immediate)
- **Allowed Fields:** `personal_email`, `phone`, `residential_address`, `emergency_contact_name`, `emergency_contact_phone`.
- **Execution:** `EMPLOYEE` (`SELF`) updates via strict `UpdateOwnContactDto`. Writes old/new diff to `audit_logs` (`EMPLOYEE_CONTACT_UPDATED`).

### 2.2 Sensitive Field Change Requests (`LEGAL_NAME`, `BANK_DETAILS`, `NATIONAL_ID_NIN`)
| From State | Event / Action | To State | Allowed Actor | Preconditions & Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `SUBMIT_SENSITIVE_CHANGE` | `PENDING_HR` | `EMPLOYEE` (`SELF`), `HR_MANAGER` | Requires `request_reason` and new value payload (plus optional supporting PDF such as Bank Verification Letter). Encrypts raw bank account / NIN values before persisting `profile_change_requests`. Notifies HR Manager(s). |
| `PENDING_HR` | `APPROVE_SENSITIVE_CHANGE` | `APPROVED` | `HR_MANAGER` | **Anti-Self-Approval:** `reviewed_by_user_id !== employee.user_id`. Atomically updates `employees` (`legal_name` OR `bank_name` + `bank_branch` + `bank_account_encrypted` + `bank_account_last4` OR `nin_encrypted` + `nin_last4`), increments `employees.version`, writes redacted diff to `audit_logs`. |
| `PENDING_HR` | `REJECT_SENSITIVE_CHANGE` | `REJECTED` | `HR_MANAGER` | **Mandatory `decision_reason`**. Employee profile remains untouched. Notifies employee. |

---

## 3. Attendance & Correction State Machines

### 3.1 Daily Browser Check-In & Check-Out (`Africa/Kampala`)
1. Compute `today_eat = DateTime.now().setZone('Africa/Kampala').toISODate()`.
2. **Check-In (`POST /api/v1/attendance/check-in`):**
   - Reject if `employee.status === 'EXITED'` (`403`).
   - Reject if `attendance_period_locks` exists for `(today_eat.year, today_eat.month)` (`423 PERIOD_LOCKED`).
   - Reject if `attendance_records` already has `(employee_id, today_eat)` (`409 ALREADY_CHECKED_IN`).
   - Evaluate `now_eat` against `employee.work_schedule.shift_start_time` on `today_eat`:
     - `now_eat <= shift_start`: `status = 'PRESENT_ON_TIME'`
     - `shift_start < now_eat <= shift_start + grace_period_minutes`: `status = 'PRESENT_GRACE'`
     - `now_eat > shift_start + grace_period_minutes`: `status = 'LATE'`
   - Insert `attendance_records` using **server UTC timestamp** (`now_utc`)—client timestamps and GPS coordinates are never accepted.
3. **Check-Out (`POST /api/v1/attendance/check-out`):**
   - Load `attendance_records` for `(employee_id, today_eat)`.
   - **Hard Rules:** Must exist with `check_in_at IS NOT NULL` (`422 MUST_CHECK_IN_FIRST`) AND `check_out_at IS NULL` (`409 ALREADY_CHECKED_OUT`).
   - Update `check_out_at = now_utc` and `worked_minutes = floor((check_out_at - check_in_at) / 60000)`.

### 3.2 Attendance Correction Request State Machine
| From State | Event / Action | To State | Allowed Actor | Preconditions & Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `SUBMIT_CORRECTION` | `PENDING` | `EMPLOYEE` (`SELF`) | `work_date` MUST be `<= today_eat` and NOT inside a locked `attendance_period_locks` month. **Mandatory `reason`**. Notifies Line Manager (or active delegate). |
| `PENDING` | `APPROVE_CORRECTION` | `APPROVED` | `LINE_MANAGER` (`TEAM` or active delegate), `HR_MANAGER` (fallback) | **Anti-Self-Approval:** reviewer `<> employee.user_id`. Checks period still unlocked. Upserts `attendance_records` (`check_in_at`, `check_out_at`, `worked_minutes`, `is_manual_correction = true`), recalculates `PRESENT_ON_TIME` / `PRESENT_GRACE` / `LATE`, writes old/new timestamps to `audit_logs` (with `on_behalf_of_user_id` if delegated). |
| `PENDING` | `REJECT_CORRECTION` | `REJECTED` | `LINE_MANAGER` (`TEAM` or active delegate), `HR_MANAGER` | **Mandatory `decision_reason`**. Existing attendance record remains unchanged. |
---

## 4. Leave Management & Ugandan Working-Day Engine

### 4.1 Deterministic Working-Day Calculation Algorithm (`Africa/Kampala`)
Given `employee_id`, `start_date` (`DATE`), and `end_date` (`DATE`):
1. Load `employee.work_schedule.working_days_bitmap` (e.g., `[1, 2, 3, 4, 5]` for Mon–Fri, ISO weekday `1 = Monday ... 7 = Sunday`).
2. Query `public_holidays` where `holiday_date BETWEEN start_date AND end_date` into a fast lookup Set.
3. Iterate calendar day `d` from `start_date` to `end_date` inclusive (interpreted strictly as `Africa/Kampala` dates):
   - Increment `working_days` by `1` **only if** `d.weekday IN working_days_bitmap` **AND** `d NOT IN holidaySet`.
4. Return `{ calendarDays, workingDays, excludedDates: [{ date, reason: 'DAY_OFF' | 'PUBLIC_HOLIDAY', label }] }`.
5. **Hard Rule:** If `workingDays === 0` (e.g., request spans only a weekend/holiday), block submission (`422 ZERO_WORKING_DAYS`).

### 4.2 Leave Request State Machine
| From State | Event / Action | To State | Allowed Actor | Preconditions & Atomic Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(New)* | `SUBMIT_LEAVE` | `PENDING_MANAGER` | `EMPLOYEE` (`SELF`) | 1. Compute `workingDays > 0`.<br>2. **Mandatory `reason`**.<br>3. Check no overlapping `PENDING_MANAGER`, `PENDING_HR`, or `APPROVED` request (backed by `excl_leave_no_overlap`).<br>4. Lock `leave_balances` row (`FOR UPDATE`). If `leave_type.annual_entitlement_days > 0`, assert `(entitled + carried_over - used - pending) >= workingDays`.<br>5. Increment `leave_balances.pending_days += workingDays`.<br>6. Notify Line Manager (or active delegate). |
| `PENDING_MANAGER` | `MANAGER_APPROVE` | `PENDING_HR` *(if HR step required)* **OR** `APPROVED` | `LINE_MANAGER` (`TEAM` or active delegate) | **Anti-Self-Approval:** reviewer `<> employee.user_id`. Checks `leave_type.requires_hr_approval === true` OR (`hr_approval_threshold_days !== null && workingDays > hr_approval_threshold_days`). If true $\rightarrow$ transitions to `PENDING_HR` and notifies HR Manager; else $\rightarrow$ triggers **Final Approval Side Effects**. |
| `PENDING_HR` | `HR_APPROVE` | `APPROVED` | `HR_MANAGER` | **Anti-Self-Approval:** reviewer `<> employee.user_id`. Triggers **Final Approval Side Effects**. |
| `PENDING_MANAGER` / `PENDING_HR` | `REJECT_LEAVE` | `REJECTED` | Approver (`TEAM` or `HR`) | **Mandatory `decision_reason`**. Atomically releases `leave_balances.pending_days -= workingDays`. Logs `LEAVE_REJECTED`. |
| `PENDING_MANAGER` / `PENDING_HR` | `CANCEL_LEAVE` | `CANCELLED` | `EMPLOYEE` (`SELF`) | Atomically releases `leave_balances.pending_days -= workingDays`. Logs `LEAVE_CANCELLED`. |
| `APPROVED` | `HR_REVOKE_LEAVE` | `CANCELLED` | `HR_MANAGER` | Allowed ONLY for dates whose month is NOT locked in `attendance_period_locks`. **Mandatory `decision_reason`**. Restores `used_days -= workingDays` and removes/resets generated `ON_LEAVE` attendance rows. |

### 4.3 Final Approval Atomic Side Effects
Inside the single transaction when transitioning to `APPROVED`:
1. Lock `leave_balances` (`FOR UPDATE`): `pending_days -= workingDays`, `used_days += workingDays`.
2. For each working day `d` in `[start_date, end_date]` (where `d` is a scheduled workday and not a public holiday):
   - Upsert `attendance_records` for `(employee_id, d)` setting `status = 'ON_LEAVE'`, `notes = 'Approved Leave #' + request.id`.
3. Resolve manager/HR pending notifications, notify employee (`"Leave request approved"`), and write `LEAVE_APPROVED` to `audit_logs` (recording `on_behalf_of_user_id` if delegated).

---

## 5. Monthly Payroll Run, Calculation Pipeline & Post-Lock Adjustments

### 5.1 Preconditions for Creating a Payroll Run
1. Target `(year, month)` MUST NOT already have a `payroll_runs` row.
2. An `attendance_period_locks` row MUST exist for `(year, month)` so attendance/leave inputs are frozen before payroll computation.
3. Load the active `statutory_tax_policies` row whose `[effective_from, effective_to]` covers the pay period end date.

### 5.2 Deterministic Calculation Pipeline Per Employee (`Decimal.js`, `ROUND_HALF_UP`)
For every employee employed during `[period_start, period_end]` (`status IN ('ONBOARDING', 'ACTIVE', 'OFFBOARDING')`, `hire_date <= period_end`):
1. **Locked Attendance Summary Snapshot:**
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
   - Evaluated against `gross_pay_ugx` (per Ugandan tax law, employee NSSF is **not** deducted before computing PAYE) using `policy.paye_resident_brackets` or `policy.paye_non_resident_brackets` per `employee.tax_residency`:
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
| *(New)* | `PREPARE_PAYROLL` | `DRAFT` | `PAYROLL_OFFICER` | Requires `attendance_period_locks` for `(year, month)`. Generates `payroll_items` & aggregate run totals. Logs `PAYROLL_CREATED`. |
| `DRAFT` | `UPDATE_DRAFT_EXTRAS` | `DRAFT` | `PAYROLL_OFFICER` | Edits `bonus_or_arrears_ugx` or `other_deductions_ugx` and recalculates statutory taxes & run totals. |
| `DRAFT` | `SUBMIT_PAYROLL` | `PENDING_APPROVAL` | `PAYROLL_OFFICER` | Sets `submitted_at`. Notifies HR Manager / Approver. |
| `PENDING_APPROVAL` | `RETURN_PAYROLL` | `DRAFT` | `HR_MANAGER` | **Mandatory `decision_reason`**. Returns to Payroll Officer for revision. |
| `PENDING_APPROVAL` | `APPROVE_PAYROLL` | `APPROVED` | `HR_MANAGER` | **Separation of Duties:** `actor.userId !== run.prepared_by_user_id`. Sets `approved_by_user_id`, `approved_at`. Logs `PAYROLL_APPROVED`. |
| `APPROVED` | `LOCK_AND_PUBLISH` | `LOCKED` | `HR_MANAGER` or `PAYROLL_OFFICER` | Inside transaction:<br>1. Set `status = 'LOCKED'`, `locked_at`, `locked_by_user_id`.<br>2. Decrement `staff_loans.remaining_balance_ugx` (marking `SETTLED` if `0`).<br>3. Generate PDF payslips with `verification_code`, QR code, and `document_sha256` hash; store in private S3.<br>4. Insert `payslips` rows.<br>5. Notify employees (`"Your payslip for [Month] is ready"`—no UGX figures in email). |

### 5.4 Post-Lock Authorised Adjustments (`LOCKED` Payroll Protection)
- **Hard Rule:** Any direct `PUT`/`PATCH` on `payroll_items` belonging to a `LOCKED` run is rejected (`423 PAYROLL_LOCKED_DIRECT_EDIT_FORBIDDEN`) AND blocked by PostgreSQL trigger `trg_payroll_items_locked_guard`.
- **Adjustment Flow:**
  1. `PAYROLL_OFFICER` creates `payroll_adjustments` (`status = 'PENDING'`, `amount_ugx > 0`, `adjustment_type`, **mandatory `reason`**).
  2. `HR_MANAGER` (`actor.userId !== requested_by_user_id`) approves (`APPROVED`) or rejects (`REJECTED` + **mandatory `decision_reason`**).
  3. Approved adjustments settle in the next open payroll run (linking `applied_in_run_id`) with full audit traceability.

---

## 6. Company Asset Custody & Acknowledgement Workflow

| From State | Event / Action | To State | Allowed Actor | Preconditions & Atomic Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| *(Asset Available)* | `ISSUE_ASSET` | `PENDING_ACKNOWLEDGEMENT` | `ASSET_OFFICER` | Assert `asset.condition NOT IN ('DAMAGED','LOST','RETIRED')`. Partial unique index `uq_asset_single_active_custody` guarantees zero concurrent assignees (`409 ASSET_ALREADY_ASSIGNED`). Creates `"Pending My Action"` notification for employee. |
| `PENDING_ACKNOWLEDGEMENT` | `ACKNOWLEDGE_ASSET` | `ACKNOWLEDGED` | Assigned `EMPLOYEE` (`SELF`) | Sets `acknowledged_at = now()`. Resolves employee pending notification. Logs `ASSET_ACKNOWLEDGED`. |
| `PENDING_ACKNOWLEDGEMENT` / `ACKNOWLEDGED` | `RECORD_RETURN` | `RETURNED` | `ASSET_OFFICER` | Sets `returned_at = now()`, `received_by_user_id`, `return_condition`. Updates `assets.condition`. If `return_condition = 'DAMAGED'`, requires `incident_notes`. Frees asset for future issuing and refreshes any active offboarding `ASSET_RETURN` clearance track. |
| `PENDING_ACKNOWLEDGEMENT` / `ACKNOWLEDGED` | `REPORT_DAMAGE_OR_LOSS` | `CLOSED_DAMAGED` / `CLOSED_LOST` | `ASSET_OFFICER` | **Mandatory `incident_notes`**. Sets `returned_at = now()` (closing active custody slot), updates `assets.condition` (`DAMAGED`/`LOST`), writes `ASSET_INCIDENT_LOGGED`, and flags HR/Offboarding recovery if applicable. |

---

## 7. Offboarding, Hard Clearance Blockers & Account Deactivation

### 7.1 Exit Initiation (`ACTIVE` $\rightarrow$ `OFFBOARDING`)
Triggered by `HR_MANAGER`:
1. Validates `last_working_day >= notice_date` and **mandatory `exit_reason`**.
2. Updates `employees.status = 'OFFBOARDING'`, `employees.last_working_day = last_working_day`.
3. Inserts `offboarding_cases` (`status = 'IN_PROGRESS'`).
4. Dynamically checks active dependencies and creates 4 `offboarding_clearance_items`:
   - `ASSET_RETURN` (`ASSET_OFFICER`): Set to `BLOCKED` (listing unreturned `#AST-...` tags) if employee holds any active `asset_assignments` where `returned_at IS NULL`; else `PENDING`.
   - `OPERATIONAL_HANDOVER` (`LINE_MANAGER`): `PENDING`.
   - `FINANCE_LOANS` (`PAYROLL_OFFICER`): Set to `BLOCKED` (listing remaining `UGX` balance) if employee has `staff_loans` with `remaining_balance_ugx > 0`; else `PENDING`.
   - `HR_EXIT` (`HR_MANAGER`): `PENDING`.

### 7.2 Dynamic Blocker Enforcement & Track Sign-Off
- When `ASSET_OFFICER` clicks sign-off on `ASSET_RETURN`: backend queries `asset_assignments WHERE employee_id = X AND returned_at IS NULL`. If count `> 0`, **physically blocks** clearance (`422 CLEARANCE_BLOCKED`).
- When `PAYROLL_OFFICER` clicks sign-off on `FINANCE_LOANS`: backend checks `staff_loans WHERE employee_id = X AND remaining_balance_ugx > 0`. If balance `> 0`, **physically blocks** clearance (`422 CLEARANCE_BLOCKED`) until settled.
- **Finalize Clearance (`IN_PROGRESS` $\rightarrow$ `CLEARED`):** Allowed ONLY when all 4 `offboarding_clearance_items.status === 'CLEARED'`.

### 7.3 Account Deactivation (`CLEARED` $\rightarrow$ `DEACTIVATED`)
- **Rule:** Allowed once `status === 'CLEARED'` AND `today_eat > last_working_day` (automated via `00:05 EAT` cron or manually by HR post-`last_working_day`).
- Inside atomic transaction:
  1. `offboarding_cases.status = 'DEACTIVATED'`, `deactivated_at = now()`.
  2. `employees.status = 'EXITED'`.
  3. `users.is_active = false`, `users.deactivated_at = now()`.
  4. `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = emp.user_id AND revoked_at IS NULL`.
  5. Audit log `EMPLOYEE_ACCOUNT_DEACTIVATED`. Employee, attendance, leave, payslip, and asset records remain preserved read-only indefinitely.

---

## 8. Automated Scheduled Jobs (Cron Specifications)

Protected via constant-time `X-Cron-Secret: <CRON_SHARED_SECRET>` comparison and triggered daily by GitHub Actions `schedule` (plus manual `workflow_dispatch` for testing/demo):

### Job 1: End-of-Day Attendance Absence Reconciliation
- **Schedule:** Daily at **`23:55 EAT`** (`20:55 UTC`).
- **Endpoint:** `POST /api/v1/internal/jobs/reconcile-attendance`
- **Idempotent Logic for `target_date = today_eat`:**
  1. Check whether `target_date` exists in `public_holidays`.
  2. Fetch all employees where `status IN ('ONBOARDING', 'ACTIVE', 'OFFBOARDING')` AND `hire_date <= target_date` AND (`last_working_day IS NULL OR last_working_day >= target_date`).
  3. For each employee (skipping if `(employee_id, target_date)` already exists in `attendance_records`):
     - If `target_date` is a public holiday $\rightarrow$ insert `status = 'HOLIDAY'`.
     - Else if `target_date.weekday NOT IN employee.work_schedule.working_days_bitmap` $\rightarrow$ insert `status = 'DAY_OFF'`.
     - Else if an `APPROVED` leave request covers `target_date` $\rightarrow$ insert `status = 'ON_LEAVE'`.
     - Else $\rightarrow$ insert `status = 'ABSENT'`, `notes = 'Auto-marked absent at 23:55 EAT EOD reconciliation'`.
  4. Log summary count to `audit_logs` (`CRON_ATTENDANCE_RECONCILED`).

### Job 2: Daily Lifecycle Transitions (`Vacancies`, `Offboarding`, `Delegations`)
- **Schedule:** Daily at **`00:05 EAT`** (`21:05 UTC`).
- **Endpoint:** `POST /api/v1/internal/jobs/process-daily-transitions`
- **Idempotent Logic:**
  1. **Close Expired Vacancies:** `UPDATE vacancies SET status = 'CLOSED' WHERE status = 'PUBLISHED' AND closing_at < now()`.
  2. **Deactivate Cleared Exits Past Last Working Day:** Query `offboarding_cases` where `status = 'CLEARED'` AND `last_working_day < today_eat` $\rightarrow$ execute Section 7.3 deactivation transaction for each.
  3. **Notify HR of Overdue Uncleared Exits:** Query `offboarding_cases` where `status = 'IN_PROGRESS'` AND `last_working_day < today_eat` $\rightarrow$ notify HR Manager (`"Exit overdue with unresolved clearance blockers"`).
  4. **Expire Acting Delegations:** `UPDATE acting_delegations SET is_active = false WHERE is_active = true AND ends_at < now()`.