import { z } from "zod";

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

export const ApiHealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
});

export type ApiHealthResponse = z.infer<typeof ApiHealthResponseSchema>;
