import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../src/auth/auth.types";
import { PerformanceService } from "../src/performance/performance.service";
import type { PrismaService } from "../src/prisma.service";

const manager: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000001", email: "manager@example.invalid", role: "LINE_MANAGER",
  employeeId: "20000000-0000-4000-8000-000000000001", authzVersion: 1, mustChangePassword: false,
};
const employeeId = "20000000-0000-4000-8000-000000000002";
const reviewId = "30000000-0000-4000-8000-000000000001";

function serviceWith(prisma: Record<string, unknown>): PerformanceService {
  return new PerformanceService(prisma as unknown as PrismaService);
}

describe("performance reviews", () => {
  it("creates a self-assessment cycle for a direct report and audits it", async () => {
    const created = { id: reviewId, status: "SELF_REVIEW_PENDING" };
    const create = vi.fn().mockResolvedValue(created);
    const auditCreate = vi.fn().mockResolvedValue({});
    const tx = { performanceReview: { create }, auditLog: { create: auditCreate } };
    const prisma = {
      employee: { findUnique: vi.fn().mockResolvedValue({ id: employeeId, status: "ACTIVE", managerId: manager.employeeId }) },
      performanceReview: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = serviceWith(prisma);
    await expect(service.create(manager, { employeeId, reviewPeriod: "2026 Annual", objectives: ["Deliver planned project milestones"] })).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reviewerManagerId: manager.employeeId, status: "SELF_REVIEW_PENDING" }) }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "PERFORMANCE_REVIEW_CREATED" }) }));
  });

  it("blocks a line manager from opening a review outside their team", async () => {
    const prisma = {
      employee: { findUnique: vi.fn().mockResolvedValue({ id: employeeId, status: "ACTIVE", managerId: "40000000-0000-4000-8000-000000000001" }) },
    };
    await expect(serviceWith(prisma).create(manager, {
      employeeId, reviewPeriod: "2026 Annual", objectives: ["Deliver planned project milestones"],
    })).rejects.toMatchObject({ status: 403 });
  });

  it("submits a self-assessment only for the linked employee's pending review", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const auditCreate = vi.fn().mockResolvedValue({});
    const updated = { id: reviewId, status: "SELF_REVIEW_SUBMITTED" };
    const tx = {
      performanceReview: { updateMany, findUniqueOrThrow: vi.fn().mockResolvedValue(updated) },
      auditLog: { create: auditCreate },
    };
    const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
    const employee: AuthenticatedUser = { ...manager, id: "10000000-0000-4000-8000-000000000003", role: "EMPLOYEE", employeeId };
    await expect(serviceWith(prisma).submitSelfAssessment(employee, reviewId, {
      selfAssessment: "I completed all project objectives and identified a training goal.",
    })).resolves.toEqual(updated);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: reviewId, employeeId, status: "SELF_REVIEW_PENDING" },
      data: { selfAssessment: "I completed all project objectives and identified a training goal.", status: "SELF_REVIEW_SUBMITTED" },
    });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "PERFORMANCE_SELF_REVIEW_SUBMITTED" }) }));
  });
});
