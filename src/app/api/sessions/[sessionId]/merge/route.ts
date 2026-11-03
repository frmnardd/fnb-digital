import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/sessions/[sessionId]/merge
 *
 * Menggabungkan seluruh pesanan dari sesi sumber ke sesi target (mis. dua meja
 * digabung). Sesi sumber ditutup dan mejanya ditandai `NEEDS_CLEANING`.
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const bodySchema = z.object({ sourceSessionId: z.string().min(1).max(64) }).strict();
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

    if (input.sourceSessionId === sessionId) {
      throw new ApiError("CONFLICT", "Sesi sumber dan target tidak boleh sama.");
    }

    const [target, source] = await Promise.all([
      db.tableSession.findUnique({
        where: { id: sessionId },
        select: { id: true, status: true, tableId: true, table: { select: { tableNumber: true } } },
      }),
      db.tableSession.findUnique({
        where: { id: input.sourceSessionId },
        select: { id: true, status: true, tableId: true, table: { select: { tableNumber: true } } },
      }),
    ]);

    if (!target || !source) {
      throw new ApiError("NOT_FOUND", "Sesi meja tidak ditemukan.");
    }

    for (const session of [target, source]) {
      if (!OPEN_STATUSES.includes(session.status as (typeof OPEN_STATUSES)[number])) {
        throw new ApiError("CONFLICT", "Salah satu sesi meja sudah ditutup.");
      }
    }

    const now = new Date();

    const movedOrders = await db.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { tableSessionId: source.id },
        data: { tableSessionId: target.id },
      });

      await tx.tableSession.update({
        where: { id: source.id },
        data: { status: "CLOSED", closedAt: now },
      });

      await tx.table.update({
        where: { id: source.tableId },
        data: { status: "NEEDS_CLEANING" },
      });

      await tx.tableSession.update({
        where: { id: target.id },
        data: { lastActivityAt: now },
      });

      return result.count;
    });

    return jsonOk({
      targetSessionId: target.id,
      targetTable: target.table.tableNumber,
      sourceTable: source.table.tableNumber,
      movedOrders,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
