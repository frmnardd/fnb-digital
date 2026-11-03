import { db } from "@/lib/db";

/**
 * Data back-office menu (dipakai API admin & halaman /admin/menu).
 */

export interface AdminCategoryView {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  itemCount: number;
}

export interface AdminMenuItemView {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  costPrice: number;
  station: "KITCHEN" | "BAR" | "PASTRY";
  isAvailable: boolean;
  isBestSeller: boolean;
  tags: string[];
  prepTimeMinutes: number;
  availableFrom: string | null;
  availableUntil: string | null;
  sortOrder: number;
  isActive: boolean;
  modifierGroupIds: string[];
}

export interface AdminModifierGroupView {
  id: string;
  name: string;
}

export interface AdminMenuData {
  categories: AdminCategoryView[];
  items: AdminMenuItemView[];
  modifierGroups: AdminModifierGroupView[];
  stats: { items: number; unavailable: number; categories: number };
}

export async function getAdminMenuData(): Promise<AdminMenuData> {
  const [categories, items, modifierGroups] = await Promise.all([
    db.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        isActive: true,
        _count: { select: { menuItems: true } },
      },
    }),
    db.menuItem.findMany({
      orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        categoryId: true,
        description: true,
        imageUrl: true,
        basePrice: true,
        costPrice: true,
        station: true,
        isAvailable: true,
        isBestSeller: true,
        tags: true,
        prepTimeMinutes: true,
        availableFrom: true,
        availableUntil: true,
        sortOrder: true,
        isActive: true,
        category: { select: { name: true } },
        modifierGroups: { select: { id: true } },
      },
    }),
    db.modifierGroup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      itemCount: category._count.menuItems,
    })),
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      description: item.description,
      imageUrl: item.imageUrl,
      basePrice: item.basePrice,
      costPrice: item.costPrice,
      station: item.station,
      isAvailable: item.isAvailable,
      isBestSeller: item.isBestSeller,
      tags: item.tags,
      prepTimeMinutes: item.prepTimeMinutes,
      availableFrom: item.availableFrom,
      availableUntil: item.availableUntil,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      modifierGroupIds: item.modifierGroups.map((group) => group.id),
    })),
    modifierGroups,
    stats: {
      items: items.length,
      unavailable: items.filter((item) => !item.isAvailable).length,
      categories: categories.length,
    },
  };
}
