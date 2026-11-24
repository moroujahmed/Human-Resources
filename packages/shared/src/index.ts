import { z } from "zod";

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, { message: "Expected a valid calendar date" });

export const StaffHubRoleSchema = z.enum([
  "SYSTEM_ADMIN",
  "HR_MANAGER",
  "RECRUITER",
  "LINE_MANAGER",
  "PAYROLL_OFFICER",
  "ASSET_OFFICER",
  "EMPLOYEE",
]);

export type StaffHubRole = z.infer<typeof StaffHubRoleSchema>;

export const PasswordPolicySchema = z
  .string()
  .min(10)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

export const LoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(1024),
}).strict();

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: PasswordPolicySchema,
}).strict();

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
}).strict();

export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(32).max(1024),
  newPassword: PasswordPolicySchema,
}).strict();

export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const EmployeeContactUpdateSchema = z.object({
  phone: z.string().trim().min(7).max(40).optional(),
  personalEmail: z.string().trim().toLowerCase().email().max(255).optional(),
}).strict().refine((value) => value.phone !== undefined || value.personalEmail !== undefined, {
  message: "At least one contact field is required",
});

export type EmployeeContactUpdate = z.infer<typeof EmployeeContactUpdateSchema>;

export const LeaveHalfDaySchema = z.enum(["FULL", "MORNING", "AFTERNOON"]);
export type LeaveHalfDay = z.infer<typeof LeaveHalfDaySchema>;

export const LeaveCalculateSchema = z.object({
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  halfDayPeriod: LeaveHalfDaySchema.optional().default("FULL"),
}).strict();

export type LeaveCalculate = z.infer<typeof LeaveCalculateSchema>;

export const LeaveCreateSchema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  halfDayPeriod: LeaveHalfDaySchema.optional().default("FULL"),
  reason: z.string().trim().min(1).max(2000),
  handoverEmployeeId: z.string().uuid().optional(),
}).strict();

export type LeaveCreate = z.infer<typeof LeaveCreateSchema>;

export const LeaveDecisionSchema = z.object({
  reason: z.string().trim().min(1).max(2000).optional(),
}).strict();

export type LeaveDecision = z.infer<typeof LeaveDecisionSchema>;

export const AdminUserCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  role: StaffHubRoleSchema,
  password: PasswordPolicySchema.optional(),
}).strict();
export type AdminUserCreate = z.infer<typeof AdminUserCreateSchema>;

export const UserRoleUpdateSchema = z.object({ role: StaffHubRoleSchema }).strict();
export type UserRoleUpdate = z.infer<typeof UserRoleUpdateSchema>;

export const WorkScheduleCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  shiftStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  shiftEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  gracePeriodMinutes: z.number().int().min(0).max(180).default(15),
  workingDaysBitmap: z.array(z.number().int().min(1).max(7)).min(1).max(7).default([1, 2, 3, 4, 5]).refine((days) => new Set(days).size === days.length),
  isDefault: z.boolean().default(false),
}).strict().refine((value) => value.shiftStartTime !== value.shiftEndTime, { message: "Shift start and end must differ" });
export type WorkScheduleCreate = z.infer<typeof WorkScheduleCreateSchema>;

export const PublicHolidayCreateSchema = z.object({
  holidayDate: IsoDateSchema,
  name: z.string().trim().min(2).max(150),
}).strict();
export type PublicHolidayCreate = z.infer<typeof PublicHolidayCreateSchema>;

