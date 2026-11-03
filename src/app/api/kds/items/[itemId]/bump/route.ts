import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import {
  isTicketReady,
  nextItemStatus,
  type KdsItemAction,
  type KdsItemStatus,
} from "@/lib/kds";

/**
 * POST /api/kds/items/[itemId]/bump
 *
 * Bump status satu item KDS: mulai masak (`START_COOKING`), tandai siap
 * (`MARK_READY`), atau kembalikan satu langkah (`REVERT`).
 * Bila seluruh item pesanan sudah READY → status order menjadi `READY`.
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

const bodySchema = z
  .object({ action: z.enum(["START_COOKING", "MARK_READY", "REVERT"]) })
  .strict();

type RouteContext = { params: Promise<{ itemId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { itemId } = await context.params;

    if (!ITEM_ID_PATTERN.test(itemId)) {
      throw new ApiError("BAD_REQUEST", "ID item tidak valid.");
    }

    const input = bodySchema.parse(await readJsonBody(request));

    const item = await db.orderItem.findUnique({
      where: { id: itemId },
      select: { id: true, orderId: true, status: true, cookingAt: true },
    });

    if (!item) {
      throw new ApiError("NOT_FOUND", "Item pesanan tidak ditemukan.");
    }

    if (item.status === "SERVED" || item.status === "VOIDED") {
      throw new ApiError("CONFLICT", "Item sudah diantar atau dibatalkan.");
    }

    const nextStatus = nextItemStatus(item.status as KdsItemStatus, input.action as KdsItemAction);

    if (!nextStatus) {
      throw new ApiError(
        "CONFLICT",
        `Aksi ${input.action} tidak valid untuk status ${item.status}.`,
      );
    }

    const now = new Date();
    const data: Prisma.OrderItemUpdateInput = { status: nextStatus };

    if (input.action === "START_COOKING") {
      data.cookingAt = now;
    }

    if (input.action === "MARK_READY") {
      data.readyAt = now;

      if (item.cookingAt === null) {
        data.cookingAt = now;
      }
    }

    if (input.action === "REVERT") {
      if (nextStatus === "QUEUED") {
        data.cookingAt = null;
      } else {
        data.readyAt = null;
      }
    }

    const result = await db.$transaction(async (tx) => {
      await tx.orderItem.update({ where: { id: item.id }, data });

      const siblings = await tx.orderItem.findMany({
        where: { orderId: item.orderId },
        select: { status: true },
      });

      if (isTicketReady(siblings.map((sibling) => sibling.status as KdsItemStatus))) {
        return tx.order.update({
          where: { id: item.orderId },
          data: { status: "READY" },
          select: { orderNumber: true, status: true },
        });
      }

      return tx.order.findUnique({
        where: { id: item.orderId },
        select: { orderNumber: true, status: true },
      });
    });

    return jsonOk({
      itemId: item.id,
      itemStatus: nextStatus,
      orderNumber: result?.orderNumber ?? null,
      orderStatus: result?.status ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
