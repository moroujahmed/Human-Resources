import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import type {
  ApplicationStage,
  JobOfferCreate,
  OnboardingTaskUpdate,
  RequisitionCreate,
  VacancyCreate,
} from "@staffhub/shared";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma.service";
import { PrivateStorageService } from "../storage/private-storage.service";
import { PasswordResetMailService } from "../auth/password-reset-mail.service";

@Injectable()
export class RecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateStorageService,
    private readonly accountMail: PasswordResetMailService,
  ) {}

  private async sendAccountSetup(email: string, userId: string): Promise<boolean> {
    const rawToken = randomBytes(64).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
      await tx.passwordResetToken.create({
        data: { userId, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      });
    });
    try {
      await this.accountMail.sendWelcome(email, rawToken);
      return true;
    } catch {
      return false;
    }
  }

  private requireRecruitmentRole(user: AuthenticatedUser, includeHr = true): void {
    const allowed = includeHr
      ? ["HR_MANAGER", "RECRUITER", "SYSTEM_ADMIN"].includes(user.role)
      : ["HR_MANAGER", "RECRUITER"].includes(user.role);
    if (!allowed) throw new ForbiddenException("FORBIDDEN");
  }

  async requisitions(user: AuthenticatedUser): Promise<Record<string, unknown>[]> {
    if (user.role === "LINE_MANAGER") {
      if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      const employee = await this.prisma.employee.findUnique({ where: { id: user.employeeId } });
      if (!employee) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      return this.prisma.staffRequisition.findMany({
        where: { requestedByUserId: user.id },
        include: { department: true },
        orderBy: { createdAt: "desc" },
      });
    }
    if (!["HR_MANAGER", "SYSTEM_ADMIN", "RECRUITER"].includes(user.role)) {
      throw new ForbiddenException("FORBIDDEN");
    }
    return this.prisma.staffRequisition.findMany({
      include: { department: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createRequisition(user: AuthenticatedUser, input: RequisitionCreate): Promise<Record<string, unknown>> {
    if (user.role !== "LINE_MANAGER" && user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") {
      throw new ForbiddenException("FORBIDDEN");
    }
    const department = await this.prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!department) throw new NotFoundException("DEPARTMENT_NOT_FOUND");
    const requisitionCode = `REQ-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
    return this.prisma.staffRequisition.create({
      data: {
        requisitionCode,
        requestedByUserId: user.id,
        departmentId: input.departmentId,
        jobTitle: input.jobTitle,
        headcount: input.headcount,
        employmentType: input.employmentType,
        justification: input.justification,
        targetStartDate: new Date(`${input.targetStartDate}T00:00:00.000Z`),
        status: "PENDING_HR",
      },
    });
  }

  async approveRequisition(user: AuthenticatedUser, id: string): Promise<Record<string, unknown>> {
    if (user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
    const requisition = await this.prisma.staffRequisition.findUnique({ where: { id } });
    if (!requisition) throw new NotFoundException("REQUISITION_NOT_FOUND");
    if (requisition.requestedByUserId === user.id) throw new ForbiddenException("SELF_APPROVAL_FORBIDDEN");
    if (requisition.status !== "PENDING_HR") throw new ConflictException("INVALID_REQUISITION_STATE");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.staffRequisition.update({
        where: { id, version: requisition.version },
        data: {
          status: "APPROVED",
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "REQUISITION_APPROVED",
          entityType: "StaffRequisition",
          entityId: id,
          checksumSha256: createHash("sha256").update(`REQUISITION_APPROVED:${id}`).digest("hex"),
        },
      });
      return updated;
    });
  }

  async rejectRequisition(user: AuthenticatedUser, id: string, reason: string | undefined): Promise<Record<string, unknown>> {
    if (user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
    if (!reason?.trim()) throw new UnprocessableEntityException("REASON_REQUIRED");
    const requisition = await this.prisma.staffRequisition.findUnique({ where: { id } });
    if (!requisition) throw new NotFoundException("REQUISITION_NOT_FOUND");
    if (requisition.status !== "PENDING_HR") throw new ConflictException("INVALID_REQUISITION_STATE");
    return this.prisma.staffRequisition.update({
      where: { id },
      data: { status: "REJECTED", reviewedByUserId: user.id, reviewedAt: new Date(), decisionReason: reason.trim() },
    });
  }

  async vacancies(user: AuthenticatedUser, status: "DRAFT" | "PUBLISHED" | "CLOSED" | "CANCELLED" | undefined): Promise<Record<string, unknown>[]> {
    if (user.role === "LINE_MANAGER") {
      if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      return this.prisma.vacancy.findMany({
        where: { status, requisition: { requestedByUserId: user.id } },
        include: { requisition: { include: { department: true } } },
        orderBy: { createdAt: "desc" },
      });
    }
    if (!["HR_MANAGER", "RECRUITER", "SYSTEM_ADMIN"].includes(user.role)) throw new ForbiddenException("FORBIDDEN");
    return this.prisma.vacancy.findMany({
      where: status ? { status } : undefined,
      include: { requisition: { include: { department: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async createVacancy(user: AuthenticatedUser, input: VacancyCreate): Promise<Record<string, unknown>> {
    this.requireRecruitmentRole(user);
    if (input.salaryBandMaxUgx !== undefined
      && input.salaryBandMinUgx !== undefined
      && input.salaryBandMaxUgx < input.salaryBandMinUgx) {
      throw new UnprocessableEntityException("INVALID_SALARY_BAND");
    }
    const requisition = await this.prisma.staffRequisition.findUnique({ where: { id: input.requisitionId } });
    if (!requisition) throw new NotFoundException("REQUISITION_NOT_FOUND");
    if (requisition.status !== "APPROVED") throw new UnprocessableEntityException("REQUISITION_NOT_APPROVED");
    const existing = await this.prisma.vacancy.findUnique({ where: { requisitionId: requisition.id } });
    if (existing) throw new ConflictException("VACANCY_ALREADY_EXISTS");
    return this.prisma.vacancy.create({
      data: {
        vacancyCode: `VAC-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`,
        requisitionId: requisition.id,
        publishedByUserId: user.role === "RECRUITER" || user.role === "HR_MANAGER" ? user.id : null,
        title: input.title,
        location: input.location,
        description: input.description,
        requirements: input.requirements,
        salaryBandMinUgx: input.salaryBandMinUgx?.toString(),
        salaryBandMaxUgx: input.salaryBandMaxUgx?.toString(),
        closingAt: new Date(input.closingAt),
        status: "DRAFT",
      },
    });
  }

  async publishVacancy(user: AuthenticatedUser, id: string): Promise<Record<string, unknown>> {
    this.requireRecruitmentRole(user);
    const vacancy = await this.prisma.vacancy.findUnique({ where: { id } });
    if (!vacancy) throw new NotFoundException("VACANCY_NOT_FOUND");
    if (vacancy.status !== "DRAFT") throw new ConflictException("INVALID_VACANCY_STATE");
    if (vacancy.closingAt <= new Date()) throw new UnprocessableEntityException("VACANCY_CLOSED");
    return this.prisma.vacancy.update({
      where: { id },
      data: { status: "PUBLISHED", publishedByUserId: user.id, publishedAt: new Date() },
    });
  }

  async applications(user: AuthenticatedUser, vacancyId: string): Promise<Record<string, unknown>[]> {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id: vacancyId },
      select: { requisition: { select: { requestedByUserId: true } } },
    });
    if (!vacancy) throw new NotFoundException("VACANCY_NOT_FOUND");
    if (user.role === "LINE_MANAGER") {
      if (vacancy.requisition.requestedByUserId !== user.id) throw new ForbiddenException("FORBIDDEN_SCOPE");
      return this.prisma.jobApplication.findMany({
        where: { vacancyId, status: "SHORTLISTED" },
        select: {
          id: true, applicationCode: true, fullName: true, status: true, submittedAt: true, stageNotes: true,
          interviews: { select: { id: true, scheduledAt: true, outcome: true } },
        },
        orderBy: { submittedAt: "desc" },
      });
    }
    if (user.role !== "HR_MANAGER" && user.role !== "RECRUITER") throw new ForbiddenException("FORBIDDEN");
    return this.prisma.jobApplication.findMany({
      where: { vacancyId },
      select: {
        id: true, applicationCode: true, fullName: true, applicantEmail: true, phone: true,
        expectedGrossUgx: true, earliestStartDate: true, coverNote: true, cvOriginalFilename: true,
        cvMimeType: true, status: true, stageNotes: true, submittedAt: true,
        offer: { select: { id: true, status: true, offeredJobTitle: true, proposedStartDate: true } },
        interviews: { select: { id: true, scheduledAt: true, interviewMode: true, outcome: true, score: true } },
      },
      orderBy: { submittedAt: "desc" },
    });
  }

  async applicationCvUrl(user: AuthenticatedUser, applicationId: string): Promise<Record<string, unknown>> {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { vacancy: { include: { requisition: { select: { requestedByUserId: true } } } } },
    });
    if (!application) throw new NotFoundException("APPLICATION_NOT_FOUND");
    if (user.role === "LINE_MANAGER") {
      if (application.vacancy.requisition.requestedByUserId !== user.id || application.status !== "SHORTLISTED") {
        throw new ForbiddenException("FORBIDDEN_SCOPE");
      }
    } else if (user.role !== "HR_MANAGER" && user.role !== "RECRUITER") {
      throw new ForbiddenException("FORBIDDEN");
    }
    const signedUrl = await this.storage.signedDownloadUrl(application.cvStorageKey, application.cvOriginalFilename);
    return { signedUrl, expiresInSeconds: 120 };
  }

  async stageApplication(
    user: AuthenticatedUser,
    id: string,
    input: ApplicationStage,
  ): Promise<Record<string, unknown>> {
    this.requireRecruitmentRole(user);
    const application = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException("APPLICATION_NOT_FOUND");
    const allowedNextStates: Record<string, string[]> = {
      APPLIED: ["SHORTLISTED", "REJECTED"],
      SHORTLISTED: ["INTERVIEWING", "REJECTED"],
      INTERVIEWING: ["REJECTED"],
    };
    if (!allowedNextStates[application.status]?.includes(input.status)) throw new ConflictException("INVALID_APPLICATION_STATE");
    if (input.status === "REJECTED" && !input.stageNotes) {
      throw new UnprocessableEntityException("REJECTION_REASON_REQUIRED");
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.jobApplication.update({
        where: { id },
        data: { status: input.status, stageNotes: input.stageNotes ?? application.stageNotes },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id, actorRole: user.role, action: `APPLICATION_${input.status}`,
          entityType: "JobApplication", entityId: id,
          reason: input.stageNotes,
          checksumSha256: createHash("sha256").update(`APPLICATION_${input.status}:${id}:${new Date().toISOString()}`).digest("hex"),
        },
      });
      return updated;
    });
  }

  async createOffer(
    user: AuthenticatedUser,
    applicationId: string,
    input: JobOfferCreate,
  ): Promise<Record<string, unknown>> {
    this.requireRecruitmentRole(user);
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { offer: true },
    });
    if (!application) throw new NotFoundException("APPLICATION_NOT_FOUND");
    if (application.offer) throw new ConflictException("OFFER_ALREADY_EXISTS");
    if (application.status !== "SHORTLISTED" && application.status !== "INTERVIEWING") {
      throw new UnprocessableEntityException("APPLICATION_NOT_READY_FOR_OFFER");
    }
    return this.prisma.$transaction(async (tx) => {
      const stageUpdated = await tx.jobApplication.updateMany({
        where: { id: applicationId, status: { in: ["SHORTLISTED", "INTERVIEWING"] } },
        data: { status: "OFFERED" },
      });
      if (stageUpdated.count !== 1) throw new ConflictException("INVALID_APPLICATION_STATE");
      const offer = await tx.jobOffer.create({
        data: {
        applicationId,
        preparedByUserId: user.id,
        offeredJobTitle: input.offeredJobTitle,
        departmentId: input.departmentId,
        reportingManagerId: input.reportingManagerId,
        offeredBaseSalaryUgx: input.offeredBaseSalaryUgx.toString(),
        offeredAllowancesUgx: input.offeredAllowancesUgx.toString(),
        proposedStartDate: new Date(`${input.proposedStartDate}T00:00:00.000Z`),
        offerExpiresAt: new Date(input.offerExpiresAt),
        status: "DRAFT",
      },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id, actorRole: user.role, action: "OFFER_CREATED", entityType: "JobOffer", entityId: offer.id,
          checksumSha256: createHash("sha256").update(`OFFER_CREATED:${offer.id}:${new Date().toISOString()}`).digest("hex"),
        },
      });
      return offer;
    });
  }

  async approveOffer(user: AuthenticatedUser, id: string): Promise<Record<string, unknown>> {
    if (user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
    const offer = await this.prisma.jobOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException("OFFER_NOT_FOUND");
    if (offer.status !== "PENDING_APPROVAL") throw new ConflictException("INVALID_OFFER_STATE");
    if (offer.preparedByUserId === user.id) throw new ForbiddenException("SELF_APPROVAL_FORBIDDEN");
    return this.prisma.jobOffer.update({
      where: { id },
      data: { status: "APPROVED", approvedByUserId: user.id, approvedAt: new Date(), version: { increment: 1 } },
    });
  }

  async convertOffer(
    user: AuthenticatedUser,
    offerId: string,
    idempotencyKey: string | undefined,
  ): Promise<Record<string, unknown>> {
    if (user.role !== "HR_MANAGER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
    if (!idempotencyKey) throw new UnprocessableEntityException("IDEMPOTENCY_KEY_REQUIRED");
    const offer = await this.prisma.jobOffer.findUnique({
      where: { id: offerId },
      include: {
        application: { include: { vacancy: { include: { requisition: { select: { employmentType: true } } } } } },
        reportingManager: { select: { id: true, userId: true } },
      },
    });
    if (!offer) throw new NotFoundException("OFFER_NOT_FOUND");
    if (offer.status !== "ACCEPTED") throw new ConflictException("OFFER_NOT_ACCEPTED");

    const converted = await this.prisma.employee.findUnique({
      where: { convertedFromOfferId: offerId },
    });
    if (converted) {
      const account = await this.prisma.user.findUnique({ where: { id: converted.userId }, select: { email: true } });
      const invitationSent = account ? await this.sendAccountSetup(account.email, converted.userId) : false;
      return { status: "ALREADY_CONVERTED", employeeId: converted.id, invitationSent };
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: offer.application.applicantEmail.toLowerCase() },
    });
    if (existingUser) throw new ConflictException("USER_ALREADY_EXISTS");

    const result = await this.prisma.$transaction(async (tx) => {
      const tempPassword = randomBytes(24).toString("base64url");
      const tempPasswordHash = await argon2.hash(tempPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });
      const userRecord = await tx.user.create({
        data: {
          email: offer.application.applicantEmail.toLowerCase(),
          passwordHash: tempPasswordHash,
          role: "EMPLOYEE",
          mustChangePassword: true,
        },
      });
      const schedule = await tx.workSchedule.findFirst({ where: { isDefault: true } });
      if (!schedule) throw new UnprocessableEntityException("DEFAULT_SCHEDULE_NOT_FOUND");
      const employee = await tx.employee.create({
        data: {
          userId: userRecord.id,
          convertedFromOfferId: offerId,
          employeeCode: `UG-EMP-${randomBytes(3).toString("hex").toUpperCase()}`,
          legalName: offer.application.fullName,
          workEmail: offer.application.applicantEmail.toLowerCase(),
          personalEmail: offer.application.applicantEmail.toLowerCase(),
          phone: offer.application.phone,
          jobTitle: offer.offeredJobTitle,
          employmentType: offer.application.vacancy.requisition.employmentType,
          departmentId: offer.departmentId,
          managerId: offer.reportingManagerId,
          workScheduleId: schedule.id,
          status: "ONBOARDING",
          hireDate: offer.proposedStartDate,
          baseSalaryUgx: offer.offeredBaseSalaryUgx,
          recurringAllowancesUgx: offer.offeredAllowancesUgx,
        },
      });
      await tx.jobOffer.update({ where: { id: offerId }, data: { status: "CONVERTED" } });
      await tx.jobApplication.update({
        where: { id: offer.applicationId },
        data: { status: "OFFER_ACCEPTED" },
      });
      await tx.onboardingChecklist.create({
        data: {
          employeeId: employee.id,
          status: "IN_PROGRESS",
          tasks: {
            create: [
              { assignedRole: "HR_MANAGER", title: "Verify employment documents and personal details", sortOrder: 1 },
              { assignedRole: "LINE_MANAGER", assignedUserId: offer.reportingManager?.userId ?? null, title: "Confirm role objectives and first-week plan", sortOrder: 2 },
              { assignedRole: "EMPLOYEE", assignedUserId: userRecord.id, title: "Complete your profile and acknowledge workplace policies", sortOrder: 3 },
              { assignedRole: "ASSET_OFFICER", title: "Issue and record required equipment", sortOrder: 4 },
            ],
          },
        },
      });
      const eatDate = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const leaveTypes = await tx.leaveType.findMany({ where: { isActive: true } });
      await tx.leaveBalance.createMany({
        data: leaveTypes.map((leaveType) => ({
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          year: eatDate.getUTCFullYear(),
          entitledDays: leaveType.annualEntitlementDays,
        })),
        skipDuplicates: true,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "OFFER_CONVERTED",
          entityType: "JobOffer",
          entityId: offerId,
          checksumSha256: createHash("sha256").update(`OFFER_CONVERTED:${offerId}:${employee.id}`).digest("hex"),
        },
      });
      await tx.idempotencyKey.upsert({
        where: {
          userId_endpoint_key: {
            userId: user.id,
            endpoint: "/recruitment/offers/convert",
            key: idempotencyKey,
          },
        },
        update: {},
        create: {
          key: idempotencyKey,
          userId: user.id,
          endpoint: "/recruitment/offers/convert",
          requestHash: createHash("sha256").update(offerId).digest("hex"),
          responseStatus: 201,
          responseBody: { employeeId: employee.id },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return { employeeId: employee.id, userId: userRecord.id, email: userRecord.email, onboarding: true };
    });
    const invitationSent = await this.sendAccountSetup(result.email, result.userId);
    return { employeeId: result.employeeId, onboarding: true, invitationSent };
  }

  async onboarding(user: AuthenticatedUser): Promise<Record<string, unknown>[]> {
    let where: Record<string, unknown>;
    if (user.role === "HR_MANAGER" || user.role === "SYSTEM_ADMIN") {
      where = {};
    } else if (user.role === "LINE_MANAGER") {
      if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      where = { employee: { managerId: user.employeeId } };
    } else if (user.role === "ASSET_OFFICER") {
      where = { tasks: { some: { assignedRole: "ASSET_OFFICER", isCompleted: false } } };
    } else if (user.role === "EMPLOYEE") {
      if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
      where = { employeeId: user.employeeId };
    } else {
      throw new ForbiddenException("FORBIDDEN");
    }
    return this.prisma.onboardingChecklist.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeCode: true, legalName: true, jobTitle: true, managerId: true } },
        tasks: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateOnboardingTask(user: AuthenticatedUser, taskId: string, input: OnboardingTaskUpdate) {
    const task = await this.prisma.onboardingTask.findUnique({
      where: { id: taskId },
      include: { checklist: { include: { employee: { select: { id: true, userId: true, managerId: true } } } } },
    });
    if (!task) throw new NotFoundException("ONBOARDING_TASK_NOT_FOUND");
    if (task.assignedRole !== user.role) throw new ForbiddenException("FORBIDDEN_TASK");
    if (user.role === "EMPLOYEE" && task.checklist.employee.userId !== user.id) throw new ForbiddenException("FORBIDDEN_SCOPE");
    if (user.role === "LINE_MANAGER" && task.checklist.employee.managerId !== user.employeeId) throw new ForbiddenException("FORBIDDEN_SCOPE");
    if (task.isCompleted === input.isCompleted) return task;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM onboarding_checklists WHERE id = ${task.checklistId}::uuid FOR UPDATE`;
      const changed = await tx.onboardingTask.updateMany({
        where: { id: taskId, isCompleted: task.isCompleted },
        data: {
          isCompleted: input.isCompleted,
          completedByUserId: input.isCompleted ? user.id : null,
          completedAt: input.isCompleted ? new Date() : null,
        },
      });
      if (changed.count !== 1) throw new ConflictException("ONBOARDING_TASK_CHANGED");
      const incomplete = await tx.onboardingTask.count({ where: { checklistId: task.checklistId, isCompleted: false } });
      if (incomplete === 0) {
        await tx.onboardingChecklist.update({ where: { id: task.checklistId }, data: { status: "COMPLETED", completedAt: new Date() } });
        await tx.employee.updateMany({ where: { id: task.checklist.employee.id, status: "ONBOARDING" }, data: { status: "ACTIVE" } });
      } else if (!input.isCompleted) {
        await tx.onboardingChecklist.update({ where: { id: task.checklistId }, data: { status: "IN_PROGRESS", completedAt: null } });
        await tx.employee.updateMany({ where: { id: task.checklist.employee.id, status: "ACTIVE" }, data: { status: "ONBOARDING" } });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: input.isCompleted ? "ONBOARDING_TASK_COMPLETED" : "ONBOARDING_TASK_REOPENED",
          entityType: "OnboardingTask",
          entityId: taskId,
          checksumSha256: createHash("sha256").update(`${taskId}:${input.isCompleted}:${Date.now()}`).digest("hex"),
        },
      });
      return tx.onboardingTask.findUniqueOrThrow({ where: { id: taskId } });
    });
  }
}
