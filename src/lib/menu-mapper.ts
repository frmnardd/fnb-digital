import { isMenuItemOrderable } from "@/lib/menu";
import type { CategoryWithItems } from "@/lib/menu-select";
import type { PublicCategory, PublicMenuItem } from "@/types/menu";

/**
 * Mengubah hasil query Prisma menjadi payload publik (tanpa data internal).
 */
export function toPublicCategory(
  category: CategoryWithItems,
  options: { now: Date; timeZone: string },
): PublicCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.imageUrl,
    items: category.menuItems.map((item) => toPublicMenuItem(item, options)),
  };
}

function toPublicMenuItem(
  item: CategoryWithItems["menuItems"][number],
  options: { now: Date; timeZone: string },
): PublicMenuItem {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    imageUrl: item.imageUrl,
    basePrice: item.basePrice,
    station: item.station,
    isBestSeller: item.isBestSeller,
    tags: item.tags,
    prepTimeMinutes: item.prepTimeMinutes,
    isAvailable: item.isAvailable,
    isOrderable: isMenuItemOrderable({
      isAvailable: item.isAvailable,
      availableFrom: item.availableFrom,
      availableUntil: item.availableUntil,
      now: options.now,
      timeZone: options.timeZone,
    }),
    availableFrom: item.availableFrom,
    availableUntil: item.availableUntil,
    modifierGroups: item.modifierGroups.map((group) => ({
      id: group.id,
      name: group.name,
      selectionType: group.selectionType,
      isRequired: group.isRequired,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
        isDefault: option.isDefault,
      })),
    })),
  };
}
