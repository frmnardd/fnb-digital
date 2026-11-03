import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";
import { getPosFloorPlan } from "@/lib/services/pos-tables";

/**
 * GET /api/pos/tables
 *
 * Denah meja untuk layar kasir: area, status meja, sesi aktif, dan total bill
 * berjalan. Tidak pernah mengirim PIN meja atau data internal lain.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    getServerEnv();

    const areas = await getPosFloorPlan();

    return jsonOk({ areas });
  } catch (error) {
    return handleRouteError(error);
  }
}
