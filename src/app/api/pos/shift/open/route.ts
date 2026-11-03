import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { requireStaffApi } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/pos/shift/open
 *
 * Membuka shift kasir baru (modal awal) untuk staf yang sedang login,
 * sekaligus mencatat `OPENING_FLOAT` pada laci kas.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    startingCash: z.number().int().min(0, "Modal awal tidak boleh negatif."),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const session = await requireStaffApi(["ADMIN", "CASHIER"]);
    const input = bodySchema.parse(await readJsonBody(request));

    const staff = await db.staff.findUnique({
      where: { id: session.sub },
      select: { id: true, name: true, isActive: true },
    });

    if (!staff || !staff.isActive) {
      throw new ApiError("FORBIDDEN", "Akun staf tidak aktif. Silakan login ulang.");
    }

    const existing = await db.cashierShift.findFirst({
      where: { staffId: staff.id, status: "OPEN" },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError(
        "CONFLICT",
        "Masih ada shift terbuka. Tutup shift tersebut terlebih dahulu.",
      );
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
