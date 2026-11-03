import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  computeRecipeCost,
  getStockStatus,
  summarizeInventory,
  type StockStatus,
} from "@/lib/inventory";

/**
 * Data inventori & pemakaian bahan (BOM) untuk back-office.
 */

export type IngredientUnitKey = "GRAM" | "ML" | "PIECE" | "PACK" | "SLICE";

export interface IngredientView {
  id: string;
  name: string;
  sku: string | null;
  unit: IngredientUnitKey;
  currentStock: number;
  minThreshold: number;
  costPerUnit: number;
  status: StockStatus;
  isActive: boolean;
}

export interface RecipeLineView {
  ingredientId: string;
  ingredientName: string;
  unit: IngredientUnitKey;
  quantity: number;
  costPerUnit: number;
  lineCost: number;
}

export interface RecipeView {
  menuItemId: string;
  menuName: string;
  costPrice: number;
  computedCost: number;
  lines: RecipeLineView[];
}

export interface InventoryData {
  ingredients: IngredientView[];
  recipes: RecipeView[];
  menus: Array<{ id: string; name: string }>;
  stats: { total: number; low: number; out: number };
}

export async function getInventoryData(): Promise<InventoryData> {
  const [ingredients, recipes, menus] = await Promise.all([
    db.ingredient.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        currentStock: true,
        minThreshold: true,
        costPerUnit: true,
        isActive: true,
      },
    }),
    db.menuRecipe.findMany({
      orderBy: { menuItem: { name: "asc" } },
      select: {
        menuItemId: true,
        ingredientId: true,
        quantity: true,
        menuItem: { select: { name: true, costPrice: true } },
        ingredient: { select: { name: true, unit: true, costPerUnit: true } },
      },
    }),
    db.menuItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const ingredientViews: IngredientView[] = ingredients.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.name,
    sku: ingredient.sku,
    unit: ingredient.unit,
    currentStock: Number(ingredient.currentStock),
    minThreshold: Number(ingredient.minThreshold),
    costPerUnit: ingredient.costPerUnit,
    status: getStockStatus(Number(ingredient.currentStock), Number(ingredient.minThreshold)),
    isActive: ingredient.isActive,
  }));

  const recipeMap = new Map<string, RecipeView>();

  for (const recipe of recipes) {
    const line: RecipeLineView = {
      ingredientId: recipe.ingredientId,
      ingredientName: recipe.ingredient.name,
      unit: recipe.ingredient.unit,
      quantity: Number(recipe.quantity),
      costPerUnit: recipe.ingredient.costPerUnit,
      lineCost: Math.round(Number(recipe.quantity) * recipe.ingredient.costPerUnit),
    };

    const existing = recipeMap.get(recipe.menuItemId);

    if (existing) {
      existing.lines.push(line);
      continue;
    }

    recipeMap.set(recipe.menuItemId, {
      menuItemId: recipe.menuItemId,
      menuName: recipe.menuItem.name,
      costPrice: recipe.menuItem.costPrice,
      computedCost: 0,
      lines: [line],
    });
  }

  const recipeViews = [...recipeMap.values()].map((recipe) => ({
    ...recipe,
    computedCost: computeRecipeCost(
      recipe.lines.map((line) => ({ quantity: line.quantity, costPerUnit: line.costPerUnit })),
    ),
  }));

  return {
    ingredients: ingredientViews,
    recipes: recipeViews,
    menus,
    stats: summarizeInventory(
      ingredientViews.map((ingredient) => ({
        id: ingredient.id,
        currentStock: ingredient.currentStock,
        minThreshold: ingredient.minThreshold,
      })),
    ),
  };
}

/**
 * Mengurangi stok bahan sesuai resep untuk seluruh item pesanan.
 * Dipanggil di dalam transaksi ketika pesanan menjadi PAID (idempoten dari sisi
 * pemanggil — pastikan hanya dipanggil sekali per transisi status).
 */
export async function deductInventoryForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<{ ingredientsUpdated: number }> {
  const items = await tx.orderItem.findMany({
    where: { orderId, status: { not: "VOIDED" } },
    select: { menuItemId: true, quantity: true },
  });

  if (items.length === 0) {
    return { ingredientsUpdated: 0 };
  }

  const soldByMenu = new Map<string, number>();

  for (const item of items) {
    if (!item.menuItemId) {
      continue;
    }

    soldByMenu.set(item.menuItemId, (soldByMenu.get(item.menuItemId) ?? 0) + item.quantity);
  }

  const recipes = await tx.menuRecipe.findMany({
    where: { menuItemId: { in: [...soldByMenu.keys()] } },
    select: { menuItemId: true, ingredientId: true, quantity: true },
  });

  if (recipes.length === 0) {
    return { ingredientsUpdated: 0 };
  }

  const usage = new Map<string, number>();

  for (const recipe of recipes) {
    const sold = soldByMenu.get(recipe.menuItemId) ?? 0;
    const total = Number(recipe.quantity) * sold;
    usage.set(recipe.ingredientId, (usage.get(recipe.ingredientId) ?? 0) + total);
  }

  const stocks = await tx.ingredient.findMany({
    where: { id: { in: [...usage.keys()] } },
    select: { id: true, currentStock: true },
  });

  let ingredientsUpdated = 0;

  for (const stock of stocks) {
    const used = usage.get(stock.id) ?? 0;

    if (used <= 0) {
      continue;
    }

    const next = Math.max(0, Math.round((Number(stock.currentStock) - used) * 1000) / 1000);

    await tx.ingredient.update({
      where: { id: stock.id },
      data: { currentStock: next },
    });

    ingredientsUpdated += 1;
  }

  return { ingredientsUpdated };
}
