import type { NextRequest } from "next/server";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import type { PosBillDetail, PosBillModifier } from "@/types/pos";

/**
 * GET /api/orders/[orderNumber]/bill
 *
 * Detail tagihan untuk panel kanan POS: item + modifier + catatan, total, dan
 * pembayaran terakhir (termasuk bukti transfer manual).
 * Tidak pernah mengirim `costPrice` atau data internal lain.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;

type RouteContext = { params: Promise<{ orderNumber: string }> };

function parseModifiers(value: unknown): PosBillModifier[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const modifiers: PosBillModifier[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const candidate = entry as { name?: unknown; priceDelta?: unknown };
    const name = typeof candidate.name === "string" ? candidate.name : null;
    const priceDelta = typeof candidate.priceDelta === "number" ? candidate.priceDelta : 0;

    if (name) {
      modifiers.push({ name, priceDelta });
    }
  }

  return modifiers;
}

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
        customerName: true,
        createdAt: true,
        subtotal: true,
        discountAmount: true,
        serviceCharge: true,
        taxAmount: true,
        uniqueCode: true,
        grandTotal: true,
        tableSession: {
          select: {
            table: { select: { tableNumber: true, area: { select: { name: true } } } },
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            menuName: true,
            quantity: true,
            unitPrice: true,
            modifiers: true,
            notes: true,
            status: true,
            station: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            method: true,
            status: true,
            amountPaid: true,
            changeAmount: true,
            proofImageUrl: true,
            paidAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    const payment = order.payments[0] ?? null;

    const payload: PosBillDetail = {
      orderNumber: order.orderNumber,
      status: order.status,
      orderType: order.orderType,
      tableLabel: order.tableSession?.table
        ? `${order.tableSession.table.tableNumber} · ${order.tableSession.table.area.name}`
        : null,
      createdAt: order.createdAt.toISOString(),
      customerName: order.customerName,
      totals: {
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        serviceCharge: order.serviceCharge,
        taxAmount: order.taxAmount,
        uniqueCode: order.uniqueCode,
        grandTotal: order.grandTotal,
      },
      items: order.items.map((item) => ({
        name: item.menuName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.quantity,
        modifiers: parseModifiers(item.modifiers),
        note: item.notes,
        status: item.status,
        station: item.station,
      })),
      payment: payment
        ? {
            id: payment.id,
            method: payment.method,
            status: payment.status,
            amountPaid: payment.amountPaid,
            changeAmount: payment.changeAmount,
            proofImageUrl: payment.proofImageUrl,
            paidAt: payment.paidAt?.toISOString() ?? null,
          }
        : null,
    };

    return jsonOk(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
