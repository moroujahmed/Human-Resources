import "reflect-metadata";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { parseCorsOrigins } from "./cors-origins";
import { applyHttpSecurityHeaders } from "./http-security";
import { ZodExceptionFilter } from "./zod-exception.filter";

const envFilePath = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
].find(existsSync);

if (envFilePath) {
  const result = dotenv.config({ path: envFilePath });
  if (result.error) {
    throw result.error;
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalFilters(new ZodExceptionFilter());
  app.setGlobalPrefix("api/v1");
  applyHttpSecurityHeaders(app);
  app.enableCors({
    origin: parseCorsOrigins(
      process.env.CORS_ORIGIN,
      process.env.NODE_ENV === "production",
    ),
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "Idempotency-Key",
    ],
  });

  const port = Number(process.env.PORT ?? "4000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  await app.listen(port, "0.0.0.0");
}

void bootstrap();
