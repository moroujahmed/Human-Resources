import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "./health.controller";
import { PrismaService } from "./prisma.service";
import { AuthModule } from "./auth/auth.module";
import { EmployeesModule } from "./employees/employees.module";
import { LeaveModule } from "./leave/leave.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { RecruitmentModule } from "./recruitment/recruitment.module";
import { CareersModule } from "./careers/careers.module";
import { AssetsModule } from "./assets/assets.module";
import { OffboardingModule } from "./offboarding/offboarding.module";
import { PayrollModule } from "./payroll/payroll.module";
import { AdminModule } from "./admin/admin.module";
import { PerformanceModule } from "./performance/performance.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    JwtModule.register({}),
    AuthModule,
    EmployeesModule,
    LeaveModule,
    AttendanceModule,
    RecruitmentModule,
    CareersModule,
    AssetsModule,
    OffboardingModule,
    PayrollModule,
    AdminModule,
    PerformanceModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
