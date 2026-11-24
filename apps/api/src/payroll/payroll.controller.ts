import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PayrollService } from "./payroll.service";

@Controller("payroll")
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get("runs")
  runs(@CurrentUser() user: AuthenticatedUser) {
    return this.payroll.runs(user);
  }

  @Get("runs/:id")
  run(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.payroll.run(user, id);
  }

  @Post("runs")
  prepare(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: { year: number; month: number },
  ) {
    return this.payroll.prepare(user, body.year, body.month, idempotencyKey);
  }

  @Patch("runs/:runId/items/:itemId")
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("runId") runId: string,
    @Param("itemId") itemId: string,
    @Body() body: unknown,
  ) {
    return this.payroll.updateItem(user, runId, itemId, body);
  }

  @Post("runs/:id/submit")
  submit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.payroll.submit(user, id);
  }

  @Post("runs/:id/approve")
  approve(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.payroll.approve(user, id);
  }

  @Post("runs/:id/lock")
  lock(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ) {
    return this.payroll.lock(user, id, idempotencyKey);
  }

  @Get("my-payslips")
  myPayslips(@CurrentUser() user: AuthenticatedUser) {
    return this.payroll.myPayslips(user);
  }

  @Get("loans")
  loans(@CurrentUser() user: AuthenticatedUser) {
    return this.payroll.loans(user);
  }
}
