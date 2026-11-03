import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * PATCH /api/admin/tables/[id] — ubah kapasitas atau aktif/nonaktifkan meja.
 *
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

const bodySchema = z
  .object({
    isActive: z.boolean().optional(),
    capacity: z.number().int().min(1).max(30).optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { id } = await context.params;

    if (!ID_PATTERN.test(id)) {
      throw new ApiError("BAD_REQUEST", "ID meja tidak valid.");
    }

    const input = bodySchema.parse(await readJsonBody(request));

    if (input.isActive === undefined && input.capacity === undefined) {
      throw new ApiError("VALIDATION_ERROR", "Tidak ada perubahan yang dikirim.");
    }

    const existing = await db.table.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      throw new ApiError("NOT_FOUND", "Meja tidak ditemukan.");
    }

    if (input.isActive === false) {
      const activeSession = await db.tableSession.findFirst({
        where: { tableId: id, status: { in: ["ACTIVE", "BILL_REQUESTED"] } },
        select: { id: true },
      });

      if (activeSession) {
        throw new ApiError("CONFLICT", "Meja masih memiliki sesi aktif.");
      }
    }

    const updated = await db.table.update({
      where: { id },
      data: {
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        ...(input.capacity === undefined ? {} : { capacity: input.capacity }),
      },
      select: { id: true, tableNumber: true, isActive: true, capacity: true },
    });

    return jsonOk({ table: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
