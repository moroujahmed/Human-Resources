import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "apps/api/prisma/schema.prisma",
  migrations: {
    path: "apps/api/prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL
      ?? "postgresql://staffhub:staffhub_local_only@localhost:5432/staffhub?schema=public",
  },
});
