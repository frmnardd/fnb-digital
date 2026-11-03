import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { buildMenuSlug, validateMenuPricing, validateSchedule } from "@/lib/admin-menu";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/admin/menu-items
 *
 * Membuat menu baru. Harga/HPP & jadwal tayang divalidasi di server.
 *
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const timeSchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional();

const bodySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    categoryId: z.string().min(1).max(64),
    description: z.string().trim().max(280).optional(),
    imageUrl: z.string().trim().max(500).optional(),
    basePrice: z.number().int(),
    costPrice: z.number().int(),
    station: z.enum(["KITCHEN", "BAR", "PASTRY"]).default("KITCHEN"),
    tags: z.array(z.string().trim().min(1).max(24)).max(10).default([]),
    prepTimeMinutes: z.number().int().min(1).max(180).default(10),
    availableFrom: timeSchema,
    availableUntil: timeSchema,
    isBestSeller: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(999).default(0),
    modifierGroupIds: z.array(z.string().min(1).max(64)).max(10).default([]),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const input = bodySchema.parse(await readJsonBody(request));

    const pricing = validateMenuPricing({
      basePrice: input.basePrice,
      costPrice: input.costPrice,
    });

    if (!pricing.valid) {
      throw new ApiError("VALIDATION_ERROR", pricing.error ?? "Harga tidak valid.");
    }

    const schedule = validateSchedule(input.availableFrom, input.availableUntil);

    if (!schedule.valid) {
      throw new ApiError("VALIDATION_ERROR", schedule.error ?? "Jadwal tidak valid.");
    }

    const category = await db.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new ApiError("NOT_FOUND", "Kategori tidak ditemukan.");
    }

    const existingSlugs = (
      await db.menuItem.findMany({ select: { slug: true } })
    ).map((item) => item.slug);
    const slug = buildMenuSlug(input.name, existingSlugs);

    const created = await db.menuItem.create({
      data: {
        name: input.name,
        slug,
        categoryId: input.categoryId,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        basePrice: input.basePrice,
        costPrice: input.costPrice,
        station: input.station,
        tags: input.tags,
        prepTimeMinutes: input.prepTimeMinutes,
        availableFrom: input.availableFrom ?? null,
        availableUntil: input.availableUntil ?? null,
        isBestSeller: input.isBestSeller,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        modifierGroups: { connect: input.modifierGroupIds.map((id) => ({ id })) },
      },
      select: { id: true, name: true, slug: true },
    });

    return jsonOk({ item: created }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
