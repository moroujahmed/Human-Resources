import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma.service";
import { OffboardingController } from "./offboarding.controller";
import { OffboardingService } from "./offboarding.service";

@Module({
  imports: [AuthModule],
  controllers: [OffboardingController],
  providers: [OffboardingService, PrismaService],
})
export class OffboardingModule {}
