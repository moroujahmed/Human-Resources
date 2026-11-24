import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma.service";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";

@Module({
  imports: [AuthModule],
  controllers: [PayrollController],
  providers: [PayrollService, PrismaService],
})
export class PayrollModule {}
