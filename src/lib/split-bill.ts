import { calculateOrderTotals, type PricingModifierInput } from "@/lib/pricing";

/**
 * Logika split bill (murni & teruji).
 */

const MAX_SPLIT_PARTS = 20;

export interface SplittableItem {
  id: string;
  /** Harga dasar sebelum modifier (unitPrice dikurangi total modifier). */
  basePrice: number;
  quantity: number;
  modifiers: PricingModifierInput[];
}

export interface SplitSelection {
  moved: SplittableItem[];
  remaining: SplittableItem[];
}

export type SplitBillErrorCode =
  | "EMPTY_SELECTION"
  | "ALL_SELECTED"
  | "UNKNOWN_ITEM"
  | "DUPLICATE_SELECTION"
  | "INVALID_PARTS";

export class SplitBillError extends Error {
  readonly code: SplitBillErrorCode;

  constructor(code: SplitBillErrorCode, message: string) {
    super(message);
    this.name = "SplitBillError";
    this.code = code;
  }
}

/** Memisahkan item terpilih (pindah ke bill baru) dari sisanya. */
export function splitItemsBySelection(
  items: readonly SplittableItem[],
  selectedIds: readonly string[],
): SplitSelection {
  if (selectedIds.length === 0) {
    throw new SplitBillError("EMPTY_SELECTION", "Pilih minimal satu item untuk dipisahkan.");
  }

  if (new Set(selectedIds).size !== selectedIds.length) {
    throw new SplitBillError("DUPLICATE_SELECTION", "Terdapat item yang dipilih ganda.");
  }

  const itemIds = new Set(items.map((item) => item.id));

  for (const selectedId of selectedIds) {
    if (!itemIds.has(selectedId)) {
      throw new SplitBillError(
        "UNKNOWN_ITEM",
        "Salah satu item yang dipilih bukan bagian dari pesanan ini.",
      );
    }
  }

  const selected = new Set(selectedIds);
  const moved = items.filter((item) => selected.has(item.id));
  const remaining = items.filter((item) => !selected.has(item.id));

  if (remaining.length === 0) {
    throw new SplitBillError(
      "ALL_SELECTED",
      "Tidak bisa memindahkan seluruh item; sisakan minimal satu item pada bill asal.",
    );
  }

  return { moved, remaining };
}

export interface RecalculatedTotals {
  subtotal: number;
  serviceCharge: number;
  taxAmount: number;
  grandTotal: number;
}

/** Menghitung ulang total sebuah bill dari daftar itemnya (diskon/kode unik dibuang). */
export function recalculateTotalsFromItems(
  items: readonly SplittableItem[],
  options: { servicePercent?: number; taxPercent?: number } = {},
): RecalculatedTotals {
  const totals = calculateOrderTotals({
    items: items.map((item) => ({
      menuItemId: item.id,
      basePrice: item.basePrice,
      quantity: item.quantity,
      modifiers: item.modifiers,
    })),
    ...(options.servicePercent === undefined ? {} : { servicePercent: options.servicePercent }),
    ...(options.taxPercent === undefined ? {} : { taxPercent: options.taxPercent }),
  });

  return {
    subtotal: totals.subtotal,
    serviceCharge: totals.serviceCharge,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal,
  };
}

/**
 * Membagi total secara rata; sisa pembulatan diberikan ke bagian pertama
 * sehingga jumlah seluruh bagian selalu sama dengan total.
 */
export function splitEqually(total: number, parts: number): number[] {
  if (!Number.isInteger(total) || total < 0) {
    throw new SplitBillError("INVALID_PARTS", "Total harus bilangan bulat Rupiah >= 0.");
  }

  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_SPLIT_PARTS) {
    throw new SplitBillError(
      "INVALID_PARTS",
      `Jumlah bagian harus bilangan bulat 1–${MAX_SPLIT_PARTS}.`,
    );
  }

  const base = Math.floor(total / parts);
  const remainder = total - base * parts;

  return Array.from({ length: parts }, (_, index) => base + (index === 0 ? remainder : 0));
}
