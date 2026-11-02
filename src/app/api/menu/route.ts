import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";
import { getCustomerMenuCatalog } from "@/lib/services/customer-menu";

/**
 * GET /api/menu
 *
 * Katalog menu publik: kategori aktif, menu aktif, status 86'd, jadwal tayang,
 * dan grup modifier. Payload dibangun oleh `getCustomerMenuCatalog()` sehingga
 * konsisten dengan server component halaman pelanggan.
 *
 * Filter opsional: `?category=<slug>`.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  category: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,64}$/, "Slug kategori tidak valid.")
    .optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const catalog = await getCustomerMenuCatalog({ categorySlug: query.category });

    return jsonOk(catalog);
  } catch (error) {
    return handleRouteError(error);
  }
}
