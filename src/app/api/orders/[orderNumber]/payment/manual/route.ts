import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { MANUAL_TRANSFER_ACCOUNTS } from "@/lib/payment/manual-transfer";

/**
 * POST /api/orders/[orderNumber]/payment/manual
 *
 * Menyiapkan instruksi transfer manual: rekening tujuan + nominal akhir yang
 * sudah memuat kode unik 3 digit (dihitung saat order dibuat).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;
const MANUAL_TTL_MS = 24 * 60 * 60 * 1000;

type RouteContext = { params: Promise<{ orderNumber: string }> };

export async function POST(_request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { orderNumber } = await context.params;

    if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
      throw new ApiError("BAD_REQUEST", "Nomor pesanan tidak valid.");
    }

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: { id: true, status: true, grandTotal: true, uniqueCode: true },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new ApiError("CONFLICT", "Pesanan ini tidak sedang menunggu pembayaran.");
    }

    const now = new Date();

    const existing = await db.payment.findFirst({
      where: {
        orderId: order.id,
        method: "MANUAL_TRANSFER",
        status: "PENDING",
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, expiresAt: true },
    });

    if (existing?.expiresAt) {
      return jsonOk({
        paymentId: existing.id,
        orderNumber,
        amount: order.grandTotal,
        uniqueCode: order.uniqueCode,
        accounts: MANUAL_TRANSFER_ACCOUNTS,
        expiresAt: existing.expiresAt,
      });
    }

    const expiresAt = new Date(now.getTime() + MANUAL_TTL_MS);

    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        method: "MANUAL_TRANSFER",
        status: "PENDING",
        amountPaid: order.grandTotal,
        provider: "manual-transfer",
        gatewayRefId: `manual-${orderNumber}-${now.getTime()}`,
        expiresAt,
        gatewayPayload: {
          accounts: MANUAL_TRANSFER_ACCOUNTS.map((account) => ({ ...account })),
        } as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return jsonOk(
      {
        paymentId: payment.id,
        orderNumber,
        amount: order.grandTotal,
        uniqueCode: order.uniqueCode,
        accounts: MANUAL_TRANSFER_ACCOUNTS,
        expiresAt,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
