import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import path from "node:path";

// Exported CI/CLI settings take precedence. Next.js also uses .env.local;
// Prisma's CLI needs explicit loading because it does not run through Next.js.
if (!process.env.DIRECT_URL) loadEnv({ path: path.join(__dirname, ".env.local"), quiet: true });
if (!process.env.DIRECT_URL) loadEnv({ path: path.join(__dirname, ".env"), quiet: true });

const directUrl = process.env.DIRECT_URL;
if (!directUrl || !/^postgres(?:ql)?:\/\//i.test(directUrl)) {
  throw new Error("DIRECT_URL must be configured as the direct PostgreSQL connection for Prisma CLI commands.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  // SQLite history remains untouched in prisma/migrations for recovery/export.
  migrations: { path: "prisma/migrations-postgresql" },
  datasource: {
    url: directUrl,
  },
});
