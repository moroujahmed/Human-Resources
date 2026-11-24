import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../src/auth/auth.types";
import { RecruitmentService } from "../src/recruitment/recruitment.service";
import type { PrismaService } from "../src/prisma.service";

const user: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000001", email: "hr@example.invalid", role: "HR_MANAGER",
  employeeId: null, authzVersion: 1, mustChangePassword: false,
};
const offerId = "20000000-0000-4000-8000-000000000001";
const requisitionId = "30000000-0000-4000-8000-000000000001";
const vacancyId = "40000000-0000-4000-8000-000000000001";

describe("requisition headcount fill transition", () => {
  it("marks the vacancy filled when converted hires reach approved headcount", async () => {
    const updateVacancy = vi.fn().mockResolvedValue({ count: 1 });
    const auditCreate = vi.fn().mockResolvedValue({});
    const tx = {
      user: { create: vi.fn().mockResolvedValue({ id: "50000000-0000-4000-8000-000000000001", email: "candidate@example.invalid" }) },
      workSchedule: { findFirst: vi.fn().mockResolvedValue({ id: "60000000-0000-4000-8000-000000000001" }) },
      employee: { create: vi.fn().mockResolvedValue({ id: "70000000-0000-4000-8000-000000000001" }) },
      jobOffer: {
        update: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(2),
      },
      vacancy: { updateMany: updateVacancy },
      jobApplication: { update: vi.fn().mockResolvedValue({}) },
      onboardingChecklist: { create: vi.fn().mockResolvedValue({}) },
      leaveType: { findMany: vi.fn().mockResolvedValue([]) },
      leaveBalance: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: auditCreate },
      idempotencyKey: { upsert: vi.fn().mockResolvedValue({}) },
      passwordResetToken: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      jobOffer: { findUnique: vi.fn().mockResolvedValue({
        id: offerId, status: "ACCEPTED", applicationId: "80000000-0000-4000-8000-000000000001",
        departmentId: "90000000-0000-4000-8000-000000000001", reportingManagerId: null,
        offeredJobTitle: "People Officer", offeredBaseSalaryUgx: 1_000_000, offeredAllowancesUgx: 0,
        proposedStartDate: new Date("2027-01-01T00:00:00.000Z"),
        application: {
          applicantEmail: "candidate@example.invalid", fullName: "Test Candidate", phone: "+256700000000",
          vacancy: { id: vacancyId, requisition: { id: requisitionId, headcount: 2, employmentType: "FULL_TIME" } },
        },
        reportingManager: null,
      }) },
      employee: { findUnique: vi.fn().mockResolvedValue(null) },
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const sendWelcome = vi.fn().mockResolvedValue(undefined);
    const service = new RecruitmentService(prisma as unknown as PrismaService, {} as never, { sendWelcome } as never);

    await expect(service.convertOffer(user, offerId, "b2c8e982-5b2c-45a1-bc48-1a94d174fc8b"))
      .resolves.toMatchObject({ onboarding: true, invitationSent: true });
    expect(tx.jobOffer.count).toHaveBeenCalledWith({
      where: { status: "CONVERTED", application: { is: { vacancy: { is: { requisitionId } } } } },
    });
    expect(updateVacancy).toHaveBeenCalledWith({
      where: { requisitionId, status: { in: ["PUBLISHED", "CLOSED"] } },
      data: { status: "FILLED" },
    });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "VACANCY_FILLED", entityId: vacancyId }) }));
  });
});
