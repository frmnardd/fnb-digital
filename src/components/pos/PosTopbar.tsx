"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Topbar kasir: nama kasir, status shift, jam berjalan, dan toggle suara notifikasi.
 * Jam dirender setelah mount agar tidak terjadi hydration mismatch.
 */
export function PosTopbar({
  cashierName,
  shiftLabel,
  soundEnabled,
  onToggleSound,
}: {
  cashierName: string;
  shiftLabel: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
}) {
  const [clock, setClock] = useState<string | null>(null);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    });

    const update = () => setClock(formatter.format(new Date()));
    update();

    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          POS Kasir
        </span>
        <span className="truncate text-sm font-extrabold">{cashierName}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold text-muted-foreground">
          {shiftLabel}
        </span>

        <span className="min-w-[72px] text-right text-sm font-extrabold tabular-nums">
          {clock ?? "--:--:--"}
        </span>

        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundEnabled}
          aria-label={soundEnabled ? "Matikan suara notifikasi" : "Aktifkan suara notifikasi"}
          className={cn(
            "flex min-h-touch min-w-touch items-center justify-center rounded-lg border transition",
            soundEnabled
              ? "border-success/40 bg-success/15 text-success"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          {soundEnabled ? (
            <Volume2 className="size-5" aria-hidden />
          ) : (
            <VolumeX className="size-5" aria-hidden />
          )}
        </button>
      </div>
    </header>
  );
}
