import { Check, ChefHat, Clock, Flame, RotateCcw } from "lucide-react";

import { getTicketAgeState, type KdsTicket } from "@/lib/kds";
import type { KdsItemAction } from "@/lib/kds";
import { cn } from "@/lib/utils";

/**
 * Kartu tiket KDS: nomor pesanan, meja, daftar item, badge umur tiket
 * (hijau → kuning → merah berkedip), dan tombol bump per item/tiket.
 */

const AGE_STYLE = {
  FRESH: "bg-success/15 text-success",
  WARNING: "bg-warning/15 text-warning",
  OVERDUE: "bg-danger/15 text-danger animate-blink-danger",
} as const;

export interface TicketCardProps {
  ticket: KdsTicket;
  now: Date | null;
  onItemAction: (itemId: string, action: KdsItemAction) => void;
  onBumpTicket: (orderId: string) => void;
  /** Kunci aksi yang sedang diproses (mis. `item:<id>` / `order:<id>`). */
  busyKey: string | null;
}

export function TicketCard({
  ticket,
  now,
  onItemAction,
  onBumpTicket,
  busyKey,
}: TicketCardProps) {
  const age = now ? getTicketAgeState(new Date(ticket.queuedAt), now) : null;
  const state = age?.state ?? "FRESH";
  const isTicketBusy = busyKey === `order:${ticket.orderId}`;

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3",
        state === "OVERDUE" ? "border-danger/60" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-base font-extrabold tabular-nums">{ticket.orderNumber}</span>
          <span className="truncate text-[11px] font-semibold text-muted-foreground">
            {ticket.tableLabel ?? "Takeaway"}
            {ticket.orderType === "TAKEAWAY" ? " · Bawa pulang" : ""}
          </span>
        </div>

        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-extrabold tabular-nums",
            AGE_STYLE[state],
          )}
        >
          <Clock className="size-3" aria-hidden />
          {age ? `${age.agingMinutes} mnt` : "--"}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {ticket.items.map((item) => {
          const itemBusy = busyKey === `item:${item.id}`;

          return (
            <li
              key={item.id}
              className="flex flex-col gap-1 border-b border-border/50 pb-1.5 last:border-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-bold">
                  <span className="tabular-nums">{item.quantity}×</span> {item.menuName}
                </span>

                {item.status === "COOKING" ? (
                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-warning">
                    <Flame className="size-2.5" aria-hidden />
                    Dimasak
                  </span>
                ) : null}
              </div>

              {item.modifiers.length > 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  {item.modifiers.join(", ")}
                </span>
              ) : null}

              {item.note ? (
                <span className="text-[11px] italic text-warning">Catatan: {item.note}</span>
              ) : null}

              <div className="flex gap-1.5">
                {item.status === "QUEUED" ? (
                  <button
                    type="button"
                    disabled={itemBusy}
                    onClick={() => onItemAction(item.id, "START_COOKING")}
                    className="flex min-h-touch flex-1 items-center justify-center gap-1 rounded-lg border border-primary/40 bg-primary/10 text-[11px] font-bold text-primary transition hover:bg-primary/20 disabled:opacity-50"
                  >
                    <ChefHat className="size-3.5" aria-hidden />
                    Mulai
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={itemBusy}
                    onClick={() => onItemAction(item.id, "MARK_READY")}
                    className="flex min-h-touch flex-1 items-center justify-center gap-1 rounded-lg bg-success text-[11px] font-extrabold text-success-foreground transition hover:bg-success/90 disabled:opacity-50"
                  >
                    <Check className="size-3.5" aria-hidden />
                    Siap
                  </button>
                )}

                {item.status === "COOKING" ? (
                  <button
                    type="button"
                    disabled={itemBusy}
                    onClick={() => onItemAction(item.id, "REVERT")}
                    aria-label={`Kembalikan status ${item.menuName}`}
                    className="flex min-h-touch w-12 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={isTicketBusy}
        onClick={() => onBumpTicket(ticket.orderId)}
        className="mt-1 min-h-touch rounded-lg border border-border bg-background text-[11px] font-bold text-foreground transition hover:bg-secondary disabled:opacity-50"
      >
        Bump Tiket
      </button>
    </article>
  );
}
