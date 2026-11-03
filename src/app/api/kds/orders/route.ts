import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";
import { getKdsBoard } from "@/lib/services/kds";

/**
 * GET /api/kds/orders?station=KITCHEN|BAR|PASTRY
 *
 * Tiket aktif (item QUEUED/COOKING) untuk layar dapur/bar.
 * TODO(RBAC): batasi akses setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  station: z.enum(["KITCHEN", "BAR", "PASTRY"]),
});

export async function GET(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const query = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const board = await getKdsBoard(query.station);

    return jsonOk(board);
  } catch (error) {
    return handleRouteError(error);
  }
}
