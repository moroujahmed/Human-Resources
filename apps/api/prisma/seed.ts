import "dotenv/config";
import * as argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function requireDemoConfiguration(): void {
  if (process.env.NODE_ENV === "production") throw new Error("Demo seed refused in production");
  if (process.env.DEMO_MODE !== "true") throw new Error("Set DEMO_MODE=true to seed synthetic demo data");
  if (!process.env.DATABASE_URL || /(?:staffhub_prod|production)/i.test(process.env.DATABASE_URL)) {
    throw new Error("Refusing to seed an unapproved production database");
  }
  if (!process.env.DEMO_SEED_PASSWORDS) throw new Error("DEMO_SEED_PASSWORDS is required outside source control");
}

async function passwordHash(password: string): Promise<string> {
  if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("Each demo password must contain 12+ characters, uppercase, lowercase, and a digit");
  }
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    return await argon2.verify(stored, password);
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  requireDemoConfiguration();
  const credentials = JSON.parse(process.env.DEMO_SEED_PASSWORDS) as Record<string, string>;
  if (Object.keys(credentials).length < 8) throw new Error("Demo credentials are missing one or more internal accounts");

  const departmentSeeds = [
    ["IT-GOV", "IT & Governance"],
    ["PPL-CUL", "People & Culture"],
    ["FIN-OPS", "Finance & Operations"],
    ["INF-SEC", "Infrastructure & Security"],
  ] as const;
  const departments = new Map<string, { id: string }>();
  for (const [code, name] of departmentSeeds) {
    departments.set(code, await prisma.department.upsert({
      where: { code },
      update: { name, isActive: true },
      create: { code, name, isActive: true },
    }));
  }

  const schedule = await prisma.workSchedule.upsert({
    where: { name: "Kampala Standard Office (Mon-Fri)" },
    update: { shiftStartTime: new Date("1970-01-01T08:00:00.000Z"), shiftEndTime: new Date("1970-01-01T17:00:00.000Z"), gracePeriodMinutes: 15, workingDaysBitmap: [1,2,3,4,5], isDefault: true },
    create: { name: "Kampala Standard Office (Mon-Fri)", shiftStartTime: new Date("1970-01-01T08:00:00.000Z"), shiftEndTime: new Date("1970-01-01T17:00:00.000Z"), gracePeriodMinutes: 15, workingDaysBitmap: [1,2,3,4,5], isDefault: true },
  });

  const users = [
    ["00000000-0000-4000-8000-000000000001", "raymond.mugisha@example.invalid", "SYSTEM_ADMIN", "Raymond Mugisha", "UG-ADM-0001", "IT-GOV"],
    ["00000000-0000-4000-8000-000000000002", "julius.okello@example.invalid", "HR_MANAGER", "Julius Okello", "UG-HR-0012", "PPL-CUL"],
    ["00000000-0000-4000-8000-000000000003", "grace.akello@example.invalid", "HR_MANAGER", "Grace Akello", "UG-HR-0013", "PPL-CUL"],
    ["00000000-0000-4000-8000-000000000004", "grace.apio@example.invalid", "RECRUITER", "Grace Apio", "UG-REC-0019", "PPL-CUL"],
    ["00000000-0000-4000-8000-000000000005", "michael.kigozi@example.invalid", "LINE_MANAGER", "Michael Kigozi", "UG-MGR-0089", "FIN-OPS"],
    ["00000000-0000-4000-8000-000000000006", "sarah.namubiru@example.invalid", "PAYROLL_OFFICER", "Sarah Namubiru", "UG-PAY-0034", "FIN-OPS"],
    ["00000000-0000-4000-8000-000000000007", "joseph.mukasa@example.invalid", "ASSET_OFFICER", "Joseph Mukasa", "UG-AST-0021", "INF-SEC"],
    ["00000000-0000-4000-8000-000000000008", "brian.kato@example.invalid", "EMPLOYEE", "Brian Kato", "UG-EMP-0412", "FIN-OPS"],
  ] as const;

  for (const [id, email, role, name, code, deptCode] of users) {
    const password = credentials[email];
    if (!password) throw new Error(`Missing demo credential for ${email}`);
    await prisma.user.upsert({
      where: { id },
      update: { email, role: role as never, isActive: true, mustChangePassword: false, passwordHash: await passwordHash(password) },
      create: { id, email, role: role as never, isActive: true, mustChangePassword: false, passwordHash: await passwordHash(password) },
    });
    await prisma.employee.upsert({
      where: { userId: id },
      update: { legalName: name, workEmail: email, employeeCode: code, departmentId: departments.get(deptCode)!.id, workScheduleId: schedule.id, status: "ACTIVE", jobTitle: name.includes("Manager") ? "Manager" : "Staff", phone: "+256700000000", baseSalaryUgx: code === "UG-EMP-0412" ? "4200000" : "2500000", recurringAllowancesUgx: code === "UG-EMP-0412" ? "650000" : "0" },
      create: { userId: id, legalName: name, workEmail: email, employeeCode: code, departmentId: departments.get(deptCode)!.id, workScheduleId: schedule.id, status: "ACTIVE", jobTitle: name.includes("Manager") ? "Manager" : "Staff", phone: "+256700000000", baseSalaryUgx: code === "UG-EMP-0412" ? "4200000" : "2500000", recurringAllowancesUgx: code === "UG-EMP-0412" ? "650000" : "0", hireDate: new Date("2024-01-01T00:00:00.000Z") },
    });
  }

  const michael = await prisma.employee.findUniqueOrThrow({ where: { employeeCode: "UG-MGR-0089" } });
  const brian = await prisma.employee.findUniqueOrThrow({ where: { employeeCode: "UG-EMP-0412" } });
  await prisma.employee.update({ where: { id: brian.id }, data: { managerId: michael.id } });

  const directReports = [
    ["00000000-0000-4000-8000-000000000009", "rebecca.kisakye@example.invalid", "Rebecca Kisakye", "UG-EMP-0449", "ACTIVE"],
    ["00000000-0000-4000-8000-000000000010", "fiona.namatovu@example.invalid", "Fiona Namatovu", "UG-EMP-0405", "ACTIVE"],
    ["00000000-0000-4000-8000-000000000011", "ivan.tumusiime@example.invalid", "Ivan Tumusiime", "UG-EMP-0512", "ACTIVE"],
    ["00000000-0000-4000-8000-000000000012", "denis.mukasa@example.invalid", "Denis Mukasa", "UG-EMP-0291", "OFFBOARDING"],
    ["00000000-0000-4000-8000-000000000013", "samuel.ssebunya@example.invalid", "Samuel Ssebunya", "UG-EMP-0104", "EXITED"],
  ] as const;

  for (const [id, email, name, code, status] of directReports) {
    const password = credentials[email];
    if (!password) throw new Error(`Missing demo credential for ${email}`);
    await prisma.user.upsert({
      where: { id },
      update: { email, role: "EMPLOYEE", isActive: status !== "OFFBOARDING" && status !== "EXITED", mustChangePassword: false, passwordHash: await passwordHash(password) },
      create: { id, email, role: "EMPLOYEE", isActive: status !== "OFFBOARDING" && status !== "EXITED", mustChangePassword: false, passwordHash: await passwordHash(password) },
    });
    await prisma.employee.upsert({
      where: { userId: id },
      update: { legalName: name, workEmail: email, employeeCode: code, departmentId: departments.get("FIN-OPS")!.id, workScheduleId: schedule.id, managerId: michael.id, status: status as never, phone: "+256700000000" },
      create: { userId: id, legalName: name, workEmail: email, employeeCode: code, departmentId: departments.get("FIN-OPS")!.id, workScheduleId: schedule.id, managerId: michael.id, status: status as never, phone: "+256700000000", hireDate: new Date("2024-01-01T00:00:00.000Z") },
    });
  }

  const leaveTypeSeeds = [
    ["ANNUAL","Annual Leave","21","true","false","0"],
    ["SICK","Sick Leave","14","true","false","0"],
    ["COMPASSIONATE","Compassionate Leave","5","true","false","0"],
    ["MATERNITY","Maternity Leave","60","true","true","0"],
    ["PATERNITY","Paternity Leave","4","true","true","0"],
    ["STUDY","Study Leave","5","true","true","0"],
    ["UNPAID","Unpaid Leave","0","false","true","0"],
  ] as const;
  for (const [code,name,entitled,isPaid,requiresHr,maxCarry] of leaveTypeSeeds) {
    await prisma.leaveType.upsert({
      where: { code },
      update: { name, annualEntitlementDays: entitled, isPaid: isPaid === "true", requiresHrApproval: requiresHr === "true", maxCarryOverDays: maxCarry },
      create: { code, name, annualEntitlementDays: entitled, isPaid: isPaid === "true", requiresHrApproval: requiresHr === "true", maxCarryOverDays: maxCarry },
    });
  }
  const annual = await prisma.leaveType.findUniqueOrThrow({ where: { code: "ANNUAL" } });
  await prisma.leaveBalance.upsert({
    where: { employeeId_leaveTypeId_year: { employeeId: brian.id, leaveTypeId: annual.id, year: 2026 } },
    update: { entitledDays: "21", carriedOverDays: "0", usedDays: "7", pendingDays: "0" },
    create: { employeeId: brian.id, leaveTypeId: annual.id, year: 2026, entitledDays: "21", carriedOverDays: "0", usedDays: "7", pendingDays: "0" },
  });
  const rebecca = await prisma.employee.findUniqueOrThrow({ where: { employeeCode: "UG-EMP-0449" } });
  const fiona = await prisma.employee.findUniqueOrThrow({ where: { employeeCode: "UG-EMP-0405" } });
  const study = await prisma.leaveType.findUniqueOrThrow({ where: { code: "STUDY" } });
  await prisma.leaveRequest.upsert({
    where: { id: "40000000-0000-4000-8000-000000000001" },
    update: { status: "PENDING_MANAGER", workingDays: "2", reason: "Synthetic study leave presentation request" },
    create: { id: "40000000-0000-4000-8000-000000000001", employeeId: rebecca.id, leaveTypeId: study.id, startDate: new Date("2026-11-23T00:00:00.000Z"), endDate: new Date("2026-11-24T00:00:00.000Z"), halfDayPeriod: "FULL", workingDays: "2", reason: "Synthetic study leave presentation request", status: "PENDING_MANAGER" },
  });
  await prisma.attendanceCorrectionRequest.upsert({
    where: { id: "40000000-0000-4000-8000-000000000002" },
    update: { reason: "Synthetic missed check-out presentation request", status: "PENDING" },
    create: { id: "40000000-0000-4000-8000-000000000002", employeeId: fiona.id, workDate: new Date("2026-11-17T00:00:00.000Z"), requestedCheckInAt: new Date("2026-11-17T05:00:00.000Z"), requestedCheckOutAt: new Date("2026-11-17T14:00:00.000Z"), reason: "Synthetic missed check-out presentation request", status: "PENDING" },
  });

  const holidays = [
    ["2026-01-01","New Year's Day"],["2026-01-26","NRM Liberation Day"],["2026-02-16","Janani Luwum Day"],
    ["2026-03-08","International Women's Day"],["2026-04-03","Good Friday"],["2026-04-06","Easter Monday"],
    ["2026-05-01","Labour Day"],["2026-06-03","Uganda Martyrs' Day"],["2026-06-09","National Heroes' Day"],
    ["2026-10-09","Independence Day"],["2026-12-25","Christmas Day"],["2026-12-26","Boxing Day"],
  ] as const;
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "raymond.mugisha@example.invalid" } });
  for (const [date,name] of holidays) {
    await prisma.publicHoliday.upsert({
      where: { holidayDate: new Date(`${date}T00:00:00.000Z`) },
      update: { name, year: 2026, createdByUserId: admin.id },
      create: { holidayDate: new Date(`${date}T00:00:00.000Z`), name, year: 2026, createdByUserId: admin.id },
    });
  }

  const assets = [
    ["#AST-088","DEMO-MBP-088","MacBook Pro 16 M3 Pro","LAPTOP","15000000"],
    ["#AST-064","DEMO-T14-064","Lenovo ThinkPad T14 Gen 3","LAPTOP","6500000"],
    ["#AST-092","DEMO-DOCK-092","ThinkPad Dock","MONITOR","1200000"],
  ] as const;
  for (const [assetTag,serialNumber,name,category,purchase] of assets) {
    await prisma.asset.upsert({
      where: { assetTag },
      update: { serialNumber, name, category, condition: "GOOD", purchaseValueUgx: purchase },
      create: { assetTag, serialNumber, name, category, condition: "GOOD", purchaseValueUgx: purchase },
    });
  }
  const ast088 = await prisma.asset.findUniqueOrThrow({ where: { assetTag: "#AST-088" } });
  const assetOfficer = await prisma.user.findFirstOrThrow({ where: { role: "ASSET_OFFICER" } });
  await prisma.assetAssignment.upsert({
    where: { id: "30000000-0000-4000-8000-000000000088" },
    update: { assetId: ast088.id, employeeId: brian.id, issuedByUserId: assetOfficer.id, status: "PENDING_ACKNOWLEDGEMENT" },
    create: { id: "30000000-0000-4000-8000-000000000088", assetId: ast088.id, employeeId: brian.id, issuedByUserId: assetOfficer.id, status: "PENDING_ACKNOWLEDGEMENT" },
  });

  const denis = await prisma.employee.findUniqueOrThrow({ where: { employeeCode: "UG-EMP-0291" } });
  const ast064 = await prisma.asset.findUniqueOrThrow({ where: { assetTag: "#AST-064" } });
  const ast092 = await prisma.asset.findUniqueOrThrow({ where: { assetTag: "#AST-092" } });
  for (const asset of [ast064, ast092]) {
    await prisma.assetAssignment.upsert({
      where: { id: asset.assetTag === "#AST-064" ? "30000000-0000-4000-8000-000000000064" : "30000000-0000-4000-8000-000000000092" },
      update: { assetId: asset.id, employeeId: denis.id, issuedByUserId: assetOfficer.id, status: "ACKNOWLEDGED", acknowledgedAt: new Date("2026-11-01T09:00:00.000Z") },
      create: { id: asset.assetTag === "#AST-064" ? "30000000-0000-4000-8000-000000000064" : "30000000-0000-4000-8000-000000000092", assetId: asset.id, employeeId: denis.id, issuedByUserId: assetOfficer.id, status: "ACKNOWLEDGED", acknowledgedAt: new Date("2026-11-01T09:00:00.000Z") },
    });
  }
  await prisma.offboardingCase.upsert({
    where: { employeeId: denis.id },
    update: { exitType: "RESIGNATION", noticeDate: new Date("2026-10-30T00:00:00.000Z"), lastWorkingDay: new Date("2026-11-30T00:00:00.000Z"), exitReason: "Synthetic presentation exit", status: "IN_PROGRESS" },
    create: { employeeId: denis.id, exitType: "RESIGNATION", noticeDate: new Date("2026-10-30T00:00:00.000Z"), lastWorkingDay: new Date("2026-11-30T00:00:00.000Z"), exitReason: "Synthetic presentation exit", status: "IN_PROGRESS", initiatedByUserId: admin.id },
  });

  const hr = await prisma.user.findFirstOrThrow({ where: { role: "HR_MANAGER" } });
  const recruiter = await prisma.user.findFirstOrThrow({ where: { role: "RECRUITER" } });
  const requisition = await prisma.staffRequisition.upsert({
    where: { requisitionCode: "REQ-2026-042" },
    update: { status: "APPROVED", reviewedByUserId: hr.id, reviewedAt: new Date("2026-11-10T08:00:00.000Z") },
    create: { requisitionCode: "REQ-2026-042", requestedByUserId: michael.userId, departmentId: departments.get("FIN-OPS")!.id, jobTitle: "Senior Payroll Compliance Specialist", headcount: 1, employmentType: "FULL_TIME", justification: "Synthetic payroll compliance capacity requirement", targetStartDate: new Date("2027-01-01T00:00:00.000Z"), status: "APPROVED", reviewedByUserId: hr.id, reviewedAt: new Date("2026-11-10T08:00:00.000Z") },
  });
  const vacancy = await prisma.vacancy.upsert({
    where: { vacancyCode: "VAC-2026-042" },
    update: { title: "Senior Payroll Compliance Specialist", status: "PUBLISHED", closingAt: new Date("2026-11-28T20:59:00.000Z"), publishedByUserId: recruiter.id, publishedAt: new Date("2026-11-11T08:00:00.000Z") },
    create: { vacancyCode: "VAC-2026-042", requisitionId: requisition.id, publishedByUserId: recruiter.id, title: "Senior Payroll Compliance Specialist", location: "Kampala HQ", description: "Synthetic demo vacancy.", requirements: "Synthetic demo requirements.", closingAt: new Date("2026-11-28T20:59:00.000Z"), status: "PUBLISHED", publishedAt: new Date("2026-11-11T08:00:00.000Z") },
  });
  const application = await prisma.jobApplication.upsert({
    where: { applicationCode: "APP-DEMO-84920" },
    update: { status: "OFFER_ACCEPTED", applicantEmail: "amina.nabakooza@example.invalid", fullName: "Amina Florence Nabakooza" },
    create: { applicationCode: "APP-DEMO-84920", vacancyId: vacancy.id, fullName: "Amina Florence Nabakooza", applicantEmail: "amina.nabakooza@example.invalid", phone: "+25670084920", coverNote: "Synthetic accepted candidate.", cvStorageKey: "demo/applications/APP-DEMO-84920.pdf", cvOriginalFilename: "amina-nabakooza.pdf", cvMimeType: "application/pdf", status: "OFFER_ACCEPTED" },
  });
  await prisma.jobOffer.upsert({
    where: { applicationId: application.id },
    update: { status: "ACCEPTED", acceptedAt: new Date("2026-11-15T08:00:00.000Z"), approvedByUserId: hr.id, approvedAt: new Date("2026-11-12T08:00:00.000Z"), reportingManagerId: michael.id },
    create: { applicationId: application.id, preparedByUserId: recruiter.id, offeredJobTitle: "Senior Payroll Compliance Specialist", departmentId: departments.get("FIN-OPS")!.id, reportingManagerId: michael.id, offeredBaseSalaryUgx: "7500000", offeredAllowancesUgx: "0", proposedStartDate: new Date("2027-01-11T00:00:00.000Z"), offerExpiresAt: new Date("2026-12-15T20:59:00.000Z"), status: "ACCEPTED", approvedByUserId: hr.id, approvedAt: new Date("2026-11-12T08:00:00.000Z"), acceptedAt: new Date("2026-11-15T08:00:00.000Z") },
  });

  for (const date of ["2026-11-11","2026-11-12","2026-11-13","2026-11-16","2026-11-17"]) {
    await prisma.attendanceRecord.upsert({
      where: { employeeId_workDate: { employeeId: brian.id, workDate: new Date(`${date}T00:00:00.000Z`) } },
      update: { status: "PRESENT_ON_TIME", checkInAt: new Date(`${date}T05:04:00.000Z`), checkOutAt: new Date(`${date}T14:00:00.000Z`), workedMinutes: 536, isManualCorrection: false },
      create: { employeeId: brian.id, workDate: new Date(`${date}T00:00:00.000Z`), scheduleId: schedule.id, status: "PRESENT_ON_TIME", checkInAt: new Date(`${date}T05:04:00.000Z`), checkOutAt: new Date(`${date}T14:00:00.000Z`), workedMinutes: 536, isManualCorrection: false },
    });
  }

  const payrollOfficer = await prisma.user.findFirstOrThrow({ where: { role: "PAYROLL_OFFICER" } });
  let policy = await prisma.statutoryTaxPolicy.findFirst({ where: { policyName: "StaffHub Synthetic Uganda Demo FY 2026/27" } });
  if (!policy) {
    policy = await prisma.statutoryTaxPolicy.create({
      data: { policyName: "StaffHub Synthetic Uganda Demo FY 2026/27", effectiveFrom: new Date("2026-07-01T00:00:00.000Z"), nssfEmployeeRate: "0.05", nssfEmployerRate: "0.10", payeResidentBrackets: [], payeNonResidentBrackets: [], lstTiers: [], lstCollectionMonths: [10], reviewStatus: "DRAFT", legalSourceReference: "Synthetic demo fixture - not legal or production policy", approvedByUserId: null, approvedAt: null, createdByUserId: payrollOfficer.id },
    });
  }
  const attendanceLock = await prisma.attendancePeriodLock.upsert({
    where: { year_month: { year: 2026, month: 10 } },
    update: { lockedByUserId: payrollOfficer.id },
    create: { year: 2026, month: 10, lockedByUserId: payrollOfficer.id },
  });
  const payrollRun = await prisma.payrollRun.upsert({
    where: { year_month: { year: 2026, month: 10 } },
    update: { status: "DRAFT", lockedByUserId: null, lockedAt: null, approvedByUserId: null, approvedAt: null },
    create: { runCode: "PR-UG-2026-10-DEMO", year: 2026, month: 10, policyId: policy.id, attendanceLockId: attendanceLock.id, status: "DRAFT", preparedByUserId: payrollOfficer.id },
  });
  const payrollItem = await prisma.payrollItem.upsert({
    where: { payrollRunId_employeeId: { payrollRunId: payrollRun.id, employeeId: brian.id } },
    update: { baseSalaryUgx: "4200000", allowancesUgx: "650000", grossPayUgx: "4850000", nssfEmployeeUgx: "242500", nssfEmployerUgx: "485000", payeUgx: "1343250", lstUgx: "25000", netPayUgx: "3239250" },
    create: { payrollRunId: payrollRun.id, employeeId: brian.id, workingDaysInMonth: 22, daysPresent: 22, baseSalaryUgx: "4200000", allowancesUgx: "650000", grossPayUgx: "4850000", nssfEmployeeUgx: "242500", nssfEmployerUgx: "485000", payeUgx: "1343250", lstUgx: "25000", netPayUgx: "3239250" },
  });
  await prisma.payslip.upsert({
    where: { payrollItemId: payrollItem.id },
    update: { generationStatus: "PENDING" },
    create: { payrollItemId: payrollItem.id, payslipNumber: "PAY-202610-0412-DEMO", verificationCode: "DEMO2026100412", generationStatus: "PENDING" },
  });
  await prisma.payrollRun.update({
    where: { id: payrollRun.id },
    data: { status: "LOCKED", lockedByUserId: payrollOfficer.id, lockedAt: new Date("2026-11-01T08:00:00.000Z"), approvedByUserId: hr.id, approvedAt: new Date("2026-11-01T07:00:00.000Z") },
  });

  const firstEmail = users[0][1];
  const stored = await prisma.user.findUniqueOrThrow({ where: { id: users[0][0] } });
  if (!(await verifyPassword(credentials[firstEmail], stored.passwordHash))) throw new Error("Password verification failed");
  console.log("StaffHub isolated demo seed completed; plaintext passwords and precomputed hashes are absent from source.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Demo seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
