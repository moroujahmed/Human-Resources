import {
  ConflictException,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import type { Express } from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { PublicApplicationSchema } from "@staffhub/shared";
import { PrismaService } from "../prisma.service";
import { PrivateStorageService } from "../storage/private-storage.service";

@Injectable()
export class CareersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateStorageService,
  ) {}

  async vacancies(search: string | undefined, departmentId: string | undefined): Promise<Record<string, unknown>[]> {
    return this.prisma.vacancy.findMany({
      where: {
        status: "PUBLISHED",
        closingAt: { gt: new Date() },
        ...(departmentId ? { requisition: { departmentId } } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { requisition: { include: { department: true } } },
      orderBy: { closingAt: "asc" },
    });
  }

  async apply(
    vacancyId: string,
    body: unknown,
    cv: Express.Multer.File,
  ): Promise<Record<string, unknown>> {
    const input = PublicApplicationSchema.parse(body);
    await this.verifyTurnstile(input.turnstileToken);
    const vacancy = await this.prisma.vacancy.findUnique({ where: { id: vacancyId } });
    if (!vacancy || vacancy.status !== "PUBLISHED" || vacancy.closingAt <= new Date()) {
      throw new UnprocessableEntityException("VACANCY_CLOSED");
    }
    if (!cv) throw new UnsupportedMediaTypeException("CV_REQUIRED");
    if (cv.size > 5 * 1024 * 1024) throw new PayloadTooLargeException("CV_TOO_LARGE");

    const detected = await fileTypeFromBuffer(cv.buffer);
    if (!detected || !["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(detected.mime)) {
      throw new UnsupportedMediaTypeException("UNSUPPORTED_MEDIA_TYPE");
    }
    const duplicate = await this.prisma.jobApplication.findFirst({
      where: {
        vacancyId,
        applicantEmail: { equals: input.email, mode: "insensitive" },
      },
    });
    if (duplicate) throw new ConflictException("DUPLICATE_APPLICATION");

    const code = `APP-${randomBytes(5).toString("hex").toUpperCase()}`;
    const key = `applications/${vacancyId}/${randomUUID()}.${detected.ext}`;
    const storedKey = await this.storage.upload(key, cv.buffer, detected.mime);
    const safeOriginalFilename = cv.originalname
      .replace(/[\\/]/g, "_")
      .split("")
      .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
      .join("")
      .slice(0, 255) || `cv.${detected.ext}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const application = await tx.jobApplication.create({
          data: {
        applicationCode: code,
        vacancyId,
        fullName: input.fullName,
        applicantEmail: input.email,
        phone: input.phone,
        expectedGrossUgx: input.expectedGrossUgx?.toString(),
        earliestStartDate: input.earliestStartDate ? new Date(`${input.earliestStartDate}T00:00:00.000Z`) : null,
        coverNote: input.coverNote,
        cvStorageKey: storedKey,
        cvOriginalFilename: safeOriginalFilename,
        cvMimeType: detected.mime,
        status: "APPLIED",
      },
        });
        await tx.auditLog.create({
          data: {
            actorRole: "PUBLIC",
            action: "JOB_APPLICATION_SUBMITTED",
            entityType: "JobApplication",
            entityId: application.id,
            checksumSha256: createHash("sha256").update(`JOB_APPLICATION_SUBMITTED:${application.id}:${new Date().toISOString()}`).digest("hex"),
          },
        });
        return { applicationCode: application.applicationCode, submittedAt: application.submittedAt };
      });
    } catch (error) {
      await this.storage.delete(storedKey).catch(() => undefined);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new ConflictException("DUPLICATE_APPLICATION");
      }
      throw error;
    }
  }

  private async verifyTurnstile(token: string | undefined): Promise<void> {
    if (process.env.NODE_ENV === "test" && !process.env.TURNSTILE_SECRET_KEY) return;
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) throw new ServiceUnavailableException("APPLICATION_VERIFICATION_UNAVAILABLE");
    const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME;
    if (!expectedHostname) throw new ServiceUnavailableException("APPLICATION_VERIFICATION_UNAVAILABLE");
    if (!token || token.length > 2048) throw new UnprocessableEntityException("APPLICATION_VERIFICATION_REQUIRED");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, response: token, idempotency_key: randomUUID() }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Turnstile verification request failed");
      const result = await response.json() as { success?: boolean; action?: string; hostname?: string };
      if (
        result.success !== true ||
        result.action !== "job_application" ||
        result.hostname?.toLowerCase() !== expectedHostname.toLowerCase()
      ) throw new UnprocessableEntityException("APPLICATION_VERIFICATION_FAILED");
    } catch (error) {
      if (error instanceof UnprocessableEntityException) throw error;
      throw new ServiceUnavailableException("APPLICATION_VERIFICATION_UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  }
}
