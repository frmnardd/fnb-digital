import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import {
  generateOrderNumber,
  isUniqueViolation,
  ORDER_NUMBER_MAX_ATTEMPTS,
} from "@/lib/order-number";
import {
  recalculateTotalsFromItems,
  SplitBillError,
  splitItemsBySelection,
  type SplittableItem,
} from "@/lib/split-bill";
import type { PricingModifierInput } from "@/lib/pricing";

/**
 * POST /api/orders/[orderNumber]/split
 *
 * Memisahkan sebagian item ke pesanan baru (Split by Item) pada sesi meja yang
 * sama, lalu menghitung ulang total kedua pesanan di server.
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;

const bodySchema = z
  .object({ itemIds: z.array(z.string().min(1).max(64)).min(1).max(50) })
  .strict();

const SPLITTABLE_STATUSES = [
  "PENDING_PAYMENT",
  "WAITING_CASHIER_APPROVAL",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
] as const;

type RouteContext = { params: Promise<{ orderNumber: string }> };

function parseModifiers(value: unknown): PricingModifierInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const modifiers: PricingModifierInput[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const candidate = entry as { id?: unknown; name?: unknown; priceDelta?: unknown };

    modifiers.push({
      id: typeof candidate.id === "string" ? candidate.id : "modifier",
      name: typeof candidate.name === "string" ? candidate.name : "Modifier",
      priceDelta: typeof candidate.priceDelta === "number" ? candidate.priceDelta : 0,
    });
  }

  return modifiers;
}

function mapSplitError(error: SplitBillError): ApiError {
  switch (error.code) {
    case "UNKNOWN_ITEM":
    case "DUPLICATE_SELECTION":
      return new ApiError("VALIDATION_ERROR", error.message, { reason: error.code });
    default:
      return new ApiError("BAD_REQUEST", error.message, { reason: error.code });
  }
}

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
        orderNumber: true,
        status: true,
        orderType: true,
        tableSessionId: true,
        customerName: true,
        customerPhone: true,
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            modifierTotal: true,
            modifiers: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { method: true, status: true, provider: true },
        },
      },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    if (!SPLITTABLE_STATUSES.includes(order.status as (typeof SPLITTABLE_STATUSES)[number])) {
      throw new ApiError("CONFLICT", "Pesanan ini tidak dapat dipisahkan pada status saat ini.");
    }

    const originalPayment = order.payments[0] ?? null;

    if (originalPayment?.status === "PAID") {
      throw new ApiError("CONFLICT", "Pesanan sudah lunas sehingga tidak perlu dipisahkan.");
    }

    if (order.items.length < 2) {
      throw new ApiError("CONFLICT", "Pesanan hanya memiliki satu item; split tidak diperlukan.");
    }

    const splittable: SplittableItem[] = order.items.map((item) => ({
      id: item.id,
      basePrice: item.unitPrice - item.modifierTotal,
      quantity: item.quantity,
      modifiers: parseModifiers(item.modifiers),
    }));

    let selection: ReturnType<typeof splitItemsBySelection>;

    try {
      selection = splitItemsBySelection(splittable, input.itemIds);
    } catch (error) {
      if (error instanceof SplitBillError) {
        throw mapSplitError(error);
      }

      throw error;
    }

    const movedTotals = recalculateTotalsFromItems(selection.moved);
    const remainingTotals = recalculateTotalsFromItems(selection.remaining);
    const movedIds = selection.moved.map((item) => item.id);

    let created: { orderNumber: string } | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < ORDER_NUMBER_MAX_ATTEMPTS && created === null; attempt += 1) {
      try {
        created = await db.$transaction(async (tx) => {
          const newOrderNumber = await generateOrderNumber(tx, attempt);

          const newOrder = await tx.order.create({
            data: {
              orderNumber: newOrderNumber,
              orderType: order.orderType,
              status: order.status,
              tableSessionId: order.tableSessionId,
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              subtotal: movedTotals.subtotal,
              discountAmount: 0,
              serviceCharge: movedTotals.serviceCharge,
              taxAmount: movedTotals.taxAmount,
              uniqueCode: 0,
              grandTotal: movedTotals.grandTotal,
            },
            select: { id: true, orderNumber: true },
          });

          await tx.orderItem.updateMany({
            where: { id: { in: movedIds } },
            data: { orderId: newOrder.id },
          });

          await tx.payment.create({
            data: {
              orderId: newOrder.id,
              method: originalPayment?.method ?? "CASH",
              status: "PENDING",
              amountPaid: movedTotals.grandTotal,
              provider: originalPayment?.provider ?? "cashier",
            },
          });

          await tx.order.update({
            where: { id: order.id },
            data: {
              subtotal: remainingTotals.subtotal,
              serviceCharge: remainingTotals.serviceCharge,
              taxAmount: remainingTotals.taxAmount,
              uniqueCode: 0,
              grandTotal: remainingTotals.grandTotal,
            },
          });

          return { orderNumber: newOrder.orderNumber };
        });
      } catch (error) {
        if (isUniqueViolation(error) && attempt < ORDER_NUMBER_MAX_ATTEMPTS - 1) {
          lastError = error;
          continue;
        }

        throw error;
      }
    }

    if (!created) {
      throw lastError ?? new ApiError("CONFLICT", "Gagal membuat nomor pesanan baru untuk split.");
    }

    return jsonOk(
      {
        originalOrder: { orderNumber: order.orderNumber, totals: remainingTotals },
        newOrder: { orderNumber: created.orderNumber, totals: movedTotals },
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
