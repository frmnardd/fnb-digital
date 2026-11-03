/**
 * Virtual Account (transfer bank) — generator nomor demo tanpa gateway.
 *
 * Bila kredensial gateway tersedia, nomor VA asli akan dibuat oleh gateway pada
 * sub-tugas lanjutan. Modul ini menyiapkan nomor deterministik yang stabil per
 * pesanan sehingga UI & pengujian tidak bergantung pada layanan eksternal.
 */

export const BANK_CODES = ["BCA", "MANDIRI", "BNI", "BRI"] as const;

export type BankCode = (typeof BANK_CODES)[number];

export const BANK_OPTIONS: ReadonlyArray<{ code: BankCode; label: string }> = [
  { code: "BCA", label: "BCA" },
  { code: "MANDIRI", label: "Mandiri" },
  { code: "BNI", label: "BNI" },
  { code: "BRI", label: "BRI" },
];

/** Prefix nomor VA per bank (murni untuk demo). */
const BANK_PREFIX: Record<BankCode, string> = {
  BCA: "8808",
  MANDIRI: "8908",
  BNI: "8810",
  BRI: "8888",
};

export function isValidBank(value: string): value is BankCode {
  return BANK_OPTIONS.some((bank) => bank.code === value);
}

export function getBankLabel(bank: BankCode): string {
  return BANK_OPTIONS.find((option) => option.code === bank)?.label ?? bank;
}

/** Membuat nomor VA demo 12 digit yang deterministik dari nomor pesanan. */
export function buildVirtualAccount({
  bank,
  orderNumber,
}: {
  bank: BankCode;
  orderNumber: string;
}): string {
  const digits = orderNumber.replace(/\D/g, "");

  if (digits.length === 0) {
    throw new Error("Nomor pesanan harus mengandung digit untuk membuat nomor VA.");
  }

  const suffix = digits.padStart(8, "0").slice(-8);

  return `${BANK_PREFIX[bank]}${suffix}`;
}
