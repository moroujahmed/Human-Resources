import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
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

  async sendWelcome(email: string, rawToken: string): Promise<void> {
    const host = process.env.SMTP_HOST;
    if (!host) throw new ServiceUnavailableException("EMAIL_DELIVERY_UNAVAILABLE");
    const port = Number(process.env.SMTP_PORT ?? "1025");
    const secure = process.env.SMTP_SECURE === "true";
    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? "StaffHub <no-reply@staffhub.invalid>",
      to: email,
      subject: "Set up your StaffHub account",
      text: `Your StaffHub employee account is ready. Set your password using this secure link: ${webUrl}/reset-password?token=${encodeURIComponent(rawToken)}\nThis link expires in 30 minutes. If you were not expecting this message, contact your HR team.`,
    });
  }

  async sendOffer(email: string, offer: {
    title: string;
    department: string;
    baseSalaryUgx: string;
    allowancesUgx: string;
    proposedStartDate: string;
    expiresAt: string;
    responseUrl: string;
  }): Promise<void> {
    const host = process.env.SMTP_HOST;
    if (!host) throw new ServiceUnavailableException("EMAIL_DELIVERY_UNAVAILABLE");
    const port = Number(process.env.SMTP_PORT ?? "1025");
    const secure = process.env.SMTP_SECURE === "true";
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? "StaffHub <no-reply@staffhub.invalid>",
      to: email,
      subject: `StaffHub employment offer: ${offer.title}`,
      text: [
        "You have received a StaffHub employment offer.",
        `Role: ${offer.title}`,
        `Department: ${offer.department}`,
        `Base monthly salary: UGX ${offer.baseSalaryUgx}`,
        `Monthly allowances: UGX ${offer.allowancesUgx}`,
        `Proposed start date: ${offer.proposedStartDate}`,
        `Please respond by: ${offer.expiresAt}`,
        `Review and record your decision securely: ${offer.responseUrl}`,
        "This private link is single use. Contact the recruiting team if it expires or you need an accessible alternative.",
      ].join("\n"),
    });
  }
}
