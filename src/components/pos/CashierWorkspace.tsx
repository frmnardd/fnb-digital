"use client";

import { useState } from "react";

import { PosBillPanel } from "@/components/pos/PosBillPanel";
import { PosQueueList } from "@/components/pos/PosQueueList";
import { PosSidebar } from "@/components/pos/PosSidebar";
import { PosTopbar } from "@/components/pos/PosTopbar";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import type { PosQueueOrder } from "@/types/pos";

/**
 * Workspace kasir 3-panel: sidebar navigasi, antrean pesanan, dan detail tagihan.
 * State pemilihan pesanan disimpan di sini agar panel kanan ikut berubah.
 */
export function CashierWorkspace({
  initialOrders,
  cashierName,
}: {
  initialOrders: PosQueueOrder[];
  cashierName: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialOrders[0]?.id ?? null);
  const { isEnabled, enable, disable } = useNotificationSound();

  const selectedOrder = initialOrders.find((order) => order.id === selectedId) ?? null;

  async function handleToggleSound() {
    if (isEnabled) {
      disable();
      return;
    }

    await enable();
  }

  return (
    <div className="flex h-dvh">
      <PosSidebar active="queue" />

      <div className="flex min-w-0 flex-1 flex-col">
        <PosTopbar
          cashierName={cashierName}
          shiftLabel="Shift belum dibuka"
          soundEnabled={isEnabled}
          onToggleSound={() => void handleToggleSound()}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h1 className="text-sm font-extrabold">Antrean Pesanan</h1>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold tabular-nums">
                {initialOrders.length} pesanan
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <PosQueueList
                orders={initialOrders}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </section>

          <aside className="hidden min-h-0 overflow-y-auto border-l border-border bg-card/40 p-4 lg:block">
            <PosBillPanel order={selectedOrder} />
          </aside>
        </div>
      </div>
    </div>
  );
}
