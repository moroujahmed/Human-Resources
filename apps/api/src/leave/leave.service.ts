import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { LeaveCalculate, LeaveCreate } from "@staffhub/shared";
import { PrismaService } from "../prisma.service";
import { LeaveCalculatorService } from "./leave-calculator.service";

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: LeaveCalculatorService,
  ) {}

  async types(): Promise<Record<string, unknown>[]> {
    return this.prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async balances(
    user: AuthenticatedUser,
    year: number | undefined,
    employeeId: string | undefined,
  ): Promise<Record<string, unknown>[]> {
    let targetEmployeeId = employeeId;
    if (user.role === "EMPLOYEE" || (!targetEmployeeId && user.employeeId)) {
      targetEmployeeId = user.employeeId ?? undefined;
    }
    if (!targetEmployeeId) throw new ForbiddenException("FORBIDDEN_SCOPE");

    if (user.role === "LINE_MANAGER") {
      const target = await this.prisma.employee.findUnique({
        where: { id: targetEmployeeId },
        select: { managerId: true },
      });
      if (!target || target.managerId !== user.employeeId) throw new ForbiddenException("FORBIDDEN_SCOPE");
    } else if (
      user.role !== "HR_MANAGER"
      && user.role !== "PAYROLL_OFFICER"
      && user.role !== "SYSTEM_ADMIN"
      && targetEmployeeId !== user.employeeId
    ) {
      throw new ForbiddenException("FORBIDDEN_SCOPE");
    }

    return this.prisma.leaveBalance.findMany({
      where: {
        employeeId: targetEmployeeId,
        ...(year ? { year } : {}),
      },
      include: { leaveType: { select: { code: true, name: true, isPaid: true } } },
      orderBy: [{ year: "asc" }, { leaveTypeId: "asc" }],
    });
  }

  async calculate(user: AuthenticatedUser, input: LeaveCalculate): Promise<Record<string, unknown>> {
    if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
    const employee = await this.prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: { workSchedule: true },
    });
    if (!employee) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        holidayDate: {
          gte: new Date(`${input.startDate}T00:00:00.000Z`),
          lte: new Date(`${input.endDate}T00:00:00.000Z`),
        },
      },
      select: { holidayDate: true, name: true },
    });
    const result = this.calculator.calculate(
      input.startDate,
      input.endDate,
      employee.workSchedule.workingDaysBitmap,
      holidays,
      input.halfDayPeriod,
    );
    return { ...result };
  }

  async requests(
    user: AuthenticatedUser,
    pendingMyApproval: boolean,
  ): Promise<Record<string, unknown>[]> {
    let where: Record<string, unknown> = {};
    if (user.role === "EMPLOYEE") {
      if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      where = { employeeId: user.employeeId };
    } else if (user.role === "LINE_MANAGER") {
      if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      where = { employee: { managerId: user.employeeId } };
    } else if (user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") {
      throw new ForbiddenException("FORBIDDEN_SCOPE");
    }
    if (pendingMyApproval) {
      if (user.role === "LINE_MANAGER") {
        where = { ...where, status: "PENDING_MANAGER" };
      } else if (user.role === "HR_MANAGER") {
        where = { ...where, status: "PENDING_HR" };
      }
    }
    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeCode: true, legalName: true, managerId: true } },
        leaveType: { select: { id: true, code: true, name: true, requiresHrApproval: true, hrApprovalThresholdDays: true } },
        yearAllocations: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async submit(
    user: AuthenticatedUser,
    input: LeaveCreate,
    idempotencyKey: string | undefined,
  ): Promise<Record<string, unknown>> {
    if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
    if (!idempotencyKey || !/^.{1,128}$/.test(idempotencyKey)) {
      throw new UnprocessableEntityException("IDEMPOTENCY_KEY_REQUIRED");
    }

    const requestHash = createHash("sha256")
      .update(JSON.stringify({ ...input, employeeId: user.employeeId }))
      .digest("hex");
    const existing = await this.prisma.idempotencyKey.findFirst({
      where: { key: idempotencyKey, userId: user.id, endpoint: "/leave/requests" },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new ConflictException("IDEMPOTENCY_KEY_REUSED");
      if (existing.expiresAt > new Date()) return existing.responseBody as Record<string, unknown>;
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: { workSchedule: true },
    });
    if (!employee) throw new NotFoundException("EMPLOYEE_NOT_FOUND");

    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: input.leaveTypeId, isActive: true },
    });
    if (!leaveType) throw new NotFoundException("LEAVE_TYPE_NOT_FOUND");

    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        holidayDate: {
          gte: new Date(`${input.startDate}T00:00:00.000Z`),
          lte: new Date(`${input.endDate}T00:00:00.000Z`),
        },
      },
      select: { holidayDate: true, name: true },
    });
    const calculation = this.calculator.calculate(
      input.startDate,
      input.endDate,
      employee.workSchedule.workingDaysBitmap,
      holidays,
      input.halfDayPeriod,
    );

    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ["PENDING_MANAGER", "PENDING_HR", "APPROVED"] },
        startDate: { lte: new Date(`${input.endDate}T00:00:00.000Z`) },
        endDate: { gte: new Date(`${input.startDate}T00:00:00.000Z`) },
      },
      select: { id: true },
    });
    if (overlap) throw new UnprocessableEntityException("LEAVE_OVERLAP");

    const response = await this.prisma.$transaction(async (tx) => {
      const balances: Array<{
        id: string;
        year: number;
        entitledDays: unknown;
        carriedOverDays: unknown;
        usedDays: unknown;
        pendingDays: unknown;
        version: number;
      }> = [];
      for (const allocation of calculation.annualAllocations) {
        let balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              year: allocation.year,
            },
          },
        });
        if (!balance) {
          balance = await tx.leaveBalance.create({
            data: {
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              year: allocation.year,
              entitledDays: leaveType.isPaid ? leaveType.annualEntitlementDays : "0",
            },
          });
        }
        const available = Number(balance.entitledDays)
          + Number(balance.carriedOverDays)
          - Number(balance.usedDays)
          - Number(balance.pendingDays);
        if (leaveType.isPaid && Number(allocation.workingDays) > available) {
          throw new UnprocessableEntityException("INSUFFICIENT_LEAVE_BALANCE");
        }
        balances.push(balance);
      }

      const request = await tx.leaveRequest.create({
        data: {
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          startDate: new Date(`${input.startDate}T00:00:00.000Z`),
          endDate: new Date(`${input.endDate}T00:00:00.000Z`),
          halfDayPeriod: input.halfDayPeriod,
          workingDays: calculation.workingDays.toFixed(2),
          reason: input.reason,
          handoverEmployeeId: input.handoverEmployeeId,
          status: "PENDING_MANAGER",
        },
      });

      for (let index = 0; index < calculation.annualAllocations.length; index += 1) {
        const allocation = calculation.annualAllocations[index];
        await tx.leaveRequestYearAllocation.create({
          data: {
            leaveRequestId: request.id,
            year: allocation.year,
            workingDays: allocation.workingDays.toFixed(2),
          },
        });
        if (leaveType.isPaid) {
          const balance = balances[index];
          const updated = await tx.leaveBalance.updateMany({
            where: { id: balance.id, version: balance.version },
            data: {
              pendingDays: {
                increment: allocation.workingDays,
              },
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) throw new ConflictException("LEAVE_BALANCE_STATE_CHANGED");
        }
      }

      return tx.leaveRequest.findUniqueOrThrow({
        where: { id: request.id },
        include: {
          leaveType: true,
          yearAllocations: true,
          employee: { select: { id: true, employeeCode: true, legalName: true } },
        },
      });
    });

    await this.prisma.idempotencyKey.upsert({
      where: {
        userId_endpoint_key: {
          userId: user.id,
          endpoint: "/leave/requests",
          key: idempotencyKey,
        },
      },
      update: {
        requestHash,
        responseStatus: 201,
        responseBody: response as object,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      create: {
        key: idempotencyKey,
        userId: user.id,
        endpoint: "/leave/requests",
        requestHash,
        responseStatus: 201,
        responseBody: response as object,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return { statusCode: 201, data: response };
  }

  async approve(user: AuthenticatedUser, requestId: string): Promise<Record<string, unknown>> {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: true,
        leaveType: true,
        yearAllocations: true,
      },
    });
    if (!request) throw new NotFoundException("LEAVE_REQUEST_NOT_FOUND");
    if (request.employee.userId === user.id) throw new ForbiddenException("SELF_APPROVAL_FORBIDDEN");

    if (request.status === "PENDING_MANAGER") {
      if (user.role === "LINE_MANAGER" && request.employee.managerId !== user.employeeId) {
        throw new ForbiddenException("FORBIDDEN_SCOPE");
      }
      if (user.role !== "LINE_MANAGER" && user.role !== "HR_MANAGER") {
        throw new ForbiddenException("FORBIDDEN");
      }
      const needsHr =
        request.leaveType.requiresHrApproval
        || (request.leaveType.hrApprovalThresholdDays !== null
          && Number(request.workingDays) > Number(request.leaveType.hrApprovalThresholdDays));
      if (!needsHr) return this.approveFinal(requestId, user);
      await this.prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: "PENDING_HR",
          managerReviewedByUserId: user.id,
          managerReviewedAt: new Date(),
        },
      });
      return { status: "PENDING_HR" };
    }
    if (request.status === "PENDING_HR") {
      if (user.role !== "HR_MANAGER") throw new ForbiddenException("FORBIDDEN");
      return this.approveFinal(requestId, user);
    }
    throw new ConflictException("INVALID_LEAVE_STATE");
  }

  private async approveFinal(requestId: string, user: AuthenticatedUser): Promise<Record<string, unknown>> {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: {
          employee: { include: { workSchedule: true } },
          leaveType: true,
          yearAllocations: true,
        },
      });
      if (request.status === "APPROVED") throw new ConflictException("INVALID_LEAVE_STATE");

      for (const allocation of request.yearAllocations) {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: request.employeeId,
              leaveTypeId: request.leaveTypeId,
              year: allocation.year,
            },
          },
        });
        if (balance && request.leaveType.isPaid) {
          const pending = Number(balance.pendingDays);
          const allocated = Number(allocation.workingDays);
          if (pending < allocated) throw new ConflictException("LEAVE_BALANCE_STATE_CHANGED");
          const updated = await tx.leaveBalance.updateMany({
            where: { id: balance.id, version: balance.version },
            data: {
              pendingDays: { decrement: allocated },
              usedDays: { increment: allocated },
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) throw new ConflictException("LEAVE_BALANCE_STATE_CHANGED");
        }
      }

      if (request.halfDayPeriod === "FULL") {
        const holidays = await tx.publicHoliday.findMany({
          where: {
            holidayDate: {
              gte: request.startDate,
              lte: request.endDate,
            },
          },
          select: { holidayDate: true },
        });
        const holidaySet = new Set(holidays.map((holiday) => holiday.holidayDate.toISOString().slice(0, 10)));
        const cursor = new Date(request.startDate);
        while (cursor <= request.endDate) {
          const dateString = cursor.toISOString().slice(0, 10);
          const isoWeekday = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
          if (!holidaySet.has(dateString) && request.employee.workSchedule.workingDaysBitmap.includes(isoWeekday)) {
            const existing = await tx.attendanceRecord.findUnique({
              where: {
                employeeId_workDate: {
                  employeeId: request.employeeId,
                  workDate: cursor,
                },
              },
            });
            if (existing && (existing.checkInAt || existing.checkOutAt)) {
              throw new UnprocessableEntityException("ATTENDANCE_CONFLICT");
            }
            if (existing) {
              await tx.attendanceRecord.update({
                where: { id: existing.id },
                data: { status: "ON_LEAVE", leaveDays: "1", leaveTypeId: request.leaveTypeId, leaveRequestId: request.id },
              });
            } else {
              await tx.attendanceRecord.create({
                data: {
                  employeeId: request.employeeId,
                  workDate: cursor,
                  scheduleId: request.employee.workScheduleId,
                  status: "ON_LEAVE",
                  leaveDays: "1",
                  leaveTypeId: request.leaveTypeId,
                  leaveRequestId: request.id,
                },
              });
            }
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }

      await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          ...(user.role === "LINE_MANAGER"
            ? { managerReviewedByUserId: user.id, managerReviewedAt: new Date() }
            : {}),
          hrReviewedByUserId: user.role === "HR_MANAGER" ? user.id : request.hrReviewedByUserId,
          hrReviewedAt: user.role === "HR_MANAGER" ? new Date() : request.hrReviewedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "LEAVE_APPROVED",
          entityType: "LeaveRequest",
          entityId: requestId,
          checksumSha256: createHash("sha256")
            .update(`LEAVE_APPROVED:${requestId}:${new Date().toISOString()}`)
            .digest("hex"),
        },
      });
      return tx.leaveRequest.findUniqueOrThrow({ where: { id: requestId } });
    });
    return result;
  }

  async reject(user: AuthenticatedUser, requestId: string, reason: string | undefined): Promise<Record<string, unknown>> {
    if (!reason?.trim()) throw new UnprocessableEntityException("REASON_REQUIRED");
    return this.releaseRequest(user, requestId, "REJECTED", reason);
  }

  async cancel(user: AuthenticatedUser, requestId: string, reason: string | undefined): Promise<Record<string, unknown>> {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { employee: true },
    });
    if (!request) throw new NotFoundException("LEAVE_REQUEST_NOT_FOUND");
    if (request.employee.userId !== user.id && user.role !== "HR_MANAGER") {
      throw new ForbiddenException("FORBIDDEN_SCOPE");
    }
    if (request.status === "APPROVED") {
      if (user.role !== "HR_MANAGER") throw new ForbiddenException("FORBIDDEN");
      if (!reason?.trim()) throw new UnprocessableEntityException("REASON_REQUIRED");
      return this.revokeApproved(user, requestId, reason);
    }
    return this.releaseRequest(user, requestId, "CANCELLED", reason);
  }

  private async releaseRequest(
    user: AuthenticatedUser,
    requestId: string,
    status: "REJECTED" | "CANCELLED",
    reason: string | undefined,
  ): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findUnique({
        where: { id: requestId },
        include: { employee: true, leaveType: true, yearAllocations: true },
      });
      if (!request) throw new NotFoundException("LEAVE_REQUEST_NOT_FOUND");
      if (status === "REJECTED") {
        if (user.role === "LINE_MANAGER" && request.employee.managerId !== user.employeeId) {
          throw new ForbiddenException("FORBIDDEN_SCOPE");
        }
        if (user.role !== "LINE_MANAGER" && user.role !== "HR_MANAGER") throw new ForbiddenException("FORBIDDEN");
        if (request.employee.userId === user.id) throw new ForbiddenException("SELF_APPROVAL_FORBIDDEN");
        if (request.status !== "PENDING_MANAGER" && request.status !== "PENDING_HR") {
          throw new ConflictException("INVALID_LEAVE_STATE");
        }
      }
      if (request.status === "APPROVED") throw new ConflictException("INVALID_LEAVE_STATE");

      for (const allocation of request.yearAllocations) {
        if (request.leaveType.isPaid) {
          const balance = await tx.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: request.employeeId,
                leaveTypeId: request.leaveTypeId,
                year: allocation.year,
              },
            },
          });
          if (balance) {
            const released = Math.min(Number(balance.pendingDays), Number(allocation.workingDays));
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: { pendingDays: { decrement: released }, version: { increment: 1 } },
            });
          }
        }
      }
      await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status,
          decisionReason: reason?.trim() ?? null,
          ...(status === "REJECTED" && user.role === "HR_MANAGER"
            ? { hrReviewedByUserId: user.id, hrReviewedAt: new Date() }
            : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: status === "REJECTED" ? "LEAVE_REJECTED" : "LEAVE_CANCELLED",
          entityType: "LeaveRequest",
          entityId: requestId,
          reason,
          checksumSha256: createHash("sha256")
            .update(`${status}:${requestId}:${new Date().toISOString()}`)
            .digest("hex"),
        },
      });
      return tx.leaveRequest.findUniqueOrThrow({ where: { id: requestId } });
    });
  }

  private async revokeApproved(
    user: AuthenticatedUser,
    requestId: string,
    reason: string,
  ): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findUnique({
        where: { id: requestId },
        include: { leaveType: true, yearAllocations: true },
      });
      if (!request || request.status !== "APPROVED") throw new ConflictException("INVALID_LEAVE_STATE");

      for (const allocation of request.yearAllocations) {
        if (request.leaveType.isPaid) {
          const balance = await tx.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: request.employeeId,
                leaveTypeId: request.leaveTypeId,
                year: allocation.year,
              },
            },
          });
          if (balance) {
            const restored = Math.min(Number(balance.usedDays), Number(allocation.workingDays));
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: { usedDays: { decrement: restored }, version: { increment: 1 } },
            });
          }
        }
      }
      await tx.attendanceRecord.deleteMany({
        where: { leaveRequestId: requestId, status: "ON_LEAVE" },
      });
      await tx.leaveRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED", decisionReason: reason.trim(), hrReviewedByUserId: user.id, hrReviewedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "LEAVE_CANCELLED",
          entityType: "LeaveRequest",
          entityId: requestId,
          reason,
          checksumSha256: createHash("sha256")
            .update(`LEAVE_CANCELLED:${requestId}:${new Date().toISOString()}`)
            .digest("hex"),
        },
      });
      return tx.leaveRequest.findUniqueOrThrow({ where: { id: requestId } });
    });
  }
}
