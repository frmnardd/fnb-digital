import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";
import { getDashboardData } from "@/lib/services/analytics";

/**
 * GET /api/admin/analytics?days=7
 *
 * Ringkasan omzet, mix pembayaran, jam sibuk, dan matriks Menu Engineering.
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export async function GET(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const query = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const data = await getDashboardData({ days: query.days });

    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
