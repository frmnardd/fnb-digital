"use client";

import { ConciergeBell, UtensilsCrossed } from "lucide-react";
import { useState } from "react";

import { CallWaiterSheet } from "@/components/customer/CallWaiterSheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCartStore, type OrderType } from "@/store/useCartStore";

/**
 * Header meja pelanggan + quick action bar.
 *
 * Mode pesanan (Dine In/Takeaway) disimpan di `useCartStore` agar konsisten
 * dengan isi keranjang dan nilai yang dikirim saat checkout.
 */

const ORDER_MODES: Array<{ value: OrderType; label: string }> = [
  { value: "DINE_IN", label: "Dine In" },
  { value: "TAKEAWAY", label: "Takeaway" },
];

export interface CustomerHeaderProps {
  tableSlug: string;
  tableNumber: string;
  areaName: string;
  sessionStatus: "ACTIVE" | "BILL_REQUESTED" | null;
}

export function CustomerHeader({
  tableSlug,
  tableNumber,
  areaName,
  sessionStatus,
}: CustomerHeaderProps) {
  const orderMode = useCartStore((state) => state.orderType);
  const setOrderMode = useCartStore((state) => state.setOrderType);
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-3 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UtensilsCrossed className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  FnB Digital
                </p>
                <h1 className="truncate text-base font-extrabold leading-tight">
                  Meja {tableNumber}
                  <span className="ml-1.5 text-xs font-semibold text-muted-foreground">
                    · {areaName}
                  </span>
                </h1>
              </div>
            </div>

            <span
              className={cn(
                "mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                sessionStatus
                  ? "bg-success/10 text-success"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {sessionStatus ? "Sesi aktif" : "Belum mulai"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex flex-1 rounded-lg bg-secondary p-1"
              role="group"
              aria-label="Tipe pesanan"
            >
              {ORDER_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  aria-pressed={orderMode === mode.value}
                  onClick={() => setOrderMode(mode.value)}
                  className={cn(
                    "h-12 flex-1 rounded-md text-sm font-bold transition",
                    orderMode === mode.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => setIsCallWaiterOpen(true)}
              className="shrink-0 gap-2 px-3"
            >
              <ConciergeBell className="size-4" aria-hidden />
              Pelayan
            </Button>
          </div>
        </div>
      </header>

      <CallWaiterSheet
        tableSlug={tableSlug}
        open={isCallWaiterOpen}
        onOpenChange={setIsCallWaiterOpen}
      />
    </>
  );
}
