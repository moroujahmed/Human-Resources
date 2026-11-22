import { describe, expect, it } from "vitest";
import { ApiHealthResponseSchema, StaffHubRoleSchema } from "./index";

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
});
