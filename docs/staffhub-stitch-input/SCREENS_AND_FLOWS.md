# StaffHub — Screen Inventory & Stitch Generation Prompts

Upload `DESIGN.md`, `PRD_AND_ROLES.md`, and `SCREENS_AND_FLOWS.md` to Stitch AI, then generate screens one by one in this order.

---

## Screen 1: Public Careers Portal & Apply Flow (Job Applicant)
- **Layout:** Clean Ivory top bar (logo + `"Open Positions"` + `"Staff Sign In"`), warm editorial hero header, search & department filter bar, 2-column vacancy cards showing Job Title, Department, Contract Type, and `Closes: 28 Nov 2026, 23:59 EAT`.
- **Application Drawer/Page:** Job description on left + `"Apply Without Account"` form on right (Full Name, Email, Phone, Cover Note, PDF CV Upload). Include an inline duplicate-email alert example (`"This email has already applied for this vacancy."`).

## Screen 2: Employee Self-Service Home (Desktop + Mobile Responsive)
- **Layout:** Warm greeting (`"Good morning, Amara"`), prominent Check-In/Out Card showing live `Africa/Kampala` clock (`08:04 EAT`), assigned shift (`08:00 – 17:00 • 15m grace`), status pill (`Not Checked In` / `Checked In`), and single Nile Petrol CTA (`Check In Now`).
- **Cards Row:**
  1. `Pending My Action` (e.g., `"Acknowledge assigned MacBook Pro — Asset #AST-088"`).
  2. `Annual Leave Balance` (`14 Working Days Available` + `"Request Leave"` link).
  3. `Latest Payslip` (`October 2026 • UGX •••••••` with Reveal eye toggle + `"View PDF"`).
- **Bottom Table:** Last 7 working days attendance log with `"Request Correction"` link.

## Screen 3: Leave Request & Team Calendar (Employee & Line Manager)
- **Layout:** 2/3 Left Form + Requests Table (`Leave Type`, `Start/End Dates`, automated `"3 Working Days (Excludes Weekend & Holiday)"` summary pill, mandatory `Reason`); 1/3 Right Leave Balances & Ugandan Holiday Mini-Calendar.
- **Manager Tab:** `"Team Approval Queue"` with `Approve` and `Reject` (opens mandatory Reason modal).

## Screen 4: Line Manager Team Dashboard (Strict Privacy Enforced)
- **Layout:** 4 KPI cards (`Team Members: 12`, `Checked In: 10`, `Late Grace: 1`, `Pending Approvals: 3`). Tabs: `Today's Attendance`, `Approval Inbox`, `Staff Requisitions`, `Performance`.
- **Privacy Enforcement:** Table displays Name, Role, Work Email, Check-In Time (`EAT`), and Leave Status. **Zero salary, bank, or NIN columns.**

## Screen 5: Recruitment Pipeline & Candidate Conversion (Recruiter & HR)
- **Layout:** Approved Vacancy selector + clean Kanban/Tabbed Pipeline (`Applied`, `Shortlisted`, `Interviewing`, `Offer Approval`, `Offer Sent`, `Accepted`).
- **Conversion Drawer:** Clicking an `Accepted` candidate reveals pre-filled profile data, Terracotta highlight CTA **`Convert to Employee`**, and auto-generated 4-role Onboarding Checklist preview (HR, Line Manager, Employee, Asset Officer).

## Screen 6: HR Employee Profile & Offboarding Clearance (HR Manager)
- **Layout:** Profile Header (`Active` or `Exiting • Last Day: 30 Nov 2026`), Tabs (`Overview`, `Compensation & Bank [Masked]`, `Pending Change Approvals`, `Attendance & Leave`, `Assets`, `Offboarding`).
- **Pending Change Diff Card:** Shows `Current Bank Account` vs `Requested Bank Account` with `Approve` / `Reject (Reason Required)`.
- **Offboarding Tab:** Clearance Progress Bar (`3/5 Cleared`) with red **Blocker Cards** (e.g., `"Blocked: HP EliteBook not yet returned to Asset Officer"`), keeping `"Deactivate Account"` disabled until blockers clear.

## Screen 7: Monthly Payroll Run & Locked Payslip Drawer (Payroll Officer)
- **Layout:** Period Header (`October 2026 demo fixture • Currency: UGX`), 4-Step Workflow Stepper (`Draft` $\rightarrow$ `Review` $\rightarrow$ `Approved` $\rightarrow$ `Locked`), 4 Financial Summary Cards (`Gross UGX`, `NSSF`, `PAYE + LST`, `Net Pay UGX`), and dense tabular-numeric payroll table with right-aligned currency columns. The mock run is illustrative only; it is not legal payroll output or proof of disbursement.
- **Locked Banner:** Crisp warning banner (`"Payroll Locked — Direct edits disabled"`) with `"Create Authorised Adjustment"` button.
- **Payslip Drawer:** Clean printable `UGX` payslip preview featuring itemized deductions and a Verification QR Code.

## Screen 8: Company Asset Registry (Asset Officer)
- **Layout:** 4 KPIs (`Total Assets`, `Assigned`, `Available`, `Damaged / Lost`), Filterable Registry Table (`Asset Tag`, `Item`, `Category`, `Condition`, `Assigned To [Single Employee]`, `Acknowledgement Status`), and slide-over Drawer to `Issue Asset`, `Record Return`, or `Log Damage/Loss`.

## Screen 9: System Admin & Immutable Audit Trail (System Administrator)
- **Layout:** Tabs (`Users & Roles`, `Work Schedules & Holidays`, `Payroll Tax Policy`, `Audit Trail`).
- **Audit Trail View:** Filterable, read-only chronological table (`Timestamp EAT`, `Actor & Role`, `Action`, `Target Entity`, `Change Summary`, `Logged Reason`).

---

### Exact Stitch Prompting Sequence
1. **Upload all 3 files** (`DESIGN.md`, `PRD_AND_ROLES.md`, `SCREENS_AND_FLOWS.md`) into Stitch.
2. **Paste this Alignment Prompt first:**
   > *"Read DESIGN.md, PRD_AND_ROLES.md, and SCREENS_AND_FLOWS.md carefully. Adopt the Savannah Editorial palette (Warm Limestone `#F5F3EE`, Smoked Obsidian `#161513`, Deep Nile Petrol `#0B4F4E`, Terracotta Copper `#B85028`, Warm Brass `#D49B42`) and Bricolage Grotesque + Inter + JetBrains Mono typography. Strictly enforce UGX formatting, Africa/Kampala time, zero biometrics/GPS, and strict role privacy. Generate Screen 2 (Employee Self-Service Home) for Desktop and Mobile first."*
3. **Generate remaining screens one at a time** (e.g., *"Now generate Screen 7 using the exact sidebar shell, tokens, and table discipline from DESIGN.md"*).