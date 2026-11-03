import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { getServerEnv } from "@/lib/env";
import { OrderDraftError, PAYMENT_METHODS } from "@/lib/order-draft";
import { createOrder } from "@/lib/services/order-creation";

/**
 * POST /api/orders
 *
 * Membuat pesanan pelanggan. Seluruh nominal DIHITUNG ULANG di server dari
 * katalog database (`createOrder` → `buildOrderDraft`); body klien hanya berisi
 * id menu/opsi, kuantitas, dan catatan.
 *
 * Status awal (CONTEXT §4):
 * - `CASH` / `EDC_CARD` → `WAITING_CASHIER_APPROVAL`
 * - metode lain        → `PENDING_PAYMENT`
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const orderSchema = z
  .object({
    orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
    tableSlug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{1,64}$/, "Kode QR meja tidak valid.")
      .optional(),
    items: z
      .array(
        z
          .object({
            menuItemId: z.string().min(1, "menuItemId wajib diisi.").max(64),
            quantity: z
              .number()
              .int("Kuantitas harus bilangan bulat.")
              .min(1, "Kuantitas minimal 1.")
              .max(20, "Kuantitas maksimal 20."),
            modifierOptionIds: z.array(z.string().min(1).max(64)).max(20).default([]),
            note: z.string().trim().max(160, "Catatan maksimal 160 karakter.").optional(),
          })
          .strict(),
      )
      .min(1, "Pesanan minimal berisi satu item.")
      .max(50, "Maksimal 50 baris per pesanan."),
    paymentMethod: z.enum(PAYMENT_METHODS),
    customerName: z.string().trim().max(60, "Nama maksimal 60 karakter.").optional(),
    customerPhone: z.string().trim().max(20, "Nomor maksimal 20 karakter.").optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.orderType === "DINE_IN" && value.tableSlug === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tableSlug"],
        message: "tableSlug wajib diisi untuk pesanan DINE_IN.",
      });
    }
  });

function mapDraftError(error: OrderDraftError): ApiError {
  const details = {
    reason: error.code,
    ...(error.details === undefined ? {} : { info: error.details }),
  };

  switch (error.code) {
    case "EMPTY_CART":
    case "QUANTITY_INVALID":
      return new ApiError("BAD_REQUEST", error.message, details);
    case "MENU_NOT_FOUND":
      return new ApiError("NOT_FOUND", error.message, details);
    case "MENU_UNAVAILABLE":
      return new ApiError("CONFLICT", error.message, details);
    default:
      return new ApiError("VALIDATION_ERROR", error.message, details);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const input = orderSchema.parse(await readJsonBody(request));

    let created: Awaited<ReturnType<typeof createOrder>>;

    try {
      created = await createOrder({
        orderType: input.orderType,
        ...(input.tableSlug === undefined ? {} : { tableSlug: input.tableSlug }),
        items: input.items,
        paymentMethod: input.paymentMethod,
        ...(input.customerName === undefined ? {} : { customerName: input.customerName }),
        ...(input.customerPhone === undefined ? {} : { customerPhone: input.customerPhone }),
      });
    } catch (error) {
      if (error instanceof OrderDraftError) {
        throw mapDraftError(error);
      }

      throw error;
    }

    return jsonOk(
      {
        order: {
          id: created.order.id,
          orderNumber: created.order.orderNumber,
          status: created.order.status,
          orderType: created.order.orderType,
          grandTotal: created.order.grandTotal,
          createdAt: created.order.createdAt,
          items: created.draft.lines.map((line) => ({
            menuItemId: line.menuItemId,
            menuName: line.menuName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            modifiers: line.modifiers,
            note: line.note,
          })),
          totals: created.draft.totals,
        },
        payment: {
          id: created.payment.id,
          method: created.payment.method,
          status: created.payment.status,
          provider: created.payment.provider,
          amount: created.payment.amountPaid,
          expiresAt: created.payment.expiresAt,
        },
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
