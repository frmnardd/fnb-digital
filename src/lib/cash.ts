/**
 * Helper kalkulator pembayaran tunai kasir.
 *
 * Murni & teruji: dipakai `CashPaymentModal` untuk chip pecahan uang dan
 * pembersihan input keypad.
 */

/** Pecahan uang kertas/uang tunai yang umum dipakai kasir. */
export const CASH_DENOMINATIONS = [20000, 50000, 100000] as const;

/** Batas digit agar input tidak overflow (maks Rp 999.999.999). */
export const CASH_INPUT_MAX_DIGITS = 9;

/**
 * Daftar tombol nominal cepat untuk sebuah tagihan:
 * selalu menyertakan "Uang Pas" (nilai total) lalu pecahan yang >= total.
 */
export function getCashShortcuts(total: number): number[] {
  if (!Number.isInteger(total) || total < 1) {
    return [];
  }

  const candidates = [total, ...CASH_DENOMINATIONS.filter((denomination) => denomination >= total)];

  return [...new Set(candidates)].sort((a, b) => a - b);
}

/** Mengubah input bebas menjadi nominal Rupiah (hanya digit, dibatasi panjangnya). */
export function parseCashInput(value: string): number {
  const digits = value.replace(/\D/g, "").slice(0, CASH_INPUT_MAX_DIGITS);

  return digits.length === 0 ? 0 : Number(digits);
}

/** Format angka untuk ditampilkan pada keypad (tanpa "Rp"). */
export function formatCashInput(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0";
  }

  return new Intl.NumberFormat("id-ID").format(Math.trunc(value));
}
