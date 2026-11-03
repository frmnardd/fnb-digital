"use client";

import { Delete, Eraser, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { getCashShortcuts, parseCashInput } from "@/lib/cash";
import { calculateCashChange, formatRupiah } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Modal kalkulator pembayaran tunai kasir.
 *
 * - Keypad numerik 56px (`1–9`, `00`, `0`, hapus).
 * - Chip pecahan cepat dari `getCashShortcuts(total)`.
 * - Kembalian dihitung reaktif dengan `calculateCashChange`.
 * - Menekan "Bayar & Lunas" memanggil `cashier-confirm` lalu `onPaid(change)`.
 */

const KEYPAD_ROWS: Array<Array<{ label: string; value: string }>> = [
  [
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
  ],
  [
    { label: "4", value: "4" },
    { label: "5", value: "5" },
    { label: "6", value: "6" },
  ],
  [
    { label: "7", value: "7" },
    { label: "8", value: "8" },
    { label: "9", value: "9" },
  ],
  [
    { label: "00", value: "00" },
    { label: "0", value: "0" },
    { label: "Hapus", value: "backspace" },
  ],
];

export function CashPaymentModal({
  open,
  onOpenChange,
  orderNumber,
  total,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  total: number;
  onPaid: (changeAmount: number) => void;
}) {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setInput("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const received = parseCashInput(input);
  const isEnough = received >= total && received > 0;

  let changeAmount = 0;

  if (isEnough) {
    try {
      changeAmount = calculateCashChange(received, total);
    } catch {
      changeAmount = 0;
    }
  }

  const shortcuts = getCashShortcuts(total);

  function handleKey(value: string) {
    setError(null);

    if (value === "backspace") {
      setInput((previous) => previous.slice(0, -1));
      return;
    }

    setInput((previous) => (previous + value).slice(0, 12));
  }

  async function handleSubmit() {
    if (isSubmitting || !isEnough) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/cashier-confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "MARK_PAID", amountReceived: received }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        data?: { changeAmount?: number };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Gagal memproses pembayaran tunai.");
        return;
      }

      onPaid(payload?.data?.changeAmount ?? changeAmount);
      onOpenChange(false);
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Pembayaran Tunai"
      description={`Pesanan ${orderNumber}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between rounded-lg bg-secondary/60 px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Total tagihan
          </span>
          <span className="text-xl font-extrabold tabular-nums">{formatRupiah(total)}</span>
        </div>

        <div className="flex flex-col gap-1 rounded-lg border border-border bg-background px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Uang diterima
          </span>
          <span
            className={cn(
              "text-2xl font-extrabold tabular-nums",
              received === 0 && "text-muted-foreground",
            )}
          >
            {formatRupiah(received)}
          </span>
          <span
            className={cn(
              "text-[11px] font-bold tabular-nums",
              received === 0
                ? "text-muted-foreground"
                : isEnough
                  ? "text-success"
                  : "text-danger",
            )}
          >
            {received === 0
              ? "Masukkan nominal uang"
              : isEnough
                ? `Kembalian ${formatRupiah(changeAmount)}`
                : "Uang diterima kurang dari total"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {shortcuts.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setInput(String(amount))}
              className="min-h-touch rounded-lg border border-border bg-card px-2 text-[11px] font-bold tabular-nums transition hover:bg-secondary"
            >
              {amount === total ? "Uang Pas" : formatRupiah(amount)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {KEYPAD_ROWS.flat().map((key) => (
            <button
              key={key.value}
              type="button"
              onClick={() => handleKey(key.value)}
              className={cn(
                "flex min-h-touch items-center justify-center rounded-lg border border-border bg-card text-lg font-extrabold tabular-nums transition hover:bg-secondary",
                key.value === "backspace" && "text-muted-foreground",
                key.value === "00" && "text-base",
              )}
              aria-label={key.value === "backspace" ? "Hapus digit" : `Angka ${key.label}`}
            >
              {key.value === "backspace" ? (
                <Delete className="size-5" aria-hidden />
              ) : (
                key.label
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setInput("")}
          className="flex min-h-touch items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-[11px] font-bold text-muted-foreground transition hover:text-foreground"
        >
          <Eraser className="size-4" aria-hidden />
          Kosongkan
        </button>

        {error ? (
          <p role="alert" className="rounded-lg bg-danger/10 p-2 text-[11px] font-semibold text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!isEnough || isSubmitting}
          onClick={() => void handleSubmit()}
          className="flex min-h-touch items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {isSubmitting ? "Memproses…" : "Bayar & Lunas"}
        </button>
      </div>
    </Modal>
  );
}
