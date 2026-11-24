import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../src/auth/auth.types";
import { RecruitmentService } from "../src/recruitment/recruitment.service";
import type { PrismaService } from "../src/prisma.service";

const recruiter: AuthenticatedUser = {
  id: "10000000-0000-4000-8000-000000000001", email: "recruiter@example.invalid", role: "RECRUITER",
  employeeId: null, authzVersion: 1, mustChangePassword: false,
};
const panelistId = "10000000-0000-4000-8000-000000000002";
const applicationId = "20000000-0000-4000-8000-000000000001";
const interviewId = "30000000-0000-4000-8000-000000000001";

function serviceWith(prisma: Record<string, unknown>): RecruitmentService {
  return new RecruitmentService(prisma as unknown as PrismaService, {} as never, {} as never);
}

describe("recruitment interviews", () => {
  it("schedules only for shortlisted candidates and records an audit event", async () => {
    const created = { id: interviewId, applicationId };
    const interviewCreate = vi.fn().mockResolvedValue(created);
    const auditCreate = vi.fn().mockResolvedValue({});
    const tx = {
      jobApplication: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      interview: { create: interviewCreate },
      auditLog: { create: auditCreate },
    };
    const prisma = {
      jobApplication: { findUnique: vi.fn().mockResolvedValue({ id: applicationId, status: "SHORTLISTED" }) },
      user: { count: vi.fn().mockResolvedValue(1) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = serviceWith(prisma);

    await expect(service.scheduleInterview(recruiter, applicationId, {
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      interviewMode: "VIDEO", locationOrLink: "https://meet.example.invalid/room",
      interviewerUserIds: [panelistId],
    })).resolves.toEqual(created);
    expect(tx.jobApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: applicationId, status: { in: ["SHORTLISTED", "INTERVIEWING"] } },
    }));
    expect(interviewCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ interviewerUserIds: [panelistId] }) }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "INTERVIEW_SCHEDULED" }) }));
  });

  it("allows only an assigned interviewer to submit a scored review", async () => {
    const prisma = {
      interview: { findUnique: vi.fn().mockResolvedValue({ id: interviewId, interviewerUserIds: [panelistId], outcome: "SCHEDULED" }) },
    };
    const service = serviceWith(prisma);
    await expect(service.reviewInterview(recruiter, interviewId, {
      score: 4, feedback: "Strong relevant experience and clear answers.", outcome: "ADVANCE",
    })).rejects.toMatchObject({ status: 403 });
  });

  it("stores each assigned panelist's review independently and audits the change", async () => {
    const review = { id: "40000000-0000-4000-8000-000000000001", interviewId, reviewerUserId: panelistId };
    const upsert = vi.fn().mockResolvedValue(review);
    const auditCreate = vi.fn().mockResolvedValue({});
    const tx = { interviewPanelReview: { upsert }, auditLog: { create: auditCreate } };
    const prisma = {
      interview: { findUnique: vi.fn().mockResolvedValue({ id: interviewId, interviewerUserIds: [panelistId], outcome: "SCHEDULED" }) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const assignedPanelist = { ...recruiter, id: panelistId, role: "EMPLOYEE" as const };
    const service = serviceWith(prisma);

    await expect(service.reviewInterview(assignedPanelist, interviewId, {
      score: 4.5, feedback: "Strong relevant experience and clear answers.", outcome: "ADVANCE",
    })).resolves.toEqual(review);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { interviewId_reviewerUserId: { interviewId, reviewerUserId: panelistId } },
      create: expect.objectContaining({ score: 4.5, recommendation: "ADVANCE" }),
    }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorUserId: panelistId, action: "INTERVIEW_REVIEWED" }) }));
  });
});
