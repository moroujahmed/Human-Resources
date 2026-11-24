import { describe, expect, it } from "vitest";
import { PasswordPolicySchema } from "@staffhub/shared";
import { PasswordService } from "../src/auth/password.service";
import { ZodExceptionFilter } from "../src/zod-exception.filter";
import { z } from "zod";

describe("authentication primitives", () => {
  it("rejects passwords outside the documented policy", () => {
    expect(PasswordPolicySchema.safeParse("Strong1@Password").success).toBe(true);
    expect(PasswordPolicySchema.safeParse("lowercase123!").success).toBe(false);
  });

  it("hashes and verifies an Argon2id password", async () => {
    const passwords = new PasswordService();
    const hash = await passwords.hash("Strong1@Password");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await passwords.verify(hash, "Strong1@Password")).toBe(true);
    expect(await passwords.verify(hash, "Wrong1@Password")).toBe(false);
  });

  it("maps Zod validation failures to a bad-request response", () => {
    const filter = new ZodExceptionFilter();
    let statusCode = 0;
    let body: unknown;
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return payload;
      },
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    };
    const result = z.object({ phone: z.string() }).parse;
    try {
      result({});
    } catch (error) {
      filter.catch(error as z.ZodError, host as never);
    }
    expect(statusCode).toBe(400);
    expect(body).toMatchObject({ error: "VALIDATION_ERROR" });
  });
});
