import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../src/auth/auth.types";
import { RecruitmentService } from "../src/recruitment/recruitment.service";
import type { PrismaService } from "../src/prisma.service";

const employeeUser: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "employee@example.invalid",
  role: "EMPLOYEE",
  employeeId: "20000000-0000-4000-8000-000000000001",
  authzVersion: 1,
  mustChangePassword: false,
};

function serviceWith(prisma: Record<string, unknown>): RecruitmentService {
  return new RecruitmentService(
    prisma as unknown as PrismaService,
    {} as never,
    { sendWelcome: vi.fn().mockResolvedValue(undefined) } as never,
  );
}

describe("onboarding task access and state", () => {
  it("limits an employee's checklist query to their own employee record", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = serviceWith({ onboardingChecklist: { findMany } });

    await service.onboarding(employeeUser);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeId: employeeUser.employeeId } }));
  });

  it("rejects a task assigned to a different employee", async () => {
    const task = {
      id: "30000000-0000-4000-8000-000000000001",
      assignedRole: "EMPLOYEE",
      isCompleted: false,
      checklist: { employee: { id: employeeUser.employeeId, userId: "different-user", managerId: null } },
    };
    const service = serviceWith({ onboardingTask: { findUnique: vi.fn().mockResolvedValue(task) } });

    await expect(service.updateOnboardingTask(employeeUser, task.id, { isCompleted: true }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("serializes task completion and activates the hire after the final task", async () => {
    const task = {
      id: "30000000-0000-4000-8000-000000000002",
      checklistId: "40000000-0000-4000-8000-000000000001",
      assignedRole: "EMPLOYEE",
      isCompleted: false,
      checklist: { employee: { id: employeeUser.employeeId, userId: employeeUser.id, managerId: null } },
    };
    const updatedTask = { ...task, isCompleted: true };
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      onboardingTask: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(0),
        findUniqueOrThrow: vi.fn().mockResolvedValue(updatedTask),
      },
      onboardingChecklist: { update: vi.fn().mockResolvedValue({}) },
      employee: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      onboardingTask: { findUnique: vi.fn().mockResolvedValue(task) },
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    const service = serviceWith(prisma);

    await expect(service.updateOnboardingTask(employeeUser, task.id, { isCompleted: true })).resolves.toEqual(updatedTask);

    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.onboardingChecklist.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: task.checklistId },
      data: expect.objectContaining({ status: "COMPLETED" }),
    }));
    expect(transaction.employee.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: employeeUser.employeeId, status: "ONBOARDING" },
      data: { status: "ACTIVE" },
    }));
  });
});
