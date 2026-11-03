import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { isTicketReady, type KdsItemStatus } from "@/lib/kds";

/**
 * POST /api/kds/orders/[orderId]/bump
 *
 * Bump seluruh tiket sekaligus:
 * - `BUMP_TICKET`: semua item QUEUED/COOKING → READY
 * - `MARK_READY`: hanya item COOKING → READY
 * Bila seluruh item siap, status order menjadi `READY`.
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const ACTIVE_ORDER_STATUSES = ["CONFIRMED", "PREPARING", "READY"] as const;

const bodySchema = z.object({ action: z.enum(["BUMP_TICKET", "MARK_READY"]) }).strict();

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { orderId } = await context.params;

    if (!ORDER_ID_PATTERN.test(orderId)) {
      throw new ApiError("BAD_REQUEST", "ID pesanan tidak valid.");
    }

    const input = bodySchema.parse(await readJsonBody(request));

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, status: true },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    if (!ACTIVE_ORDER_STATUSES.includes(order.status as (typeof ACTIVE_ORDER_STATUSES)[number])) {
      throw new ApiError("CONFLICT", "Pesanan tidak berada pada antrean dapur.");
    }

    const now = new Date();

    const result = await db.$transaction(async (tx) => {
      if (input.action === "BUMP_TICKET") {
        await tx.orderItem.updateMany({
          where: { orderId: order.id, status: { in: ["QUEUED", "COOKING"] }, cookingAt: null },
          data: { cookingAt: now },
        });
      }

      const updated = await tx.orderItem.updateMany({
        where: {
          orderId: order.id,
          status:
            input.action === "BUMP_TICKET" ? { in: ["QUEUED", "COOKING"] } : "COOKING",
        },
        data: { status: "READY", readyAt: now },
      });

      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { status: true },
      });

      const allReady = isTicketReady(items.map((item) => item.status as KdsItemStatus));

      if (allReady) {
        await tx.order.update({ where: { id: order.id }, data: { status: "READY" } });
      }

      const fresh = await tx.order.findUnique({
        where: { id: order.id },
        select: { orderNumber: true, status: true },
      });

      return { updated: updated.count, order: fresh };
    });

    return jsonOk({
      orderNumber: result.order?.orderNumber ?? order.orderNumber,
      orderStatus: result.order?.status ?? order.status,
      updated: result.updated,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
