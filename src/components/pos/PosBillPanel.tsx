"use client";

import { CheckCircle2, ExternalLink, Loader2, ReceiptText, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { calculateCashChange, formatRupiah } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PosBillDetail, PosQueueOrder } from "@/types/pos";

/**
 * Panel kanan POS: detail tagihan + validasi pembayaran kasir.
 *
 * - Tunai: input uang diterima + tombol pecahan cepat, pratinjau kembalian.
 * - Transfer manual: tampilkan thumbnail bukti (wajib ada sebelum melunasi).
 * - Aksi: `MARK_PAID` menandai lunas & meneruskan pesanan ke dapur, `REJECT` membatalkan.
 *
 * TODO(RBAC): aksi ini belum memerlukan PIN supervisor; lihat 5.7.
 */

const QUICK_AMOUNTS = [50000, 100000, 150000] as const;

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  QRIS_DYNAMIC: "QRIS",
  VIRTUAL_ACCOUNT: "Virtual Account",
  MANUAL_TRANSFER: "Transfer Manual",
  CASH: "Tunai",
  EDC_CARD: "Kartu EDC",
};

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-warning/15 text-warning",
  PAID: "bg-success/15 text-success",
  FAILED: "bg-danger/15 text-danger",
  REFUNDED: "bg-secondary text-muted-foreground",
  EXPIRED: "bg-secondary text-muted-foreground",
};

interface BillEnvelope {
  data?: PosBillDetail;
  error?: { message?: string };
}

