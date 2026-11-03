import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";
import { getCurrentShift } from "@/lib/services/shift";

/**
 * GET /api/pos/shift?staffEmail=...
 *
 * Ringkasan shift kasir yang sedang terbuka beserta mutasi laci kas.
 * `null` berarti belum ada shift terbuka.
 *
 * TODO(RBAC): ganti `staffEmail` query dengan identitas dari sesi staf.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  staffEmail: z.string().trim().toLowerCase().email("Email staf tidak valid."),
});

export async function GET(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    // ZodError ditangani `handleRouteError` → 422 dengan format konsisten.
    const query = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const shift = await getCurrentShift(query.staffEmail);

    return jsonOk({ shift });
  } catch (error) {
    return handleRouteError(error);
  }
}
