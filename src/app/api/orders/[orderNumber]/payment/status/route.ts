import type { NextRequest } from "next/server";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * GET /api/orders/[orderNumber]/payment/status
 *
 * Status ringkas untuk polling halaman pembayaran (QRIS/VA/transfer/tunai).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;

type RouteContext = { params: Promise<{ orderNumber: string }> };

export async function GET(_request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { orderNumber } = await context.params;

    if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
      throw new ApiError("BAD_REQUEST", "Nomor pesanan tidak valid.");
    }

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: {
        status: true,
        grandTotal: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            method: true,
            status: true,
            paidAt: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    return jsonOk({
      orderNumber,
      orderStatus: order.status,
      amount: order.grandTotal,
      payment: order.payments[0] ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
