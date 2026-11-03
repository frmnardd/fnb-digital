import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * PATCH /api/admin/ingredients/[id] — sesuaikan stok, ambang minimum, biaya satuan.
 *
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

const bodySchema = z
  .object({
    currentStock: z.number().min(0).max(999_999).optional(),
    minThreshold: z.number().min(0).max(999_999).optional(),
    costPerUnit: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { id } = await context.params;

    if (!ID_PATTERN.test(id)) {
      throw new ApiError("BAD_REQUEST", "ID bahan tidak valid.");
    }

    const input = bodySchema.parse(await readJsonBody(request));

    if (Object.keys(input).length === 0) {
      throw new ApiError("VALIDATION_ERROR", "Tidak ada perubahan yang dikirim.");
    }

    const existing = await db.ingredient.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      throw new ApiError("NOT_FOUND", "Bahan baku tidak ditemukan.");
    }

    const updated = await db.ingredient.update({
      where: { id },
      data: {
        ...(input.currentStock === undefined ? {} : { currentStock: input.currentStock }),
        ...(input.minThreshold === undefined ? {} : { minThreshold: input.minThreshold }),
        ...(input.costPerUnit === undefined ? {} : { costPerUnit: input.costPerUnit }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        minThreshold: true,
        costPerUnit: true,
      },
    });

    return jsonOk({ ingredient: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
