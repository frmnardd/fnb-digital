import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Verifikasi & pemetaan notifikasi payment gateway (Midtrans).
 *
 * Signature Midtrans = SHA-512 dari `order_id + status_code + gross_amount + serverKey`.
 * Perbandingan dilakukan constant-time untuk mencegah timing attack.
 */

export const MIDTRANS_TRANSACTION_STATUSES = [
  "capture",
  "settlement",
  "pending",
  "deny",
  "cancel",
  "expire",
  "failure",
  "refund",
  "partial_refund",
] as const;

export type MidtransTransactionStatus = (typeof MIDTRANS_TRANSACTION_STATUSES)[number];

export const midtransNotificationSchema = z
  .object({
    order_id: z.string().min(1, "order_id wajib ada."),
    status_code: z.string().min(1, "status_code wajib ada."),
    gross_amount: z.string().min(1, "gross_amount wajib ada."),
    signature_key: z.string().min(1, "signature_key wajib ada."),
    transaction_status: z.enum(MIDTRANS_TRANSACTION_STATUSES),
    fraud_status: z.enum(["accept", "challenge", "deny"]).optional(),
    payment_type: z.string().optional(),
    transaction_id: z.string().optional(),
    transaction_time: z.string().optional(),
  })
  // Midtrans mengirim banyak field tambahan; jangan tolak payload yang sah.
  .passthrough();

export type MidtransNotification = z.infer<typeof midtransNotificationSchema>;

export type PaymentStatusKey = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";

/** SHA-512 signature yang diharapkan gateway. */
export function computeMidtransSignature({
  orderId,
  statusCode,
  grossAmount,
  serverKey,
}: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
}): string {
  return createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");
}

/** Membandingkan signature notifikasi dengan nilai yang diharapkan (constant-time). */
export function verifyMidtransSignature({
  orderId,
  statusCode,
  grossAmount,
  signatureKey,
  serverKey,
}: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
  serverKey: string;
}): boolean {
  if (!serverKey || !/^[0-9a-f]+$/i.test(signatureKey)) {
    return false;
  }

  const expected = Buffer.from(
    computeMidtransSignature({ orderId, statusCode, grossAmount, serverKey }),
    "hex",
  );
  const received = Buffer.from(signatureKey, "hex");

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

/**
 * Memetakan status transaksi gateway ke `PaymentStatus`.
 * `capture` dengan fraud challenge tetap PENDING sampai review selesai.
 */
export function mapTransactionToPaymentStatus({
  transactionStatus,
  fraudStatus,
}: {
  transactionStatus: MidtransTransactionStatus;
  fraudStatus?: "accept" | "challenge" | "deny";
}): PaymentStatusKey {
  switch (transactionStatus) {
    case "settlement":
      return "PAID";
    case "capture":
      if (fraudStatus === "deny") {
        return "FAILED";
      }

      if (fraudStatus === "challenge" || fraudStatus === "accept") {
        return fraudStatus === "accept" ? "PAID" : "PENDING";
      }

      return "PAID";
    case "pending":
      return "PENDING";
    case "deny":
    case "cancel":
    case "failure":
      return "FAILED";
    case "expire":
      return "EXPIRED";
    case "refund":
    case "partial_refund":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

/**
 * Mengambil nomor pesanan dari `order_id` gateway.
 * Format yang dipakai saat charge: `<orderNumber>-<timestamp>`.
 */
export function extractOrderNumber(orderId: string): string | null {
  const withTimestamp = /^(.+)-(\d{10,})$/.exec(orderId.trim());

  if (withTimestamp) {
    const candidate = withTimestamp[1]?.trim() ?? "";
    return candidate.length > 0 ? candidate : null;
  }

  if (/^[A-Za-z0-9-]{4,32}$/.test(orderId.trim())) {
    return orderId.trim();
  }

  return null;
}
