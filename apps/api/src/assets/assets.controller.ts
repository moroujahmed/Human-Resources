import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AssetCreateSchema, AssetIncidentSchema, AssetIssueSchema, AssetReturnSchema, AssetUpdateSchema } from "@staffhub/shared";
import { AssetsService } from "./assets.service";

@Controller("assets")
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.assets.list(user);
  }

  @Get("my-assets")
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.assets.mine(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.assets.create(user, AssetCreateSchema.parse(body));
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.assets.update(user, id, AssetUpdateSchema.parse(body));
  }

  @Post(":id/issue")
  issue(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.assets.issue(user, id, AssetIssueSchema.parse(body).employeeId);
  }

  @Post("assignments/:id/acknowledge")
  acknowledge(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.assets.acknowledge(user, id);
  }

  @Post("assignments/:id/return")
  returnAsset(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.assets.returnAsset(user, id, AssetReturnSchema.parse(body));
  }

  @Post("assignments/:id/incident")
  incident(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: unknown) {
    return this.assets.incident(user, id, AssetIncidentSchema.parse(body));
  }
}
