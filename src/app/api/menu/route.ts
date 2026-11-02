import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getRestaurantTimezone, isMenuItemOrderable } from "@/lib/menu";

/**
 * GET /api/menu
 *
 * Katalog menu publik untuk halaman pelanggan: kategori aktif, menu aktif,
 * status 86'd, jadwal tayang, serta grup modifier beserta opsinya.
 *
 * Catatan keamanan & performa:
 * - `select` eksplisit: `costPrice` (HPP), stok bahan, dan field internal TIDAK
 *   pernah dikirim ke klien.
 * - Respons memakai `force-dynamic` karena ketersediaan berubah mengikuti jam.
 * - Filter opsional: `?category=<slug>`.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  category: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,64}$/, "Slug kategori tidak valid.")
    .optional(),
});

const modifierOptionSelect = {
  id: true,
  name: true,
  priceDelta: true,
  isDefault: true,
} as const satisfies Prisma.ModifierOptionSelect;

const modifierGroupSelect = {
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

const menuItemSelect = {
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

const categorySelect = {
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

export async function GET(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const timeZone = getRestaurantTimezone();
    const now = new Date();

    const categories = await db.category.findMany({
      where: {
        isActive: true,
        ...(query.category === undefined ? {} : { slug: query.category }),
      },
      orderBy: { sortOrder: "asc" },
      select: categorySelect,
    });

    return jsonOk({
      timezone: timeZone,
      generatedAt: now.toISOString(),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        items: category.menuItems.map((item) => ({
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
            now,
            timeZone,
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
        })),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
