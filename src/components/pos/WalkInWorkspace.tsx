"use client";

import { Loader2, Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ModifierSheet, type ModifierConfirmPayload } from "@/components/customer/ModifierSheet";
import { PosSidebar } from "@/components/pos/PosSidebar";
import { PosTopbar } from "@/components/pos/PosTopbar";
import { Button } from "@/components/ui/button";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { buildCartLineId, mergeCartLines, updateLineQuantity, type CartLine } from "@/lib/cart";
import { formatRupiah } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { calculateWalkInTotals, validateWalkInCart } from "@/lib/walkin";
import type { PublicCategory, PublicMenuItem } from "@/types/menu";

/**
 * Modul kasir walk-in / takeaway: pilih menu cepat lalu simpan pesanan.
 * Pembayaran dilakukan di layar kasir (antrean) setelah pesanan dibuat.
 */

type WalkInPayment = "CASH" | "QRIS_DYNAMIC";

const PAYMENT_OPTIONS: Array<{ value: WalkInPayment; label: string }> = [
  { value: "CASH", label: "Tunai" },
  { value: "QRIS_DYNAMIC", label: "QRIS" },
];

export function WalkInWorkspace({ categories }: { categories: PublicCategory[] }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<WalkInPayment>("CASH");
  const [customerName, setCustomerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isEnabled, enable, disable } = useNotificationSound();

  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? categories[0] ?? null;
  const totals = useMemo(() => calculateWalkInTotals(lines), [lines]);

  async function handleToggleSound() {
    if (isEnabled) {
      disable();
      return;
    }

    await enable();
  }

  function addLine(line: CartLine) {
    setLines((previous) => mergeCartLines(previous, line));
    setNotice(null);
    setError(null);
  }

  function handleSelectItem(item: PublicMenuItem) {
    if (item.modifierGroups.length > 0) {
      setSelectedItem(item);
      return;
    }

    addLine({
      id: buildCartLineId(item.id, [], ""),
      menuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      station: item.station,
      basePrice: item.basePrice,
      unitPrice: item.basePrice,
      quantity: 1,
      modifiers: [],
      note: "",
    });
  }

  function handleConfirmModifier(payload: ModifierConfirmPayload) {
    addLine({
      id: buildCartLineId(payload.item.id, payload.modifiers, payload.note),
      menuItemId: payload.item.id,
      name: payload.item.name,
      imageUrl: payload.item.imageUrl,
      station: payload.item.station,
      basePrice: payload.item.basePrice,
      unitPrice: payload.unitPrice,
      quantity: payload.quantity,
      modifiers: payload.modifiers,
      note: payload.note,
    });
    setSelectedItem(null);
  }

  async function handleSubmit() {
    const validation = validateWalkInCart(lines);

    if (!validation.valid) {
      setError(validation.error ?? "Keranjang tidak valid.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/pos/walk-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "TAKEAWAY",
          items: lines.map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            // ID modifier berformat "groupId:optionId" — server hanya butuh optionId.
            modifierOptionIds: line.modifiers
              .map((modifier) => modifier.id.split(":").slice(1).join(":"))
              .filter((optionId) => optionId.length > 0),
            ...(line.note.length > 0 ? { note: line.note } : {}),
          })),
          paymentMethod,
          ...(customerName.trim().length > 0 ? { customerName: customerName.trim() } : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        data?: { order?: { orderNumber?: string } };
        error?: { message?: string };
      } | null;

      const orderNumber = payload?.data?.order?.orderNumber;

      if (!response.ok || !orderNumber) {
        setError(payload?.error?.message ?? "Gagal membuat pesanan walk-in.");
        return;
      }

      setNotice(`Pesanan ${orderNumber} dibuat. Lanjutkan pembayaran di layar kasir.`);
      setLines([]);
      setCustomerName("");
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-dvh">
      <PosSidebar active="walkin" />

      <div className="flex min-w-0 flex-1 flex-col">
        <PosTopbar
          cashierName="Kasir"
          shiftLabel="Walk-in / Takeaway"
          soundEnabled={isEnabled}
          onToggleSound={() => void handleToggleSound()}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="flex min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-3">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={category.id === activeCategory?.id}
                  onClick={() => setActiveCategoryId(category.id)}
                  className={cn(
                    "min-h-touch rounded-lg border px-3 text-xs font-bold transition",
                    category.id === activeCategory?.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {categories.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 p-10 text-center">
                  <ShoppingBasket className="size-8 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-extrabold">Katalog menu belum tersedia</p>
                  <p className="max-w-xs text-[11px] text-muted-foreground">
                    Pastikan database sudah dimigrasi dan seeder dijalankan.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {(activeCategory?.items ?? []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.isOrderable}
                      onClick={() => handleSelectItem(item)}
                      className={cn(
                        "flex min-h-[88px] flex-col justify-between gap-1 rounded-xl border p-2 text-left transition",
                        item.isOrderable
                          ? "border-border bg-card hover:border-primary/50 hover:bg-secondary/40"
                          : "cursor-not-allowed border-border/60 bg-card/40 opacity-60",
                      )}
                    >
                      <span className="line-clamp-2 text-xs font-bold">{item.name}</span>
                      <span className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-extrabold tabular-nums">
                          {formatRupiah(item.basePrice)}
                        </span>
                        {item.isAvailable ? null : (
                          <span className="text-[9px] font-extrabold uppercase text-danger">Habis</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col border-l border-border bg-card/40">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-extrabold">Keranjang</h2>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold tabular-nums">
                {totals.totalQuantity} item
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {lines.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-[11px] text-muted-foreground">
                  Pilih menu di kiri untuk menambahkan item.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lines.map((line) => (
                    <li key={line.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold">{line.name}</span>
                        <button
                          type="button"
                          aria-label={`Hapus ${line.name}`}
                          onClick={() => setLines((previous) => updateLineQuantity(previous, line.id, 0))}
                          className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-danger"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </div>

                      {line.modifiers.length > 0 ? (
                        <span className="text-[10px] text-muted-foreground">
                          {line.modifiers.map((modifier) => modifier.name).join(", ")}
                        </span>
                      ) : null}

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            aria-label={`Kurangi ${line.name}`}
                            onClick={() =>
                              setLines((previous) =>
                                updateLineQuantity(previous, line.id, line.quantity - 1),
                              )
                            }
                            className="flex size-11 items-center justify-center rounded-lg border border-border bg-card"
                          >
                            <Minus className="size-4" aria-hidden />
                          </button>
                          <span className="w-6 text-center text-sm font-extrabold tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Tambah ${line.name}`}
                            onClick={() =>
                              setLines((previous) =>
                                updateLineQuantity(previous, line.id, line.quantity + 1),
                              )
                            }
                            className="flex size-11 items-center justify-center rounded-lg border border-border bg-card"
                          >
                            <Plus className="size-4" aria-hidden />
                          </button>
                        </div>
                        <span className="text-xs font-extrabold tabular-nums">
                          {formatRupiah(line.unitPrice * line.quantity)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-border p-3">
              <div className="flex flex-col gap-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold tabular-nums">{formatRupiah(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service 5%</span>
                  <span className="font-semibold tabular-nums">{formatRupiah(totals.serviceCharge)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PB1 10%</span>
                  <span className="font-semibold tabular-nums">{formatRupiah(totals.taxAmount)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm">
                  <span className="font-extrabold">Total</span>
                  <span className="font-extrabold tabular-nums">{formatRupiah(totals.grandTotal)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={paymentMethod === option.value}
                    onClick={() => setPaymentMethod(option.value)}
                    className={cn(
                      "min-h-touch rounded-lg border text-xs font-bold transition",
                      paymentMethod === option.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                maxLength={60}
                placeholder="Nama pelanggan (opsional)"
                aria-label="Nama pelanggan"
                className="h-12 rounded-lg border border-input bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

              {error ? (
                <p role="alert" className="rounded-lg bg-danger/10 p-2 text-[11px] font-semibold text-danger">
                  {error}
                </p>
              ) : null}

              {notice ? (
                <p role="status" className="rounded-lg bg-success/10 p-2 text-[11px] font-semibold text-success">
                  {notice}{" "}
                  <Link href="/cashier" className="underline">
                    Buka kasir
                  </Link>
                </p>
              ) : null}

              <Button className="w-full" onClick={() => void handleSubmit()} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {isSubmitting ? "Menyimpan…" : "Simpan & Bayar"}
              </Button>
            </div>
          </aside>
        </div>
      </div>

      <ModifierSheet
        item={selectedItem}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null);
          }
        }}
        onConfirm={handleConfirmModifier}
      />
    </div>
  );
}
