"use client";

import { Loader2, TrendingUp } from "lucide-react";
import { useState } from "react";

import { formatRupiah } from "@/lib/pricing";
import type { DashboardData } from "@/lib/services/analytics";
import { cn } from "@/lib/utils";

/**
 * Dashboard analitik: KPI, seri harian, mix pembayaran, jam sibuk,
 * dan matriks Menu Engineering. Grafik memakai div (tanpa library chart).
 */

const RANGE_OPTIONS = [7, 30, 90] as const;

const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Tunai",
  QRIS_DYNAMIC: "QRIS",
  VIRTUAL_ACCOUNT: "Virtual Account",
  MANUAL_TRANSFER: "Transfer Manual",
  EDC_CARD: "Kartu EDC",
};

const QUADRANT_STYLE = {
  STAR: "bg-success/15 text-success",
  PLOWHORSE: "bg-primary/15 text-primary",
  PUZZLE: "bg-warning/15 text-warning",
  DOG: "bg-danger/15 text-danger",
} as const;

const QUADRANT_LABEL = {
  STAR: "Star",
  PLOWHORSE: "Plowhorse",
  PUZZLE: "Puzzle",
  DOG: "Dog",
} as const;

export function DashboardView({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [days, setDays] = useState<number>(initialData.days);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxDailyRevenue = Math.max(1, ...data.daily.map((row) => row.revenue));
  const maxPeak = Math.max(1, ...data.peakHours.map((row) => row.orders));

  async function loadRange(nextDays: number) {
    setDays(nextDays);
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/analytics?days=${nextDays}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        data?: DashboardData;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.data) {
        setError(payload?.error?.message ?? "Gagal memuat analitik.");
        return;
      }

      setData(payload.data);
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Back-office
          </span>
          <h1 className="text-lg font-extrabold">Dashboard Analitik</h1>
          <p className="text-[11px] text-muted-foreground">
            Ringkasan {data.days} hari terakhir · diperbarui{" "}
            {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(
              new Date(data.generatedAt),
            )}
          </p>
        </div>

        <div className="flex gap-1" role="group" aria-label="Rentang analitik">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={days === option}
              disabled={busy}
              onClick={() => void loadRange(option)}
              className={cn(
                "min-h-11 rounded-lg border px-3 text-xs font-bold transition disabled:opacity-50",
                days === option
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {option} hari
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-2 text-[11px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiCard label="Omzet" value={formatRupiah(data.kpi.revenue)} highlight />
        <KpiCard label="Pesanan" value={String(data.kpi.orderCount)} />
        <KpiCard label="Rata-rata / transaksi" value={formatRupiah(data.kpi.averageTicket)} />
        <KpiCard label="Item terjual" value={String(data.kpi.itemsSold)} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <span className="flex items-center gap-1.5 text-xs font-extrabold">
            <TrendingUp className="size-4 text-primary" aria-hidden />
            Omzet Harian
          </span>

          <div className="flex h-40 items-end gap-1">
            {data.daily.map((row) => (
              <div
                key={row.date}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                title={`${row.date}: ${formatRupiah(row.revenue)} (${row.orders} pesanan)`}
              >
                <div
                  className="w-full rounded-t bg-primary/70 transition-all"
                  style={{ height: `${Math.max(row.revenue > 0 ? 4 : 1, Math.round((row.revenue / maxDailyRevenue) * 100))}%` }}
                />
                <span className="text-[8px] text-muted-foreground tabular-nums">
                  {row.date.slice(8, 10)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <span className="text-xs font-extrabold">Metode Pembayaran</span>

          {data.paymentMix.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Belum ada pembayaran lunas.</p>
          ) : (
            data.paymentMix.map((row) => (
              <div key={row.method} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold">
                    {PAYMENT_LABEL[row.method] ?? row.method}
                    <span className="ml-1 text-[10px] text-muted-foreground">({row.count})</span>
                  </span>
                  <span className="font-bold tabular-nums">{formatRupiah(row.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(2, Math.round(row.share * 100))}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {Math.round(row.share * 100)}%
                </span>
              </div>
            ))
          )}
        </section>
      </div>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <span className="text-xs font-extrabold">Jam Sibuk</span>
        <div className="flex h-24 items-end gap-0.5">
          {data.peakHours.map((row) => (
            <div
              key={row.hour}
              className="flex h-full flex-1 flex-col items-center justify-end"
              title={`${String(row.hour).padStart(2, "0")}:00 — ${row.orders} pesanan`}
            >
              <div
                className={cn(
                  "w-full rounded-t",
                  row.orders === maxPeak && row.orders > 0 ? "bg-primary" : "bg-primary/40",
                )}
                style={{ height: `${Math.max(row.orders > 0 ? 6 : 1, Math.round((row.orders / maxPeak) * 100))}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground tabular-nums">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold">Menu Engineering</span>
          <span className="text-[10px] text-muted-foreground">
            Popularitas × margin per unit
          </span>
        </div>

        {data.menuEngineering.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Belum ada item terjual pada rentang ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-bold">Menu</th>
                  <th className="px-2 py-2 text-right font-bold">Terjual</th>
                  <th className="px-2 py-2 text-right font-bold">Omzet</th>
                  <th className="px-2 py-2 text-right font-bold">Margin/unit</th>
                  <th className="px-2 py-2 font-bold">Kuadran</th>
                </tr>
              </thead>
              <tbody>
                {data.menuEngineering.map((row) => (
                  <tr key={row.menuItemId} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-1.5 font-semibold">{row.name}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.quantitySold}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatRupiah(row.revenue)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatRupiah(row.marginPerUnit)}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase",
                          QUADRANT_STYLE[row.quadrant],
                        )}
                      >
                        {QUADRANT_LABEL[row.quadrant]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Star: populer & margin tinggi · Plowhorse: populer, margin rendah · Puzzle: jarang
          terjual, margin tinggi · Dog: jarang terjual & margin rendah.
        </p>
      </section>

      {busy ? (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-[11px] font-semibold shadow">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          Memuat…
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border p-3",
        highlight ? "border-primary/40 bg-primary/10" : "border-border bg-card",
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-base font-extrabold tabular-nums",
          highlight ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
