import { Injectable, BadRequestException, ForbiddenException, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import type { StaffHubRole } from "@staffhub/shared";
import { PrismaService } from "../prisma.service";
import { PasswordService } from "./password.service";
import type { AccessTokenPayload, AuthenticatedUser } from "./auth.types";
import { PasswordResetMailService } from "./password-reset-mail.service";

const REFRESH_COOKIE = "staffhub_rt";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
    private readonly passwordResetMail: PasswordResetMailService,
  ) {}

  private accessSecret(): string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("JWT_ACCESS_SECRET is required in production");
    }
    return secret ?? "staffhub-local-access-development-secret";
  }

  private csrfSecret(): string {
    const secret = process.env.CSRF_HMAC_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("CSRF_HMAC_SECRET is required in production");
    }
    return secret ?? "staffhub-local-csrf-development-secret";
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashRefreshToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  private csrfToken(rawRefreshToken: string): string {
    return createHmac("sha256", this.csrfSecret()).update(rawRefreshToken).digest("base64url");
  }

  private auditChecksum(action: string, entityId: string): string {
    return createHash("sha256").update(`${action}:${entityId}:${new Date().toISOString()}`).digest("hex");
  }

  private verifyCsrf(rawRefreshToken: string, provided: string): boolean {
    const expected = Buffer.from(this.csrfToken(rawRefreshToken));
    const actual = Buffer.from(provided);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private cookieOptions(): Record<string, boolean | number | string> {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: REFRESH_TTL_MS,
    };
  }

  async login(email: string, password: string, response: Response): Promise<Record<string, unknown>> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
      include: { employee: { select: { id: true } } },
    });
    if (!user) throw new UnauthorizedException("UNAUTHORIZED");
    if (!user.isActive) throw new UnauthorizedException("ACCOUNT_DEACTIVATED");
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException("ACCOUNT_LOCKED");
    }
    const valid = await this.password.verify(user.passwordHash, password);
    if (!valid) {
      const failedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
      const failedAttempts = failedUser.failedLoginAttempts;
      const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      if (lockedUntil) await this.prisma.user.update({ where: { id: user.id }, data: { lockedUntil } });
      if (lockedUntil) {
        await this.prisma.auditLog.create({
          data: {
            actorUserId: user.id,
            actorRole: user.role,
            action: "AUTH_ACCOUNT_LOCKED",
            entityType: "User",
            entityId: user.id,
            checksumSha256: this.auditChecksum("AUTH_ACCOUNT_LOCKED", user.id),
          },
        });
        throw new ForbiddenException("ACCOUNT_LOCKED");
      }
      throw new UnauthorizedException("UNAUTHORIZED");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    if (user.mustChangePassword) {
      const tempToken = await this.jwt.signAsync(
        {
          sub: user.id,
          role: user.role,
          employeeId: user.employee?.id ?? null,
          authzVersion: user.authzVersion,
          jti: randomUUID(),
          scope: "PASSWORD_RESET_ONLY",
        } satisfies AccessTokenPayload,
        { secret: this.accessSecret(), expiresIn: "10m" },
      );
      return { passwordChangeRequired: true, tempToken };
    }

    const session = await this.issueRefreshSession(user.id, user.role, user.authzVersion, user.employee?.id ?? null, response);
    return {
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employeeId: user.employee?.id ?? null,
        mustChangePassword: false,
      },
    };
  }

  private async issueRefreshSession(
    userId: string,
    role: StaffHubRole,
    authzVersion: number,
    employeeId: string | null,
    response: Response,
    familyId: `${string}-${string}-${string}-${string}-${string}` = randomUUID(),
  ): Promise<{ accessToken: string; csrfToken: string }> {
    const rawRefreshToken = randomBytes(64).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(rawRefreshToken),
        familyId,
        expiresAt,
      },
    });
    const accessToken = await this.jwt.signAsync(
      {
        sub: userId,
        role,
        employeeId,
        authzVersion,
        jti: randomUUID(),
      } satisfies AccessTokenPayload,
      { secret: this.accessSecret(), expiresIn: "15m" },
    );
    response.cookie(REFRESH_COOKIE, rawRefreshToken, this.cookieOptions());
    return { accessToken, csrfToken: this.csrfToken(rawRefreshToken) };
  }

  async csrf(rawRefreshToken: string | undefined): Promise<Record<string, string>> {
    if (!rawRefreshToken) throw new UnauthorizedException("UNAUTHORIZED");
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashRefreshToken(rawRefreshToken) },
      include: { user: true },
    });
    if (!token || token.revokedAt || token.expiresAt <= new Date() || !token.user.isActive) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }
    return { csrfToken: this.csrfToken(rawRefreshToken) };
  }

  async refresh(rawRefreshToken: string | undefined, csrfToken: string | undefined, response: Response): Promise<Record<string, string>> {
    if (!rawRefreshToken || !csrfToken || !this.verifyCsrf(rawRefreshToken, csrfToken)) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashRefreshToken(rawRefreshToken) },
      include: { user: { include: { employee: { select: { id: true } } } } },
    });
    if (!token) throw new UnauthorizedException("UNAUTHORIZED");
    if (token.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: token.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("UNAUTHORIZED");
    }
    if (token.expiresAt <= new Date() || !token.user.isActive) {
      throw new UnauthorizedException("ACCOUNT_DEACTIVATED");
    }
    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });
    return this.issueRefreshSession(
      token.userId,
      token.user.role,
      token.user.authzVersion,
      token.user.employee?.id ?? null,
      response,
      token.familyId as `${string}-${string}-${string}-${string}-${string}`,
    );
  }

  async logout(rawRefreshToken: string | undefined, csrfToken: string | undefined, response: Response): Promise<Record<string, boolean>> {
    if (!rawRefreshToken || !csrfToken) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }
    if (!this.verifyCsrf(rawRefreshToken, csrfToken)) {
      throw new UnauthorizedException("UNAUTHORIZED");
    }
    if (rawRefreshToken && csrfToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.hashRefreshToken(rawRefreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    response.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/auth" });
    return { ok: true };
  }

  async me(user: AuthenticatedUser): Promise<Record<string, unknown>> {
    const unreadActionCount = await this.prisma.notification.count({
      where: { userId: user.id, isRead: false, resolvedAt: null },
    });
    const allowedNavRoutes: Record<StaffHubRole, string[]> = {
      SYSTEM_ADMIN: ["/admin", "/employees", "/audit"],
      HR_MANAGER: ["/recruitment", "/employees", "/leave", "/offboarding", "/payroll"],
      RECRUITER: ["/recruitment"],
      LINE_MANAGER: ["/team", "/attendance", "/leave", "/performance"],
      PAYROLL_OFFICER: ["/payroll"],
      ASSET_OFFICER: ["/assets"],
      EMPLOYEE: ["/self", "/attendance", "/leave", "/payslips", "/assets"],
    };
    return {
      user,
      employeeSummary: user.employeeId ? { id: user.employeeId } : null,
      allowedNavRoutes: allowedNavRoutes[user.role],
      unreadActionCount,
    };
  }

  async changePassword(authorization: string | undefined, currentPassword: string, newPassword: string): Promise<Record<string, boolean>> {
    if (!authorization?.startsWith("Bearer ")) throw new UnauthorizedException("UNAUTHORIZED");
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(authorization.slice(7), { secret: this.accessSecret() });
    } catch {
      throw new UnauthorizedException("TOKEN_EXPIRED");
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException("ACCOUNT_DEACTIVATED");
    if (payload.authzVersion !== user.authzVersion) throw new UnauthorizedException("UNAUTHORIZED");
    if (!(await this.password.verify(user.passwordHash, currentPassword))) {
      throw new BadRequestException("INVALID_CURRENT_PASSWORD");
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.password.hash(newPassword), mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null, authzVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "AUTH_PASSWORD_CHANGED",
          entityType: "User",
          entityId: user.id,
          checksumSha256: this.auditChecksum("AUTH_PASSWORD_CHANGED", user.id),
        },
      }),
    ]);
    return { ok: true };
  }

  async forgotPassword(email: string): Promise<Record<string, boolean>> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (user?.isActive) {
      await this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null, expiresAt: { lte: new Date() } },
      });
      const rawToken = randomBytes(64).toString("base64url");
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(rawToken).digest("hex"),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      await this.passwordResetMail.send(normalizedEmail, rawToken).catch((error: unknown) => {
        this.logger.error("Password reset email delivery failed", error instanceof Error ? error.stack : String(error));
      });
    }
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<Record<string, boolean>> {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date() || !reset.user.isActive) {
      throw new UnauthorizedException("INVALID_OR_EXPIRED_RESET_TOKEN");
    }
    const passwordHash = await this.password.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw new UnauthorizedException("INVALID_OR_EXPIRED_RESET_TOKEN");
      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null, authzVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: reset.userId,
          actorRole: reset.user.role,
          action: "AUTH_PASSWORD_RESET",
          entityType: "User",
          entityId: reset.userId,
          checksumSha256: this.auditChecksum("AUTH_PASSWORD_RESET", reset.userId),
        },
      });
    });
    return { ok: true };
  }
}
