"use client";

import { Loader2, Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { computeRecipeCost, getStockStatus } from "@/lib/inventory";
import { formatRupiah } from "@/lib/pricing";
import type { IngredientView, InventoryData } from "@/lib/services/inventory";
import { cn } from "@/lib/utils";

/**
 * Manajemen inventori: stok bahan, restock/penyesuaian, dan editor resep (BOM).
 */

type Tab = "stock" | "recipe";

const UNIT_OPTIONS = ["GRAM", "ML", "PIECE", "PACK", "SLICE"] as const;
type UnitKey = (typeof UNIT_OPTIONS)[number];

const STATUS_STYLE = {
  OUT: "bg-danger/15 text-danger",
  LOW: "bg-warning/15 text-warning",
  OK: "bg-success/15 text-success",
} as const;

const STATUS_LABEL = { OUT: "Habis", LOW: "Rendah", OK: "Aman" } as const;

interface AdjustState {
  id: string | null;
  name: string;
  unit: UnitKey;
  currentStock: string;
  minThreshold: string;
  costPerUnit: string;
}

function digits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 9);
}

function decimals(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [head, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${head}.${rest.join("").slice(0, 3)}` : (head ?? "");
}

export function InventoryManager({ initialData }: { initialData: InventoryData }) {
  const [data, setData] = useState<InventoryData>(initialData);
  const [tab, setTab] = useState<Tab>("stock");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjust, setAdjust] = useState<AdjustState>({
    id: null,
    name: "",
    unit: "GRAM",
    currentStock: "",
    minThreshold: "",
    costPerUnit: "",
  });

  const [recipeMenuId, setRecipeMenuId] = useState(data.menus[0]?.id ?? "");
  const [recipeLines, setRecipeLines] = useState<Array<{ ingredientId: string; quantity: string }>>(
    [],
  );

  const recipe = data.recipes.find((entry) => entry.menuItemId === recipeMenuId) ?? null;

  const computedCost = useMemo(() => {
    const costById = new Map(data.ingredients.map((ingredient) => [ingredient.id, ingredient.costPerUnit] as const));

    return computeRecipeCost(
      recipeLines.map((line) => ({
        quantity: Number(line.quantity || "0"),
        costPerUnit: costById.get(line.ingredientId) ?? 0,
      })),
    );
  }, [recipeLines, data.ingredients]);

  async function refresh() {
    const response = await fetch("/api/admin/inventory", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { data?: InventoryData } | null;

    if (payload?.data) {
      setData(payload.data);
    }
  }

  async function send(url: string, method: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Aksi gagal diproses.");
        return false;
      }

      await refresh();
      return true;
    } catch {
      setError("Tidak dapat menghubungi server.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openAdjust(ingredient: IngredientView | null) {
    setAdjust(
      ingredient
        ? {
            id: ingredient.id,
            name: ingredient.name,
            unit: ingredient.unit,
            currentStock: String(ingredient.currentStock),
            minThreshold: String(ingredient.minThreshold),
            costPerUnit: String(ingredient.costPerUnit),
          }
        : {
            id: null,
            name: "",
            unit: "GRAM",
            currentStock: "0",
            minThreshold: "0",
            costPerUnit: "0",
          },
    );
    setAdjustOpen(true);
  }

  async function saveAdjust() {
    const payload = {
      currentStock: Number(adjust.currentStock || "0"),
      minThreshold: Number(adjust.minThreshold || "0"),
      costPerUnit: Number(adjust.costPerUnit || "0"),
    };

    const ok = adjust.id
      ? await send(`/api/admin/ingredients/${encodeURIComponent(adjust.id)}`, "PATCH", payload)
      : await send("/api/admin/ingredients", "POST", {
          name: adjust.name.trim(),
          unit: adjust.unit,
          ...payload,
        });

    if (ok) {
      setAdjustOpen(false);
      setMessage(adjust.id ? "Bahan diperbarui." : "Bahan baru ditambahkan.");
    }
  }

  function loadRecipe(menuItemId: string) {
    setRecipeMenuId(menuItemId);

    const existing = data.recipes.find((entry) => entry.menuItemId === menuItemId);

    setRecipeLines(
      existing
        ? existing.lines.map((line) => ({
            ingredientId: line.ingredientId,
            quantity: String(line.quantity),
          }))
        : [],
    );
  }

  async function saveRecipe() {
    if (!recipeMenuId) {
      setError("Pilih menu terlebih dahulu.");
      return;
    }

    const lines = recipeLines
      .map((line) => ({ ingredientId: line.ingredientId, quantity: Number(line.quantity || "0") }))
      .filter((line) => line.ingredientId.length > 0 && line.quantity > 0);

    const ok = await send(
      `/api/admin/menu-items/${encodeURIComponent(recipeMenuId)}/recipe`,
      "PUT",
      { lines },
    );

    if (ok) {
      setMessage("Resep disimpan & HPP diperbarui.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Back-office
          </span>
          <h1 className="text-lg font-extrabold">Inventori & Resep</h1>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {data.stats.total} bahan · {data.stats.low} rendah · {data.stats.out} habis
          </p>
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            aria-pressed={tab === "stock"}
            onClick={() => setTab("stock")}
            className={cn(
              "min-h-11 rounded-lg border px-3 text-xs font-bold",
              tab === "stock"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            Stok Bahan
          </button>
          <button
            type="button"
            aria-pressed={tab === "recipe"}
            onClick={() => setTab("recipe")}
            className={cn(
              "min-h-11 rounded-lg border px-3 text-xs font-bold",
              tab === "recipe"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            Resep & HPP
          </button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-2 text-[11px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {message ? (
        <p role="status" className="rounded-lg bg-success/10 p-2 text-[11px] font-semibold text-success">
          {message}
        </p>
      ) : null}

      {tab === "stock" ? (
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <Button onClick={() => openAdjust(null)}>
              <Plus className="size-4" aria-hidden />
              Tambah Bahan
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-bold">Bahan</th>
                  <th className="px-3 py-2 text-right font-bold">Stok</th>
                  <th className="px-3 py-2 text-right font-bold">Minimum</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                  <th className="px-3 py-2 text-right font-bold">Biaya/satuan</th>
                  <th className="px-3 py-2 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.ingredients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                      Belum ada bahan baku. Tambahkan bahan untuk memakai resep & HPP otomatis.
                    </td>
                  </tr>
                ) : (
                  data.ingredients.map((ingredient) => {
                    const status = getStockStatus(ingredient.currentStock, ingredient.minThreshold);

                    return (
                      <tr key={ingredient.id} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2">
                          <span className="flex flex-col">
                            <span className="font-bold">{ingredient.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {ingredient.sku ?? "tanpa SKU"}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {ingredient.currentStock} {ingredient.unit}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {ingredient.minThreshold}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase",
                              STATUS_STYLE[status],
                            )}
                          >
                            {STATUS_LABEL[status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatRupiah(ingredient.costPerUnit)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => openAdjust(ingredient)}
                            className="min-h-9 rounded-lg border border-border px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                          >
                            Sesuaikan
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={recipeMenuId}
              onChange={(event) => loadRecipe(event.target.value)}
              aria-label="Pilih menu"
              className="h-11 rounded-lg border border-input bg-background px-2 text-xs font-semibold outline-none"
            >
              {data.menus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name}
                </option>
              ))}
            </select>

            <span className="rounded-lg bg-secondary px-2 py-1 text-[11px] font-bold tabular-nums">
              HPP hitung: {formatRupiah(computedCost)}
            </span>
            {recipe ? (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                tersimpan: {formatRupiah(recipe.costPrice)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3">
            {recipeLines.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Belum ada bahan pada resep ini. Tambahkan baris di bawah.
              </p>
            ) : (
              recipeLines.map((line, index) => (
                <div key={`${line.ingredientId}-${index}`} className="flex items-center gap-1.5">
                  <select
                    value={line.ingredientId}
                    onChange={(event) =>
                      setRecipeLines((previous) =>
                        previous.map((entry, position) =>
                          position === index ? { ...entry, ingredientId: event.target.value } : entry,
                        ),
                      )
                    }
                    aria-label={`Bahan baris ${index + 1}`}
                    className="h-10 flex-1 rounded-lg border border-input bg-background px-2 text-[11px] outline-none"
                  >
                    <option value="">Pilih bahan…</option>
                    {data.ingredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name} ({ingredient.unit})
                      </option>
                    ))}
                  </select>

                  <input
                    value={line.quantity}
                    onChange={(event) =>
                      setRecipeLines((previous) =>
                        previous.map((entry, position) =>
                          position === index
                            ? { ...entry, quantity: decimals(event.target.value) }
                            : entry,
                        ),
                      )
                    }
                    inputMode="decimal"
                    placeholder="Takaran"
                    aria-label={`Takaran baris ${index + 1}`}
                    className="h-10 w-24 rounded-lg border border-input bg-background px-2 text-right text-[11px] tabular-nums outline-none"
                  />

                  <button
                    type="button"
                    aria-label={`Hapus baris ${index + 1}`}
                    onClick={() =>
                      setRecipeLines((previous) => previous.filter((_, position) => position !== index))
                    }
                    className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-danger"
                  >
                    ×
                  </button>
                </div>
              ))
            )}

            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                onClick={() =>
                  setRecipeLines((previous) => [
                    ...previous,
                    { ingredientId: "", quantity: "" },
                  ])
                }
              >
                <Plus className="size-4" aria-hidden />
                Tambah Baris
              </Button>
              <Button onClick={() => void saveRecipe()} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
                Simpan Resep
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        title={adjust.id ? `Sesuaikan ${adjust.name}` : "Tambah Bahan Baku"}
        description="Stok mendukung 3 desimal (contoh 1250.5 gram)."
      >
        <div className="grid grid-cols-2 gap-2">
          {adjust.id === null ? (
            <>
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Nama bahan</span>
                <input
                  value={adjust.name}
                  onChange={(event) => setAdjust({ ...adjust, name: event.target.value })}
                  className="h-11 rounded-lg border border-input bg-background px-2 text-xs outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Satuan</span>
                <select
                  value={adjust.unit}
                  onChange={(event) => setAdjust({ ...adjust, unit: event.target.value as UnitKey })}
                  className="h-11 rounded-lg border border-input bg-background px-2 text-xs outline-none"
                >
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Stok saat ini</span>
            <input
              value={adjust.currentStock}
              onChange={(event) => setAdjust({ ...adjust, currentStock: decimals(event.target.value) })}
              inputMode="decimal"
              className="h-11 rounded-lg border border-input bg-background px-2 text-xs tabular-nums outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Minimum</span>
            <input
              value={adjust.minThreshold}
              onChange={(event) => setAdjust({ ...adjust, minThreshold: decimals(event.target.value) })}
              inputMode="decimal"
              className="h-11 rounded-lg border border-input bg-background px-2 text-xs tabular-nums outline-none"
            />
          </label>

          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">
              Biaya per satuan (Rp)
            </span>
            <input
              value={adjust.costPerUnit}
              onChange={(event) => setAdjust({ ...adjust, costPerUnit: digits(event.target.value) })}
              inputMode="numeric"
              className="h-11 rounded-lg border border-input bg-background px-2 text-xs tabular-nums outline-none"
            />
          </label>
        </div>

        <Button className="mt-3 w-full" disabled={busy} onClick={() => void saveAdjust()}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Simpan
        </Button>
      </Modal>
    </div>
  );
}
