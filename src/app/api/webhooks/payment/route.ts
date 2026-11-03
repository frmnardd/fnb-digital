import type { NextRequest } from "next/server";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import {
  extractOrderNumber,
  mapTransactionToPaymentStatus,
  midtransNotificationSchema,
  verifyMidtransSignature,
} from "@/lib/payment/webhook";
import { deductInventoryForOrder } from "@/lib/services/inventory";

/**
 * POST /api/webhooks/payment
 *
 * Penerima notifikasi pembayaran (Midtrans). Alur:
 * 1. Baca body mentah → parse JSON → validasi skema (passthrough field gateway).
 * 2. Verifikasi signature SHA-512 (`MIDTRANS_SERVER_KEY`). Bila kunci belum ada,
 *    hanya boleh lolos saat `PAYMENT_ALLOW_UNSIGNED_WEBHOOK=true` (mode demo).
 * 3. Idempoten: notifikasi ulang untuk pembayaran yang sudah PAID tidak menulis apa pun.
 * 4. PAID → `Payment.PAID`, `Order.CONFIRMED` (bila masih menunggu), update sesi.
 *
 * Respons selalu 200 untuk notifikasi valid agar gateway tidak melakukan retry
 * berulang; error validasi 400, signature salah 401.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const rawBody = await request.text();
    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      throw new ApiError("BAD_REQUEST", "Body notifikasi bukan JSON yang valid.");
    }

    const notification = midtransNotificationSchema.parse(parsedBody);

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const allowUnsigned = process.env.PAYMENT_ALLOW_UNSIGNED_WEBHOOK === "true";

    if (serverKey) {
      const isSignatureValid = verifyMidtransSignature({
        orderId: notification.order_id,
        statusCode: notification.status_code,
        grossAmount: notification.gross_amount,
        signatureKey: notification.signature_key,
        serverKey,
      });

      if (!isSignatureValid) {
        throw new ApiError("UNAUTHORIZED", "Signature notifikasi tidak valid.");
      }
    } else if (!allowUnsigned) {
      throw new ApiError(
        "UNAUTHORIZED",
        "Webhook belum dikonfigurasi: MIDTRANS_SERVER_KEY kosong.",
      );
    }

    const orderNumber = extractOrderNumber(notification.order_id);

    if (!orderNumber) {
      throw new ApiError("BAD_REQUEST", "order_id pada notifikasi tidak dikenali.");
    }

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        status: true,
        tableSessionId: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, method: true },
        },
      },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan untuk notifikasi ini tidak ditemukan.");
    }

    const payment = order.payments[0];

    if (!payment) {
      throw new ApiError("NOT_FOUND", "Transaksi pembayaran untuk pesanan ini tidak ditemukan.");
    }

    // Idempoten: jangan menulis ulang bila sudah lunas.
    if (payment.status === "PAID") {
      return jsonOk({
        received: true,
        duplicate: true,
        orderNumber,
        paymentStatus: "PAID",
      });
    }

    const nextStatus = mapTransactionToPaymentStatus({
      transactionStatus: notification.transaction_status,
      ...(notification.fraud_status === undefined ? {} : { fraudStatus: notification.fraud_status }),
    });

    const now = new Date();

    if (nextStatus === "PAID") {
      await db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "PAID", paidAt: now },
        });

        if (order.status === "PENDING_PAYMENT" || order.status === "WAITING_CASHIER_APPROVAL") {
          await tx.order.update({
            where: { id: order.id },
            data: { status: "CONFIRMED", confirmedAt: now },
          });
        }

        // Kurangi stok bahan sesuai resep (satu kali per transisi ke PAID).
        await deductInventoryForOrder(tx, order.id);

        if (order.tableSessionId) {
          await tx.tableSession.update({
            where: { id: order.tableSessionId },
            data: { lastActivityAt: now },
          });
        }
      });
    } else if (nextStatus === "FAILED" || nextStatus === "EXPIRED" || nextStatus === "REFUNDED") {
      // Order tetap PENDING_PAYMENT agar pelanggan bisa memilih metode lain.
      await db.payment.update({
        where: { id: payment.id },
        data: { status: nextStatus },
      });
    }

    return jsonOk({
      received: true,
      duplicate: false,
      orderNumber,
      paymentStatus: nextStatus,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
