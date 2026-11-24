import { BadRequestException, Body, Controller, Get, Headers, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  ChangePasswordRequestSchema,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  ResetPasswordRequestSchema,
} from "@staffhub/shared";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { CurrentUser } from "./auth.decorators";
import type { AuthenticatedUser } from "./auth.types";
import { requireTrustedOrigin } from "./origin.util";
import { Throttle } from "@nestjs/throttler";

type CookieRequest = Request & { cookies?: Record<string, string> };

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  async login(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    requireTrustedOrigin(request);
    const parsed = LoginRequestSchema.parse(body);
    return this.auth.login(parsed.email, parsed.password, response);
  }

  @Post("csrf")
  async csrf(
    @Req() request: CookieRequest,
  ): Promise<Record<string, string>> {
    requireTrustedOrigin(request);
    if (!request.headers["content-type"]?.toLowerCase().includes("application/json")) {
      throw new BadRequestException("Content-Type must be application/json");
    }
    return this.auth.csrf(request.cookies?.staffhub_rt);
  }

  @Post("refresh")
  async refresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
    @Headers("x-csrf-token") csrfToken: string | undefined,
  ): Promise<Record<string, string>> {
    requireTrustedOrigin(request);
    return this.auth.refresh(request.cookies?.staffhub_rt, csrfToken, response);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
    @Headers("x-csrf-token") csrfToken: string | undefined,
  ): Promise<Record<string, boolean>> {
    requireTrustedOrigin(request);
    return this.auth.logout(request.cookies?.staffhub_rt, csrfToken, response);
  }

  @Post("change-password")
  async changePassword(
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<Record<string, boolean>> {
    const parsed = ChangePasswordRequestSchema.parse(body);
    return this.auth.changePassword(
      request.headers.authorization,
      parsed.currentPassword,
      parsed.newPassword,
    );
  }

  @Post("forgot-password")
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  async forgotPassword(@Req() request: Request, @Body() body: unknown): Promise<Record<string, boolean>> {
    requireTrustedOrigin(request);
    const parsed = ForgotPasswordRequestSchema.parse(body);
    return this.auth.forgotPassword(parsed.email);
  }

  @Post("reset-password")
  async resetPassword(@Req() request: Request, @Body() body: unknown): Promise<Record<string, boolean>> {
    requireTrustedOrigin(request);
    const parsed = ResetPasswordRequestSchema.parse(body);
    return this.auth.resetPassword(parsed.token, parsed.newPassword);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<Record<string, unknown>> {
    return this.auth.me(user);
  }
}
