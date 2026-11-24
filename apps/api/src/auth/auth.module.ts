import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PasswordService } from "./password.service";
import { RolesGuard } from "./roles.guard";
import { PrismaService } from "../prisma.service";
import { PasswordResetMailService } from "./password-reset-mail.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, PrismaService, JwtAuthGuard, RolesGuard, PasswordResetMailService],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, PrismaService, PasswordResetMailService],
})
export class AuthModule {}