export const AssetConditionSchema = z.enum(["NEW", "GOOD", "FAIR", "DAMAGED", "LOST", "RETIRED"]);
export const AssetCreateSchema = z.object({
  assetTag: z.string().trim().min(1).max(80),
  serialNumber: z.string().trim().max(120).optional(),
  name: z.string().trim().min(2).max(150),
  category: z.string().trim().min(2).max(80),
  purchaseValueUgx: z.number().finite().nonnegative().max(1_000_000_000_000).optional(),
  condition: AssetConditionSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict();
export type AssetCreate = z.infer<typeof AssetCreateSchema>;

export const AssetUpdateSchema = AssetCreateSchema.partial().extend({ version: z.number().int().min(1) }).strict();
export type AssetUpdate = z.infer<typeof AssetUpdateSchema>;

export const AssetIssueSchema = z.object({ employeeId: z.string().uuid() }).strict();
export const AssetReturnSchema = z.object({
  returnCondition: AssetConditionSchema.exclude(["RETIRED"]),
  notes: z.string().trim().max(2000).optional(),
}).strict();
export const AssetIncidentSchema = z.object({
  outcome: z.enum(["CLOSED_DAMAGED", "CLOSED_LOST"]),
  incidentNotes: z.string().trim().min(10).max(2000),
}).strict();

export const PayrollItemUpdateSchema = z.object({
  bonusOrArrearsUgx: z.number().finite().nonnegative().max(1_000_000_000).optional(),
  otherDeductionsUgx: z.number().finite().nonnegative().max(1_000_000_000).optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one payroll field is required" });

export const OffboardingCreateSchema = z.object({
  employeeId: z.string().uuid(),
  exitType: z.enum(["RESIGNATION", "CONTRACT_EXPIRY", "TERMINATION", "RETIREMENT"]),
  noticeDate: IsoDateSchema,
  lastWorkingDay: IsoDateSchema,
  exitReason: z.string().trim().min(5).max(2000),
}).strict().refine((value) => value.lastWorkingDay >= value.noticeDate, { message: "Last working day must not be before notice date" });
export type OffboardingCreate = z.infer<typeof OffboardingCreateSchema>;

export const OffboardingClearanceTrackSchema = z.enum(["ASSET_RETURN", "OPERATIONAL_HANDOVER", "FINANCE_LOANS", "HR_EXIT"]);
export const ClearanceSignoffSchema = z.object({ notes: z.string().trim().max(2000).optional() }).strict();

export const AttendanceCorrectionCreateSchema = z.object({
  workDate: IsoDateSchema,
  requestedCheckInAt: z.string().datetime(),
  requestedCheckOutAt: z.string().datetime().optional(),
  reason: z.string().trim().min(10).max(2000),
}).strict();

export type AttendanceCorrectionCreate = z.infer<typeof AttendanceCorrectionCreateSchema>;

export const AttendanceCorrectionDecisionSchema = z.object({
  reason: z.string().trim().min(10).max(2000).optional(),
}).strict();

export type AttendanceCorrectionDecision = z.infer<typeof AttendanceCorrectionDecisionSchema>;

export const AttendancePeriodLockSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
}).strict();

export type AttendancePeriodLock = z.infer<typeof AttendancePeriodLockSchema>;

export const PublicApplicationSchema = z.object({
  fullName: z.string().trim().min(3).max(150),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().min(7).max(40),
  expectedGrossUgx: z.coerce.number().int().nonnegative().optional(),
  earliestStartDate: IsoDateSchema.optional(),
  coverNote: z.string().trim().min(10).max(5000),
  turnstileToken: z.string().trim().min(1).optional(),
}).strict();

export type PublicApplication = z.infer<typeof PublicApplicationSchema>;

export const RequisitionCreateSchema = z.object({
  departmentId: z.string().uuid(),
  jobTitle: z.string().trim().min(3).max(150),
  headcount: z.number().int().min(1).max(100).default(1),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]),
  justification: z.string().trim().min(10).max(3000),
  targetStartDate: IsoDateSchema,
}).strict();

export type RequisitionCreate = z.infer<typeof RequisitionCreateSchema>;

export const RequisitionDecisionSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
}).strict();

export const VacancyStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED", "FILLED"]);

export const VacancyCreateSchema = z.object({
  requisitionId: z.string().uuid(),
  title: z.string().trim().min(3).max(150),
  location: z.string().trim().min(2).max(120).default("Kampala HQ"),
  description: z.string().trim().min(10).max(10000),
  requirements: z.string().trim().min(10).max(10000),
  salaryBandMinUgx: z.number().int().nonnegative().optional(),
  salaryBandMaxUgx: z.number().int().nonnegative().optional(),
  closingAt: z.string().datetime(),
}).strict();