export function PosBillPanel({ order }: { order: PosQueueOrder | null }) {
  const router = useRouter();

  const [bill, setBill] = useState<PosBillDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const loadBill = useCallback(async (orderNumber: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/bill`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as BillEnvelope | null;

      if (!response.ok || !payload?.data) {
        setError(payload?.error?.message ?? "Gagal memuat tagihan.");
        return;
      }

      setBill(payload.data);
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setNotice(null);
    setIsRejecting(false);
    setAmountReceived("");

    if (!order) {
      setBill(null);
      return;
    }

    void loadBill(order.orderNumber);
  }, [order, loadBill]);

  const total = bill?.totals.grandTotal ?? 0;
  const receivedDigits = amountReceived.replace(/\D/g, "");
  const receivedNumber = receivedDigits.length > 0 ? Number(receivedDigits) : null;

  let changePreview: number | null = null;

  if (receivedNumber !== null && Number.isFinite(receivedNumber)) {
    try {
      changePreview = calculateCashChange(receivedNumber, total);
    } catch {
      changePreview = null;
    }
  }

  async function handleAction(action: "MARK_PAID" | "REJECT") {
    if (!bill || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const body: Record<string, unknown> = { action };

      if (action === "MARK_PAID" && bill.payment?.method === "CASH" && receivedNumber !== null) {
        body.amountReceived = receivedNumber;
      }

      const response = await fetch(
        `/api/orders/${encodeURIComponent(bill.orderNumber)}/cashier-confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        data?: { changeAmount?: number; duplicate?: boolean };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setNotice(payload?.error?.message ?? "Aksi gagal diproses.");
        return;
      }

      if (action === "MARK_PAID") {
        const change = payload?.data?.changeAmount ?? 0;
        setNotice(
          change > 0
            ? `Pembayaran lunas. Kembalian ${formatRupiah(change)}.`
            : "Pembayaran lunas.",
        );
      } else {
        setNotice("Pesanan ditolak dan dibatalkan.");
      }

      setIsRejecting(false);
      await loadBill(bill.orderNumber);
      router.refresh();
    } catch {
      setNotice("Tidak dapat menghubungi server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!order) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <ReceiptText className="size-6" aria-hidden />
        </span>
        <p className="text-sm font-extrabold">Pilih pesanan</p>
        <p className="max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">
          Detail tagihan dan tombol validasi pembayaran akan muncul di panel ini.
        </p>
      </div>
    );
  }

  if (isLoading && !bill) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
        <Button variant="secondary" size="sm" onClick={() => void loadBill(order.orderNumber)}>
          Coba lagi
        </Button>
      </div>
    );
  }

  if (!bill) {
    return null;
  }

  const payment = bill.payment;
  const isPaid = payment?.status === "PAID";
  const canConfirm = payment?.status === "PENDING";
  const isCash = payment?.method === "CASH";
  const isManual = payment?.method === "MANUAL_TRANSFER";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Pesanan terpilih
        </span>
        <span className="text-base font-extrabold tabular-nums">{bill.orderNumber}</span>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {bill.tableLabel ?? "Takeaway"} · {bill.orderType === "DINE_IN" ? "Dine In" : "Takeaway"}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5 rounded-lg border border-border/70 p-2">
        {bill.items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex flex-col gap-0.5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold">
                {item.quantity}× {item.name}
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums">
                {formatRupiah(item.lineTotal)}
              </span>
            </div>
            {item.modifiers.length > 0 ? (
              <span className="text-[10px] text-muted-foreground">
                {item.modifiers.map((modifier) => modifier.name).join(", ")}
              </span>
            ) : null}
            {item.note ? (
              <span className="text-[10px] italic text-muted-foreground">{item.note}</span>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-0.5 rounded-lg bg-secondary/60 p-2 text-[11px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold tabular-nums">{formatRupiah(bill.totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Service 5%</span>
          <span className="font-semibold tabular-nums">
            {formatRupiah(bill.totals.serviceCharge)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">PB1 10%</span>
          <span className="font-semibold tabular-nums">{formatRupiah(bill.totals.taxAmount)}</span>
        </div>
        {bill.totals.uniqueCode > 0 ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kode unik</span>
            <span className="font-semibold tabular-nums">{bill.totals.uniqueCode}</span>
          </div>
        ) : null}
        <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm">
          <span className="font-extrabold">Total</span>
          <span className="font-extrabold tabular-nums">{formatRupiah(bill.totals.grandTotal)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground">Pembayaran</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold">
            {payment ? (PAYMENT_METHOD_LABEL[payment.method] ?? payment.method) : "—"}
          </span>
          {payment ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase",
                PAYMENT_STATUS_STYLE[payment.status] ?? "bg-secondary text-muted-foreground",
              )}
            >
              {payment.status}
            </span>
          ) : null}
        </div>
      </div>

      {isManual && payment?.proofImageUrl ? (
        <a
          href={payment.proofImageUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[11px] font-bold text-primary"
        >
          <span className="flex items-center gap-1.5">
            <ExternalLink className="size-3.5" aria-hidden />
            Lihat bukti transfer
          </span>
          <span className="text-muted-foreground">Buka</span>
        </a>
      ) : null}

      {isManual && !payment?.proofImageUrl && canConfirm ? (
        <p className="rounded-lg bg-warning/10 p-2 text-[11px] font-semibold text-warning">
          Bukti transfer belum diunggah. Minta pelanggan mengunggah bukti sebelum melunasi.
        </p>
      ) : null}

      {canConfirm ? (
        <>
          {isCash ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 p-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold">Uang diterima</span>
                <input
                  value={amountReceived}
                  onChange={(event) => setAmountReceived(event.target.value)}
                  inputMode="numeric"
                  placeholder={String(bill.totals.grandTotal)}
                  className="h-12 rounded-lg border border-input bg-background px-3 text-sm font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmountReceived(String(bill.totals.grandTotal))}
                  className="min-h-touch flex-1 rounded-lg border border-border bg-card px-2 text-[11px] font-bold hover:bg-secondary"
                >
                  Uang Pas
                </button>
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setAmountReceived(String(amount))}
                    className="min-h-touch flex-1 rounded-lg border border-border bg-card px-2 text-[11px] font-bold tabular-nums hover:bg-secondary"
                  >
                    {formatRupiah(amount)}
                  </button>
                ))}
              </div>

              {receivedNumber !== null && receivedNumber > 0 ? (
                <p
                  className={cn(
                    "text-[11px] font-bold tabular-nums",
                    changePreview === null ? "text-danger" : "text-success",
                  )}
                >
                  {changePreview === null
                    ? "Uang diterima kurang dari total."
                    : `Kembalian ${formatRupiah(changePreview)}`}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Button
              className="w-full"
              disabled={isSubmitting || (isManual && !payment?.proofImageUrl)}
              onClick={() => void handleAction("MARK_PAID")}
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {isSubmitting ? "Memproses…" : "Konfirmasi Lunas"}
            </Button>

            {isRejecting ? (
              <div className="flex gap-1.5">
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={() => void handleAction("REJECT")}
                >
                  <XCircle className="size-4" aria-hidden />
                  Ya, tolak
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={() => setIsRejecting(false)}
                >
                  Batal
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setIsRejecting(true)}>
                Tolak Pesanan
              </Button>
            )}
          </div>
        </>
      ) : null}

      {isPaid ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-success/10 p-2 text-[11px] font-bold text-success">
          <CheckCircle2 className="size-3.5" aria-hidden />
          Pembayaran sudah lunas
          {payment && payment.changeAmount > 0
            ? ` · kembalian ${formatRupiah(payment.changeAmount)}`
            : ""}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-lg bg-secondary p-2 text-[11px] font-semibold">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
