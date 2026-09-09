import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma database client.
 *
 * WHY THE GLOBAL?
 * During development Next.js reloads modules on every file save. Without this
 * cache we would open a brand-new database connection each time and quickly
 * exhaust the connection limit of the free Neon tier.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Log slow/failed queries in development only — production stays quiet.
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
