import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  LeaveCalculateSchema,
  LeaveCreateSchema,
  LeaveDecisionSchema,
} from "@staffhub/shared";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LeaveService } from "./leave.service";

@Controller("leave")
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get("types")
  types(): Promise<Record<string, unknown>[]> {
    return this.leave.types();
  }

  @Get("balances")
  balances(
    @CurrentUser() user: AuthenticatedUser,
    @Query("year") year: string | undefined,
    @Query("employeeId") employeeId: string | undefined,
  ): Promise<Record<string, unknown>[]> {
    return this.leave.balances(user, year ? Number(year) : undefined, employeeId);
  }

  @Post("calculate-working-days")
  calculate(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<Record<string, unknown>> {
    const parsed = LeaveCalculateSchema.parse(body);
    return this.leave.calculate(user, parsed);
  }

  @Get("requests")
  requests(
    @CurrentUser() user: AuthenticatedUser,
    @Query("pendingMyApproval") pendingMyApproval: string | undefined,
  ): Promise<Record<string, unknown>[]> {
    return this.leave.requests(user, pendingMyApproval === "true");
  }

  @Post("requests")
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    const parsed = LeaveCreateSchema.parse(body);
    return this.leave.submit(user, parsed, idempotencyKey);
  }

  @Post("requests/:id/approve")
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<Record<string, unknown>> {
    return this.leave.approve(user, id);
  }

  @Post("requests/:id/reject")
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    const parsed = LeaveDecisionSchema.parse(body);
    return this.leave.reject(user, id, parsed.reason);
  }

  @Post("requests/:id/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    const parsed = LeaveDecisionSchema.parse(body);
    return this.leave.cancel(user, id, parsed.reason);
  }
}
