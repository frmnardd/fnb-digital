import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { parseQrSlug, readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getRestaurantTimezone } from "@/lib/menu";
import { toPublicMenuItem } from "@/lib/menu-mapper";
import { menuItemSelect } from "@/lib/menu-select";
import {
  buildOrderDraft,
  OrderDraftError,
  PAYMENT_METHODS,
  type PaymentMethodKey,
} from "@/lib/order-draft";
import { TABLE_SESSION_COOKIE } from "@/lib/security/token";

/**
 * POST /api/orders
 *
 * Membuat pesanan pelanggan. Seluruh nominal DIHITUNG ULANG di server dari
 * katalog database (`buildOrderDraft`); body klien hanya berisi id menu/opsi,
 * kuantitas, dan catatan.
 *
 * Status awal (CONTEXT §4):
 * - `CASH` / `EDC_CARD` → `WAITING_CASHIER_APPROVAL` (dikonfirmasi kasir / PIN meja)
 * - metode lain        → `PENDING_PAYMENT` (menunggu QRIS/VA/transfer)
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPEN_SESSION_STATUSES: Array<"ACTIVE" | "BILL_REQUESTED"> = ["ACTIVE", "BILL_REQUESTED"];
const PAYMENT_EXPIRY_MINUTES = 15;
const MAX_ORDER_NUMBER_ATTEMPTS = 5;

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

type OrderInput = z.infer<typeof orderSchema>;

function isOnlinePayment(method: PaymentMethodKey): boolean {
  return method !== "CASH" && method !== "EDC_CARD";
}

function providerFor(method: PaymentMethodKey): string {
  switch (method) {
    case "MANUAL_TRANSFER":
      return "manual-transfer";
    case "CASH":
      return "cashier";
    case "EDC_CARD":
      return "edc";
    default:
      return process.env.PAYMENT_PROVIDER ?? "midtrans";
  }
}

/** Menerjemahkan error domain draft menjadi respons HTTP yang tepat. */
function mapDraftError(error: OrderDraftError): ApiError {
  const details = { reason: error.code, ...(error.details === undefined ? {} : { info: error.details }) };

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

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Nomor pesanan tampilan: ORD-0001, ORD-0002, … */
async function nextOrderNumber(tx: Prisma.TransactionClient, attempt: number): Promise<string> {
  const total = await tx.order.count();
  return `ORD-${String(total + 1 + attempt).padStart(4, "0")}`;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const input = orderSchema.parse(await readJsonBody(request));

    // 1) Ambil katalog dari database (hanya yang aktif) lalu hitung ulang harga.
    const menuIds = [...new Set(input.items.map((line) => line.menuItemId))];
    const rows = await db.menuItem.findMany({
      where: { id: { in: menuIds }, isActive: true },
      select: menuItemSelect,
    });

    const now = new Date();
    const timeZone = getRestaurantTimezone();
    const menuIndex = new Map(
      rows.map((row) => [row.id, toPublicMenuItem(row, { now, timeZone })] as const),
    );

    let draft: ReturnType<typeof buildOrderDraft>;

    try {
      draft = buildOrderDraft({
        items: input.items,
        menuIndex,
        paymentMethod: input.paymentMethod,
      });
    } catch (error) {
      if (error instanceof OrderDraftError) {
        throw mapDraftError(error);
      }

      throw error;
    }

    // 2) Simpan order + payment + update aktivitas sesi dalam satu transaksi.
    let result: Awaited<ReturnType<typeof createOrder>> | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS && result === null; attempt += 1) {
      try {
        result = await createOrder(input, draft, attempt);
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_ORDER_NUMBER_ATTEMPTS - 1) {
          lastError = error;
          continue;
        }

        throw error;
      }
    }

    if (!result) {
      throw lastError ?? new ApiError("CONFLICT", "Gagal membuat nomor pesanan. Coba lagi.");
    }

    return jsonOk(
      {
        order: {
          id: result.order.id,
          orderNumber: result.order.orderNumber,
          status: result.order.status,
          orderType: result.order.orderType,
          grandTotal: result.order.grandTotal,
          createdAt: result.order.createdAt,
          items: draft.lines.map((line) => ({
            menuItemId: line.menuItemId,
            menuName: line.menuName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            modifiers: line.modifiers,
            note: line.note,
          })),
          totals: draft.totals,
        },
        payment: {
          id: result.payment.id,
          method: result.payment.method,
          status: result.payment.status,
          provider: result.payment.provider,
          amount: result.payment.amountPaid,
          expiresAt: result.payment.expiresAt,
        },
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

async function createOrder(
  input: OrderInput,
  draft: ReturnType<typeof buildOrderDraft>,
  attempt: number,
) {
  const sessionToken = (await cookies()).get(TABLE_SESSION_COOKIE)?.value ?? null;

  return db.$transaction(async (tx) => {
    const now = new Date();
    let tableSessionId: string | null = null;

    if (input.orderType === "DINE_IN") {
      const qrSlug = parseQrSlug(input.tableSlug ?? "");

      const table = await tx.table.findUnique({
        where: { qrSlug },
        select: { id: true, isActive: true },
      });

      if (!table || !table.isActive) {
        throw new ApiError("NOT_FOUND", "Meja tidak ditemukan atau sudah tidak aktif.");
      }

      const session = await tx.tableSession.findFirst({
        where: { tableId: table.id, status: { in: OPEN_SESSION_STATUSES } },
        orderBy: { openedAt: "desc" },
        select: { id: true },
      });

      if (!session) {
        throw new ApiError(
          "CONFLICT",
          "Sesi meja belum dibuka. Scan ulang QR meja untuk memulai sesi.",
        );
      }

      // Token opsional: tamu lain di meja yang sama tetap boleh memesan
      // (group ordering), tetapi sesi meja wajib aktif.
      void sessionToken;

      tableSessionId = session.id;

      await tx.tableSession.update({
        where: { id: session.id },
        data: { lastActivityAt: now },
      });
    }

    const orderNumber = await nextOrderNumber(tx, attempt);
    const status =
      input.paymentMethod === "CASH" || input.paymentMethod === "EDC_CARD"
        ? ("WAITING_CASHIER_APPROVAL" as const)
        : ("PENDING_PAYMENT" as const);

    const order = await tx.order.create({
      data: {
        orderNumber,
        orderType: input.orderType,
        status,
        tableSessionId,
        customerName: input.customerName ?? null,
        customerPhone: input.customerPhone ?? null,
        subtotal: draft.totals.subtotal,
        discountAmount: draft.totals.discountAmount,
        serviceCharge: draft.totals.serviceCharge,
        taxAmount: draft.totals.taxAmount,
        uniqueCode: draft.totals.uniqueCode,
        grandTotal: draft.totals.grandTotal,
        items: {
          create: draft.lines.map((line) => ({
            menuItemId: line.menuItemId,
            menuName: line.menuName,
            station: line.station,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            modifierTotal: line.modifierTotal,
            // Snapshot modifier disimpan sebagai JSON; cast dibutuhkan karena
            // Prisma memakai tipe index-signature untuk kolom Json.
            modifiers: line.modifiers.map((modifier) => ({
              id: modifier.id,
              name: modifier.name,
              priceDelta: modifier.priceDelta,
            })) as unknown as Prisma.InputJsonValue,
            notes: line.note.length > 0 ? line.note : null,
          })),
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        orderType: true,
        grandTotal: true,
        createdAt: true,
      },
    });

    const expiresAt = isOnlinePayment(input.paymentMethod)
      ? new Date(now.getTime() + PAYMENT_EXPIRY_MINUTES * 60_000)
      : null;

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        method: input.paymentMethod,
        status: "PENDING",
        amountPaid: draft.totals.grandTotal,
        provider: providerFor(input.paymentMethod),
        expiresAt,
      },
      select: {
        id: true,
        method: true,
        status: true,
        provider: true,
        amountPaid: true,
        expiresAt: true,
      },
    });

    return { order, payment };
  });
}
