import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { buildShiftSummary, computeVariance } from "@/lib/shift";

/**
 * POST /api/pos/shift/close
 *
 * Menutup shift dengan *blind cash count*: kasir memasukkan kas fisik akhir,
 * sistem menghitung ekspektasi & selisihnya (variance).
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    shiftId: z.string().min(1).max(64),
    actualEndingCash: z.number().int().min(0, "Kas fisik tidak boleh negatif."),
    notes: z.string().trim().max(160).optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const input = bodySchema.parse(await readJsonBody(request));

    const shift = await db.cashierShift.findUnique({
      where: { id: input.shiftId },
      select: {
        id: true,
        status: true,
        startingCash: true,
        drawerLogs: { select: { type: true, amount: true } },
      },
    });

    if (!shift) {
      throw new ApiError("NOT_FOUND", "Shift tidak ditemukan.");
    }

    if (shift.status !== "OPEN") {
      throw new ApiError("CONFLICT", "Shift sudah ditutup.");
    }

    const summary = buildShiftSummary({ startingCash: shift.startingCash, logs: shift.drawerLogs });
    const variance = computeVariance(input.actualEndingCash, summary.expectedCash);
    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.cashierShift.update({
        where: { id: shift.id },
        data: {
          status: "CLOSED",
          closedAt: now,
          expectedCash: summary.expectedCash,
          actualEndingCash: input.actualEndingCash,
          variance,
          notes: input.notes ?? null,
        },
      });

      await tx.cashDrawerLog.create({
        data: {
          shiftId: shift.id,
          type: "CLOSING_COUNT",
          amount: input.actualEndingCash,
          reason: "Hitung fisik kas akhir shift",
        },
      });
    });

    return jsonOk({
      shiftId: shift.id,
      expectedCash: summary.expectedCash,
      actualEndingCash: input.actualEndingCash,
      variance,
      sales: summary.sales,
      cashIn: summary.cashIn,
      cashOut: summary.cashOut,
      refunds: summary.refunds,
      closedAt: now.toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
