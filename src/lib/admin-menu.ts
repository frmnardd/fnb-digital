/**
 * Helper back-office menu (murni & teruji).
 */

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Membuat slug unik dengan sufiks `-2`, `-3`, dst. */
export function buildMenuSlug(name: string, existing: readonly string[] = []): string {
  const base = slugify(name) || "menu";
  const taken = new Set(existing);

  if (!taken.has(base)) {
    return base;
  }

  let suffix = 2;

  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

export interface PricingValidation {
  valid: boolean;
  error?: string;
}

export function validateMenuPricing({
  basePrice,
  costPrice,
}: {
  basePrice: number;
  costPrice: number;
}): PricingValidation {
  if (!Number.isInteger(basePrice) || basePrice <= 0) {
    return { valid: false, error: "Harga jual harus bilangan bulat Rupiah lebih dari 0." };
  }

  if (!Number.isInteger(costPrice) || costPrice < 0) {
    return { valid: false, error: "HPP harus bilangan bulat Rupiah (boleh 0)." };
  }

  if (costPrice >= basePrice) {
    return { valid: false, error: "HPP harus lebih kecil dari harga jual." };
  }

  return { valid: true };
}

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateSchedule(
  from?: string | null,
  until?: string | null,
): PricingValidation {
  const normalizedFrom = from?.trim() ?? "";
  const normalizedUntil = until?.trim() ?? "";

  if (normalizedFrom.length === 0 && normalizedUntil.length === 0) {
    return { valid: true };
  }

  if (normalizedFrom.length > 0 && !TIME_PATTERN.test(normalizedFrom)) {
    return { valid: false, error: "Jam mulai harus format HH:mm." };
  }

  if (normalizedUntil.length > 0 && !TIME_PATTERN.test(normalizedUntil)) {
    return { valid: false, error: "Jam selesai harus format HH:mm." };
  }

  if (normalizedFrom.length === 0 || normalizedUntil.length === 0) {
    return { valid: false, error: "Isi jam mulai dan jam selesai sekaligus (atau kosongkan keduanya)." };
  }

  return { valid: true };
}

export interface AdminMenuItemLike {
  id: string;
  name: string;
  categoryId: string;
  slug: string;
  isAvailable: boolean;
}

export interface AdminMenuFilter {
  search?: string;
  categoryId?: string | null;
  only86?: boolean;
}

export function filterAdminMenuItems<T extends AdminMenuItemLike>(
  items: readonly T[],
  filter: AdminMenuFilter = {},
): T[] {
  const query = (filter.search ?? "").trim().toLowerCase();

  return items.filter((item) => {
    if (filter.categoryId && item.categoryId !== filter.categoryId) {
      return false;
    }

    if (filter.only86 && item.isAvailable) {
      return false;
    }

    if (query.length > 0) {
      const haystack = `${item.name} ${item.slug}`.toLowerCase();
      return haystack.includes(query);
    }

    return true;
  });
}
