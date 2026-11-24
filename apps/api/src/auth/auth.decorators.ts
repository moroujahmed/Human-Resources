import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedUser } from "./auth.types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request & { authUser?: AuthenticatedUser }>();
    if (!request.authUser) throw new Error("Authenticated user is missing");
    return request.authUser;
  },
);
