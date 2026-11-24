import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminService } from "../src/admin/admin.service";
import type { PrismaService } from "../src/prisma.service";

function serviceWith(prisma: Record<string, unknown>): AdminService {
  return new AdminService(prisma as unknown as PrismaService);
}

describe("protected scheduled jobs", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CRON_SHARED_SECRET;
  });

  it("reconciles an eligible scheduled workday as absent with duplicate-safe inserts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T12:00:00.000Z"));
    process.env.CRON_SHARED_SECRET = "test-cron-secret";
    const createMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const prisma = {
      publicHoliday: { findUnique: vi.fn().mockResolvedValue(null) },
      employee: { findMany: vi.fn().mockResolvedValue([{
        id: "employee-1",
        status: "ACTIVE",
        hireDate: new Date("2025-01-01T00:00:00.000Z"),
        lastWorkingDay: null,
        workScheduleId: "schedule-1",
        workSchedule: { workingDaysBitmap: [1, 2, 3, 4, 5] },
      }]) },
      leaveRequest: { findFirst: vi.fn().mockResolvedValue(null) },
      attendanceRecord: {
        findUnique: vi.fn().mockResolvedValue(null),
        createMany,
      },
    };

    const result = await serviceWith(prisma).runInternalJob("test-cron-secret", "reconcile-attendance");

    expect(result).toEqual({ reconciled: 1, flaggedMissedCheckouts: 0 });
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({ employeeId: "employee-1", status: "ABSENT", notes: expect.stringContaining("absent") })],
    }));
    await expect(serviceWith(prisma).runInternalJob("test-cron-secret", "reconcile-attendance"))
      .resolves.toEqual({ reconciled: 0, flaggedMissedCheckouts: 0 });
  });

  it("does not claim that unimplemented jobs were processed", async () => {
    process.env.CRON_SHARED_SECRET = "test-cron-secret";
    const service = serviceWith({});

    await expect(service.runInternalJob("test-cron-secret", "process-async-outbox"))
      .rejects.toMatchObject({ status: 501, response: { message: "OUTBOX_HANDLERS_NOT_CONFIGURED" } });
    await expect(service.runInternalJob("test-cron-secret", "rollover-leave-balances"))
      .rejects.toMatchObject({ status: 501, response: { message: "LEAVE_ROLLOVER_POLICY_REQUIRED" } });
  });
});
