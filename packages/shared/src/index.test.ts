import { describe, expect, it } from "vitest";
import {
  ApiHealthResponseSchema,
  EmployeeContactUpdateSchema,
  LeaveCalculateSchema,
  LeaveCreateSchema,
  LeaveDecisionSchema,
  AttendanceCorrectionCreateSchema,
  AttendancePeriodLockSchema,
  LoginRequestSchema,
  PasswordPolicySchema,
  StaffHubRoleSchema,
  AdminUserCreateSchema,
  AssetCreateSchema,
  AssetUpdateSchema,
  IsoDateSchema,
  WorkScheduleCreateSchema,
  OnboardingTaskUpdateSchema,
  OfferDecisionSchema,
  PublicOfferDecisionSchema,
  InterviewCreateSchema,
  InterviewReviewSchema,
} from "./index";

describe("shared contracts", () => {
  it("accepts the documented internal roles", () => {
    expect(StaffHubRoleSchema.safeParse("PAYROLL_OFFICER").success).toBe(true);
    expect(StaffHubRoleSchema.safeParse("SUPER_ADMIN").success).toBe(false);
  });

  it("validates the API health response shape", () => {
    expect(
      ApiHealthResponseSchema.safeParse({ status: "ok", service: "api" }).success,
    ).toBe(true);
    expect(
      ApiHealthResponseSchema.safeParse({ status: "ok", service: "web" }).success,
    ).toBe(false);
  });

  it("validates login and password policy contracts", () => {
    expect(LoginRequestSchema.safeParse({ email: " User@Example.com ", password: "secret" }).success).toBe(true);
    expect(PasswordPolicySchema.safeParse("Strong1@Password").success).toBe(true);
    expect(PasswordPolicySchema.safeParse("weakpassword").success).toBe(false);
  });

  it("rejects mass-assigned employee contact payloads", () => {
    expect(EmployeeContactUpdateSchema.safeParse({ phone: "+256700123456" }).success).toBe(true);
    expect(EmployeeContactUpdateSchema.safeParse({ role: "SYSTEM_ADMIN", baseSalaryUgx: 99000000 }).success).toBe(false);
    expect(EmployeeContactUpdateSchema.safeParse({ phone: "+256700123456", role: "SYSTEM_ADMIN" }).success).toBe(false);
  });

  it("validates leave calculation, submission, and mandatory decisions", () => {
    expect(LeaveCalculateSchema.safeParse({ startDate: "2026-11-23", endDate: "2026-11-24" }).success).toBe(true);
    expect(LeaveCreateSchema.safeParse({
      leaveTypeId: "00000000-0000-4000-8000-000000000001",
      startDate: "2026-11-23",
      endDate: "2026-11-24",
      reason: "Study",
    }).success).toBe(true);
    expect(LeaveDecisionSchema.safeParse({ reason: " " }).success).toBe(false);
  });

  it("validates attendance corrections and period locks", () => {
    expect(AttendanceCorrectionCreateSchema.safeParse({
      workDate: "2026-11-17",
      requestedCheckInAt: "2026-11-17T05:00:00.000Z",
      requestedCheckOutAt: "2026-11-17T14:00:00.000Z",
      reason: "Missed browser check-out during outage",
    }).success).toBe(true);
    expect(AttendancePeriodLockSchema.safeParse({ year: 2026, month: 10 }).success).toBe(true);
    expect(AttendancePeriodLockSchema.safeParse({ year: 2026, month: 13 }).success).toBe(false);
  });

  it("rejects invalid calendar dates and mass-assigned administration or asset fields", () => {
    expect(IsoDateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(AdminUserCreateSchema.safeParse({ email: "admin@example.test", role: "HR_MANAGER", isActive: false }).success).toBe(false);
    expect(AssetCreateSchema.safeParse({ assetTag: "LAP-1", name: "Laptop", category: "IT", ownerId: "someone" }).success).toBe(false);
    expect(AssetUpdateSchema.safeParse({ name: "Laptop" }).success).toBe(false);
  });

  it("validates work shift ranges and weekdays", () => {
    expect(WorkScheduleCreateSchema.safeParse({ name: "Standard", shiftStartTime: "08:00", shiftEndTime: "17:00" }).success).toBe(true);
    expect(WorkScheduleCreateSchema.safeParse({ name: "Invalid", shiftStartTime: "08:00", shiftEndTime: "08:00" }).success).toBe(false);
    expect(WorkScheduleCreateSchema.safeParse({ name: "Invalid", shiftStartTime: "08:00", shiftEndTime: "17:00", workingDaysBitmap: [1, 1] }).success).toBe(false);
  });

  it("accepts only the onboarding task completion field", () => {
    expect(OnboardingTaskUpdateSchema.safeParse({ isCompleted: true }).success).toBe(true);
    expect(OnboardingTaskUpdateSchema.safeParse({ isCompleted: true, assignedRole: "HR_MANAGER" }).success).toBe(false);
    expect(OnboardingTaskUpdateSchema.safeParse({ isCompleted: "yes" }).success).toBe(false);
  });

  it("validates one-time candidate offer decisions", () => {
    expect(OfferDecisionSchema.safeParse({ decision: "ACCEPTED" }).success).toBe(true);
    expect(OfferDecisionSchema.safeParse({ decision: "DECLINED", notes: "Accepted another role" }).success).toBe(true);
    expect(PublicOfferDecisionSchema.safeParse({ decision: "ACCEPTED", token: "x".repeat(64) }).success).toBe(true);
    expect(PublicOfferDecisionSchema.safeParse({ decision: "ACCEPTED", token: "short" }).success).toBe(false);
  });

  it("validates interview scheduling and panel reviews", () => {
    expect(InterviewCreateSchema.safeParse({
      scheduledAt: "2027-01-01T09:00:00.000Z", interviewMode: "VIDEO", locationOrLink: "https://meet.example.invalid/1",
      interviewerUserIds: ["10000000-0000-4000-8000-000000000001"],
    }).success).toBe(true);
    expect(InterviewCreateSchema.safeParse({
      scheduledAt: "tomorrow", interviewMode: "VIDEO", locationOrLink: "x", interviewerUserIds: [],
    }).success).toBe(false);
    expect(InterviewCreateSchema.safeParse({
      scheduledAt: "2027-01-01T09:00:00.000Z", interviewMode: "VIDEO", locationOrLink: "javascript:alert(1)",
      interviewerUserIds: ["10000000-0000-4000-8000-000000000001"],
    }).success).toBe(false);
    expect(InterviewReviewSchema.safeParse({ score: 4.5, feedback: "Strong experience and clear answers.", outcome: "ADVANCE" }).success).toBe(true);
    expect(InterviewReviewSchema.safeParse({ score: 6, feedback: "Good", outcome: "ADVANCE" }).success).toBe(false);
  });
});
