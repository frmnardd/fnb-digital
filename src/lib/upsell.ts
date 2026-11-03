import type { CartLine } from "@/lib/cart";
import type { PublicCategory, PublicMenuItem } from "@/types/menu";

/**
 * Logika rekomendasi tambahan (upselling / cross-selling) di keranjang.
 *
 * Aturan prioritas:
 * 1. Item yang sudah ada di keranjang TIDAK direkomendasikan lagi.
 * 2. Hanya item yang bisa dipesan (`isOrderable`).
 * 3. Best seller lebih diutamakan.
 * 4. Minuman (kategori `minuman-segar` / `kopi-teh`) diberi bobot tambahan agar
 *    pelanggan yang memesan makanan ditawari minuman.
 */

/** Kategori minuman untuk cross-selling. */
export const DRINK_CATEGORY_SLUGS = ["minuman-segar", "kopi-teh"] as const;

const DEFAULT_LIMIT = 3;

export interface UpsellOptions {
  limit?: number;
}

export function getUpsellSuggestions(
  categories: readonly PublicCategory[],
  lines: readonly CartLine[],
  options: UpsellOptions = {},
): PublicMenuItem[] {
  const limit = Math.max(0, options.limit ?? DEFAULT_LIMIT);
  const menuIdsInCart = new Set(lines.map((line) => line.menuItemId));

  const scored: Array<{ item: PublicMenuItem; score: number }> = [];

  for (const category of categories) {
    const isDrink = DRINK_CATEGORY_SLUGS.some((slug) => slug === category.slug);

    for (const item of category.items) {
      if (menuIdsInCart.has(item.id) || !item.isOrderable) {
        continue;
      }

      const score = (item.isBestSeller ? 2 : 0) + (isDrink ? 1 : 0);
      scored.push({ item, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((entry) => entry.item);
}

/** Menggabungkan nama modifier & catatan untuk ditampilkan pada baris keranjang. */
export function describeLineModifiers(line: Pick<CartLine, "modifiers" | "note">): string {
  const parts = line.modifiers.map((modifier) => modifier.name);
  const note = line.note.trim();

  if (note.length > 0) {
    parts.push(note);
  }

  return parts.join(" · ");
}
