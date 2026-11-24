import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma.service";
import type { AccessTokenPayload, AuthenticatedUser } from "./auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { authUser?: AuthenticatedUser }>();
    const authorization = request.headers.authorization;
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(authorization.slice(7), {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException("TOKEN_EXPIRED");
    }
    if (payload.scope === "PASSWORD_RESET_ONLY") {
      throw new UnauthorizedException("PASSWORD_CHANGE_REQUIRED");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { employee: { select: { id: true } } },
    });
    if (!user || !user.isActive) throw new UnauthorizedException("ACCOUNT_DEACTIVATED");
    if (user.role !== payload.role || user.authzVersion !== payload.authzVersion) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }
    request.authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee?.id ?? null,
      authzVersion: user.authzVersion,
      mustChangePassword: user.mustChangePassword,
    };
    if (user.mustChangePassword) throw new UnauthorizedException("PASSWORD_CHANGE_REQUIRED");
    return true;
  }
}
