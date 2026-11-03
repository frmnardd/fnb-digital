import type { NextRequest } from "next/server";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/runner/items/[itemId]/serve
 *
 * Menandai item sudah diantar ke meja. Bila seluruh item pesanan sudah
 * `SERVED`, status order menjadi `SERVED`.
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

type RouteContext = { params: Promise<{ itemId: string }> };

export async function POST(_request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { itemId } = await context.params;

    if (!ID_PATTERN.test(itemId)) {
      throw new ApiError("BAD_REQUEST", "ID item tidak valid.");
    }

    const item = await db.orderItem.findUnique({
      where: { id: itemId },
      select: { id: true, orderId: true, status: true },
    });

    if (!item) {
      throw new ApiError("NOT_FOUND", "Item pesanan tidak ditemukan.");
    }

    if (item.status === "VOIDED") {
      throw new ApiError("CONFLICT", "Item sudah dibatalkan.");
    }

    const now = new Date();

    const result = await db.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: item.id },
        data: { status: "SERVED", servedAt: now },
      });

      const siblings = await tx.orderItem.findMany({
        where: { orderId: item.orderId },
        select: { status: true },
      });

      const active = siblings.filter((sibling) => sibling.status !== "VOIDED");
      const allServed = active.length > 0 && active.every((sibling) => sibling.status === "SERVED");

      if (allServed) {
        await tx.order.update({ where: { id: item.orderId }, data: { status: "SERVED" } });
      }

      return tx.order.findUnique({
        where: { id: item.orderId },
        select: { orderNumber: true, status: true },
      });
    });

    return jsonOk({
      itemId: item.id,
      itemStatus: "SERVED",
      orderNumber: result?.orderNumber ?? null,
      orderStatus: result?.status ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
