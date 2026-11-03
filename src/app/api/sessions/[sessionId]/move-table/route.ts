import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/sessions/[sessionId]/move-table
 *
 * Memindahkan sesi meja aktif ke meja lain yang kosong.
 * Meja asal ditandai `NEEDS_CLEANING`, meja tujuan `OCCUPIED`.
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const bodySchema = z.object({ targetTableId: z.string().min(1).max(64) }).strict();
const OPEN_STATUSES = ["ACTIVE", "BILL_REQUESTED"] as const;

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { sessionId } = await context.params;

    if (!SESSION_ID_PATTERN.test(sessionId)) {
      throw new ApiError("BAD_REQUEST", "ID sesi tidak valid.");
    }

    const input = bodySchema.parse(await readJsonBody(request));

    const session = await db.tableSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        tableId: true,
        table: { select: { id: true, tableNumber: true } },
      },
    });

    if (!session) {
      throw new ApiError("NOT_FOUND", "Sesi meja tidak ditemukan.");
    }

    if (!OPEN_STATUSES.includes(session.status as (typeof OPEN_STATUSES)[number])) {
      throw new ApiError("CONFLICT", "Sesi meja sudah ditutup.");
    }

    const target = await db.table.findUnique({
      where: { id: input.targetTableId },
      select: { id: true, tableNumber: true, status: true, isActive: true },
    });

    if (!target || !target.isActive) {
      throw new ApiError("NOT_FOUND", "Meja tujuan tidak ditemukan atau tidak aktif.");
    }

    if (target.id === session.tableId) {
      throw new ApiError("CONFLICT", "Meja tujuan sama dengan meja saat ini.");
    }

    if (target.status !== "AVAILABLE") {
      throw new ApiError("CONFLICT", "Meja tujuan tidak kosong.");
    }

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.tableSession.update({
        where: { id: session.id },
        data: { tableId: target.id, lastActivityAt: now },
      });

      await tx.table.update({
        where: { id: session.tableId },
        data: { status: "NEEDS_CLEANING" },
      });

      await tx.table.update({
        where: { id: target.id },
        data: { status: "OCCUPIED" },
      });
    });

    return jsonOk({
      sessionId: session.id,
      fromTable: session.table.tableNumber,
      toTable: target.tableNumber,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
