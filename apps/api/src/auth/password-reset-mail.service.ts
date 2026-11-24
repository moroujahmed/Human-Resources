import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";

@Injectable()
export class PasswordResetMailService {
  private readonly logger = new Logger(PasswordResetMailService.name);

  async send(email: string, rawToken: string): Promise<void> {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? "1025");
    const secure = process.env.SMTP_SECURE === "true";
    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";

    if (!host) {
      this.logger.warn("Password reset email not sent because SMTP_HOST is not configured");
      return;
    }

    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? "StaffHub <no-reply@staffhub.invalid>",
      to: email,
      subject: "StaffHub password reset",
      text: `Reset your password: ${webUrl}/reset-password?token=${encodeURIComponent(rawToken)}\nThis link expires in 30 minutes.`,
    });
  }
}
