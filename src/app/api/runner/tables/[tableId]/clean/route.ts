import type { NextRequest } from "next/server";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/runner/tables/[tableId]/clean
 *
 * Menandai meja selesai dibersihkan (kembali `AVAILABLE`).
 * Ditolak bila masih ada sesi aktif di meja tersebut.
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

type RouteContext = { params: Promise<{ tableId: string }> };

export async function POST(_request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { tableId } = await context.params;

    if (!ID_PATTERN.test(tableId)) {
      throw new ApiError("BAD_REQUEST", "ID meja tidak valid.");
    }

    const table = await db.table.findUnique({
      where: { id: tableId },
      select: { id: true, tableNumber: true, status: true, isActive: true },
    });

    if (!table || !table.isActive) {
      throw new ApiError("NOT_FOUND", "Meja tidak ditemukan atau tidak aktif.");
    }

    const activeSession = await db.tableSession.findFirst({
      where: { tableId: table.id, status: { in: ["ACTIVE", "BILL_REQUESTED"] } },
      select: { id: true },
    });

    if (activeSession) {
      throw new ApiError("CONFLICT", "Meja masih memiliki sesi aktif.");
    }

    const updated = await db.table.update({
      where: { id: table.id },
      data: { status: "AVAILABLE" },
      select: { id: true, tableNumber: true, status: true },
    });

    return jsonOk({ table: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
