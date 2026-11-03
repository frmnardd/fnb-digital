import { PaymentConfigError, PaymentGatewayError } from "./types";

/**
 * Adapter payment gateway Midtrans (QRIS).
 *
 * Kredensial dibaca dari environment (`MIDTRANS_SERVER_KEY`). Bila belum diisi,
 * pemanggil harus menangani `PaymentConfigError` dan memakai mode demo
 * (generator QRIS lokal).
 */

const SANDBOX_BASE_URL = "https://api.sandbox.midtrans.com";
const PRODUCTION_BASE_URL = "https://api.midtrans.com";
const REQUEST_TIMEOUT_MS = 15_000;

export interface QrisChargeInput {
  orderNumber: string;
  amount: number;
}

export interface QrisChargeResult {
  qrString: string | null;
  qrUrl: string | null;
  transactionId: string | null;
  /** `order_id` yang dikirim ke gateway — dipakai mencocokkan webhook. */
  gatewayOrderId: string;
  raw: Record<string, unknown>;
}

function basicAuth(serverKey: string): string {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

/** Membuat transaksi QRIS di Midtrans dan mengembalikan string/URL QR. */
export async function createQrisCharge(input: QrisChargeInput): Promise<QrisChargeResult> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;

  if (!serverKey) {
    throw new PaymentConfigError("MIDTRANS_SERVER_KEY belum diatur; gunakan mode demo QRIS.");
  }

  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const baseUrl = isProduction ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;

  // Midtrans mensyaratkan `order_id` unik per transaksi → tambahkan timestamp.
  const gatewayOrderId = `${input.orderNumber}-${Date.now()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/v2/charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: basicAuth(serverKey),
      },
      body: JSON.stringify({
        payment_type: "qris",
        transaction_details: {
          order_id: gatewayOrderId,
          gross_amount: input.amount,
        },
        qris: { acquirer: "gopay" },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const message =
        typeof payload.status_message === "string"
          ? payload.status_message
          : `Gateway menolak permintaan (HTTP ${response.status}).`;

      throw new PaymentGatewayError(message, response.status);
    }

    const actions = Array.isArray(payload.actions)
      ? (payload.actions as Array<{ name?: string; url?: string }>)
      : [];

    const qrUrl = actions.find((action) => action.name === "generate-qr-code")?.url ?? null;
    const qrString = typeof payload.qr_string === "string" ? payload.qr_string : null;

    return {
      qrString,
      qrUrl,
      transactionId: typeof payload.transaction_id === "string" ? payload.transaction_id : null,
      gatewayOrderId,
      raw: payload,
    };
  } catch (error) {
    if (error instanceof PaymentGatewayError || error instanceof PaymentConfigError) {
      throw error;
    }

    throw new PaymentGatewayError(
      error instanceof Error ? `Gagal menghubungi gateway: ${error.message}` : "Gagal menghubungi gateway.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
