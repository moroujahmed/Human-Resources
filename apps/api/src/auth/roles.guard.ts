import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { StaffHubRole } from "@staffhub/shared";
import type { AuthenticatedUser } from "./auth.types";

export const ROLES_KEY = "staffhub_roles";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<StaffHubRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) return true;
    const request = context.switchToHttp().getRequest<Request & { authUser?: AuthenticatedUser }>();
    if (!request.authUser || !roles.includes(request.authUser.role)) {
      throw new ForbiddenException("FORBIDDEN");
    }
    return true;
  }
}
