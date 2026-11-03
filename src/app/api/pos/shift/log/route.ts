import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/pos/shift/log
 *
 * Mencatat kas masuk/keluar pada laci kas selama shift terbuka.
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    shiftId: z.string().min(1).max(64),
    type: z.enum(["CASH_IN", "CASH_OUT"]),
    amount: z.number().int().positive("Nominal harus lebih dari 0."),
    reason: z.string().trim().max(160).optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const input = bodySchema.parse(await readJsonBody(request));

    const shift = await db.cashierShift.findUnique({
      where: { id: input.shiftId },
      select: { id: true, status: true },
    });

    if (!shift) {
      throw new ApiError("NOT_FOUND", "Shift tidak ditemukan.");
    }

    if (shift.status !== "OPEN") {
      throw new ApiError("CONFLICT", "Shift sudah ditutup.");
    }

    if (input.type === "CASH_OUT" && input.amount <= 0) {
      throw new ApiError("VALIDATION_ERROR", "Nominal kas keluar harus positif.");
    }

    const log = await db.cashDrawerLog.create({
      data: {
        shiftId: shift.id,
        type: input.type,
        amount: input.amount,
        reason: input.reason ?? null,
      },
      select: { id: true, type: true, amount: true, reason: true, createdAt: true },
    });

    return jsonOk({ log }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
