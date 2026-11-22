import type { INestApplication } from "@nestjs/common";
import helmet from "helmet";

export function applyHttpSecurityHeaders(
  app: INestApplication,
  isProduction = process.env.NODE_ENV === "production",
): void {
  app.use(
    helmet({
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "no-referrer" },
      strictTransportSecurity: isProduction,
    }),
  );
}
