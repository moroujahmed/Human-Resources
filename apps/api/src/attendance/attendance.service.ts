import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type {
  AttendanceCorrectionCreate,
  AttendancePeriodLock,
} from "@staffhub/shared";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma.service";

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private eatNow(): Date {
    return new Date(Date.now() + 3 * 60 * 60 * 1000);
  }

  private eatDateString(now: Date = this.eatNow()): string {
    return now.toISOString().slice(0, 10);
  }

  private eatDateStart(now: Date = this.eatNow()): Date {
    return new Date(`${this.eatDateString(now)}T00:00:00.000Z`);
  }

  private async selfEmployee(user: AuthenticatedUser) {
    if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
    const employee = await this.prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: { workSchedule: true },
    });
    if (!employee) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
    return employee;
  }

  async today(user: AuthenticatedUser): Promise<Record<string, unknown>> {
    const employee = await this.selfEmployee(user);
    const nowEat = this.eatNow();
    const workDate = this.eatDateStart(nowEat);
    const isoWeekday = workDate.getUTCDay() === 0 ? 7 : workDate.getUTCDay();
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    });
    const holiday = await this.prisma.publicHoliday.findUnique({ where: { holidayDate: workDate } });
    const approvedLeave = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: "APPROVED",
        startDate: { lte: workDate },
        endDate: { gte: workDate },
      },
    });
    const scheduled = !holiday && employee.workSchedule.workingDaysBitmap.includes(isoWeekday);
    let allowedButtonState = "NOT_SCHEDULED";
    if (scheduled && approvedLeave) allowedButtonState = "ON_APPROVED_LEAVE";
    else if (scheduled && record?.checkInAt && record.checkOutAt) allowedButtonState = "COMPLETED";
    else if (scheduled && record?.checkInAt) allowedButtonState = "CAN_CHECK_OUT";
    else if (scheduled) allowedButtonState = "CAN_CHECK_IN";
    return {
      nowEat: nowEat.toISOString(),
      workDate: this.eatDateString(nowEat),
      workSchedule: employee.workSchedule,
      attendanceRecord: record,
      approvedLeave: approvedLeave ? { id: approvedLeave.id, halfDayPeriod: approvedLeave.halfDayPeriod } : null,
      allowedButtonState,
    };
  }

  async checkIn(user: AuthenticatedUser, idempotencyKey: string | undefined): Promise<Record<string, unknown>> {
    if (!idempotencyKey) throw new UnprocessableEntityException("IDEMPOTENCY_KEY_REQUIRED");
    const employee = await this.selfEmployee(user);
    const nowEat = this.eatNow();
    const workDate = this.eatDateStart(nowEat);
    const isoWeekday = workDate.getUTCDay() === 0 ? 7 : workDate.getUTCDay();
    if (!employee.workSchedule.workingDaysBitmap.includes(isoWeekday)) {
      throw new UnprocessableEntityException("NOT_SCHEDULED");
    }
    const holiday = await this.prisma.publicHoliday.findUnique({ where: { holidayDate: workDate } });
    if (holiday) throw new UnprocessableEntityException("NOT_SCHEDULED");
    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: "APPROVED",
        startDate: { lte: workDate },
        endDate: { gte: workDate },
      },
    });
    if (leave) throw new UnprocessableEntityException("ATTENDANCE_CONFLICT");

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    });
    if (existing?.checkInAt) throw new ConflictException("ALREADY_CHECKED_IN");

    const shiftMinutes = employee.workSchedule.shiftStartTime.getUTCHours() * 60
      + employee.workSchedule.shiftStartTime.getUTCMinutes();
    const actualMinutes = nowEat.getUTCHours() * 60 + nowEat.getUTCMinutes();
    let status: "PRESENT_ON_TIME" | "PRESENT_GRACE" | "LATE";
    if (actualMinutes <= shiftMinutes) status = "PRESENT_ON_TIME";
    else if (actualMinutes <= shiftMinutes + employee.workSchedule.gracePeriodMinutes) status = "PRESENT_GRACE";
    else status = "LATE";

    const checkInAt = new Date();
    const record = existing
      ? await this.prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: { checkInAt, status, isManualCorrection: false },
        })
      : await this.prisma.attendanceRecord.create({
          data: {
            employeeId: employee.id,
            workDate,
            scheduleId: employee.workScheduleId,
            checkInAt,
            status,
          },
        });
    await this.prisma.idempotencyKey.upsert({
      where: {
        userId_endpoint_key: {
          userId: user.id,
          endpoint: "/attendance/check-in",
          key: idempotencyKey,
        },
      },
      update: {},
      create: {
        key: idempotencyKey,
        userId: user.id,
        endpoint: "/attendance/check-in",
        requestHash: createHash("sha256").update(JSON.stringify({ employeeId: employee.id, workDate })).digest("hex"),
        responseStatus: 201,
        responseBody: record as object,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return record;
  }

  async checkOut(user: AuthenticatedUser): Promise<Record<string, unknown>> {
    const employee = await this.selfEmployee(user);
    const workDate = this.eatDateStart();
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    });
    if (!record?.checkInAt) throw new UnprocessableEntityException("MUST_CHECK_IN_FIRST");
    if (record.checkOutAt) throw new ConflictException("ALREADY_CHECKED_OUT");
    const checkOutAt = new Date();
    if (checkOutAt < record.checkInAt) throw new UnprocessableEntityException("INVALID_CHECKOUT_TIME");
    const workedMinutes = Math.max(0, Math.floor((checkOutAt.getTime() - record.checkInAt.getTime()) / 60000));
    return this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { checkOutAt, workedMinutes },
    });
  }

  async records(
    user: AuthenticatedUser,
    from: string | undefined,
    to: string | undefined,
    employeeId: string | undefined,
  ): Promise<Record<string, unknown>[]> {
    let targetEmployeeId = employeeId;
    if (user.role === "EMPLOYEE" || (!targetEmployeeId && user.employeeId)) {
      targetEmployeeId = user.employeeId ?? undefined;
    }
    if (!targetEmployeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
    if (user.role === "LINE_MANAGER") {
      const target = await this.prisma.employee.findUnique({ where: { id: targetEmployeeId }, select: { managerId: true } });
      if (!target || target.managerId !== user.employeeId) throw new ForbiddenException("FORBIDDEN_SCOPE");
    } else if (
      user.role !== "HR_MANAGER"
      && user.role !== "SYSTEM_ADMIN"
      && user.role !== "EMPLOYEE"
      && !(user.role === "PAYROLL_OFFICER" && targetEmployeeId)
    ) {
      throw new ForbiddenException("FORBIDDEN_SCOPE");
    }
    return this.prisma.attendanceRecord.findMany({
      where: {
        employeeId: targetEmployeeId,
        ...(from ? { workDate: { gte: new Date(`${from}T00:00:00.000Z`) } } : {}),
        ...(to ? { workDate: { lte: new Date(`${to}T00:00:00.000Z`) } } : {}),
      },
      orderBy: { workDate: "desc" },
    });
  }

  async corrections(user: AuthenticatedUser): Promise<Record<string, unknown>[]> {
    if (user.role === "HR_MANAGER" || user.role === "SYSTEM_ADMIN") {
      return this.prisma.attendanceCorrectionRequest.findMany({ orderBy: { createdAt: "desc" } });
    }
    if (user.role === "LINE_MANAGER") {
      return this.prisma.attendanceCorrectionRequest.findMany({
        where: { employee: { managerId: user.employeeId ?? undefined } },
        orderBy: { createdAt: "desc" },
      });
    }
    if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
    return this.prisma.attendanceCorrectionRequest.findMany({
      where: { employeeId: user.employeeId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createCorrection(
    user: AuthenticatedUser,
    input: AttendanceCorrectionCreate,
  ): Promise<Record<string, unknown>> {
    const employee = await this.selfEmployee(user);
    const workDate = new Date(`${input.workDate}T00:00:00.000Z`);
    const lock = await this.prisma.attendancePeriodLock.findUnique({
      where: { year_month: { year: workDate.getUTCFullYear(), month: workDate.getUTCMonth() + 1 } },
    });
    if (lock) throw new ConflictException("ATTENDANCE_PERIOD_LOCKED");
    return this.prisma.attendanceCorrectionRequest.create({
      data: {
        employeeId: employee.id,
        workDate,
        requestedCheckInAt: new Date(input.requestedCheckInAt),
        requestedCheckOutAt: input.requestedCheckOutAt ? new Date(input.requestedCheckOutAt) : null,
        reason: input.reason,
      },
    });
  }

  async decideCorrection(
    user: AuthenticatedUser,
    correctionId: string,
    approve: boolean,
    reason?: string,
  ): Promise<Record<string, unknown>> {
    if (!approve && !reason?.trim()) throw new UnprocessableEntityException("REASON_REQUIRED");
    const correction = await this.prisma.attendanceCorrectionRequest.findUnique({
      where: { id: correctionId },
      include: { employee: true },
    });
    if (!correction) throw new NotFoundException("ATTENDANCE_CORRECTION_NOT_FOUND");
    if (correction.employee.userId === user.id) throw new ForbiddenException("SELF_APPROVAL_FORBIDDEN");
    if (user.role === "LINE_MANAGER" && correction.employee.managerId !== user.employeeId) {
      throw new ForbiddenException("FORBIDDEN_SCOPE");
    }
    if (user.role !== "LINE_MANAGER" && user.role !== "HR_MANAGER") throw new ForbiddenException("FORBIDDEN");

    if (!approve) {
      return this.prisma.attendanceCorrectionRequest.update({
        where: { id: correctionId },
        data: {
          status: "REJECTED",
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
          decisionReason: reason?.trim(),
        },
      });
    }

    const workDate = correction.workDate;
    const employee = await this.prisma.employee.findUnique({
      where: { id: correction.employeeId },
      include: { workSchedule: true },
    });
    if (!employee) throw new NotFoundException("EMPLOYEE_NOT_FOUND");
    const shiftMinutes = employee.workSchedule.shiftStartTime.getUTCHours() * 60
      + employee.workSchedule.shiftStartTime.getUTCMinutes();
    const actualMinutes = correction.requestedCheckInAt.getUTCHours() * 60
      + correction.requestedCheckInAt.getUTCMinutes();
    let status: "PRESENT_ON_TIME" | "PRESENT_GRACE" | "LATE";
    if (actualMinutes <= shiftMinutes) status = "PRESENT_ON_TIME";
    else if (actualMinutes <= shiftMinutes + employee.workSchedule.gracePeriodMinutes) status = "PRESENT_GRACE";
    else status = "LATE";
    const checkOutAt = correction.requestedCheckOutAt;
    if (checkOutAt && checkOutAt < correction.requestedCheckInAt) {
      throw new UnprocessableEntityException("INVALID_CHECKOUT_TIME");
    }
    const workedMinutes = checkOutAt
      ? Math.max(0, Math.floor((checkOutAt.getTime() - correction.requestedCheckInAt.getTime()) / 60000))
      : null;
    await this.prisma.$transaction([
      this.prisma.attendanceRecord.upsert({
        where: { employeeId_workDate: { employeeId: correction.employeeId, workDate } },
        update: {
          checkInAt: correction.requestedCheckInAt,
          checkOutAt,
          workedMinutes,
          status,
          isManualCorrection: true,
          notes: correction.reason,
        },
        create: {
          employeeId: correction.employeeId,
          workDate,
          scheduleId: employee.workScheduleId,
          checkInAt: correction.requestedCheckInAt,
          checkOutAt,
          workedMinutes,
          status,
          isManualCorrection: true,
          notes: correction.reason,
        },
      }),
      this.prisma.attendanceCorrectionRequest.update({
        where: { id: correctionId },
        data: { status: "APPROVED", reviewedByUserId: user.id, reviewedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "ATTENDANCE_CORRECTION_APPROVED",
          entityType: "AttendanceCorrectionRequest",
          entityId: correctionId,
          checksumSha256: createHash("sha256")
            .update(`ATTENDANCE_CORRECTION_APPROVED:${correctionId}:${new Date().toISOString()}`)
            .digest("hex"),
        },
      }),
    ]);
    return this.prisma.attendanceCorrectionRequest.findUniqueOrThrow({ where: { id: correctionId } });
  }

  async periodLocks(user: AuthenticatedUser): Promise<Record<string, unknown>[]> {
    if (user.role !== "HR_MANAGER" && user.role !== "PAYROLL_OFFICER" && user.role !== "SYSTEM_ADMIN") {
      throw new ForbiddenException("FORBIDDEN");
    }
    return this.prisma.attendancePeriodLock.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }] });
  }

  async lockPeriod(user: AuthenticatedUser, input: AttendancePeriodLock): Promise<Record<string, unknown>> {
    if (user.role !== "HR_MANAGER" && user.role !== "PAYROLL_OFFICER" && user.role !== "SYSTEM_ADMIN") {
      throw new ForbiddenException("FORBIDDEN");
    }
    const eatNow = this.eatNow();
    const currentYear = eatNow.getUTCFullYear();
    const currentMonth = eatNow.getUTCMonth() + 1;
    if (input.year > currentYear || (input.year === currentYear && input.month >= currentMonth)) {
      throw new UnprocessableEntityException("ATTENDANCE_PERIOD_NOT_CLOSED");
    }
    const pendingCorrections = await this.prisma.attendanceCorrectionRequest.count({
      where: {
        status: "PENDING",
        workDate: {
          gte: new Date(`${input.year}-${String(input.month).padStart(2, "0")}-01T00:00:00.000Z`),
          lte: new Date(`${input.year}-${String(input.month).padStart(2, "0")}-31T23:59:59.999Z`),
        },
      },
    });
    if (pendingCorrections > 0) throw new ConflictException("PENDING_ATTENDANCE_CORRECTIONS");
    return this.prisma.attendancePeriodLock.upsert({
      where: { year_month: { year: input.year, month: input.month } },
      update: { lockedByUserId: user.id },
      create: { year: input.year, month: input.month, lockedByUserId: user.id },
    });
  }
}
