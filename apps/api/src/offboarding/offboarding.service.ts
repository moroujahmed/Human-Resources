import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { OffboardingCreate } from "@staffhub/shared";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma.service";

@Injectable()
export class OffboardingService {
  constructor(private readonly prisma: PrismaService) {}

  private checksum(action: string, entityId: string): string {
    return createHash("sha256").update(`${action}:${entityId}:${new Date().toISOString()}`).digest("hex");
  }

  async cases(user: AuthenticatedUser): Promise<Record<string, unknown>[]> {
    if (user.role === "EMPLOYEE") {
      if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      return this.prisma.offboardingCase.findMany({
        where: { employeeId: user.employeeId },
        include: { employee: { select: { id: true, employeeCode: true, legalName: true } } },
      });
    }
    if (["HR_MANAGER", "SYSTEM_ADMIN", "ASSET_OFFICER", "PAYROLL_OFFICER"].includes(user.role)) {
      return this.prisma.offboardingCase.findMany({
        include: {
          employee: { select: { id: true, employeeCode: true, legalName: true, managerId: true } },
          clearanceItems: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }
    if (user.role === "LINE_MANAGER") {
      if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      return this.prisma.offboardingCase.findMany({
        where: { employee: { managerId: user.employeeId } },
        include: { employee: true, clearanceItems: true },
      });
    }
    throw new ForbiddenException("FORBIDDEN");
  }

  async caseDetails(user: AuthenticatedUser, id: string): Promise<Record<string, unknown>> {
    const caseRecord = await this.prisma.offboardingCase.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, employeeCode: true, legalName: true, workEmail: true, managerId: true } },
        clearanceItems: user.role === "EMPLOYEE"
          ? { select: { trackType: true, status: true } }
          : true,
      },
    });
    if (!caseRecord) throw new NotFoundException("OFFBOARDING_CASE_NOT_FOUND");
    if (user.role === "EMPLOYEE" && caseRecord.employeeId !== user.employeeId) {
      throw new ForbiddenException("FORBIDDEN_SCOPE");
    }
    if (user.role === "LINE_MANAGER" && caseRecord.employee.managerId !== user.employeeId) {
      throw new ForbiddenException("FORBIDDEN_SCOPE");
    }
    if (
      user.role !== "HR_MANAGER"
      && user.role !== "SYSTEM_ADMIN"
      && user.role !== "ASSET_OFFICER"
      && user.role !== "PAYROLL_OFFICER"
      && user.role !== "EMPLOYEE"
      && user.role !== "LINE_MANAGER"
    ) {
      throw new ForbiddenException("FORBIDDEN");
    }
    return caseRecord;
  }

  async create(user: AuthenticatedUser, input: OffboardingCreate): Promise<Record<string, unknown>> {
    if (user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
    const employee = await this.prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee) throw new NotFoundException("EMPLOYEE_NOT_FOUND");
    if (employee.status === "EXITED" || employee.status === "OFFBOARDING") throw new ConflictException("EMPLOYEE_NOT_ACTIVE");
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.offboardingCase.findUnique({ where: { employeeId: input.employeeId } });
      if (existing) throw new ConflictException("OFFBOARDING_CASE_ALREADY_EXISTS");
      const caseRecord = await tx.offboardingCase.create({
        data: {
          employeeId: input.employeeId,
          exitType: input.exitType,
          noticeDate: new Date(`${input.noticeDate}T00:00:00.000Z`),
          lastWorkingDay: new Date(`${input.lastWorkingDay}T00:00:00.000Z`),
          exitReason: input.exitReason.trim(),
          status: "IN_PROGRESS",
          initiatedByUserId: user.id,
        },
      });
      await tx.employee.update({
        where: { id: input.employeeId },
        data: { status: "OFFBOARDING", lastWorkingDay: new Date(`${input.lastWorkingDay}T00:00:00.000Z`) },
      });
      await tx.offboardingClearanceItem.createMany({
        data: [
          { offboardingCaseId: caseRecord.id, trackType: "ASSET_RETURN", assignedRole: "ASSET_OFFICER", status: "PENDING" },
          { offboardingCaseId: caseRecord.id, trackType: "OPERATIONAL_HANDOVER", assignedRole: "LINE_MANAGER", status: "PENDING" },
          { offboardingCaseId: caseRecord.id, trackType: "FINANCE_LOANS", assignedRole: "PAYROLL_OFFICER", status: "PENDING" },
          { offboardingCaseId: caseRecord.id, trackType: "HR_EXIT", assignedRole: "HR_MANAGER", status: "PENDING" },
        ],
      });
      await tx.auditLog.create({ data: {
        actorUserId: user.id, actorRole: user.role, action: "OFFBOARDING_CASE_CREATED", entityType: "OffboardingCase", entityId: caseRecord.id,
        checksumSha256: this.checksum("OFFBOARDING_CASE_CREATED", caseRecord.id),
      } });
      return caseRecord;
    });
  }

  async signOff(
    user: AuthenticatedUser,
    caseId: string,
    trackType: "ASSET_RETURN" | "OPERATIONAL_HANDOVER" | "FINANCE_LOANS" | "HR_EXIT",
    input: { notes?: string },
  ): Promise<Record<string, unknown>> {
    const caseRecord = await this.prisma.offboardingCase.findUnique({
      where: { id: caseId },
      include: { employee: true },
    });
    if (!caseRecord) throw new NotFoundException("OFFBOARDING_CASE_NOT_FOUND");
    const allowed =
      (trackType === "ASSET_RETURN" && user.role === "ASSET_OFFICER")
      || (trackType === "OPERATIONAL_HANDOVER" && user.role === "LINE_MANAGER")
      || (trackType === "FINANCE_LOANS" && user.role === "PAYROLL_OFFICER")
      || (trackType === "HR_EXIT" && user.role === "HR_MANAGER");
    if (!allowed) throw new ForbiddenException("FORBIDDEN_TRACK");

    if (trackType === "ASSET_RETURN") {
      const activeAsset = await this.prisma.assetAssignment.findFirst({
        where: { employeeId: caseRecord.employeeId, returnedAt: null, status: { in: ["PENDING_ACKNOWLEDGEMENT", "ACKNOWLEDGED"] } },
      });
      if (activeAsset) throw new UnprocessableEntityException("CLEARANCE_BLOCKED");
    }
    if (trackType === "FINANCE_LOANS") {
      const loan = await this.prisma.staffLoan.findFirst({
        where: { employeeId: caseRecord.employeeId, status: "ACTIVE", remainingBalanceUgx: { gt: "0" } },
      });
      if (loan) throw new UnprocessableEntityException("CLEARANCE_BLOCKED");
    }
    if (trackType === "OPERATIONAL_HANDOVER" && caseRecord.employee.managerId !== user.employeeId) {
      throw new ForbiddenException("FORBIDDEN_SCOPE");
    }
    const notes = input.notes?.trim();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.offboardingClearanceItem.updateMany({
        where: { offboardingCaseId: caseId, trackType, status: "PENDING" },
        data: { status: "CLEARED", clearedByUserId: user.id, clearedAt: new Date(), notes: notes ?? null },
      });
      if (updated.count !== 1) throw new ConflictException("CLEARANCE_ALREADY_PROCESSED");
      await tx.auditLog.create({ data: {
        actorUserId: user.id, actorRole: user.role, action: `OFFBOARDING_CLEARANCE_${trackType}`,
        entityType: "OffboardingCase", entityId: caseId,
        checksumSha256: this.checksum(`OFFBOARDING_CLEARANCE_${trackType}`, caseId),
      } });
      return tx.offboardingClearanceItem.findUniqueOrThrow({ where: { offboardingCaseId_trackType: { offboardingCaseId: caseId, trackType } } });
    });
  }

  async finalize(user: AuthenticatedUser, caseId: string): Promise<Record<string, unknown>> {
    if (user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
    const caseRecord = await this.prisma.offboardingCase.findUnique({
      where: { id: caseId },
      include: { clearanceItems: true },
    });
    if (!caseRecord) throw new NotFoundException("OFFBOARDING_CASE_NOT_FOUND");
    if (caseRecord.status === "CLEARED") throw new ConflictException("OFFBOARDING_ALREADY_CLEARED");
    if (caseRecord.clearanceItems.some((item) => item.status !== "CLEARED")) {
      throw new UnprocessableEntityException("CLEARANCE_BLOCKED");
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.offboardingCase.updateMany({ where: { id: caseId, status: "IN_PROGRESS" }, data: { status: "CLEARED", finalizedByUserId: user.id, finalizedAt: new Date() } });
      if (updated.count !== 1) throw new ConflictException("OFFBOARDING_ALREADY_CLEARED");
      await tx.auditLog.create({ data: {
        actorUserId: user.id, actorRole: user.role, action: "OFFBOARDING_CASE_FINALIZED", entityType: "OffboardingCase", entityId: caseId,
        checksumSha256: this.checksum("OFFBOARDING_CASE_FINALIZED", caseId),
      } });
      return tx.offboardingCase.findUniqueOrThrow({ where: { id: caseId } });
    });
  }

  async deactivate(user: AuthenticatedUser, caseId: string): Promise<Record<string, unknown>> {
    if (user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
    const caseRecord = await this.prisma.offboardingCase.findUnique({ where: { id: caseId } });
    if (!caseRecord) throw new NotFoundException("OFFBOARDING_CASE_NOT_FOUND");
    if (caseRecord.deactivatedAt) throw new ConflictException("ACCOUNT_ALREADY_DEACTIVATED");
    const todayEat = new Date(Date.now() + 3 * 60 * 60 * 1000);
    if (todayEat.toISOString().slice(0, 10) <= caseRecord.lastWorkingDay.toISOString().slice(0, 10)) {
      throw new ConflictException("LAST_WORKING_DAY_NOT_PASSED");
    }
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: caseRecord.employeeId }, select: { userId: true } });
      await tx.user.update({
        where: { id: employee.userId, isActive: true },
        data: { isActive: false, deactivatedAt: new Date(), authzVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({
        where: { userId: employee.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.employee.update({ where: { id: caseRecord.employeeId }, data: { status: "EXITED" } });
      const result = await tx.offboardingCase.update({
        where: { id: caseId },
        data: { deactivatedAt: new Date() },
      });
      await tx.auditLog.create({ data: {
        actorUserId: user.id, actorRole: user.role, action: "OFFBOARDING_ACCOUNT_DEACTIVATED", entityType: "OffboardingCase", entityId: caseId,
        checksumSha256: this.checksum("OFFBOARDING_ACCOUNT_DEACTIVATED", caseId),
      } });
      return result;
    });
  }
}
