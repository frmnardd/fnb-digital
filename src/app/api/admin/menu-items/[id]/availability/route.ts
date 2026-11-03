import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * PATCH /api/admin/menu-items/[id]/availability
 *
 * Sakelar cepat status 86'd (menu habis sementara) tanpa mengubah data lain.
 *
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const bodySchema = z.object({ isAvailable: z.boolean() }).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { id } = await context.params;

    if (!ID_PATTERN.test(id)) {
      throw new ApiError("BAD_REQUEST", "ID menu tidak valid.");
    }

    const input = bodySchema.parse(await readJsonBody(request));

    const existing = await db.menuItem.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      throw new ApiError("NOT_FOUND", "Menu tidak ditemukan.");
    }

    if (!existing.isActive) {
      throw new ApiError("CONFLICT", "Menu sudah dinonaktifkan.");
    }

    const updated = await db.menuItem.update({
      where: { id },
      data: { isAvailable: input.isAvailable },
      select: { id: true, isAvailable: true },
    });

    return jsonOk({ item: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
