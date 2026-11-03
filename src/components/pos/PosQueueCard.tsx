import { Clock, Utensils } from "lucide-react";

import { formatRupiah } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PosQueueOrder, PosOrderStatus } from "@/types/pos";

/**
 * Kartu antrean pesanan POS (presentasional — dipakai `PosQueueList`).
 */

const STATUS_STYLE: Record<PosOrderStatus, { label: string; className: string }> = {
  PENDING_PAYMENT: { label: "Belum Dibayar", className: "bg-secondary text-muted-foreground" },
  WAITING_CASHIER_APPROVAL: {
    label: "Menunggu Konfirmasi",
    className: "bg-warning/15 text-warning",
  },
  CONFIRMED: { label: "Lunas", className: "bg-success/15 text-success" },
  PREPARING: { label: "Dimasak", className: "bg-primary/15 text-primary" },
  READY: { label: "Siap", className: "bg-primary/15 text-primary" },
  SERVED: { label: "Diantar", className: "bg-success/15 text-success" },
  COMPLETED: { label: "Selesai", className: "bg-success/15 text-success" },
  CANCELLED: { label: "Dibatalkan", className: "bg-danger/15 text-danger" },
};

const TIME_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

export function PosQueueCard({
  order,
  isActive,
  onSelect,
}: {
  order: PosQueueOrder;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const status = STATUS_STYLE[order.status];

  return (
    <button
      type="button"
      onClick={() => onSelect(order.id)}
      aria-pressed={isActive}
      className={cn(
        "flex w-full min-h-touch flex-col gap-1.5 rounded-xl border p-3 text-left transition",
        isActive
          ? "border-primary bg-primary/10"
          : "border-border bg-card hover:border-primary/40 hover:bg-secondary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-extrabold tabular-nums">{order.orderNumber}</span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Utensils className="size-3" aria-hidden />
            {order.tableLabel ?? "Takeaway"}
            {order.orderType === "TAKEAWAY" ? " · Bawa pulang" : ""}
          </span>
        </div>

        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase", status.className)}>
          {status.label}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          <span className="tabular-nums">{TIME_FORMATTER.format(new Date(order.createdAt))}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{order.itemCount} item</span>
        </span>

        <span className="text-sm font-extrabold tabular-nums">{formatRupiah(order.total)}</span>
      </div>
    </button>
  );
}
