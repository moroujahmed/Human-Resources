import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminService } from "./admin.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("admin/users")
  users(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.users(user);
  }

  @Get("admin/departments")
  departments() {
    return this.admin.departments();
  }

  @Post("admin/users")
  createUser(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.admin.createUser(user, body);
  }

  @Patch("admin/users/:id/role")
  role(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.admin.updateRole(user, id, body);
  }

  @Get("admin/schedules")
  schedules() {
    return this.admin.schedules();
  }

  @Post("admin/schedules")
  createSchedule(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.admin.createSchedule(user, body);
  }

  @Get("admin/holidays")
  holidays() {
    return this.admin.holidays();
  }

  @Post("admin/holidays")
  createHoliday(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.admin.createHoliday(user, body);
  }

  @Get("audit/logs")
  audit(
    @CurrentUser() user: AuthenticatedUser,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("actorId") actorId: string | undefined,
    @Query("action") action: string | undefined,
    @Query("entityType") entityType: string | undefined,
  ) {
    return this.admin.audit(user, { from, to, actorId, action, entityType });
  }

  @Get("notifications/inbox")
  notifications(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.notifications(user);
  }

  @Patch("notifications/:id/read")
  readNotification(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.admin.readNotification(user, id);
  }

  @Post("internal/jobs/:job")
  internalJob(
    @Headers("x-cron-secret") secret: string | undefined,
    @Param("job") job: string,
  ) {
    return this.admin.runInternalJob(secret, job);
  }
}
