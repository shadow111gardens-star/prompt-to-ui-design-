import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaDatasource?: "postgresql";
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error("DATABASE_URL must be configured as the pooled PostgreSQL application connection.");
  }
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma =
  // An existing development process may still hold the old SQLite client.
  // Reuse only a client explicitly created for this PostgreSQL configuration.
  (globalForPrisma.prismaDatasource === "postgresql" ? globalForPrisma.prisma : undefined) ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDatasource = "postgresql";
}
