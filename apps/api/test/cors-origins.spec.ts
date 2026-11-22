import { describe, expect, it } from "vitest";
import { parseCorsOrigins } from "../src/cors-origins";

describe("CORS origin configuration", () => {
  it("parses an exact origin allowlist", () => {
    expect(
      parseCorsOrigins("https://app.example.com, https://admin.example.com"),
    ).toEqual(["https://app.example.com", "https://admin.example.com"]);
  });

  it.each(["*", "null", "https://*.example.com", "https://example.com/path"])(
    "rejects a non-exact origin value: %s",
    (value) => {
      expect(() => parseCorsOrigins(value)).toThrow(
        "CORS_ORIGIN must contain exact HTTP(S) origins only",
      );
    },
  );

  it("requires explicit origins in production", () => {
    expect(() => parseCorsOrigins(undefined, true)).toThrow(
      "CORS_ORIGIN must be explicitly configured in production",
    );
  });

  it("requires HTTPS origins in production", () => {
    expect(() => parseCorsOrigins("http://app.example.com", true)).toThrow(
      "CORS_ORIGIN must use HTTPS in production",
    );
  });
});
