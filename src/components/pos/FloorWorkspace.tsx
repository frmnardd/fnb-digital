"use client";

import { InteractiveFloorPlan } from "@/components/pos/InteractiveFloorPlan";
import { PosSidebar } from "@/components/pos/PosSidebar";
import { PosTopbar } from "@/components/pos/PosTopbar";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import type { PosFloorArea } from "@/types/pos";

/**
 * Workspace halaman peta meja: sidebar + topbar + denah interaktif.
 */
export function FloorWorkspace({ initialAreas }: { initialAreas: PosFloorArea[] }) {
  const { isEnabled, enable, disable } = useNotificationSound();

  async function handleToggleSound() {
    if (isEnabled) {
      disable();
      return;
    }

    await enable();
  }

  return (
    <div className="flex h-dvh">
      <PosSidebar active="floor" />

      <div className="flex min-w-0 flex-1 flex-col">
        <PosTopbar
          cashierName="Kasir"
          shiftLabel="Shift belum dibuka"
          soundEnabled={isEnabled}
          onToggleSound={() => void handleToggleSound()}
        />

        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h1 className="text-sm font-extrabold">Peta Meja</h1>
            <span className="text-[11px] font-semibold text-muted-foreground">
              Status diperbarui otomatis setiap 10 detik
            </span>
          </div>

          <InteractiveFloorPlan initialAreas={initialAreas} />
        </main>
      </div>
    </div>
  );
}
