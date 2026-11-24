import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma.service";
import { RecruitmentController } from "./recruitment.controller";
import { RecruitmentService } from "./recruitment.service";
import { PrivateStorageService } from "../storage/private-storage.service";

@Module({
  imports: [AuthModule],
  controllers: [RecruitmentController],
  providers: [PrismaService, PrivateStorageService, RecruitmentService],
})
export class RecruitmentModule {}
