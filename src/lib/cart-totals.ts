import { calculateOrderTotals, type PricingItemInput } from "@/lib/pricing";
import { summarizeCart, type CartLine } from "@/lib/cart";

/**
 * Rincian biaya keranjang pelanggan.
 *
 * Modul ini TIDAK menghitung rumus sendiri — seluruh perhitungan didelegasikan
 * ke `calculateOrderTotals()` di `src/lib/pricing.ts` agar angka di layar
 * pelanggan, rincian struk, dan validasi server selalu identik.
 */

export interface CartBreakdown {
  totalQuantity: number;
  subtotal: number;
  serviceCharge: number;
  taxAmount: number;
  grandTotal: number;
}

export interface CartBreakdownOptions {
  servicePercent?: number;
  taxPercent?: number;
}

/** Mengubah baris keranjang menjadi input mesin harga. */
export function toPricingItems(lines: readonly CartLine[]): PricingItemInput[] {
  return lines.map((line) => ({
    menuItemId: line.menuItemId,
    menuName: line.name,
    basePrice: line.basePrice,
    quantity: line.quantity,
    modifiers: line.modifiers,
    notes: line.note,
  }));
}

/** Menghitung rincian biaya (subtotal, service 5%, PB1 10%, total). */
export function calculateCartBreakdown(
  lines: readonly CartLine[],
  options: CartBreakdownOptions = {},
): CartBreakdown {
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
