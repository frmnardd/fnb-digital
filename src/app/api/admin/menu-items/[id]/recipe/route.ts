import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { computeRecipeCost } from "@/lib/inventory";

/**
 * PUT /api/admin/menu-items/[id]/recipe
 *
 * Mengganti seluruh resep (BOM) sebuah menu lalu menghitung ulang
 * `MenuItem.costPrice` dari takaran × biaya satuan bahan.
 *
 * TODO(RBAC): lindungi endpoint admin setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

const bodySchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            ingredientId: z.string().min(1).max(64),
            quantity: z.number().positive().max(999_999),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { id } = await context.params;

    if (!ID_PATTERN.test(id)) {
      throw new ApiError("BAD_REQUEST", "ID menu tidak valid.");
    }

    const input = bodySchema.parse(await readJsonBody(request));

    const menu = await db.menuItem.findUnique({ where: { id }, select: { id: true, name: true } });

    if (!menu) {
      throw new ApiError("NOT_FOUND", "Menu tidak ditemukan.");
    }

    const ingredientIds = [...new Set(input.lines.map((line) => line.ingredientId))];
    const ingredients = await db.ingredient.findMany({
      where: { id: { in: ingredientIds } },
      select: { id: true, costPerUnit: true },
    });

    if (ingredients.length !== ingredientIds.length) {
      throw new ApiError("NOT_FOUND", "Salah satu bahan baku tidak ditemukan.");
    }

    const costByIngredient = new Map(
      ingredients.map((ingredient) => [ingredient.id, ingredient.costPerUnit] as const),
    );

    const costPrice = computeRecipeCost(
      input.lines.map((line) => ({
        quantity: line.quantity,
        costPerUnit: costByIngredient.get(line.ingredientId) ?? 0,
      })),
    );

    await db.$transaction(async (tx) => {
      await tx.menuRecipe.deleteMany({ where: { menuItemId: menu.id } });

      if (input.lines.length > 0) {
        await tx.menuRecipe.createMany({
          data: input.lines.map((line) => ({
            menuItemId: menu.id,
            ingredientId: line.ingredientId,
            quantity: line.quantity,
          })),
        });
      }

      await tx.menuItem.update({ where: { id: menu.id }, data: { costPrice } });
    });

    return jsonOk({ menuId: menu.id, lines: input.lines.length, costPrice });
  } catch (error) {
    return handleRouteError(error);
  }
}
