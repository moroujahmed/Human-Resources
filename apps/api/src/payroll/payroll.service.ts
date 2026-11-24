import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  private requireOfficer(user: AuthenticatedUser): void {
    if (user.role !== "PAYROLL_OFFICER" && user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") {
      throw new ForbiddenException("FORBIDDEN");
    }
  }

  private requireVerifiedCalculator(): void {
    // The current implementation has demonstration arithmetic only. Do not let a
    // synthetic or unreviewed policy turn that arithmetic into an apparent payroll.
    throw new UnprocessableEntityException("PAYROLL_CALCULATOR_NOT_CONFIGURED");
  }

  async runs(user: AuthenticatedUser) {
    this.requireOfficer(user);
    return this.prisma.payrollRun.findMany({
      include: { policy: true, attendanceLock: true, items: true },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  async run(user: AuthenticatedUser, id: string) {
    this.requireOfficer(user);
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: { policy: true, attendanceLock: true, items: { include: { employee: true, payslip: true } } },
    });
    if (!run) throw new NotFoundException("PAYROLL_RUN_NOT_FOUND");
    return run;
  }

  async prepare(user: AuthenticatedUser, year: number, month: number, idempotencyKey: string | undefined) {
    if (user.role !== "PAYROLL_OFFICER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
    this.requireVerifiedCalculator();
    if (!idempotencyKey) throw new UnprocessableEntityException("IDEMPOTENCY_KEY_REQUIRED");
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new UnprocessableEntityException("INVALID_PAYROLL_PERIOD");
    }
    const existing = await this.prisma.payrollRun.findUnique({ where: { year_month: { year, month } } });
    if (existing) return existing;

    const attendanceLock = await this.prisma.attendancePeriodLock.findUnique({
      where: { year_month: { year, month } },
    });
    if (!attendanceLock) throw new ConflictException("ATTENDANCE_PERIOD_NOT_LOCKED");

    const periodEnd = new Date(`${year}-${String(month).padStart(2, "0")}-28T23:59:59.999Z`);
    const policy = await this.prisma.statutoryTaxPolicy.findFirst({
      where: {
        reviewStatus: "APPROVED",
        effectiveFrom: { lte: periodEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodEnd } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!policy) throw new UnprocessableEntityException("APPROVED_TAX_POLICY_REQUIRED");

    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          runCode: `PR-UG-${year}-${String(month).padStart(2, "0")}-${randomUUID().slice(0, 8).toUpperCase()}`,
          year,
          month,
          policyId: policy.id,
          attendanceLockId: attendanceLock.id,
          status: "DRAFT",
          preparedByUserId: user.id,
        },
      });
      const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`);
      const employees = await tx.employee.findMany({
        where: {
          hireDate: { lte: periodEnd },
          OR: [{ lastWorkingDay: null }, { lastWorkingDay: { gte: monthStart } }],
        },
      });
      for (const employee of employees) {
        const baseSalary = Number(employee.baseSalaryUgx);
        const allowances = Number(employee.recurringAllowancesUgx);
        const gross = baseSalary + allowances;
        const nssfEmployee = Math.round(gross * 0.05);
        const nssfEmployer = Math.round(gross * 0.10);
        const paye = employee.taxResidency === "RESIDENT" ? 0 : Math.round(gross * 0.15);
        const net = Math.max(0, gross - nssfEmployee - paye);
        await tx.payrollItem.create({
          data: {
            payrollRunId: run.id,
            employeeId: employee.id,
            workingDaysInMonth: 22,
            daysPresent: 22,
            baseSalaryUgx: baseSalary.toFixed(2),
            allowancesUgx: allowances.toFixed(2),
            grossPayUgx: gross.toFixed(2),
            nssfEmployeeUgx: nssfEmployee.toFixed(2),
            nssfEmployerUgx: nssfEmployer.toFixed(2),
            payeUgx: paye.toFixed(2),
            lstUgx: "0",
            netPayUgx: net.toFixed(2),
          },
        });
      }
      await tx.idempotencyKey.upsert({
        where: {
          userId_endpoint_key: { userId: user.id, endpoint: "/payroll/runs", key: idempotencyKey },
        },
        update: {},
        create: {
          key: idempotencyKey,
          userId: user.id,
          endpoint: "/payroll/runs",
          requestHash: createHash("sha256").update(`${year}-${month}`).digest("hex"),
          responseStatus: 201,
          responseBody: { id: run.id },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return run;
    });
  }

  async updateItem(user: AuthenticatedUser, runId: string, itemId: string, body: unknown) {
    if (user.role !== "PAYROLL_OFFICER") throw new ForbiddenException("FORBIDDEN");
    this.requireVerifiedCalculator();
    const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException("PAYROLL_RUN_NOT_FOUND");
    if (run.status !== "DRAFT") throw new ConflictException("PAYROLL_LOCKED");
    const input = body as { bonusOrArrearsUgx?: number; otherDeductionsUgx?: number; notes?: string };
    if (input.bonusOrArrearsUgx !== undefined && input.bonusOrArrearsUgx < 0) throw new UnprocessableEntityException("INVALID_DEDUCTION");
    if (input.otherDeductionsUgx !== undefined && input.otherDeductionsUgx < 0) throw new UnprocessableEntityException("INVALID_DEDUCTION");
    return this.prisma.payrollItem.update({
      where: { id: itemId },
      data: {
        ...(input.bonusOrArrearsUgx !== undefined ? { bonusOrArrearsUgx: input.bonusOrArrearsUgx.toFixed(2) } : {}),
        ...(input.otherDeductionsUgx !== undefined ? { otherDeductionsUgx: input.otherDeductionsUgx.toFixed(2) } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  }

  async submit(user: AuthenticatedUser, id: string) {
    if (user.role !== "PAYROLL_OFFICER") throw new ForbiddenException("FORBIDDEN");
    this.requireVerifiedCalculator();
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException("PAYROLL_RUN_NOT_FOUND");
    if (run.status !== "DRAFT") throw new ConflictException("INVALID_PAYROLL_STATE");
    return this.prisma.payrollRun.update({ where: { id }, data: { status: "PENDING_APPROVAL", submittedAt: new Date(), version: { increment: 1 } } });
  }

  async approve(user: AuthenticatedUser, id: string) {
    if (user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
    this.requireVerifiedCalculator();
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException("PAYROLL_RUN_NOT_FOUND");
    if (run.status !== "PENDING_APPROVAL") throw new ConflictException("INVALID_PAYROLL_STATE");
    if (run.preparedByUserId === user.id) throw new ForbiddenException("SELF_APPROVAL_FORBIDDEN");
    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: "APPROVED", approvedByUserId: user.id, approvedAt: new Date(), version: { increment: 1 } },
    });
  }

  async lock(user: AuthenticatedUser, id: string, idempotencyKey: string | undefined) {
    if (user.role !== "PAYROLL_OFFICER" && user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
    this.requireVerifiedCalculator();
    if (!idempotencyKey) throw new UnprocessableEntityException("IDEMPOTENCY_KEY_REQUIRED");
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: { items: { include: { employee: true } } },
    });
    if (!run) throw new NotFoundException("PAYROLL_RUN_NOT_FOUND");
    if (run.status !== "APPROVED") throw new ConflictException("INVALID_PAYROLL_STATE");
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.payrollRun.update({
        where: { id },
        data: { status: "LOCKED", lockedByUserId: user.id, lockedAt: new Date(), version: { increment: 1 } },
      });
      for (const item of run.items) {
        await tx.payslip.upsert({
          where: { payrollItemId: item.id },
          update: {},
          create: {
            payrollItemId: item.id,
            payslipNumber: `PAY-${run.year}${String(run.month).padStart(2, "0")}-${item.employee.employeeCode}-DEMO`,
            verificationCode: `VERIFY-${randomUUID().replace(/-/g, "").slice(0, 28).toUpperCase()}`,
            generationStatus: "PENDING",
          },
        });
      }
      return locked;
    });
  }

  async myPayslips(user: AuthenticatedUser) {
    if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
    return this.prisma.payslip.findMany({
      where: { payrollItem: { employeeId: user.employeeId, payrollRun: { status: "LOCKED" } } },
      include: { payrollItem: { include: { payrollRun: true } } },
      orderBy: { publishedAt: "desc" },
    });
  }

  async loans(user: AuthenticatedUser) {
    if (user.role === "EMPLOYEE") {
      if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      return this.prisma.staffLoan.findMany({ where: { employeeId: user.employeeId }, orderBy: { createdAt: "desc" } });
    }
    if (!["PAYROLL_OFFICER", "HR_MANAGER", "SYSTEM_ADMIN"].includes(user.role)) throw new ForbiddenException("FORBIDDEN");
    return this.prisma.staffLoan.findMany({ orderBy: { createdAt: "desc" } });
  }
}
