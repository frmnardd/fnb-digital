import type { NextRequest } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { requireStaffApi } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import {
  toEscPos,
  type PaperWidth,
  type ReceiptOrderItem,
} from "@/lib/printer/escpos";

/**
 * GET /api/orders/[orderNumber]/receipt/escpos?width=58|80
 *
 * Mengembalikan payload ESC/POS siap kirim ke printer thermal.
 * Browser tidak dapat mengirim byte mentah ke printer tanpa jembatan lokal
 * (QZ Tray / WebUSB / agen cetak) — endpoint ini menyediakan payload-nya.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;

type RouteContext = { params: Promise<{ orderNumber: string }> };

function parseWidth(value: string | null): PaperWidth {
  return value === "58" ? 58 : 80;
}

function parseModifierNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "object" && entry !== null && "name" in entry) {
        const name = (entry as { name?: unknown }).name;
        return typeof name === "string" ? name : null;
      }

      return null;
    })
    .filter((name): name is string => name !== null && name.length > 0);
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    // Struk thermal hanya untuk layar kasir.
    await requireStaffApi(["ADMIN", "CASHIER"]);

    const { orderNumber } = await context.params;

    if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
      throw new ApiError("BAD_REQUEST", "Nomor pesanan tidak valid.");
    }

    const paperWidth = parseWidth(request.nextUrl.searchParams.get("width"));

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: {
        orderNumber: true,
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
          select: { menuName: true, quantity: true, unitPrice: true, modifiers: true, notes: true },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { method: true, status: true },
        },
      },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    const items: ReceiptOrderItem[] = order.items.map((item) => ({
      name: item.menuName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      modifiers: parseModifierNames(item.modifiers),
      note: item.notes,
    }));

    const payload = toEscPos(
      {
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        tableLabel: order.tableSession?.table
          ? `${order.tableSession.table.tableNumber} - ${order.tableSession.table.area.name}`
          : null,
        customerName: order.customerName,
        createdAt: order.createdAt,
        items,
        totals: {
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          serviceCharge: order.serviceCharge,
          taxAmount: order.taxAmount,
          uniqueCode: order.uniqueCode,
          grandTotal: order.grandTotal,
        },
        payment: order.payments[0] ?? null,
      },
      { paperWidth, qrData: order.orderNumber },
    );

    return new Response(payload, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="struk-${order.orderNumber}-${paperWidth}mm.txt"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
