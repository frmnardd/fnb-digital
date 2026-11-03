"use client";

import { BellRing, Check, Loader2, RefreshCw, Sparkles, Utensils } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getWaiterCallLabel } from "@/lib/runner";
import type { RunnerData } from "@/lib/services/runner";
import { cn } from "@/lib/utils";

/**
 * Board pelayan/runner: item siap antar, panggilan meja, dan meja kotor.
 * Polling 5 detik; aksi memakai endpoint runner lalu memuat ulang data.
 */

type RunnerTab = "ready" | "calls" | "tables";

const TIME_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

export function RunnerBoard({ initialData }: { initialData: RunnerData }) {
  const [data, setData] = useState<RunnerData>(initialData);
  const [activeTab, setActiveTab] = useState<RunnerTab>("ready");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/runner", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        data?: RunnerData;
      } | null;

      if (payload?.data) {
        setData(payload.data);
      }
    } catch {
      // abaikan gangguan jaringan; polling berikutnya mencoba lagi
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [refresh]);

  async function runAction(key: string, url: string, body?: Record<string, unknown>) {
    if (busyKey !== null) {
      return;
    }

    setBusyKey(key);
    setError(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        ...(body
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
          : {}),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Aksi gagal diproses.");
        return;
      }

      await refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setBusyKey(null);
    }
  }

  const tabs: Array<{ key: RunnerTab; label: string; count: number }> = [
    { key: "ready", label: "Siap Antar", count: data.summary.readyTickets },
    { key: "calls", label: "Panggilan", count: data.summary.pendingCalls },
    { key: "tables", label: "Meja Kotor", count: data.summary.dirtyTables },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 px-4 py-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Runner
          </span>
          <h1 className="text-lg font-extrabold">Pelayan</h1>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          aria-label="Muat ulang"
          className="flex size-12 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:text-foreground"
        >
          {busyKey === "refresh" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
        </button>
      </header>

      <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Bagian runner">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center rounded-lg border text-[11px] font-bold transition",
              activeTab === tab.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            <span className="tabular-nums">{tab.count}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-2 text-[11px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {activeTab === "ready" ? (
        data.readyTickets.length === 0 ? (
          <EmptyState icon={<Utensils className="size-6" aria-hidden />} title="Belum ada makanan siap" />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.readyTickets.map((ticket) => (
              <li key={ticket.orderId} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold tabular-nums">{ticket.orderNumber}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {ticket.tableLabel ?? "Takeaway"}
                  </span>
                </div>

                <ul className="flex flex-col gap-1">
                  {ticket.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">
                        {item.quantity}× {item.menuName}
                        {item.modifiers.length > 0 ? (
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            ({item.modifiers.join(", ")})
                          </span>
                        ) : null}
                      </span>

                      <button
                        type="button"
                        disabled={busyKey === `item:${item.id}`}
                        onClick={() =>
                          void runAction(
                            `item:${item.id}`,
                            `/api/runner/items/${encodeURIComponent(item.id)}/serve`,
                          )
                        }
                        className="flex min-h-touch shrink-0 items-center gap-1 rounded-lg bg-success px-3 text-[11px] font-extrabold text-success-foreground disabled:opacity-50"
                      >
                        <Check className="size-3.5" aria-hidden />
                        Antar
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {activeTab === "calls" ? (
        data.waiterCalls.length === 0 ? (
          <EmptyState icon={<BellRing className="size-6" aria-hidden />} title="Tidak ada panggilan meja" />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.waiterCalls.map((call) => (
              <li key={call.id} className="flex flex-col gap-1.5 rounded-xl border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold">{getWaiterCallLabel(call.type)}</span>
                  <span className="text-[10px] font-bold uppercase tabular-nums text-muted-foreground">
                    {TIME_FORMATTER.format(new Date(call.createdAt))}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {call.tableLabel}
                </span>
                {call.note ? (
                  <span className="text-[11px] italic text-muted-foreground">{call.note}</span>
                ) : null}

                <div className="flex gap-1.5">
                  {call.status === "PENDING" ? (
                    <button
                      type="button"
                      disabled={busyKey === `call:${call.id}`}
                      onClick={() =>
                        void runAction(
                          `call:${call.id}`,
                          `/api/runner/calls/${encodeURIComponent(call.id)}/resolve`,
                          { action: "ACKNOWLEDGE" },
                        )
                      }
                      className="min-h-touch flex-1 rounded-lg border border-primary/40 bg-primary/10 text-[11px] font-bold text-primary disabled:opacity-50"
                    >
                      Tangani
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={busyKey === `call:${call.id}`}
                    onClick={() =>
                      void runAction(
                        `call:${call.id}`,
                        `/api/runner/calls/${encodeURIComponent(call.id)}/resolve`,
                        { action: "RESOLVE" },
                      )
                    }
                    className="min-h-touch flex-1 rounded-lg bg-success text-[11px] font-extrabold text-success-foreground disabled:opacity-50"
                  >
                    Selesai
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {activeTab === "tables" ? (
        data.dirtyTables.length === 0 ? (
          <EmptyState icon={<Sparkles className="size-6" aria-hidden />} title="Semua meja bersih" />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.dirtyTables.map((table) => (
              <li
                key={table.id}
                className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-extrabold">Meja {table.tableNumber}</span>
                  <span className="text-[11px] text-muted-foreground">{table.areaName}</span>
                </span>

                <button
                  type="button"
                  disabled={busyKey === `table:${table.id}`}
                  onClick={() =>
                    void runAction(
                      `table:${table.id}`,
                      `/api/runner/tables/${encodeURIComponent(table.id)}/clean`,
                    )
                  }
                  className="flex min-h-touch items-center gap-1 rounded-lg bg-primary px-3 text-[11px] font-extrabold text-primary-foreground disabled:opacity-50"
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  Sudah Bersih
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <footer className="mt-auto text-center text-[10px] text-muted-foreground">
        Diperbarui otomatis setiap 5 detik
      </footer>
    </div>
  );
}

function EmptyState({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm font-extrabold">{title}</p>
      <p className="text-[11px] text-muted-foreground">Daftar akan muncul otomatis di sini.</p>
    </div>
  );
}
