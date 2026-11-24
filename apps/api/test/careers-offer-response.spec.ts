import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CareersService } from "../src/careers/careers.service";
import type { PrismaService } from "../src/prisma.service";

const token = "a".repeat(64);

function serviceWith(prisma: Record<string, unknown>): CareersService {
  return new CareersService(prisma as unknown as PrismaService, {} as never);
}

describe("public offer responses", () => {
  it("stores only token hashes and atomically accepts the candidate response", async () => {
    const offerId = "10000000-0000-4000-8000-000000000001";
    const applicationId = "20000000-0000-4000-8000-000000000001";
    const updateOffer = vi.fn().mockResolvedValue({ count: 1 });
    const updateApplication = vi.fn().mockResolvedValue({ id: applicationId });
    const audit = vi.fn().mockResolvedValue({});
    const tx = {
      jobOffer: { updateMany: updateOffer },
      jobApplication: { update: updateApplication },
      auditLog: { create: audit },
    };
    const prisma = {
      jobOffer: { findUnique: vi.fn().mockResolvedValue({
        id: offerId,
        applicationId,
        status: "SENT",
        offerExpiresAt: new Date(Date.now() + 60_000),
      }) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = serviceWith(prisma);

    await expect(service.respondToOffer({ decision: "ACCEPTED", token })).resolves.toEqual({ ok: true, decision: "ACCEPTED" });
    expect(prisma.jobOffer.findUnique).toHaveBeenCalledWith({
      where: { responseTokenHash: createHash("sha256").update(token).digest("hex") },
      select: { id: true, applicationId: true, status: true, offerExpiresAt: true },
    });
    expect(updateOffer).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: offerId, status: "SENT", responseTokenHash: createHash("sha256").update(token).digest("hex") }),
      data: expect.objectContaining({ status: "ACCEPTED", responseTokenHash: null }),
    }));
    expect(updateApplication).toHaveBeenCalledWith({ where: { id: applicationId }, data: { status: "OFFER_ACCEPTED" } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorRole: "PUBLIC", action: "CANDIDATE_OFFER_ACCEPTED" }) }));
  });

  it("expires the offer and invalidates the token before returning an expired response", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      jobOffer: { findUnique: vi.fn().mockResolvedValue({
        id: "10000000-0000-4000-8000-000000000002",
        applicationId: "20000000-0000-4000-8000-000000000002",
        status: "SENT",
        offerExpiresAt: new Date(Date.now() - 60_000),
      }), updateMany },
    };
    const service = serviceWith(prisma);

    await expect(service.respondToOffer({ decision: "ACCEPTED", token })).rejects.toMatchObject({ status: 410 });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "EXPIRED", responseTokenHash: null }),
    }));
  });
});
