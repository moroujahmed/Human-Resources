import type { StaffHubRole } from "@staffhub/shared";

export const ROLE_NAVIGATION: Record<StaffHubRole, Array<{ label: string; href: string }>> = {
  EMPLOYEE: [
    { label: "Home", href: "/home" },
    { label: "Attendance", href: "/attendance" },
    { label: "Leave", href: "/leave" },
    { label: "My Payslips", href: "/my-payslips" },
    { label: "My Assets", href: "/my-assets" },
    { label: "Onboarding", href: "/onboarding" },
    { label: "Profile", href: "/profile" },
  ],
  LINE_MANAGER: [
    { label: "Team Operations", href: "/manager" },
    { label: "Leave Approvals", href: "/leave" },
    { label: "Staff Requisitions", href: "/recruitment" },
    { label: "Onboarding", href: "/onboarding" },
    { label: "My Self-Service", href: "/home" },
  ],
  HR_MANAGER: [
    { label: "HR Overview", href: "/hr" },
    { label: "Employee Directory", href: "/hr/employees" },
    { label: "Recruitment", href: "/recruitment" },
    { label: "Onboarding", href: "/onboarding" },
    { label: "Offboarding", href: "/hr/offboarding" },
    { label: "Payroll", href: "/payroll" },
    { label: "Audit", href: "/audit" },
  ],
  RECRUITER: [
    { label: "Vacancies & Pipeline", href: "/recruitment" },
    { label: "Onboarding", href: "/onboarding" },
    { label: "My Self-Service", href: "/home" },
  ],
  PAYROLL_OFFICER: [
    { label: "Payroll Runs", href: "/payroll" },
    { label: "Staff Loans", href: "/payroll/loans" },
    { label: "My Self-Service", href: "/home" },
  ],
  ASSET_OFFICER: [
    { label: "Asset Registry", href: "/assets" },
    { label: "Issue & Returns", href: "/assets" },
    { label: "Onboarding Tasks", href: "/onboarding" },
    { label: "My Self-Service", href: "/home" },
  ],
  SYSTEM_ADMIN: [
    { label: "User Accounts", href: "/admin" },
    { label: "Schedules & Holidays", href: "/admin" },
    { label: "Audit Trail", href: "/audit" },
  ],
};
