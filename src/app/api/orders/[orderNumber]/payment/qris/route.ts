import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { createQrisCharge } from "@/lib/payment/midtrans";
import { buildDynamicQris, createDemoStaticPayload } from "@/lib/payment/qris";
import { PaymentConfigError, PaymentGatewayError } from "@/lib/payment/types";

/**
 * POST /api/orders/[orderNumber]/payment/qris
 *
 * Menerbitkan instruksi pembayaran QRIS untuk sebuah pesanan.
 *
 * - Idempoten: memakai kembali `Payment` PENDING yang belum kedaluwarsa.
 * - Bila kredensial gateway tersedia (`MIDTRANS_SERVER_KEY`), QR dibuat gateway.
 * - Bila tidak, memakai **mode demo**: payload QRIS dinamis dibuat lokal dari
 *   `QRIS_STATIC_PAYLOAD` (atau payload contoh) sehingga alur UI tetap utuh.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;
const QRIS_TTL_MS = 15 * 60 * 1000;

type RouteContext = { params: Promise<{ orderNumber: string }> };

interface StoredQrisPayload {
  qrString?: string;
  qrUrl?: string | null;
  mode?: "gateway" | "demo";
}

export async function POST(_request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { orderNumber } = await context.params;

    if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
      throw new ApiError("BAD_REQUEST", "Nomor pesanan tidak valid.");
    }

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: { id: true, status: true, grandTotal: true },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new ApiError("CONFLICT", "Pesanan ini tidak sedang menunggu pembayaran QRIS.");
    }

    const now = new Date();

    // Idempoten: gunakan QR yang masih berlaku agar tidak dobel tagihan.
    const existing = await db.payment.findFirst({
      where: {
        orderId: order.id,
        method: "QRIS_DYNAMIC",
        status: "PENDING",
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, gatewayPayload: true, expiresAt: true },
    });

    if (existing?.expiresAt) {
      const stored = (existing.gatewayPayload ?? {}) as StoredQrisPayload;

      if (typeof stored.qrString === "string" && stored.qrString.length > 0) {
        return jsonOk({
          paymentId: existing.id,
          orderNumber,
          amount: order.grandTotal,
          qrString: stored.qrString,
          qrUrl: stored.qrUrl ?? null,
          expiresAt: existing.expiresAt,
          mode: stored.mode ?? "demo",
        });
      }
    }

    const expiresAt = new Date(now.getTime() + QRIS_TTL_MS);
    const staticPayload = process.env.QRIS_STATIC_PAYLOAD ?? createDemoStaticPayload();

    let qrString = "";
    let qrUrl: string | null = null;
    let mode: "gateway" | "demo" = "gateway";
    let provider = process.env.PAYMENT_PROVIDER ?? "midtrans";
    let gatewayRefId: string | null = null;

    try {
      const charge = await createQrisCharge({ orderNumber, amount: order.grandTotal });

      qrUrl = charge.qrUrl;
      gatewayRefId = charge.transactionId;

      qrString =
        charge.qrString ??
        buildDynamicQris({
          staticPayload,
          amount: order.grandTotal,
          merchantRef: orderNumber,
        });
    } catch (error) {
      if (error instanceof PaymentConfigError) {
        mode = "demo";
        provider = "demo-qris";
        gatewayRefId = `demo-${orderNumber}-${now.getTime()}`;
        qrString = buildDynamicQris({
          staticPayload,
          amount: order.grandTotal,
          merchantRef: orderNumber,
        });
      } else if (error instanceof PaymentGatewayError) {
        throw new ApiError("CONFLICT", `Gagal membuat QRIS: ${error.message}`);
      } else {
        throw error;
      }
    }

    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        method: "QRIS_DYNAMIC",
        status: "PENDING",
        amountPaid: order.grandTotal,
        provider,
        gatewayRefId,
        expiresAt,
        gatewayPayload: {
          qrString,
          qrUrl,
          mode,
        } as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return jsonOk(
      {
        paymentId: payment.id,
        orderNumber,
        amount: order.grandTotal,
        qrString,
        qrUrl,
        expiresAt,
        mode,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
