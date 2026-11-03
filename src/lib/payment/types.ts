/**
 * Tipe & util bersama modul pembayaran.
 */

/** Hasil instruksi pembayaran QRIS yang siap ditampilkan ke pelanggan. */
export interface QrisInstruction {
  /** Payload EMVCo QRIS (string) yang di-encode menjadi gambar QR. */
  qrString: string;
  /** URL gambar QR dari gateway (bila ada), mis. Midtrans `actions[]`. */
  qrUrl: string | null;
  expiresAt: Date;
  /** "gateway" = dibuat gateway asli, "demo" = dibuat lokal dari payload statis. */
  mode: "gateway" | "demo";
}

/** Terjadi saat konfigurasi payment gateway belum lengkap. */
export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}

/** Terjadi saat gateway menolak permintaan pembayaran. */
export class PaymentGatewayError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "PaymentGatewayError";
    this.statusCode = statusCode;
  }
}
