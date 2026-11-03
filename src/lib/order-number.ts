import { Prisma } from "@prisma/client";

/**
 * Generator nomor pesanan (`ORD-0001`) dengan retry untuk benturan unik.
 * Dipakai oleh route pembuatan order dan split bill.
 */

const MAX_ATTEMPTS = 5;

export async function generateOrderNumber(
  tx: Prisma.TransactionClient,
  attempt: number = 0,
): Promise<string> {
  const total = await tx.order.count();
  return `ORD-${String(total + 1 + attempt).padStart(4, "0")}`;
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const ORDER_NUMBER_MAX_ATTEMPTS = MAX_ATTEMPTS;
