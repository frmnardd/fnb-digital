import type { NextRequest } from "next/server";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { buildOrderTrackPayload } from "@/lib/order-tracking";

/**
 * GET /api/orders/[orderNumber]/track
 *
 * Status pesanan + tahapan pelacakan untuk halaman tracker pelanggan.
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
        orderNumber: true,
        status: true,
        orderType: true,
        grandTotal: true,
        confirmedAt: true,
        completedAt: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true },
        },
        items: {
          orderBy: { createdAt: "asc" },
          select: { menuName: true, quantity: true, status: true, station: true },
        },
      },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    return jsonOk(
      buildOrderTrackPayload({
        orderNumber: order.orderNumber,
        status: order.status,
        orderType: order.orderType,
        grandTotal: order.grandTotal,
        paymentStatus: order.payments[0]?.status ?? null,
        confirmedAt: order.confirmedAt,
        completedAt: order.completedAt,
        items: order.items.map((item) => ({
          name: item.menuName,
          quantity: item.quantity,
          status: item.status,
          station: item.station,
        })),
      }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
