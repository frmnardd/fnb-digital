import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { calculateCashChange, PricingError } from "@/lib/pricing";
import { deductInventoryForOrder } from "@/lib/services/inventory";

/**
 * POST /api/orders/[orderNumber]/cashier-confirm
 *
 * Validasi pembayaran oleh kasir:
 * - `MARK_PAID`: pembayaran PENDING dilunasi (tunai/transfer manual terverifikasi),
 *   pesanan menjadi `CONFIRMED` sehingga masuk ke dapur.
 * - `REJECT`: pembayaran ditandai FAILED dan pesanan dibatalkan.
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;

const bodySchema = z
  .object({
    action: z.enum(["MARK_PAID", "REJECT"]),
    amountReceived: z.number().int().min(0).optional(),
    note: z.string().trim().max(160).optional(),
  })
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

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        status: true,
        grandTotal: true,
        tableSessionId: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            method: true,
            status: true,
            proofImageUrl: true,
          },
        },
      },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    const payment = order.payments[0];

    if (!payment) {
      throw new ApiError("NOT_FOUND", "Transaksi pembayaran untuk pesanan ini tidak ditemukan.");
    }

    const now = new Date();

    if (input.action === "MARK_PAID") {
      if (payment.status === "PAID") {
        return jsonOk({
          orderNumber,
          orderStatus: order.status,
          paymentStatus: "PAID",
          changeAmount: 0,
          duplicate: true,
        });
      }

      if (payment.method === "MANUAL_TRANSFER" && !payment.proofImageUrl) {
        throw new ApiError(
          "CONFLICT",
          "Bukti transfer belum diunggah pelanggan. Minta pelanggan mengunggah bukti terlebih dahulu.",
        );
      }

      let changeAmount = 0;
      let amountPaid = order.grandTotal;

      if (payment.method === "CASH" && input.amountReceived !== undefined) {
        try {
          changeAmount = calculateCashChange(input.amountReceived, order.grandTotal);
        } catch (error) {
          if (error instanceof PricingError) {
            throw new ApiError("VALIDATION_ERROR", error.message);
          }

          throw error;
        }

        amountPaid = input.amountReceived;
      }

      await db.$transaction(async (tx) => {
        // Kaitkan pembayaran tunai ke shift yang sedang terbuka (bila ada).
        const openShift =
          payment.method === "CASH"
            ? await tx.cashierShift.findFirst({
                where: { status: "OPEN" },
                orderBy: { openedAt: "desc" },
                select: { id: true },
              })
            : null;

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "PAID",
            paidAt: now,
            amountPaid,
            changeAmount,
            ...(openShift === null ? {} : { shiftId: openShift.id }),
          },
        });

        if (openShift) {
          await tx.cashDrawerLog.create({
            data: {
              shiftId: openShift.id,
              type: "SALE",
              amount: order.grandTotal,
              reason: `Pembayaran tunai ${orderNumber}`,
              orderId: order.id,
            },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: "CONFIRMED", confirmedAt: now },
        });

        // Kurangi stok bahan sesuai resep (satu kali per transisi ke PAID).
        await deductInventoryForOrder(tx, order.id);

        if (order.tableSessionId) {
          await tx.tableSession.update({
            where: { id: order.tableSessionId },
            data: { lastActivityAt: now },
          });
        }
      });

      return jsonOk({
        orderNumber,
        orderStatus: "CONFIRMED",
        paymentStatus: "PAID",
        changeAmount,
        duplicate: false,
      });
    }

    // REJECT
    if (payment.status === "PAID") {
      throw new ApiError("CONFLICT", "Pembayaran sudah lunas dan tidak dapat ditolak.");
    }

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", cancelledAt: now },
      });
    });

    return jsonOk({
      orderNumber,
      orderStatus: "CANCELLED",
      paymentStatus: "FAILED",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
