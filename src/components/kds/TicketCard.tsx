import { Clock, Flame } from "lucide-react";

import { getTicketAgeState, type KdsTicket } from "@/lib/kds";
import { cn } from "@/lib/utils";

/**
 * Kartu tiket KDS: nomor pesanan, meja, daftar item, dan badge umur tiket
 * (hijau → kuning → merah berkedip).
 */

const AGE_STYLE = {
  FRESH: "bg-success/15 text-success",
  WARNING: "bg-warning/15 text-warning",
  OVERDUE: "bg-danger/15 text-danger animate-blink-danger",
} as const;

export function TicketCard({ ticket, now }: { ticket: KdsTicket; now: Date | null }) {
  const age = now ? getTicketAgeState(new Date(ticket.queuedAt), now) : null;
  const state = age?.state ?? "FRESH";

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
        {ticket.items.map((item) => (
          <li key={item.id} className="flex flex-col gap-0.5 border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
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
              <span className="text-[11px] text-muted-foreground">{item.modifiers.join(", ")}</span>
            ) : null}

            {item.note ? (
              <span className="text-[11px] italic text-warning">Catatan: {item.note}</span>
            ) : null}
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled
        title="Bump tiket (tersedia pada sub-tugas 6.2)"
        className="mt-1 min-h-touch cursor-not-allowed rounded-lg border border-border bg-background text-[11px] font-bold text-muted-foreground/50"
      >
        Bump (6.2)
      </button>
    </article>
  );
}
