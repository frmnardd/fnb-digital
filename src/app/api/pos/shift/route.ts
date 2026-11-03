import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { requireStaffApi } from "@/lib/auth/staff";
import { getServerEnv } from "@/lib/env";
import { getCurrentShift } from "@/lib/services/shift";

/**
 * GET /api/pos/shift
 *
 * Ringkasan shift kasir yang sedang terbuka untuk staf yang login.
 * `null` berarti belum ada shift terbuka.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    getServerEnv();

    const session = await requireStaffApi(["ADMIN", "CASHIER"]);
    const shift = await getCurrentShift(session.sub);

    return jsonOk({
      shift,
      staff: { id: session.sub, name: session.name, role: session.role },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
