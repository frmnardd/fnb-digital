import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";
import { getRunnerData } from "@/lib/services/runner";

/**
 * GET /api/runner
 *
 * Data aplikasi pelayan: item siap antar, panggilan meja, dan meja kotor.
 * TODO(RBAC): batasi akses setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    getServerEnv();

    const data = await getRunnerData();

    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
