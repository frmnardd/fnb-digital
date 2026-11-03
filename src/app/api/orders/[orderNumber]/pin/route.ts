import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { verifyPin } from "@/lib/security/pin";
import {
  isPinLocked,
  registerPinAttempt,
  resetPinAttempts,
} from "@/lib/security/pin-attempts";

/**
 * POST /api/orders/[orderNumber]/pin
 *
 * Mengesahkan pesanan **Bayar di Kasir** dengan PIN meja 4-digit (anti prank
 * order). PIN benar → `Order.status = CONFIRMED` supaya pesanan diteruskan ke
 * dapur; pembayaran tunai tetap `PENDING` sampai kasir menerima uang (5.2).
 *
 * Pembatasan: maksimal 5 percobaan / 10 menit per (pesanan + IP).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;

const bodySchema = z
  .object({ pin: z.string().regex(/^\d{4}$/, "PIN harus 4 digit angka.") })
  .strict();

type RouteContext = { params: Promise<{ orderNumber: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { orderNumber } = await context.params;

    if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
      throw new ApiError("BAD_REQUEST", "Nomor pesanan tidak valid.");
    }

    const input = bodySchema.parse(await readJsonBody(request));

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const attemptKey = `${orderNumber}:${clientIp}`;

    if (isPinLocked(attemptKey)) {
      throw new ApiError(
        "TOO_MANY_REQUESTS",
        "Terlalu banyak percobaan PIN. Coba lagi beberapa menit lagi.",
        undefined,
        { "Retry-After": "600" },
      );
    }

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        status: true,
        tableSessionId: true,
        tableSession: { select: { tableId: true } },
      },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    if (order.status !== "WAITING_CASHIER_APPROVAL") {
      throw new ApiError("CONFLICT", "Pesanan ini tidak sedang menunggu konfirmasi kasir.");
    }

    const tableId = order.tableSession?.tableId;

    if (!tableId) {
      throw new ApiError(
        "CONFLICT",
        "Pesanan ini tidak terikat sesi meja sehingga PIN meja tidak berlaku.",
      );
    }

    const table = await db.table.findUnique({
      where: { id: tableId },
      select: { currentPin: true, pinEnabled: true },
    });

    if (!table?.pinEnabled || !table.currentPin) {
      throw new ApiError("CONFLICT", "PIN meja tidak diaktifkan untuk meja ini.");
    }

    if (!verifyPin(input.pin, table.currentPin)) {
      const state = registerPinAttempt(attemptKey);

      if (state.locked) {
        throw new ApiError(
          "TOO_MANY_REQUESTS",
          "Terlalu banyak percobaan PIN. Minta bantuan kasir untuk konfirmasi.",
          { remainingAttempts: 0, retryAfterSeconds: state.retryAfterSeconds },
          { "Retry-After": String(state.retryAfterSeconds) },
        );
      }

      throw new ApiError("UNAUTHORIZED", "PIN meja salah.", {
        remainingAttempts: state.remainingAttempts,
      });
    }

    resetPinAttempts(attemptKey);

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CONFIRMED", confirmedAt: now },
      });

      if (order.tableSessionId) {
        await tx.tableSession.update({
          where: { id: order.tableSessionId },
          data: { lastActivityAt: now },
        });
      }
    });

    return jsonOk({
      orderNumber,
      status: "CONFIRMED",
      next: "WAITING_CASHIER_PAYMENT",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
