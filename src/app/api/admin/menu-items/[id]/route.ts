import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { validateMenuPricing, validateSchedule } from "@/lib/admin-menu";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * PATCH /api/admin/menu-items/[id] — ubah menu.
 * DELETE /api/admin/menu-items/[id] — nonaktifkan menu (soft delete).
 *
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const timeSchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional();

const patchSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    categoryId: z.string().min(1).max(64).optional(),
    description: z.string().trim().max(280).nullable().optional(),
    imageUrl: z.string().trim().max(500).nullable().optional(),
    basePrice: z.number().int().optional(),
    costPrice: z.number().int().optional(),
    station: z.enum(["KITCHEN", "BAR", "PASTRY"]).optional(),
    tags: z.array(z.string().trim().min(1).max(24)).max(10).optional(),
    prepTimeMinutes: z.number().int().min(1).max(180).optional(),
    availableFrom: timeSchema,
    availableUntil: timeSchema,
    isBestSeller: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    modifierGroupIds: z.array(z.string().min(1).max(64)).max(10).optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { id } = await context.params;

    if (!ID_PATTERN.test(id)) {
      throw new ApiError("BAD_REQUEST", "ID menu tidak valid.");
    }

    const input = patchSchema.parse(await readJsonBody(request));

    const current = await db.menuItem.findUnique({
      where: { id },
      select: { id: true, basePrice: true, costPrice: true, availableFrom: true, availableUntil: true },
    });

    if (!current) {
      throw new ApiError("NOT_FOUND", "Menu tidak ditemukan.");
    }

    const pricing = validateMenuPricing({
      basePrice: input.basePrice ?? current.basePrice,
      costPrice: input.costPrice ?? current.costPrice,
    });

    if (!pricing.valid) {
      throw new ApiError("VALIDATION_ERROR", pricing.error ?? "Harga tidak valid.");
    }

    const schedule = validateSchedule(
      input.availableFrom === undefined ? current.availableFrom : input.availableFrom,
      input.availableUntil === undefined ? current.availableUntil : input.availableUntil,
    );

    if (!schedule.valid) {
      throw new ApiError("VALIDATION_ERROR", schedule.error ?? "Jadwal tidak valid.");
    }

    if (input.categoryId) {
      const category = await db.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true },
      });

      if (!category) {
        throw new ApiError("NOT_FOUND", "Kategori tidak ditemukan.");
      }
    }

    const updated = await db.menuItem.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl }),
        ...(input.basePrice === undefined ? {} : { basePrice: input.basePrice }),
        ...(input.costPrice === undefined ? {} : { costPrice: input.costPrice }),
        ...(input.station === undefined ? {} : { station: input.station }),
        ...(input.tags === undefined ? {} : { tags: input.tags }),
        ...(input.prepTimeMinutes === undefined ? {} : { prepTimeMinutes: input.prepTimeMinutes }),
        ...(input.availableFrom === undefined ? {} : { availableFrom: input.availableFrom }),
        ...(input.availableUntil === undefined ? {} : { availableUntil: input.availableUntil }),
        ...(input.isBestSeller === undefined ? {} : { isBestSeller: input.isBestSeller }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(input.modifierGroupIds === undefined
          ? {}
          : { modifierGroups: { set: input.modifierGroupIds.map((groupId) => ({ id: groupId })) } }),
      },
      select: { id: true, name: true, slug: true, basePrice: true, costPrice: true },
    });

    return jsonOk({ item: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { id } = await context.params;

    if (!ID_PATTERN.test(id)) {
      throw new ApiError("BAD_REQUEST", "ID menu tidak valid.");
    }

    const existing = await db.menuItem.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      throw new ApiError("NOT_FOUND", "Menu tidak ditemukan.");
    }

    // Soft delete: riwayat pesanan lama tetap utuh.
    const updated = await db.menuItem.update({
      where: { id },
      data: { isActive: false, isAvailable: false },
      select: { id: true, isActive: true },
    });

    return jsonOk({ item: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
