import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { parseQrSlug, readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import {
  CALL_WAITER_COOLDOWN_MS,
  CALL_WAITER_COOLDOWN_SECONDS,
  evaluateCallWaiterLimit,
  WAITER_CALL_TYPES,
} from "@/lib/waiter-call";

/**
 * POST /api/tables/[qrSlug]/call-waiter
 *
 * Memanggil pelayan dari meja (minta air/tisu, bersihkan meja, tanya menu,
 * minta bill). Anti-spam: maksimal 1 panggilan per 2 menit per meja, dihitung
 * dari database agar konsisten lintas instance.
 *
 * Panggilan WAJIB terikat pada sesi meja yang sedang aktif (mencegah prank dari
 * meja yang belum dipesan).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPEN_SESSION_STATUSES: Array<"ACTIVE" | "BILL_REQUESTED"> = ["ACTIVE", "BILL_REQUESTED"];

const callWaiterSchema = z
  .object({
    type: z.enum(WAITER_CALL_TYPES, {
      errorMap: () => ({ message: "Jenis panggilan tidak dikenali." }),
    }),
    note: z.string().trim().max(160, "Catatan maksimal 160 karakter.").optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ qrSlug: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { qrSlug } = await context.params;
    const slug = parseQrSlug(qrSlug);
    // Validasi payload sebelum menyentuh database.
    const input = callWaiterSchema.parse(await readJsonBody(request));

    const table = await db.table.findUnique({
      where: { qrSlug: slug },
      select: { id: true, isActive: true },
    });

    if (!table || !table.isActive) {
      throw new ApiError("NOT_FOUND", "Meja tidak ditemukan atau sudah tidak aktif.");
    }

    const session = await db.tableSession.findFirst({
      where: { tableId: table.id, status: { in: OPEN_SESSION_STATUSES } },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    });

    if (!session) {
      throw new ApiError(
        "CONFLICT",
        "Sesi meja belum dibuka. Silakan scan ulang QR meja untuk memulai sesi.",
      );
    }

    const now = new Date();
    const lastCall = await db.waiterCall.findFirst({
      where: {
        tableId: table.id,
        createdAt: { gte: new Date(now.getTime() - CALL_WAITER_COOLDOWN_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const limit = evaluateCallWaiterLimit(lastCall?.createdAt ?? null, now);

    if (!limit.allowed) {
      throw new ApiError(
        "TOO_MANY_REQUESTS",
        `Mohon tunggu ${limit.retryAfterSeconds} detik sebelum memanggil pelayan lagi.`,
        { retryAfterSeconds: limit.retryAfterSeconds },
        { "Retry-After": String(limit.retryAfterSeconds) },
      );
    }

    const created = await db.$transaction(async (tx) => {
      const call = await tx.waiterCall.create({
        data: {
          tableId: table.id,
          tableSessionId: session.id,
          type: input.type,
          note: input.note ?? null,
        },
        select: { id: true, type: true, status: true, note: true, createdAt: true },
      });

      // Panggilan pelayan juga menandai meja masih aktif.
      await tx.tableSession.update({
        where: { id: session.id },
        data: { lastActivityAt: now },
      });

      return call;
    });

    return jsonOk({ ...created, cooldownSeconds: CALL_WAITER_COOLDOWN_SECONDS }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
