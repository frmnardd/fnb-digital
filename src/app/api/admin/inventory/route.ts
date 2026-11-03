import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";
import { getInventoryData } from "@/lib/services/inventory";

/**
 * GET /api/admin/inventory
 *
 * Stok bahan baku, resep per menu, dan HPP hasil hitung.
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    getServerEnv();

    const data = await getInventoryData();

    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
