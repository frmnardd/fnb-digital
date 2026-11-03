import type { Prisma } from "@prisma/client";

import { ApiError } from "@/lib/api/errors";
import { parseQrSlug } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getRestaurantTimezone } from "@/lib/menu";
import { toPublicMenuItem } from "@/lib/menu-mapper";
import { menuItemSelect } from "@/lib/menu-select";
import {
  buildOrderDraft,
  type OrderDraft,
  type OrderDraftItemInput,
  type PaymentMethodKey,
} from "@/lib/order-draft";
import {
  generateOrderNumber,
  isUniqueViolation,
  ORDER_NUMBER_MAX_ATTEMPTS,
} from "@/lib/order-number";

/**
 * Layanan pembuatan order (dipakai `POST /api/orders` & `POST /api/pos/walk-in`).
 *
 * Semua harga dihitung ulang dari katalog database lewat `buildOrderDraft`;
 * nomor pesanan memakai retry `P2002`.
 */

const OPEN_SESSION_STATUSES: Array<"ACTIVE" | "BILL_REQUESTED"> = ["ACTIVE", "BILL_REQUESTED"];
const PAYMENT_EXPIRY_MINUTES = 15;

export function isOnlinePayment(method: PaymentMethodKey): boolean {
  return method !== "CASH" && method !== "EDC_CARD";
}

export function providerFor(method: PaymentMethodKey): string {
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

export interface CreateOrderInput {
  orderType: "DINE_IN" | "TAKEAWAY";
  tableSlug?: string;
  items: OrderDraftItemInput[];
  paymentMethod: PaymentMethodKey;
  customerName?: string;
  customerPhone?: string;
}

export interface CreatedOrder {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    orderType: "DINE_IN" | "TAKEAWAY";
    grandTotal: number;
    createdAt: Date;
  };
  payment: {
    id: string;
    method: PaymentMethodKey;
    status: string;
    provider: string | null;
    amountPaid: number;
    expiresAt: Date | null;
  };
  draft: OrderDraft;
}

export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const menuIds = [...new Set(input.items.map((item) => item.menuItemId))];

  const rows = await db.menuItem.findMany({
    where: { id: { in: menuIds }, isActive: true },
    select: menuItemSelect,
  });

  const now = new Date();
  const timeZone = getRestaurantTimezone();
  const menuIndex = new Map(
    rows.map((row) => [row.id, toPublicMenuItem(row, { now, timeZone })] as const),
  );

  const draft = buildOrderDraft({
    items: input.items,
    menuIndex,
    paymentMethod: input.paymentMethod,
  });

  let result: Omit<CreatedOrder, "draft"> | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < ORDER_NUMBER_MAX_ATTEMPTS && result === null; attempt += 1) {
    try {
      result = await db.$transaction((tx) => createOrderInTransaction(tx, input, draft, attempt));
    } catch (error) {
      if (isUniqueViolation(error) && attempt < ORDER_NUMBER_MAX_ATTEMPTS - 1) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  if (!result) {
    throw lastError ?? new ApiError("CONFLICT", "Gagal membuat nomor pesanan. Coba lagi.");
  }

  return { ...result, draft };
}

async function createOrderInTransaction(
  tx: Prisma.TransactionClient,
  input: CreateOrderInput,
  draft: OrderDraft,
  attempt: number,
): Promise<Omit<CreatedOrder, "draft">> {
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

    tableSessionId = session.id;

    await tx.tableSession.update({
      where: { id: session.id },
      data: { lastActivityAt: now },
    });
  }

  const orderNumber = await generateOrderNumber(tx, attempt);
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
}
