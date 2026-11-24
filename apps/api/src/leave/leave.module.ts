import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma.service";
import { LeaveCalculatorService } from "./leave-calculator.service";
import { LeaveController } from "./leave.controller";
import { LeaveService } from "./leave.service";

@Module({
  imports: [AuthModule],
  controllers: [LeaveController],
  providers: [PrismaService, LeaveCalculatorService, LeaveService],
})
export class LeaveModule {}
