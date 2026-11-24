import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  AttendanceCorrectionCreateSchema,
  AttendanceCorrectionDecisionSchema,
  AttendancePeriodLockSchema,
} from "@staffhub/shared";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AttendanceService } from "./attendance.service";

@Controller("attendance")
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get("today")
  today(@CurrentUser() user: AuthenticatedUser): Promise<Record<string, unknown>> {
    return this.attendance.today(user);
  }

  @Post("check-in")
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<Record<string, unknown>> {
    return this.attendance.checkIn(user, idempotencyKey);
  }

  @Post("check-out")
  checkOut(@CurrentUser() user: AuthenticatedUser): Promise<Record<string, unknown>> {
    return this.attendance.checkOut(user);
  }

  @Get("records")
  records(
    @CurrentUser() user: AuthenticatedUser,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("employeeId") employeeId: string | undefined,
  ): Promise<Record<string, unknown>[]> {
    return this.attendance.records(user, from, to, employeeId);
  }

  @Get("corrections")
  corrections(@CurrentUser() user: AuthenticatedUser): Promise<Record<string, unknown>[]> {
    return this.attendance.corrections(user);
  }

  @Post("corrections")
  createCorrection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    return this.attendance.createCorrection(user, AttendanceCorrectionCreateSchema.parse(body));
  }

  @Post("corrections/:id/approve")
  approveCorrection(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<Record<string, unknown>> {
    return this.attendance.decideCorrection(user, id, true);
  }

  @Post("corrections/:id/reject")
  rejectCorrection(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    const parsed = AttendanceCorrectionDecisionSchema.parse(body);
    return this.attendance.decideCorrection(user, id, false, parsed.reason);
  }

  @Get("period-locks")
  periodLocks(@CurrentUser() user: AuthenticatedUser): Promise<Record<string, unknown>[]> {
    return this.attendance.periodLocks(user);
  }

  @Post("period-locks")
  lockPeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    return this.attendance.lockPeriod(user, AttendancePeriodLockSchema.parse(body));
  }
}
