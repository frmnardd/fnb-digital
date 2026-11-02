import { db } from "@/lib/db";
import { getRestaurantTimezone } from "@/lib/menu";
import { toPublicCategory } from "@/lib/menu-mapper";
import { categorySelect } from "@/lib/menu-select";
import type { PublicMenuCatalog } from "@/types/menu";

/**
 * Katalog menu publik untuk halaman pelanggan.
 *
 * Dipakai oleh server component `/t/[tableSlug]` dan route `GET /api/menu`
 * (satu jalur query agar bentuk payload selalu konsisten).
 */
export async function getCustomerMenuCatalog(options: {
  categorySlug?: string;
} = {}): Promise<PublicMenuCatalog> {
  const timeZone = getRestaurantTimezone();
  const now = new Date();

  const categories = await db.category.findMany({
    where: {
      isActive: true,
      ...(options.categorySlug === undefined ? {} : { slug: options.categorySlug }),
    },
    orderBy: { sortOrder: "asc" },
    select: categorySelect,
  });

  return {
    timezone: timeZone,
    generatedAt: now.toISOString(),
    categories: categories.map((category) => toPublicCategory(category, { now, timeZone })),
  };
}
