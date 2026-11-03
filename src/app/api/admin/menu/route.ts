import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";
import { getAdminMenuData } from "@/lib/services/admin-menu";

/**
 * GET /api/admin/menu
 *
 * Data back-office: kategori, menu (termasuk HPP), dan grup modifier.
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    getServerEnv();

    const data = await getAdminMenuData();

    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
