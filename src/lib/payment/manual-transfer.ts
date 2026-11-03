/**
 * Transfer bank manual: rekening tujuan, nominal + kode unik, dan validasi bukti.
 *
 * Nominal transfer sudah memuat kode unik 3 digit yang dihitung saat order dibuat
 * (`calculateOrderTotals` dengan `applyUniqueCode: true`).
 */

export const PROOF_MAX_BYTES = 2 * 1024 * 1024;

export const PROOF_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type ProofMimeType = (typeof PROOF_MIME_TYPES)[number];

export interface ManualTransferAccount {
  bank: string;
  accountNumber: string;
  accountHolder: string;
}

/** Rekening tujuan contoh; ganti dengan data merchant asli lewat konfigurasi. */
export const MANUAL_TRANSFER_ACCOUNTS: readonly ManualTransferAccount[] = [
  { bank: "BCA", accountNumber: "1234567890", accountHolder: "PT FNB DIGITAL NUSANTARA" },
  { bank: "Mandiri", accountNumber: "9876543210", accountHolder: "PT FNB DIGITAL NUSANTARA" },
];

export interface TransferInstruction {
  accounts: readonly ManualTransferAccount[];
  amount: number;
  uniqueCode: number;
  orderNumber: string;
}

export function buildTransferInstruction({
  orderNumber,
  amount,
  uniqueCode,
  accounts = MANUAL_TRANSFER_ACCOUNTS,
}: {
  orderNumber: string;
  amount: number;
  uniqueCode: number;
  accounts?: readonly ManualTransferAccount[];
}): TransferInstruction {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Nominal transfer harus bilangan bulat Rupiah positif.");
  }

  if (!Number.isInteger(uniqueCode) || uniqueCode < 0 || uniqueCode > 999) {
    throw new Error("Kode unik harus 0–999.");
  }

  return { accounts, amount, uniqueCode, orderNumber };
}

export interface ProofDescriptor {
  fileName: string;
  size: number;
  mimeType: string;
}

export interface ProofValidation {
  valid: boolean;
  error?: string;
}

/** Memvalidasi metadata file bukti transfer sebelum disimpan. */
export function validateProofDescriptor(input: ProofDescriptor): ProofValidation {
  if (!PROOF_MIME_TYPES.includes(input.mimeType as ProofMimeType)) {
    return { valid: false, error: "Format bukti harus JPG, PNG, WEBP, atau PDF." };
  }

  if (input.size <= 0) {
    return { valid: false, error: "File bukti kosong." };
  }

  if (input.size > PROOF_MAX_BYTES) {
    return { valid: false, error: "Ukuran bukti maksimal 2 MB." };
  }

  if (input.fileName.trim().length === 0) {
    return { valid: false, error: "Nama file tidak valid." };
  }

  return { valid: true };
}

const EXTENSION_BY_MIME: Record<ProofMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Membuat nama file aman untuk bukti transfer.
 * Nama asli diabaikan; ekstensi ditentukan dari MIME agar tidak bisa dipakai
 * untuk path traversal atau menyamarkan eksekutabel.
 */
export function buildProofFileName({
  orderNumber,
  mimeType,
  timestamp = Date.now(),
}: {
  orderNumber: string;
  mimeType: ProofMimeType;
  timestamp?: number;
}): string {
  const safeOrder = orderNumber.replace(/[^A-Za-z0-9-]/g, "").slice(0, 32) || "order";
  const extension = EXTENSION_BY_MIME[mimeType];

  return `${safeOrder}-${timestamp}.${extension}`;
}

/** URL publik file bukti (relatif terhadap root aplikasi). */
export function buildProofPublicUrl(fileName: string): string {
  return `/uploads/proofs/${fileName}`;
}
