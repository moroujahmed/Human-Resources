import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { AdminUserCreateSchema, PublicHolidayCreateSchema, UserRoleUpdateSchema, WorkScheduleCreateSchema } from "@staffhub/shared";
import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private requireAdmin(user: AuthenticatedUser): void {
    if (user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
  }

  private auditChecksum(action: string, entityId: string): string {
    return createHash("sha256").update(`${action}:${entityId}:${new Date().toISOString()}`).digest("hex");
  }

  async users(user: AuthenticatedUser) {
    this.requireAdmin(user);
    return this.prisma.user.findMany({
      select: {
        id: true, email: true, role: true, isActive: true, mustChangePassword: true,
        failedLoginAttempts: true, authzVersion: true, lockedUntil: true,
        lastLoginAt: true, deactivatedAt: true, createdAt: true,
        employee: { select: { id: true, employeeCode: true, legalName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createUser(user: AuthenticatedUser, body: unknown) {
    this.requireAdmin(user);
    const input = AdminUserCreateSchema.parse(body);
    const password = input.password ?? randomBytes(24).toString("base64url");
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email: input.email, passwordHash, role: input.role, mustChangePassword: true },
          select: { id: true, email: true, role: true, mustChangePassword: true, isActive: true },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            actorRole: user.role,
            action: "ADMIN_USER_CREATED",
            entityType: "User",
            entityId: created.id,
            checksumSha256: this.auditChecksum("ADMIN_USER_CREATED", created.id),
          },
        });
        return { ...created, ...(input.password ? {} : { temporaryPassword: password }) };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new ConflictException("EMAIL_ALREADY_EXISTS");
      }
      throw error;
    }
  }

  async updateRole(user: AuthenticatedUser, id: string, body: unknown) {
    this.requireAdmin(user);
    const input = UserRoleUpdateSchema.parse(body);
    if (id === user.id) throw new ForbiddenException("CANNOT_CHANGE_OWN_ROLE");
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException("USER_NOT_FOUND");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { role: input.role, authzVersion: { increment: 1 } },
        select: { id: true, email: true, role: true, isActive: true, authzVersion: true },
      });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "ADMIN_USER_ROLE_CHANGED",
          entityType: "User",
          entityId: id,
          oldValues: { role: target.role },
          newValues: { role: updated.role },
          checksumSha256: this.auditChecksum("ADMIN_USER_ROLE_CHANGED", id),
        },
      });
      return updated;
    });
  }

  departments() {
    return this.prisma.department.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } });
  }

  schedules() {
    return this.prisma.workSchedule.findMany({ orderBy: { name: "asc" } });
  }

  async createSchedule(user: AuthenticatedUser, body: unknown) {
    if (user.role !== "SYSTEM_ADMIN" && user.role !== "HR_MANAGER") throw new ForbiddenException("FORBIDDEN");
    const input = WorkScheduleCreateSchema.parse(body);
    return this.prisma.workSchedule.create({
      data: {
        name: input.name,
        shiftStartTime: new Date(`1970-01-01T${input.shiftStartTime}:00.000Z`),
        shiftEndTime: new Date(`1970-01-01T${input.shiftEndTime}:00.000Z`),
        gracePeriodMinutes: input.gracePeriodMinutes ?? 15,
        workingDaysBitmap: input.workingDaysBitmap ?? [1, 2, 3, 4, 5],
        isDefault: input.isDefault ?? false,
      },
    });
  }

  holidays() {
    return this.prisma.publicHoliday.findMany({ orderBy: { holidayDate: "asc" } });
  }

  async createHoliday(user: AuthenticatedUser, body: unknown) {
    if (user.role !== "SYSTEM_ADMIN" && user.role !== "HR_MANAGER") throw new ForbiddenException("FORBIDDEN");
    const input = PublicHolidayCreateSchema.parse(body);
    const date = new Date(`${input.holidayDate}T00:00:00.000Z`);
    return this.prisma.publicHoliday.upsert({
      where: { holidayDate: date },
      update: { name: input.name, year: date.getUTCFullYear(), createdByUserId: user.id },
      create: { holidayDate: date, name: input.name, year: date.getUTCFullYear(), createdByUserId: user.id },
    });
  }

  async audit(
    user: AuthenticatedUser,
    filters: { from?: string; to?: string; actorId?: string; action?: string; entityType?: string },
  ) {
    if (!["SYSTEM_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER"].includes(user.role)) throw new ForbiddenException("FORBIDDEN");
    const parseDate = (value: string | undefined, end: boolean): Date | undefined => {
      if (!value) return undefined;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException("INVALID_AUDIT_DATE");
      const date = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException("INVALID_AUDIT_DATE");
      return new Date(date.valueOf() - 3 * 60 * 60 * 1000 + (end ? 24 * 60 * 60 * 1000 - 1 : 0));
    };
    const start = parseDate(filters.from, false);
    const end = parseDate(filters.to, true);
    if (start && end && start > end) throw new BadRequestException("INVALID_AUDIT_DATE_RANGE");
    if (filters.actorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filters.actorId)) {
      throw new BadRequestException("INVALID_ACTOR_ID");
    }
    const allowedEntityTypes = user.role === "HR_MANAGER"
      ? ["Employee", "Department", "LeaveRequest", "AttendanceCorrectionRequest", "Requisition", "Vacancy", "JobApplication", "JobOffer", "OffboardingCase", "Asset", "AssetAssignment"]
      : user.role === "PAYROLL_OFFICER"
        ? ["PayrollRun", "PayrollItem", "Payslip", "StaffLoan", "AttendancePeriodLock"]
        : undefined;
    const entityFilter: Prisma.AuditLogWhereInput["entityType"] = allowedEntityTypes
      ? filters.entityType
        ? { in: allowedEntityTypes, equals: filters.entityType.slice(0, 60) }
        : { in: allowedEntityTypes }
      : filters.entityType?.slice(0, 60);
    const where: Prisma.AuditLogWhereInput = {
      ...(start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}),
      ...(filters.actorId ? { actorUserId: filters.actorId } : {}),
      ...(filters.action ? { action: { contains: filters.action.slice(0, 80), mode: "insensitive" } } : {}),
      ...(entityFilter ? { entityType: entityFilter } : {}),
    };
    return this.prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  notifications(user: AuthenticatedUser) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async readNotification(user: AuthenticatedUser, id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException("NOTIFICATION_NOT_FOUND");
    if (notification.userId !== user.id) throw new ForbiddenException("FORBIDDEN_SCOPE");
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async runInternalJob(secret: string | undefined, job: string) {
    const sharedSecret = process.env.CRON_SHARED_SECRET;
    if (!sharedSecret || secret !== sharedSecret) throw new UnauthorizedException("INVALID_CRON_SECRET");
    if (job === "reconcile-attendance") {
      return this.reconcileAttendance();
    }
    if (job === "process-daily-transitions") {
      const now = new Date();
      const closedVacancies = await this.prisma.vacancy.updateMany({
        where: { status: "PUBLISHED", closingAt: { lt: new Date() } },
        data: { status: "CLOSED" },
      });
      const expiredOffers = await this.prisma.jobOffer.updateMany({
        where: { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT"] }, offerExpiresAt: { lte: now } },
        data: { status: "EXPIRED", responseTokenHash: null, version: { increment: 1 } },
      });
      const shiftedDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      const todayEat = new Date(`${shiftedDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
      const dueCases = await this.prisma.offboardingCase.findMany({
        where: { status: { in: ["IN_PROGRESS", "CLEARED"] }, deactivatedAt: null, lastWorkingDay: { lt: todayEat } },
        include: { employee: { select: { id: true, userId: true } } },
      });
      let deactivated = 0;
      for (const exitCase of dueCases) {
        const result = await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.offboardingCase.updateMany({
            where: { id: exitCase.id, status: { in: ["IN_PROGRESS", "CLEARED"] }, deactivatedAt: null },
            data: { deactivatedAt: now },
          });
          if (claimed.count !== 1) return false;
          await tx.user.updateMany({
            where: { id: exitCase.employee.userId, isActive: true },
            data: { isActive: false, deactivatedAt: now, authzVersion: { increment: 1 } },
          });
          await tx.refreshToken.updateMany({ where: { userId: exitCase.employee.userId, revokedAt: null }, data: { revokedAt: now } });
          await tx.employee.updateMany({ where: { id: exitCase.employee.id, status: "OFFBOARDING" }, data: { status: "EXITED" } });
          await tx.auditLog.create({
            data: {
              actorRole: "SYSTEM", action: "OFFBOARDING_ACCOUNT_DEACTIVATED",
              entityType: "OffboardingCase", entityId: exitCase.id,
              checksumSha256: this.auditChecksum("OFFBOARDING_ACCOUNT_DEACTIVATED", exitCase.id),
            },
          });
          return true;
        });
        if (result) deactivated += 1;
      }
      return { closedVacancies: closedVacancies.count, expiredOffers: expiredOffers.count, deactivatedEmployees: deactivated };
    }
    if (job === "rollover-leave-balances") {
      throw new NotImplementedException("LEAVE_ROLLOVER_POLICY_REQUIRED");
    }
    if (job === "process-async-outbox") {
      throw new NotImplementedException("OUTBOX_HANDLERS_NOT_CONFIGURED");
    }
    throw new NotFoundException("CRON_JOB_NOT_FOUND");
  }

  private async reconcileAttendance() {
    const today = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const date = new Date(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const holiday = await this.prisma.publicHoliday.findUnique({ where: { holidayDate: date } });
    const employees = await this.prisma.employee.findMany({
      where: {
        status: { in: ["ONBOARDING", "ACTIVE", "OFFBOARDING"] },
        hireDate: { lte: date },
        OR: [{ lastWorkingDay: null }, { lastWorkingDay: { gte: date } }],
      },
      include: { workSchedule: true },
    });
    let reconciled = 0;
    let flaggedMissedCheckouts = 0;
    const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    for (const employee of employees) {
      const workingDay = employee.workSchedule.workingDaysBitmap.includes(isoWeekday);
      const approvedLeave = await this.prisma.leaveRequest.findFirst({
        where: { employeeId: employee.id, status: "APPROVED", startDate: { lte: date }, endDate: { gte: date } },
        include: { leaveType: { select: { id: true } } },
      });
      const existing = await this.prisma.attendanceRecord.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: date } },
      });
      if (!existing) {
        const isHalfDay = approvedLeave?.halfDayPeriod !== undefined && approvedLeave.halfDayPeriod !== "FULL";
        const status = holiday ? "HOLIDAY" : !workingDay ? "DAY_OFF" : approvedLeave && !isHalfDay ? "ON_LEAVE" : "ABSENT";
        const inserted = await this.prisma.attendanceRecord.createMany({
          data: [{
            employeeId: employee.id, workDate: date, scheduleId: employee.workScheduleId,
            status,
            ...(approvedLeave && workingDay && !holiday ? {
              leaveRequestId: approvedLeave.id,
              leaveTypeId: approvedLeave.leaveType.id,
              leaveDays: isHalfDay ? "0.5" : "1",
            } : {}),
            ...(status === "ABSENT" ? { notes: "Auto-marked absent at end-of-day reconciliation" } : {}),
          }],
          skipDuplicates: true,
        });
        reconciled += inserted.count;
      } else if (existing.checkInAt && !existing.checkOutAt && !existing.notes?.includes("Missed check-out")) {
        await this.prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: { notes: `${existing.notes ? `${existing.notes} ` : ""}[Auto-flagged: Missed check-out]` },
        });
        flaggedMissedCheckouts += 1;
      }
    }
    return { reconciled, flaggedMissedCheckouts };
  }
}
