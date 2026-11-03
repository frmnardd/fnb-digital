import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/pos/shift/open
 *
 * Membuka shift kasir baru (modal awal) dan mencatat `OPENING_FLOAT` pada laci kas.
 *
 * TODO(RBAC): ganti `staffEmail` body dengan identitas dari sesi staf.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    staffEmail: z.string().trim().toLowerCase().email("Email staf tidak valid."),
    startingCash: z.number().int().min(0, "Modal awal tidak boleh negatif."),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const input = bodySchema.parse(await readJsonBody(request));

    const staff = await db.staff.findUnique({
      where: { email: input.staffEmail },
      select: { id: true, name: true, isActive: true },
    });

    if (!staff || !staff.isActive) {
      throw new ApiError("NOT_FOUND", "Staf tidak ditemukan atau tidak aktif.");
    }

    const existing = await db.cashierShift.findFirst({
      where: { staffId: staff.id, status: "OPEN" },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError("CONFLICT", "Masih ada shift terbuka. Tutup shift tersebut terlebih dahulu.");
    }

    const shift = await db.$transaction(async (tx) => {
      const created = await tx.cashierShift.create({
        data: {
          staffId: staff.id,
          status: "OPEN",
          startingCash: input.startingCash,
        },
        select: { id: true, openedAt: true },
      });

      await tx.cashDrawerLog.create({
        data: {
          shiftId: created.id,
          type: "OPENING_FLOAT",
          amount: input.startingCash,
          reason: "Modal awal shift",
        },
      });

      return created;
    });

    return jsonOk(
      {
        shiftId: shift.id,
        staffName: staff.name,
        startingCash: input.startingCash,
        openedAt: shift.openedAt,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
