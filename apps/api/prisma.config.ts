
import { createRequire } from "node:module";
import { defineConfig } from "prisma/config";

const require = createRequire(import.meta.url);

if (!process.env.DATABASE_URL) {
  try {
    require("dotenv/config");
  } catch {
    // ECS injects DATABASE_URL directly, so dotenv is only needed for local CLI usage.
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  ...(process.env.DATABASE_URL
    ? {
        datasource: {
          url: process.env.DATABASE_URL,
        },
      }
    : {}),
});
