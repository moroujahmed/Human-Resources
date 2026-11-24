import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { applyHttpSecurityHeaders } from "../src/http-security";
import { ZodExceptionFilter } from "../src/zod-exception.filter";

describe("API health endpoint", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new ZodExceptionFilter());
    applyHttpSecurityHeaders(app, false);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the shared health contract", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200);

    expect(response.body).toEqual({ status: "ok", service: "api" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });

  it("enables HSTS when production security headers are requested", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const productionApp = moduleRef.createNestApplication();
    productionApp.setGlobalPrefix("api/v1");
    applyHttpSecurityHeaders(productionApp, true);
    await productionApp.init();

    try {
      const response = await request(productionApp.getHttpServer())
        .get("/api/v1/health")
        .expect(200);

      expect(response.headers["strict-transport-security"]).toMatch(
        /^max-age=/,
      );
    } finally {
      await productionApp.close();
    }
  });
});
