import { summarizeCart, type CartLine } from "@/lib/cart";
import { toPricingItems } from "@/lib/cart-totals";
import { calculateOrderTotals } from "@/lib/pricing";

/**
 * Helper keranjang kasir untuk pesanan walk-in / takeaway.
 * Memakai tipe `CartLine` yang sama dengan keranjang pelanggan agar operasi
 * baris (merge, ubah qty, hapus) bisa dipakai ulang.
 */

export interface WalkInTotals {
  totalQuantity: number;
  subtotal: number;
  serviceCharge: number;
  taxAmount: number;
  grandTotal: number;
}

export interface WalkInValidation {
  valid: boolean;
  error?: string;
}

export function validateWalkInCart(lines: readonly CartLine[]): WalkInValidation {
  if (lines.length === 0) {
    return { valid: false, error: "Keranjang masih kosong." };
  }

  if (lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1)) {
    return { valid: false, error: "Kuantitas item tidak valid." };
  }

  return { valid: true };
}

export function calculateWalkInTotals(
  lines: readonly CartLine[],
  options: { servicePercent?: number; taxPercent?: number } = {},
): WalkInTotals {
  if (lines.length === 0) {
    return {
      totalQuantity: 0,
      subtotal: 0,
      serviceCharge: 0,
      taxAmount: 0,
      grandTotal: 0,
    };
  }

  const totals = calculateOrderTotals({
    items: toPricingItems(lines),
    ...(options.servicePercent === undefined ? {} : { servicePercent: options.servicePercent }),
    ...(options.taxPercent === undefined ? {} : { taxPercent: options.taxPercent }),
  });

  return {
    totalQuantity: summarizeCart(lines).totalQuantity,
    subtotal: totals.subtotal,
    serviceCharge: totals.serviceCharge,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal,
  };
}

/** Referensi pendek untuk pesanan walk-in (bukan nomor pesanan resmi). */
export function generateWalkInReference(now: Date = new Date()): string {
  return `WI-${now.getTime().toString(36).toUpperCase()}`;
}
