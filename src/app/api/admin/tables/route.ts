import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";
import { getTableStudioData } from "@/lib/services/table-studio";

/**
 * GET /api/admin/tables
 *
 * Daftar area & meja untuk studio QR.
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    getServerEnv();

    const data = await getTableStudioData();

    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