export type VacancyCreate = z.infer<typeof VacancyCreateSchema>;

export const ApplicationStageSchema = z.object({
  status: z.enum(["APPLIED", "SHORTLISTED", "INTERVIEWING", "OFFERED", "REJECTED", "OFFER_ACCEPTED"]),
  stageNotes: z.string().trim().min(10).max(3000).optional(),
}).strict().refine((value) => value.status !== "REJECTED" || value.stageNotes !== undefined, {
  message: "A rejection reason is required",
});

export type ApplicationStage = z.infer<typeof ApplicationStageSchema>;

export const InterviewCreateSchema = z.object({
  scheduledAt: z.string().datetime(),
  interviewMode: z.enum(["IN_PERSON", "VIDEO", "PHONE"]),
  locationOrLink: z.string().trim().min(3).max(255),
  interviewerUserIds: z.array(z.string().uuid()).min(1).max(12).refine((ids) => new Set(ids).size === ids.length),
}).strict().superRefine((value, context) => {
  if (value.interviewMode === "VIDEO") {
    try {
      if (new URL(value.locationOrLink).protocol !== "https:") throw new Error("HTTPS required");
    } catch {
      context.addIssue({ code: "custom", path: ["locationOrLink"], message: "Video interview links must use HTTPS" });
    }
  }
});
export type InterviewCreate = z.infer<typeof InterviewCreateSchema>;

export const InterviewReviewSchema = z.object({
  score: z.number().min(1).max(5),
  feedback: z.string().trim().min(10).max(5000),
  outcome: z.enum(["COMPLETED", "ADVANCE", "REJECT"]),
}).strict();
export type InterviewReview = z.infer<typeof InterviewReviewSchema>;

export const PerformanceReviewCreateSchema = z.object({
  employeeId: z.string().uuid(),
  reviewPeriod: z.string().trim().min(3).max(60),
  objectives: z.array(z.string().trim().min(3).max(500)).min(1).max(12),
}).strict();
export type PerformanceReviewCreate = z.infer<typeof PerformanceReviewCreateSchema>;

export const SelfAssessmentSchema = z.object({
  selfAssessment: z.string().trim().min(20).max(10000),
}).strict();
export type SelfAssessment = z.infer<typeof SelfAssessmentSchema>;

export const ManagerReviewSchema = z.object({
  managerFeedback: z.string().trim().min(20).max(10000),
  rating: z.number().min(1).max(5),
}).strict();
export type ManagerReview = z.infer<typeof ManagerReviewSchema>;

export const JobOfferCreateSchema = z.object({
  offeredJobTitle: z.string().trim().min(3).max(150),
  departmentId: z.string().uuid(),
  reportingManagerId: z.string().uuid().optional(),
  offeredBaseSalaryUgx: z.number().int().positive(),
  offeredAllowancesUgx: z.number().int().nonnegative().default(0),
  proposedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  offerExpiresAt: z.string().datetime(),
}).strict();

export type JobOfferCreate = z.infer<typeof JobOfferCreateSchema>;

export const OnboardingTaskUpdateSchema = z.object({ isCompleted: z.boolean() }).strict();
export type OnboardingTaskUpdate = z.infer<typeof OnboardingTaskUpdateSchema>;

export const OfferDecisionSchema = z.object({
  decision: z.enum(["ACCEPTED", "DECLINED"]),
  notes: z.string().trim().max(2000).optional(),
}).strict();
export type OfferDecision = z.infer<typeof OfferDecisionSchema>;

export const PublicOfferDecisionSchema = OfferDecisionSchema.extend({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/),
}).strict();
export type PublicOfferDecision = z.infer<typeof PublicOfferDecisionSchema>;

export const ApiHealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
});

export type ApiHealthResponse = z.infer<typeof ApiHealthResponseSchema>;
