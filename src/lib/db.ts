import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client singleton.
 *
 * Pada mode development Next.js melakukan hot-reload dan dapat mengevaluasi modul
 * berkali-kali; tanpa cache `globalThis` setiap reload membuat koneksi baru dan
 * menghabiskan connection pool PostgreSQL.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
