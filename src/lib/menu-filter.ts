import type { PublicCategory, PublicMenuItem } from "@/types/menu";

/**
 * Logika pencarian & filter katalog menu (murni, tanpa React).
 *
 * Dipakai `MenuBrowser` untuk memfilter data yang sudah dimuat dari server,
 * sehingga pencarian tetap instan tanpa request tambahan.
 */

export type DietaryFilter = "BEST_SELLER" | "PEDAS" | "BARU";

export const DIETARY_FILTERS: Array<{ id: DietaryFilter; label: string }> = [
  { id: "BEST_SELLER", label: "Best Seller" },
  { id: "PEDAS", label: "Pedas" },
  { id: "BARU", label: "Baru" },
];

const TAG_BY_FILTER: Record<Exclude<DietaryFilter, "BEST_SELLER">, string> = {
  PEDAS: "PEDAS",
  BARU: "BARU",
};

export interface MenuFilterOptions {
  search?: string;
  dietaryFilters?: readonly DietaryFilter[];
}

function matchesSearch(item: PublicMenuItem, search: string): boolean {
  const query = search.trim().toLowerCase();

  if (query.length === 0) {
    return true;
  }

  const name = item.name.toLowerCase();
  const description = (item.description ?? "").toLowerCase();

  return name.includes(query) || description.includes(query);
}

function matchesDietary(item: PublicMenuItem, filters: readonly DietaryFilter[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  // Semua filter harus terpenuhi (AND).
  return filters.every((filter) =>
    filter === "BEST_SELLER"
      ? item.isBestSeller
      : item.tags.some((tag) => tag.toUpperCase() === TAG_BY_FILTER[filter]),
  );
}

/** Memfilter satu daftar item menu berdasarkan kata kunci & filter dietary. */
export function filterMenuItems(
  items: readonly PublicMenuItem[],
  options: MenuFilterOptions = {},
): PublicMenuItem[] {
  const search = options.search ?? "";
  const dietaryFilters = options.dietaryFilters ?? [];

  return items.filter(
    (item) => matchesSearch(item, search) && matchesDietary(item, dietaryFilters),
  );
}

/**
 * Memfilter kategori sekaligus membuang kategori yang tidak punya item cocok
 * (agar tab kategori tidak menampilkan bagian kosong).
 */
export function filterCategories(
  categories: readonly PublicCategory[],
  options: MenuFilterOptions = {},
): PublicCategory[] {
  const result: PublicCategory[] = [];

  for (const category of categories) {
    const items = filterMenuItems(category.items, options);

    if (items.length > 0) {
      result.push({ ...category, items });
    }
  }

  return result;
}

/** Jumlah seluruh item yang cocok setelah filter. */
export function countMatchingItems(
  categories: readonly PublicCategory[],
  options: MenuFilterOptions = {},
): number {
  return categories.reduce(
    (total, category) => total + filterMenuItems(category.items, options).length,
    0,
  );
}
