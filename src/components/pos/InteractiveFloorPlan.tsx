"use client";

import { Armchair, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  formatSeatedDuration,
  getFloorPlanSummary,
  TABLE_STATUS_META,
} from "@/lib/floor-plan";
import { formatRupiah } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PosFloorArea, PosFloorTable } from "@/types/pos";

/**
 * Peta meja interaktif POS.
 *
 * - Tab per area/lantai, grid meja berwarna sesuai status.
 * - Durasi duduk diperbarui tiap 30 detik (dirender setelah mount agar tidak
 *   terjadi hydration mismatch).
 * - Polling data tiap 10 detik saat tab terlihat.
 */

const REFRESH_MS = 10_000;
const CLOCK_TICK_MS = 30_000;

interface FloorResponse {
  data?: { areas?: PosFloorArea[] };
}

export function InteractiveFloorPlan({ initialAreas }: { initialAreas: PosFloorArea[] }) {
  const [areas, setAreas] = useState<PosFloorArea[]>(initialAreas);
  const [activeAreaId, setActiveAreaId] = useState<string>(initialAreas[0]?.id ?? "");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const response = await fetch("/api/pos/tables", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as FloorResponse | null;

        if (payload?.data?.areas) {
          setAreas(payload.data.areas);
        }
      } catch {
        // abaikan gangguan jaringan; percobaan berikutnya menyusul
      }
    };

    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const activeArea: PosFloorArea | null = areas.find((area) => area.id === activeAreaId) ?? areas[0] ?? null;

  const summary = useMemo(
    () => getFloorPlanSummary(activeArea?.tables ?? []),
    [activeArea],
  );

  const selectedTable: PosFloorTable | null =
    activeArea?.tables.find((table) => table.id === selectedTableId) ?? null;

  if (areas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Armchair className="size-6" aria-hidden />
        </span>
        <p className="text-sm font-extrabold">Belum ada meja</p>
        <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
          Tambahkan area dan meja dari back-office agar denah muncul di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {areas.map((area) => (
          <button
            key={area.id}
            type="button"
            aria-pressed={area.id === activeArea?.id}
            onClick={() => {
              setActiveAreaId(area.id);
              setSelectedTableId(null);
            }}
            className={cn(
              "min-h-touch rounded-lg border px-3 text-xs font-bold transition",
              area.id === activeArea?.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {area.name}
            <span className="ml-1.5 text-[10px] opacity-70">Lt. {area.floor}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <span className="rounded-full bg-secondary px-2 py-0.5 tabular-nums">
          {summary.available} tersedia
        </span>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 tabular-nums text-primary">
          {summary.occupied} terisi
        </span>
        <span className="rounded-full bg-warning/15 px-2 py-0.5 tabular-nums text-warning">
          {summary.cleaning} perlu dibersihkan
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {(activeArea?.tables ?? []).map((table) => {
          const meta = TABLE_STATUS_META[table.status];
          const isSelected = table.id === selectedTableId;

          return (
            <button
              key={table.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedTableId(table.id)}
              className={cn(
                "flex min-h-[92px] flex-col items-start justify-between gap-1 rounded-xl border p-2 text-left transition",
                meta.cardClass,
                isSelected && "ring-2 ring-primary",
              )}
            >
              <div className="flex w-full items-start justify-between gap-1">
                <span className="text-base font-extrabold tabular-nums">{table.tableNumber}</span>
                <span className={cn("mt-1 size-2 rounded-full", meta.dotClass)} aria-hidden />
              </div>

              <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                <Users className="size-3" aria-hidden />
                <span className="tabular-nums">{table.capacity}</span>
              </span>

              {table.session ? (
                <span className="text-[10px] font-extrabold tabular-nums">
                  {formatRupiah(table.runningBill)}
                </span>
              ) : (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase", meta.badgeClass)}>
                  {meta.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedTable ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-sm font-extrabold">
                Meja {selectedTable.tableNumber}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {activeArea?.name} · kapasitas {selectedTable.capacity} orang
              </span>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase",
                TABLE_STATUS_META[selectedTable.status].badgeClass,
              )}
            >
              {TABLE_STATUS_META[selectedTable.status].label}
            </span>
          </div>

          {selectedTable.session ? (
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="flex flex-col rounded-lg bg-secondary/60 p-2">
                <span className="text-muted-foreground">Tamu</span>
                <span className="font-extrabold tabular-nums">
                  {selectedTable.session.guestCount}
                </span>
              </div>
              <div className="flex flex-col rounded-lg bg-secondary/60 p-2">
                <span className="text-muted-foreground">Durasi</span>
                <span className="font-extrabold tabular-nums">
                  {now ? formatSeatedDuration(new Date(selectedTable.session.openedAt), now) : "—"}
                </span>
              </div>
              <div className="flex flex-col rounded-lg bg-secondary/60 p-2">
                <span className="text-muted-foreground">Bill</span>
                <span className="font-extrabold tabular-nums">
                  {formatRupiah(selectedTable.runningBill)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Meja belum memiliki sesi aktif. Pelanggan dapat memindai QR meja untuk mulai
              memesan.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled
              title="Pindah meja (segera hadir)"
              className="min-h-touch flex-1 cursor-not-allowed rounded-lg border border-border bg-background text-[11px] font-bold text-muted-foreground/50"
            >
              Pindah Meja
            </button>
            <button
              type="button"
              disabled
              title="Gabung tagihan (segera hadir)"
              className="min-h-touch flex-1 cursor-not-allowed rounded-lg border border-border bg-background text-[11px] font-bold text-muted-foreground/50"
            >
              Gabung Tagihan
            </button>
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-border/70 p-3 text-center text-[11px] text-muted-foreground">
          Pilih meja untuk melihat detail sesi dan tagihan berjalan.
        </p>
      )}
    </div>
  );
}
