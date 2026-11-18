---

### File 2 of 3: `PRD_AND_ROLES.md`

```markdown
# StaffHub — Product Requirements, Roles & Business Rules

## 1. System Scope
StaffHub is a unified web-based Human Resource Management System (HRMS) covering the entire employee lifecycle:
1. Recruitment & Public Job Applications
2. Hiring & Multi-Role Onboarding Checklists
3. Employee Profiles & HR-Approved Sensitive Changes
4. Web Attendance (Check-in/Check-out & Corrections)
5. Leave Management (Working-day balance rules)
6. Monthly Payroll, Statutory Deductions (PAYE, NSSF, LST), Approvals & Payslips
7. Company Asset Inventory, Issuing & Returns
8. Offboarding Clearance & Account Deactivation

### Mandatory Operational Rules
- **Browser-Based:** Responsive across desktop, tablet, and phone.
- **Currency & Time:** Ugandan Shillings (`UGX`) and `Africa/Kampala` (`EAT`, `UTC+3`).
- **No Hardware Tracking:** Zero biometric scanners and zero GPS tracking.
- **Auditability & Retention:** Important edits, approvals, and rejections record actor, timestamp, and reason. Exited employees are deactivated after their last working day; records are retained read-only and never permanently deleted.

---

## 2. The 8 Roles & Strict Privacy Matrix

| Role | Allowed Workspace Modules | Strictly Hidden / Prohibited |
| :--- | :--- | :--- |
| **System Administrator** | User accounts, role assignments, holidays/work schedules, payroll policy rules, system audit log | Cannot arbitrarily alter locked payroll figures |
| **HR Manager** | Staff profiles, requisition/offer/leave/profile-change approvals, exits/clearance, reports | — |
| **Recruiter** | Approved vacancies, public job postings, applicants, shortlisting, interviews, draft offers | Cannot publish unapproved requisitions; cannot access general staff payroll |
| **Line Manager** | Team roster, staff requisition requests, team attendance corrections, leave approvals, performance reviews | **NEVER sees** team salary, bank account, or sensitive NIN details |
| **Payroll Officer** | Monthly payroll preparation, statutory deductions, authorised adjustments, payslips, payment reports | Cannot edit daily attendance directly (uses locked attendance summary) |
| **Asset Officer** | Asset catalog, assigning/returning items, damaged/lost logging, exit asset clearance | Cannot view salaries, HR notes, or leave reasons |
| **Employee** | Self-service Check-In/Out, own attendance & correction requests, leave requests/balances, own payslips, own assigned assets, contact updates | Cannot view other staff private records or approve requests |
| **Job Applicant** | Public Careers Portal: Browse open jobs & apply **without creating an account** | No internal app shell; blocked from duplicate email per job & past closing date |

---

## 3. Core Workflow Rules for UI Accuracy

1. **Recruitment & Hiring:**
   - Requisitions require HR approval before Recruiter can publish.
   - Public application form blocks duplicate email per vacancy and blocks submissions past `Closing Date (EAT)`.
   - Job offers must be approved before sending; an `Accepted` offer converts with one click into a single Employee Profile + Onboarding Checklist (no re-typing candidate info).
2. **Employee Records:**
   - Employees edit contact info freely; Legal Name and Bank Details create a `Pending HR Approval` diff request (`Current` $\rightarrow$ `Requested`).
3. **Attendance & Leave:**
   - Maximum 1 attendance record per working day; `Check Out` disabled until `Check In` occurs.
   - Late status calculated from employee work schedule + allowed grace period.
   - Leave form auto-calculates `Working Days` (excluding weekends & Ugandan public holidays) and prevents overlapping dates or exceeding balance.
4. **Payroll:**
   - Pipeline: `Draft` $\rightarrow$ `Pending Approval` $\rightarrow$ `Approved` $\rightarrow$ `Locked & Published`.
   - Locked payroll cannot be edited inline; corrections go through an `Authorised Adjustment` workflow with reason.
   - Payslips show itemized `UGX` earnings/deductions + Verification QR Code.
5. **Assets & Offboarding:**
   - One asset assigned to at most **1 employee** at a time. Newly assigned employees see an `"Acknowledge Receipt"` prompt.
   - Offboarding shows explicit **Clearance Blockers** (unreturned assets, incomplete handover, unsettled loans) preventing exit completion until cleared.