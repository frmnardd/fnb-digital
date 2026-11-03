"use client";

import { ShoppingBag } from "lucide-react";
import { useState } from "react";

import { CartSheet } from "@/components/customer/CartSheet";
import { useCartHydrated } from "@/hooks/useCartHydrated";
import { summarizeCart } from "@/lib/cart";
import { formatRupiah } from "@/lib/pricing";
import { useCartStore } from "@/store/useCartStore";
import type { PublicCategory } from "@/types/menu";

/**
 * Bar keranjang mengambang di thumb zone (bottom, fixed) + pembuka CartSheet.
 *
 * Dirender hanya setelah store terhidrasi agar tidak terjadi hydration mismatch,
 * dan disembunyikan saat keranjang kosong.
 */

export interface CartSummaryBarProps {
  totalQuantity: number;
  subtotal: number;
  onOpen?: () => void;
}

/** Bagian presentasional (bisa dirender tanpa store, dipakai untuk verifikasi). */
export function CartSummaryBar({ totalQuantity, subtotal, onOpen }: CartSummaryBarProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-pos-panel transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="flex items-center gap-2 text-sm font-bold">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-extrabold tabular-nums">
          {totalQuantity}
        </span>
        Keranjang
      </span>

      <span className="text-sm font-extrabold tabular-nums">{formatRupiah(subtotal)}</span>

      <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide">
        <ShoppingBag className="size-3.5" aria-hidden />
        Lihat
      </span>
    </button>
  );
}

export function FloatingCartBar({ categories }: { categories: PublicCategory[] }) {
  const lines = useCartStore((state) => state.lines);
  const hydrated = useCartHydrated();
  const [isOpen, setIsOpen] = useState(false);

  const summary = summarizeCart(lines);

  if (!hydrated || summary.totalQuantity === 0) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4 pb-3 safe-area-pb">
        <CartSummaryBar
          totalQuantity={summary.totalQuantity}
          subtotal={summary.subtotal}
          onOpen={() => setIsOpen(true)}
        />
      </div>

      <CartSheet open={isOpen} onOpenChange={setIsOpen} categories={categories} />
    </>
  );
}
