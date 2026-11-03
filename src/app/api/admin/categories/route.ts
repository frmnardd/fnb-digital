import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { buildMenuSlug } from "@/lib/admin-menu";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/admin/categories — buat kategori menu baru.
 *
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    sortOrder: z.number().int().min(0).max(999).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const input = bodySchema.parse(await readJsonBody(request));

    const existingSlugs = (await db.category.findMany({ select: { slug: true } })).map(
      (category) => category.slug,
    );
    const slug = buildMenuSlug(input.name, existingSlugs);

    const created = await db.category.create({
      data: { name: input.name, slug, sortOrder: input.sortOrder, isActive: input.isActive },
      select: { id: true, name: true, slug: true, sortOrder: true, isActive: true },
    });

    return jsonOk({ category: created }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
