"use client";

import { ChefHat, Loader2, RefreshCw, Utensils } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TicketCard } from "@/components/kds/TicketCard";
import { getKdsSummary, type KdsItemAction, type KdsStation, type KdsTicket } from "@/lib/kds";

/**
 * Board KDS per stasiun: polling tiket aktif tiap 5 detik.
 * Umur tiket baru ditampilkan setelah mount (hindari hydration mismatch).
 */

const REFRESH_MS = 5000;
const CLOCK_TICK_MS = 30_000;

interface BoardResponse {
  data?: { tickets?: KdsTicket[] };
}

export function KdsBoard({
  station,
  stationLabel,
  initialTickets,
}: {
  station: KdsStation;
  stationLabel: string;
  initialTickets: KdsTicket[];
}) {
  const [tickets, setTickets] = useState<KdsTicket[]>(initialTickets);
  const [now, setNow] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const response = await fetch(`/api/kds/orders?station=${station}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as BoardResponse | null;

      if (payload?.data?.tickets) {
        setTickets(payload.data.tickets);
        setLastUpdated(
          new Intl.DateTimeFormat("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            timeZone: "Asia/Jakarta",
          }).format(new Date()),
        );
      }
    } catch {
      // abaikan gangguan jaringan; polling berikutnya mencoba lagi
    } finally {
      setIsRefreshing(false);
    }
  }, [station]);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, REFRESH_MS);

    return () => clearInterval(timer);
  }, [refresh]);

  const summary = useMemo(
    () => getKdsSummary(tickets, now ?? new Date(0)),
    [tickets, now],
  );

  async function sendBump(key: string, url: string, body: Record<string, unknown>) {
    if (busyKey !== null) {
      return;
    }

    setBusyKey(key);
    setActionError(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setActionError(payload?.error?.message ?? "Aksi bump gagal diproses.");
        return;
      }

      await refresh();
    } catch {
      setActionError("Tidak dapat menghubungi server.");
    } finally {
      setBusyKey(null);
    }
  }

  function handleItemAction(itemId: string, action: KdsItemAction) {
    void sendBump(`item:${itemId}`, `/api/kds/items/${encodeURIComponent(itemId)}/bump`, {
      action,
    });
  }

  function handleBumpTicket(orderId: string) {
    void sendBump(`order:${orderId}`, `/api/kds/orders/${encodeURIComponent(orderId)}/bump`, {
      action: "BUMP_TICKET",
    });
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            {station === "KITCHEN" ? (
              <ChefHat className="size-5" aria-hidden />
            ) : (
              <Utensils className="size-5" aria-hidden />
            )}
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Kitchen Display System
            </span>
            <h1 className="text-base font-extrabold">
              {stationLabel} · {station}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-secondary px-2.5 py-1 tabular-nums">
            {summary.tickets} tiket
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-1 tabular-nums">
            {summary.items} item
          </span>
          <span className="rounded-full bg-danger/15 px-2.5 py-1 tabular-nums text-danger">
            {summary.overdue} terlambat
          </span>

          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Muat ulang tiket"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:text-foreground"
          >
            {isRefreshing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        {tickets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <ChefHat className="size-7" aria-hidden />
            </span>
            <p className="text-sm font-extrabold">Tidak ada tiket</p>
            <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
              Tiket baru akan muncul otomatis di sini setelah pembayaran pesanan dikonfirmasi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.orderId}
                ticket={ticket}
                now={now}
                onItemAction={handleItemAction}
                onBumpTicket={handleBumpTicket}
                busyKey={busyKey}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-2 text-[10px] text-muted-foreground">
        <span>Diperbarui otomatis setiap 5 detik</span>
        {actionError ? (
          <span role="alert" className="font-semibold text-danger">
            {actionError}
          </span>
        ) : null}
        <span className="tabular-nums">{lastUpdated ? `Terakhir: ${lastUpdated}` : "Menunggu pembaruan"}</span>
      </footer>
    </div>
  );
}
