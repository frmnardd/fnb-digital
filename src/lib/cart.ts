import type { PricingModifierInput } from "@/lib/pricing";
import type { StationKey } from "@/types/menu";

/**
 * Model keranjang pelanggan & operasi murninya.
 *
 * Satu baris keranjang = kombinasi menu + pilihan modifier + catatan. Kombinasi
 * yang identik digabung (kuantitas dijumlahkan), kombinasi berbeda tetap menjadi
 * baris terpisah.
 */

export interface CartLine {
  /** ID deterministik hasil `buildCartLineId()`. */
  id: string;
  menuItemId: string;
  name: string;
  imageUrl: string | null;
  station: StationKey;
  basePrice: number;
  /** Harga per unit setelah modifier (Rupiah bulat). */
  unitPrice: number;
  quantity: number;
  modifiers: PricingModifierInput[];
  note: string;
}

export interface CartSummary {
  totalQuantity: number;
  subtotal: number;
}

/** Normalisasi catatan agar "Tanpa Bawang" dan "tanpa  bawang" dianggap sama. */
export function normalizeCartNote(note: string): string {
  return note.trim().toLowerCase().replace(/\s+/g, " ");
}

/** ID stabil: menu + daftar modifier terurut + catatan ternormalisasi. */
export function buildCartLineId(
  menuItemId: string,
  modifiers: readonly PricingModifierInput[],
  note: string,
): string {
  const modifierKey = modifiers
    .map((modifier) => modifier.id)
    .sort()
    .join("|");

  return `${menuItemId}::${modifierKey}::${normalizeCartNote(note)}`;
}

/** Menambahkan baris; bila ID sama, kuantitas dijumlahkan. */
export function mergeCartLines(
  lines: readonly CartLine[],
  incoming: CartLine,
): CartLine[] {
  const index = lines.findIndex((line) => line.id === incoming.id);

  if (index === -1) {
    return [...lines, incoming];
  }

  const next = [...lines];
  const current = lines[index];

  if (!current) {
    return [...lines, incoming];
  }

  next[index] = {
    ...current,
    // Harga & modifier mengikuti data terbaru (menu bisa berubah harga).
    unitPrice: incoming.unitPrice,
    modifiers: incoming.modifiers,
    quantity: current.quantity + incoming.quantity,
  };

  return next;
}

/** Mengubah kuantitas; kuantitas ≤ 0 menghapus baris. */
export function updateLineQuantity(
  lines: readonly CartLine[],
  id: string,
  quantity: number,
): CartLine[] {
  if (quantity <= 0) {
    return lines.filter((line) => line.id !== id);
  }

  return lines.map((line) => (line.id === id ? { ...line, quantity } : line));
}

/** Total kuantitas & subtotal (belum termasuk diskon/service/pajak). */
export function summarizeCart(lines: readonly CartLine[]): CartSummary {
  return lines.reduce<CartSummary>(
    (summary, line) => ({
      totalQuantity: summary.totalQuantity + line.quantity,
      subtotal: summary.subtotal + line.unitPrice * line.quantity,
    }),
    { totalQuantity: 0, subtotal: 0 },
  );
}

/** Jumlah seluruh porsi untuk satu menu, termasuk semua varian modifier. */
export function findQuantityByItem(lines: readonly CartLine[], menuItemId: string): number {
  return lines
    .filter((line) => line.menuItemId === menuItemId)
    .reduce((total, line) => total + line.quantity, 0);
}
