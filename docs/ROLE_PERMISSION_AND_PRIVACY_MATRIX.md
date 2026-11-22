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
Any internal user (`HR_MANAGER`, `LINE_MANAGER`, `RECRUITER`, `PAYROLL_OFFICER`, `ASSET_OFFICER`, `SYSTEM_ADMIN`) who is linked to an `employeeId` automatically inherits **`SELF`** employee capabilities (daily browser Check-In/Check-Out, viewing own payslips and loan schedule, submitting own leave requests, reading their own onboarding checklist and employee-safe offboarding summary, acknowledging own assigned assets, updating own permitted contact info).
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
