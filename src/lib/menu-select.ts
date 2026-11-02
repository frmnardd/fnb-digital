import type { Prisma } from "@prisma/client";

/**
 * Definisi `select` Prisma untuk katalog menu publik.
 *
 * Dipakai bersama oleh route API dan server component agar payload konsisten dan
 * `costPrice` (HPP) tidak pernah ikut terkirim.
 */

export const modifierOptionSelect = {
  id: true,
  name: true,
  priceDelta: true,
  isDefault: true,
} as const satisfies Prisma.ModifierOptionSelect;

export const modifierGroupSelect = {
  id: true,
  name: true,
  selectionType: true,
  isRequired: true,
  minSelect: true,
  maxSelect: true,
  options: {
    where: { isAvailable: true },
    orderBy: { sortOrder: "asc" },
    select: modifierOptionSelect,
  },
} as const satisfies Prisma.ModifierGroupSelect;

export const menuItemSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  basePrice: true,
  station: true,
  isBestSeller: true,
  tags: true,
  prepTimeMinutes: true,
  isAvailable: true,
  availableFrom: true,
  availableUntil: true,
  modifierGroups: {
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: modifierGroupSelect,
  },
} as const satisfies Prisma.MenuItemSelect;

export const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  menuItems: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: menuItemSelect,
  },
} as const satisfies Prisma.CategorySelect;

export type CategoryWithItems = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;
