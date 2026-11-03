import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * PATCH /api/admin/categories/[id] — ubah kategori.
 * DELETE /api/admin/categories/[id] — hapus kategori (hanya bila kosong).
 *
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

const patchSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { id } = await context.params;

    if (!ID_PATTERN.test(id)) {
      throw new ApiError("BAD_REQUEST", "ID kategori tidak valid.");
    }

    const input = patchSchema.parse(await readJsonBody(request));

    const existing = await db.category.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      throw new ApiError("NOT_FOUND", "Kategori tidak ditemukan.");
    }

    const updated = await db.category.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
      select: { id: true, name: true, slug: true, sortOrder: true, isActive: true },
    });

    return jsonOk({ category: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { id } = await context.params;

    if (!ID_PATTERN.test(id)) {
      throw new ApiError("BAD_REQUEST", "ID kategori tidak valid.");
    }

    const existing = await db.category.findUnique({
      where: { id },
      select: { id: true, _count: { select: { menuItems: true } } },
    });

    if (!existing) {
      throw new ApiError("NOT_FOUND", "Kategori tidak ditemukan.");
    }

    if (existing._count.menuItems > 0) {
      throw new ApiError(
        "CONFLICT",
        "Kategori masih memiliki menu. Pindahkan atau hapus menunya terlebih dahulu.",
      );
    }

    await db.category.delete({ where: { id } });

    return jsonOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
