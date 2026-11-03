"use client";

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ModifierSheet,
  type ModifierConfirmPayload,
} from "@/components/customer/ModifierSheet";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { buildCartLineId } from "@/lib/cart";
import { calculateCartBreakdown } from "@/lib/cart-totals";
import { formatRupiah } from "@/lib/pricing";
import { describeLineModifiers, getUpsellSuggestions } from "@/lib/upsell";
import { useCartStore } from "@/store/useCartStore";
import type { PublicCategory, PublicMenuItem } from "@/types/menu";

/**
 * Keranjang pelanggan (bottom sheet): ubah kuantitas, hapus item, upselling,
 * data pemesan opsional, dan rincian biaya transparan.
 *
 * Semua nominal berasal dari `calculateCartBreakdown()` → `calculateOrderTotals()`
 * sehingga identik dengan perhitungan server saat order dibuat (4.1).
 */

export function CartSheet({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: PublicCategory[];
}) {
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const addLine = useCartStore((state) => state.addLine);
  const customerName = useCartStore((state) => state.customerName);
  const customerPhone = useCartStore((state) => state.customerPhone);
  const setCustomer = useCartStore((state) => state.setCustomer);
  const orderType = useCartStore((state) => state.orderType);

  const [customizingItem, setCustomizingItem] = useState<PublicMenuItem | null>(null);

  const breakdown = useMemo(() => calculateCartBreakdown(lines), [lines]);
  const suggestions = useMemo(() => getUpsellSuggestions(categories, lines), [categories, lines]);

  function addMenuItem(item: PublicMenuItem) {
    if (item.modifierGroups.length > 0) {
      setCustomizingItem(item);
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

  function handleConfirmCustomization(payload: ModifierConfirmPayload) {
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
    setCustomizingItem(null);
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Keranjang Anda"
      description={orderType === "TAKEAWAY" ? "Takeaway · bawa pulang" : "Dine In · makan di tempat"}
    >
      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <ShoppingBag className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-extrabold">Keranjang masih kosong</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tambahkan menu favorit Anda terlebih dahulu.
          </p>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Lihat menu
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {lines.map((line) => {
              const description = describeLineModifiers(line);

              return (
                <li key={line.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-bold leading-snug">{line.name}</span>
                      {description ? (
                        <span className="text-[11px] leading-snug text-muted-foreground">
                          {description}
                        </span>
                      ) : null}
                      <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {formatRupiah(line.unitPrice)} / porsi
                      </span>
                    </div>

                    <button
                      type="button"
                      aria-label={`Hapus ${line.name}`}
                      onClick={() => removeLine(line.id)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Kurangi ${line.name}`}
                        onClick={() => setQuantity(line.id, line.quantity - 1)}
                        className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-secondary"
                      >
                        <Minus className="size-4" aria-hidden />
                      </button>

                      <span className="w-7 text-center text-sm font-extrabold tabular-nums">
                        {line.quantity}
                      </span>

                      <button
                        type="button"
                        aria-label={`Tambah ${line.name}`}
                        onClick={() => setQuantity(line.id, line.quantity + 1)}
                        className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-secondary"
                      >
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>

                    <span className="text-sm font-extrabold tabular-nums">
                      {formatRupiah(line.unitPrice * line.quantity)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {suggestions.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                Tambahkan juga
              </h3>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addMenuItem(item)}
                    className="flex w-36 shrink-0 flex-col gap-1 rounded-xl border bg-card p-2 text-left transition hover:bg-secondary"
                  >
                    <span className="line-clamp-1 text-xs font-bold">{item.name}</span>
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {formatRupiah(item.basePrice)}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-primary">
                      + Tambah
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">Nama pemesan (opsional)</span>
              <input
                value={customerName}
                onChange={(event) => setCustomer({ name: event.target.value })}
                maxLength={60}
                placeholder="Nama Anda"
                className="h-12 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">Nomor WhatsApp (opsional)</span>
              <input
                type="tel"
                inputMode="tel"
                value={customerPhone}
                onChange={(event) => setCustomer({ phone: event.target.value })}
                maxLength={20}
                placeholder="08xx xxxx xxxx"
                className="h-12 rounded-lg border border-input bg-card px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-[10px] text-muted-foreground">
                Dipakai untuk mengirim e-struk dan notifikasi pesanan siap.
              </span>
            </label>
          </section>

          <section className="flex flex-col gap-1.5 rounded-xl bg-secondary/70 p-3">
            <BreakdownRow label="Subtotal" value={formatRupiah(breakdown.subtotal)} />
            <BreakdownRow label="Service charge (5%)" value={formatRupiah(breakdown.serviceCharge)} />
            <BreakdownRow label="Pajak PB1 (10%)" value={formatRupiah(breakdown.taxAmount)} />

            <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
              <span className="text-sm font-extrabold">Total</span>
              <span className="text-base font-extrabold tabular-nums">
                {formatRupiah(breakdown.grandTotal)}
              </span>
            </div>

            <p className="text-[10px] leading-snug text-muted-foreground">
              Kode unik 3 digit ditambahkan otomatis bila memilih transfer manual.
            </p>
          </section>

          <div className="flex flex-col gap-1">
            <Button className="w-full" disabled>
              Lanjut ke Pembayaran
            </Button>
            <p className="text-center text-[10px] text-muted-foreground">
              Pembayaran &amp; pengiriman pesanan tersedia pada langkah berikutnya.
            </p>
          </div>
        </div>
      )}

      <ModifierSheet
        item={customizingItem}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setCustomizingItem(null);
          }
        }}
        onConfirm={handleConfirmCustomization}
      />
    </BottomSheet>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
