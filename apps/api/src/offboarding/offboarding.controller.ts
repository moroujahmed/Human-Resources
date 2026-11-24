import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ClearanceSignoffSchema, OffboardingClearanceTrackSchema, OffboardingCreateSchema } from "@staffhub/shared";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OffboardingService } from "./offboarding.service";

@Controller("offboarding")
@UseGuards(JwtAuthGuard)
export class OffboardingController {
  constructor(private readonly offboarding: OffboardingService) {}

  @Get("cases")
  cases(@CurrentUser() user: AuthenticatedUser) {
    return this.offboarding.cases(user);
  }

  @Get("cases/:id")
  caseDetails(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.offboarding.caseDetails(user, id);
  }

  @Post("cases")
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.offboarding.create(user, OffboardingCreateSchema.parse(body));
  }

  @Post("cases/:id/clearances/:trackType/sign-off")
  signOff(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("trackType") trackType: string,
    @Body() body: unknown,
  ) {
    return this.offboarding.signOff(user, id, OffboardingClearanceTrackSchema.parse(trackType), ClearanceSignoffSchema.parse(body));
  }

  @Post("cases/:id/finalize")
  finalize(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.offboarding.finalize(user, id);
  }

  @Post("cases/:id/deactivate")
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.offboarding.deactivate(user, id);
  }
}
