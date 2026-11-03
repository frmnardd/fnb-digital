"use client";

import { BellRing, ChefHat, PackageCheck, ReceiptText, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatRupiah } from "@/lib/pricing";
import type { OrderTrackPayload, TrackerStepKey } from "@/lib/order-tracking";
import { cn } from "@/lib/utils";

/**
 * Stepper pelacakan pesanan real-time (polling 5 detik).
 */

const STEP_ICONS: Record<TrackerStepKey, typeof PackageCheck> = {
  RECEIVED: PackageCheck,
  COOKING: ChefHat,
  READY: BellRing,
  SERVED: UtensilsCrossed,
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  QUEUED: "Antre",
  COOKING: "Dimasak",
  READY: "Siap",
  SERVED: "Diantar",
  VOIDED: "Dibatalkan",
};

export function OrderTracker({
  initial,
  tableSlug,
}: {
  initial: OrderTrackPayload;
  tableSlug: string;
}) {
  const [payload, setPayload] = useState<OrderTrackPayload>(initial);

  useEffect(() => {
    if (payload.status === "COMPLETED" || payload.status === "CANCELLED") {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(payload.orderNumber)}/track`,
          { cache: "no-store" },
        );
        const body = (await response.json().catch(() => null)) as {
          data?: OrderTrackPayload;
        } | null;

        if (body?.data) {
          setPayload(body.data);
        }
      } catch {
        // abaikan gangguan jaringan; percobaan berikutnya akan menyusul
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [payload.orderNumber, payload.status]);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border bg-card p-4 shadow-card-soft">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Status pesanan
          </span>
          <span className="text-xs font-bold tabular-nums">
            {payload.tracker.progressPercent}%
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${payload.tracker.progressPercent}%` }}
          />
        </div>

        {payload.tracker.isCancelled ? (
          <p className="mt-3 rounded-lg bg-danger/10 p-2 text-center text-xs font-bold text-danger">
            Pesanan dibatalkan
          </p>
        ) : null}

        {payload.tracker.isWaitingPayment ? (
          <p className="mt-3 rounded-lg bg-warning/10 p-2 text-center text-[11px] font-semibold text-warning">
            Menunggu pembayaran — pesanan diteruskan setelah pembayaran dikonfirmasi.
          </p>
        ) : null}

        <ol className="mt-4 flex flex-col gap-3">
          {payload.tracker.steps.map((step, index) => {
            const Icon = STEP_ICONS[step.key];
            const isLast = index === payload.tracker.steps.length - 1;

            return (
              <li key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 transition",
                      step.state === "done" && "border-success bg-success text-success-foreground",
                      step.state === "current" &&
                        "border-primary bg-primary/10 text-primary animate-pulse",
                      step.state === "todo" && "border-border bg-card text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {!isLast ? (
                    <span
                      className={cn(
                        "mt-1 w-0.5 flex-1",
                        step.state === "done" ? "bg-success" : "bg-border",
                      )}
                      aria-hidden
                    />
                  ) : null}
                </div>

                <div className="flex flex-col pb-2">
                  <span
                    className={cn(
                      "text-sm font-bold",
                      step.state === "todo" && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    {step.description}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card-soft">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Rincian pesanan
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            {payload.orderNumber}
          </span>
        </div>

        <ul className="flex flex-col gap-1.5">
          {payload.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-start justify-between gap-2">
              <span className="flex flex-col">
                <span className="text-sm font-semibold">
                  {item.quantity}× {item.name}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {item.station}
                </span>
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                  item.status === "SERVED" && "bg-success/10 text-success",
                  item.status === "READY" && "bg-primary/10 text-primary",
                  item.status === "COOKING" && "bg-warning/10 text-warning",
                  item.status === "QUEUED" && "bg-secondary text-muted-foreground",
                  item.status === "VOIDED" && "bg-danger/10 text-danger",
                )}
              >
                {ITEM_STATUS_LABEL[item.status] ?? item.status}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-1 flex items-center justify-between border-t pt-2">
          <span className="text-xs font-semibold text-muted-foreground">
            Pembayaran: {payload.paymentStatus ?? "—"}
          </span>
          <span className="text-sm font-extrabold tabular-nums">
            {formatRupiah(payload.grandTotal)}
          </span>
        </div>
      </section>

      <Link
        href={`/t/${encodeURIComponent(tableSlug)}/order/${encodeURIComponent(payload.orderNumber)}/receipt`}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground"
      >
        <ReceiptText className="size-4" aria-hidden />
        Lihat / Unduh Struk
      </Link>

      <Link
        href={`/t/${encodeURIComponent(tableSlug)}`}
        className="text-center text-[11px] font-bold text-muted-foreground underline-offset-2 hover:underline"
      >
        Kembali ke menu
      </Link>
    </div>
  );
}
