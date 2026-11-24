import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import { EmployeeContactUpdateSchema } from "@staffhub/shared";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { EmployeesService } from "./employees.service";

@Controller("employees")
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get("self")
  getSelf(@CurrentUser() user: AuthenticatedUser): Promise<Record<string, unknown>> {
    return this.employees.getSelf(user.id);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("departmentId") departmentId?: string) {
    return this.employees.directory(user, departmentId);
  }

  @Get(":id")
  getById(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.employees.getById(user, id);
  }

  @Patch("self/contact")
  updateSelfContact(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    const parsed = EmployeeContactUpdateSchema.parse(body);
    return this.employees.updateSelfContact(user.id, parsed);
  }
}
