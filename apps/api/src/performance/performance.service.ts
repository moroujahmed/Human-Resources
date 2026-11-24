import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { ManagerReview, PerformanceReviewCreate, SelfAssessment } from "@staffhub/shared";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser): Promise<Record<string, unknown>[]> {
    if (user.role === "EMPLOYEE") {
      if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      return this.prisma.performanceReview.findMany({
        where: { employeeId: user.employeeId },
        include: { employee: { select: { legalName: true, employeeCode: true } }, reviewerManager: { select: { legalName: true } } },
        orderBy: [{ reviewPeriod: "desc" }, { createdAt: "desc" }],
      });
    }
    if (user.role === "LINE_MANAGER") {
      if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      return this.prisma.performanceReview.findMany({
        where: { employee: { is: { managerId: user.employeeId } } },
        include: { employee: { select: { legalName: true, employeeCode: true } }, reviewerManager: { select: { legalName: true } } },
        orderBy: [{ reviewPeriod: "desc" }, { createdAt: "desc" }],
      });
    }
    if (user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
    return this.prisma.performanceReview.findMany({
      include: { employee: { select: { legalName: true, employeeCode: true } }, reviewerManager: { select: { legalName: true } } },
      orderBy: [{ reviewPeriod: "desc" }, { createdAt: "desc" }],
      take: 500,
    });
  }

  async create(user: AuthenticatedUser, input: PerformanceReviewCreate): Promise<Record<string, unknown>> {
    if (user.role !== "LINE_MANAGER" && user.role !== "HR_MANAGER") throw new ForbiddenException("FORBIDDEN");
    const employee = await this.prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee || employee.status === "EXITED") throw new NotFoundException("EMPLOYEE_NOT_FOUND");
    if (user.role === "LINE_MANAGER" && (!user.employeeId || employee.managerId !== user.employeeId)) {
      throw new ForbiddenException("FORBIDDEN_SCOPE");
    }
    const reviewerManagerId = employee.managerId ?? (user.role === "LINE_MANAGER" ? user.employeeId : null);
    if (!reviewerManagerId) throw new UnprocessableEntityException("REVIEW_MANAGER_NOT_ASSIGNED");
    const prior = await this.prisma.performanceReview.findUnique({
      where: { employeeId_reviewPeriod: { employeeId: input.employeeId, reviewPeriod: input.reviewPeriod } },
      select: { id: true },
    });
    if (prior) throw new ConflictException("PERFORMANCE_REVIEW_ALREADY_EXISTS");
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.performanceReview.create({
        data: {
          employeeId: input.employeeId,
          reviewerManagerId,
          reviewPeriod: input.reviewPeriod,
          objectivesJson: input.objectives,
          status: "SELF_REVIEW_PENDING",
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id, actorRole: user.role, action: "PERFORMANCE_REVIEW_CREATED",
          entityType: "PerformanceReview", entityId: review.id,
          checksumSha256: createHash("sha256").update(`PERFORMANCE_REVIEW_CREATED:${review.id}:${JSON.stringify(input.objectives)}`).digest("hex"),
        },
      });
      return review;
    });
  }

  async submitSelfAssessment(user: AuthenticatedUser, reviewId: string, input: SelfAssessment): Promise<Record<string, unknown>> {
    if (user.role !== "EMPLOYEE" || !user.employeeId) throw new ForbiddenException("FORBIDDEN");
    const employeeId = user.employeeId;
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.performanceReview.updateMany({
        where: { id: reviewId, employeeId, status: "SELF_REVIEW_PENDING" },
        data: { selfAssessment: input.selfAssessment.trim(), status: "SELF_REVIEW_SUBMITTED" },
      });
      if (changed.count !== 1) {
        const exists = await tx.performanceReview.findFirst({ where: { id: reviewId, employeeId }, select: { id: true } });
        if (!exists) throw new NotFoundException("PERFORMANCE_REVIEW_NOT_FOUND");
        throw new ConflictException("INVALID_PERFORMANCE_REVIEW_STATE");
      }
      await tx.auditLog.create({
        data: {
          actorUserId: user.id, actorRole: user.role, action: "PERFORMANCE_SELF_REVIEW_SUBMITTED",
          entityType: "PerformanceReview", entityId: reviewId,
          checksumSha256: createHash("sha256").update(`PERFORMANCE_SELF_REVIEW_SUBMITTED:${reviewId}:${input.selfAssessment}`).digest("hex"),
        },
      });
      return tx.performanceReview.findUniqueOrThrow({ where: { id: reviewId } });
    });
  }

  async submitManagerReview(user: AuthenticatedUser, reviewId: string, input: ManagerReview): Promise<Record<string, unknown>> {
    if (user.role !== "LINE_MANAGER" || !user.employeeId) throw new ForbiddenException("FORBIDDEN");
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.performanceReview.findUnique({ where: { id: reviewId }, include: { employee: { select: { managerId: true } } } });
      if (!review) throw new NotFoundException("PERFORMANCE_REVIEW_NOT_FOUND");
      if (review.employee.managerId !== user.employeeId || review.reviewerManagerId !== user.employeeId) {
        throw new ForbiddenException("FORBIDDEN_SCOPE");
      }
      if (review.employeeId === user.employeeId) throw new ForbiddenException("SELF_REVIEW_FORBIDDEN");
      if (review.status !== "SELF_REVIEW_SUBMITTED") throw new ConflictException("SELF_REVIEW_REQUIRED");
      const changed = await tx.performanceReview.updateMany({
        where: { id: reviewId, status: "SELF_REVIEW_SUBMITTED", reviewerManagerId: user.employeeId },
        data: { managerFeedback: input.managerFeedback.trim(), rating: input.rating, status: "COMPLETED", completedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException("PERFORMANCE_REVIEW_CHANGED");
      await tx.auditLog.create({
        data: {
          actorUserId: user.id, actorRole: user.role, action: "PERFORMANCE_REVIEW_COMPLETED",
          entityType: "PerformanceReview", entityId: reviewId, reason: input.managerFeedback.trim(),
          checksumSha256: createHash("sha256").update(`PERFORMANCE_REVIEW_COMPLETED:${reviewId}:${input.rating}:${input.managerFeedback}`).digest("hex"),
        },
      });
      return tx.performanceReview.findUniqueOrThrow({ where: { id: reviewId } });
    });
  }
}
