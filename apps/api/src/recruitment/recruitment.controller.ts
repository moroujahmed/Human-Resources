import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApplicationStageSchema,
  InterviewCreateSchema,
  InterviewReviewSchema,
  JobOfferCreateSchema,
  OnboardingTaskUpdateSchema,
  OfferDecisionSchema,
  RequisitionDecisionSchema,
  RequisitionCreateSchema,
  VacancyCreateSchema,
  VacancyStatusSchema,
} from "@staffhub/shared";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RecruitmentService } from "./recruitment.service";

@Controller("recruitment")
@UseGuards(JwtAuthGuard)
export class RecruitmentController {
  constructor(private readonly recruitment: RecruitmentService) {}

  @Get("requisitions")
  requisitions(@CurrentUser() user: AuthenticatedUser) {
    return this.recruitment.requisitions(user);
  }

  @Post("requisitions")
  createRequisition(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.recruitment.createRequisition(user, RequisitionCreateSchema.parse(body));
  }

  @Post("requisitions/:id/approve")
  approveRequisition(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.recruitment.approveRequisition(user, id);
  }

  @Post("requisitions/:id/reject")
  rejectRequisition(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    const parsed = RequisitionDecisionSchema.parse(body);
    return this.recruitment.rejectRequisition(user, id, parsed.reason);
  }

  @Get("vacancies")
  vacancies(@CurrentUser() user: AuthenticatedUser, @Query("status") status: string | undefined) {
    return this.recruitment.vacancies(user, status ? VacancyStatusSchema.parse(status) : undefined);
  }

  @Get("interviewers")
  interviewers(@CurrentUser() user: AuthenticatedUser) {
    return this.recruitment.interviewers(user);
  }

  @Post("vacancies")
  createVacancy(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.recruitment.createVacancy(user, VacancyCreateSchema.parse(body));
  }

  @Post("vacancies/:id/publish")
  publishVacancy(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.recruitment.publishVacancy(user, id);
  }

  @Get("vacancies/:id/applications")
  applications(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.recruitment.applications(user, id);
  }

  @Get("applications/:id/cv-url")
  applicationCvUrl(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.recruitment.applicationCvUrl(user, id);
  }

  @Patch("applications/:id/stage")
  stageApplication(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.recruitment.stageApplication(user, id, ApplicationStageSchema.parse(body));
  }

  @Post("applications/:id/interviews")
  scheduleInterview(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.recruitment.scheduleInterview(user, id, InterviewCreateSchema.parse(body));
  }

  @Patch("interviews/:id")
  reviewInterview(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.recruitment.reviewInterview(user, id, InterviewReviewSchema.parse(body));
  }

  @Post("applications/:id/offers")
  createOffer(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.recruitment.createOffer(user, id, JobOfferCreateSchema.parse(body));
  }

  @Post("offers/:id/approve")
  approveOffer(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.recruitment.approveOffer(user, id);
  }

  @Post("offers/:id/submit")
  submitOffer(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.recruitment.submitOffer(user, id);
  }

  @Post("offers/:id/reject")
  rejectOffer(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    const parsed = RequisitionDecisionSchema.parse(body);
    return this.recruitment.rejectOffer(user, id, parsed.reason);
  }

  @Post("offers/:id/send")
  sendOffer(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.recruitment.sendOffer(user, id);
  }

  @Post("offers/:id/record-decision")
  recordOfferDecision(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.recruitment.recordOfferDecision(user, id, OfferDecisionSchema.parse(body));
  }

  @Post("offers/:id/convert")
  convertOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ) {
    return this.recruitment.convertOffer(user, id, idempotencyKey);
  }

  @Get("onboarding")
  onboarding(@CurrentUser() user: AuthenticatedUser) {
    return this.recruitment.onboarding(user);
  }

  @Patch("onboarding/tasks/:taskId")
  updateOnboardingTask(@CurrentUser() user: AuthenticatedUser, @Param("taskId") taskId: string, @Body() body: unknown) {
    return this.recruitment.updateOnboardingTask(user, taskId, OnboardingTaskUpdateSchema.parse(body));
  }
}
