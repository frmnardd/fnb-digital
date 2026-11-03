import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { BANK_CODES, buildVirtualAccount } from "@/lib/payment/va";

/**
 * POST /api/orders/[orderNumber]/payment/va
 *
 * Menerbitkan nomor Virtual Account untuk pesanan yang menunggu pembayaran.
 * Nomor VA saat ini dibuat lokal (mode demo); adapter gateway dapat ditambahkan
 * tanpa mengubah kontrak respons.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;
const VA_TTL_MS = 15 * 60 * 1000;

const bodySchema = z.object({ bank: z.enum(BANK_CODES) }).strict();

type RouteContext = { params: Promise<{ orderNumber: string }> };

interface StoredVaPayload {
  bank?: string;
  vaNumber?: string;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { orderNumber } = await context.params;

    if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
      throw new ApiError("BAD_REQUEST", "Nomor pesanan tidak valid.");
    }

    const input = bodySchema.parse(await readJsonBody(request));

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: { id: true, status: true, grandTotal: true },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new ApiError("CONFLICT", "Pesanan ini tidak sedang menunggu pembayaran.");
    }

    const now = new Date();
    const vaNumber = buildVirtualAccount({ bank: input.bank, orderNumber });

    // Idempoten: VA yang masih berlaku untuk bank yang sama dikembalikan lagi.
    const existing = await db.payment.findFirst({
      where: {
        orderId: order.id,
        method: "VIRTUAL_ACCOUNT",
        status: "PENDING",
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, expiresAt: true, gatewayPayload: true },
    });

    if (existing?.expiresAt) {
      const stored = (existing.gatewayPayload ?? {}) as StoredVaPayload;

      if (stored.vaNumber && stored.bank === input.bank) {
        return jsonOk({
          paymentId: existing.id,
          orderNumber,
          bank: input.bank,
          vaNumber: stored.vaNumber,
          amount: order.grandTotal,
          expiresAt: existing.expiresAt,
          mode: "demo",
        });
      }
    }

    const expiresAt = new Date(now.getTime() + VA_TTL_MS);

    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        method: "VIRTUAL_ACCOUNT",
        status: "PENDING",
        amountPaid: order.grandTotal,
        provider: `${input.bank.toLowerCase()}-va`,
        gatewayRefId: `va-${input.bank}-${orderNumber}-${now.getTime()}`,
        expiresAt,
        gatewayPayload: {
          bank: input.bank,
          vaNumber,
        } as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return jsonOk(
      {
        paymentId: payment.id,
        orderNumber,
        bank: input.bank,
        vaNumber,
        amount: order.grandTotal,
        expiresAt,
        mode: "demo",
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
