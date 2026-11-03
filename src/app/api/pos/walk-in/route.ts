import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { getServerEnv } from "@/lib/env";
import { OrderDraftError, PAYMENT_METHODS } from "@/lib/order-draft";
import { createOrder } from "@/lib/services/order-creation";

/**
 * POST /api/pos/walk-in
 *
 * Pembuatan pesanan langsung di kasir (Walk-In / Takeaway), memakai jalur
 * perhitungan harga yang sama dengan pesanan pelanggan (`createOrder`).
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const walkInSchema = z
  .object({
    orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
    tableSlug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{1,64}$/, "Kode meja tidak valid.")
      .optional(),
    items: z
      .array(
        z
          .object({
            menuItemId: z.string().min(1).max(64),
            quantity: z.number().int().min(1).max(20),
            modifierOptionIds: z.array(z.string().min(1).max(64)).max(20).default([]),
            note: z.string().trim().max(160).optional(),
          })
          .strict(),
      )
      .min(1, "Pesanan minimal berisi satu item.")
      .max(50),
    paymentMethod: z.enum(PAYMENT_METHODS),
    customerName: z.string().trim().max(60).optional(),
    customerPhone: z.string().trim().max(20).optional(),
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
  const details = { reason: error.code };

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

    const input = walkInSchema.parse(await readJsonBody(request));

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
          totals: created.draft.totals,
        },
        payment: {
          id: created.payment.id,
          method: created.payment.method,
          status: created.payment.status,
          amount: created.payment.amountPaid,
        },
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
