import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ManagerReviewSchema, PerformanceReviewCreateSchema, SelfAssessmentSchema } from "@staffhub/shared";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PerformanceService } from "./performance.service";

@Controller("performance")
@UseGuards(JwtAuthGuard)
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Get("reviews")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.performance.list(user);
  }

  @Post("reviews")
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.performance.create(user, PerformanceReviewCreateSchema.parse(body));
  }

  @Patch("reviews/:id/self-assessment")
  submitSelfAssessment(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.performance.submitSelfAssessment(user, id, SelfAssessmentSchema.parse(body));
  }

  @Patch("reviews/:id/manager-review")
  submitManagerReview(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.performance.submitManagerReview(user, id, ManagerReviewSchema.parse(body));
  }
}
