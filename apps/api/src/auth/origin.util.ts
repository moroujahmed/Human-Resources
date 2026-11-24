import { BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import { parseCorsOrigins } from "../cors-origins";

export function requireTrustedOrigin(req: Request): string {
  const origin = req.headers.origin;
  if (typeof origin !== "string") {
    throw new BadRequestException("Origin is required");
  }
  const allowed = parseCorsOrigins(
    process.env.CORS_ORIGIN,
    process.env.NODE_ENV === "production",
  );
  if (!allowed.includes(origin)) {
    throw new BadRequestException("Origin is not allowed");
  }
  return origin;
}
