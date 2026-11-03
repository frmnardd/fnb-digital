/**
 * Perhitungan stok bahan baku & resep (murni & teruji).
 * Semua kuantitas memakai 3 desimal (gram/ml/porsi) sesuai `Decimal(12,3)`.
 */

export type StockStatus = "OUT" | "LOW" | "OK";

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export interface RecipeCostLine {
  quantity: number;
  costPerUnit: number;
}

/** HPP resep per porsi (Rupiah bulat). */
export function computeRecipeCost(lines: readonly RecipeCostLine[]): number {
  return Math.round(lines.reduce((total, line) => total + line.quantity * line.costPerUnit, 0));
}

export interface RecipeUsageLine {
  ingredientId: string;
  quantity: number;
}

export interface UsageLine extends RecipeUsageLine {
  quantity: number;
}

/** Pemakaian bahan untuk sejumlah porsi (digabung per bahan). */
export function computeUsage(
  lines: readonly RecipeUsageLine[],
  quantitySold: number,
): RecipeUsageLine[] {
  const sold = Math.max(0, quantitySold);
  const usage = new Map<string, number>();

  for (const line of lines) {
    usage.set(line.ingredientId, (usage.get(line.ingredientId) ?? 0) + line.quantity * sold);
  }

  return [...usage.entries()].map(([ingredientId, quantity]) => ({
    ingredientId,
    quantity: round3(Math.max(0, quantity)),
  }));
}

/** Stok setelah pemakaian; tidak pernah negatif. */
export function applyUsage(currentStock: number, usage: number): number {
  return round3(Math.max(0, currentStock - Math.max(0, usage)));
}

export function getStockStatus(currentStock: number, minThreshold: number): StockStatus {
  if (currentStock <= 0) {
    return "OUT";
  }

  if (minThreshold > 0 && currentStock <= minThreshold) {
    return "LOW";
  }

  return "OK";
}

export interface IngredientLike {
  id: string;
  currentStock: number;
  minThreshold: number;
}

export interface InventorySummary {
  total: number;
  low: number;
  out: number;
}

export function summarizeInventory(items: readonly IngredientLike[]): InventorySummary {
  let low = 0;
  let out = 0;

  for (const item of items) {
    const status = getStockStatus(item.currentStock, item.minThreshold);

    if (status === "OUT") {
      out += 1;
    } else if (status === "LOW") {
      low += 1;
    }
  }

  return { total: items.length, low, out };
}
