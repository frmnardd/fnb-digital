import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/admin/ingredients — tambah bahan baku.
 *
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    sku: z.string().trim().max(40).optional(),
    unit: z.enum(["GRAM", "ML", "PIECE", "PACK", "SLICE"]),
    currentStock: z.number().min(0).max(999_999).default(0),
    minThreshold: z.number().min(0).max(999_999).default(0),
    costPerUnit: z.number().int().min(0).default(0),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const input = bodySchema.parse(await readJsonBody(request));

    const created = await db.ingredient.create({
      data: {
        name: input.name,
        sku: input.sku ?? null,
        unit: input.unit,
        currentStock: input.currentStock,
        minThreshold: input.minThreshold,
        costPerUnit: input.costPerUnit,
      },
      select: { id: true, name: true, unit: true, currentStock: true },
    });

    return jsonOk({ ingredient: created }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
