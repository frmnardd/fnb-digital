"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { formatRupiah } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PosBillItem } from "@/types/pos";

/**
 * Modal Split Bill: pilih item yang akan dipisahkan ke pesanan baru.
 * Minimal satu item dipilih dan minimal satu item tetap di bill asal.
 */

export function SplitBillModal({
  open,
  onOpenChange,
  orderNumber,
  items,
  onSplit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  items: PosBillItem[];
  onSplit: (newOrderNumber: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedIds([]);
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  function toggleItem(itemId: string) {
    setSelectedIds((previous) =>
      previous.includes(itemId)
        ? previous.filter((id) => id !== itemId)
        : [...previous, itemId],
    );
  }

  const selectedTotal = items
    .filter((item) => selectedIds.includes(item.id))
    .reduce((total, item) => total + item.lineTotal, 0);

  const isValid = selectedIds.length > 0 && selectedIds.length < items.length;

  async function handleSubmit() {
    if (!isValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: selectedIds }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { newOrder?: { orderNumber?: string } };
        error?: { message?: string };
      } | null;

      const newOrderNumber = payload?.data?.newOrder?.orderNumber;

      if (!response.ok || !newOrderNumber) {
        setError(payload?.error?.message ?? "Gagal memisahkan tagihan.");
        return;
      }

      onSplit(newOrderNumber);
      onOpenChange(false);
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Split Bill"
      description={`Pilih item dari ${orderNumber} yang akan dipisah ke tagihan baru.`}
    >
      <div className="flex flex-col gap-2">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const isChecked = selectedIds.includes(item.id);

            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isChecked}
                  onClick={() => toggleItem(item.id)}
                  className={cn(
                    "flex min-h-touch w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition",
                    isChecked ? "border-primary bg-primary/10" : "border-border bg-card",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 items-center justify-center rounded border",
                        isChecked ? "border-primary bg-primary" : "border-border",
                      )}
                    >
                      {isChecked ? (
                        <span className="size-1.5 rounded-sm bg-primary-foreground" />
                      ) : null}
                    </span>
                    <span className="text-xs font-bold">
                      {item.quantity}× {item.name}
                    </span>
                  </span>
                  <span className="text-xs font-bold tabular-nums">
                    {formatRupiah(item.lineTotal)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-[11px]">
          <span className="font-semibold text-muted-foreground">
            {selectedIds.length} item dipilih
          </span>
          <span className="font-extrabold tabular-nums">{formatRupiah(selectedTotal)}</span>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-danger/10 p-2 text-[11px] font-semibold text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!isValid || isSubmitting}
          onClick={() => void handleSubmit()}
          className="flex min-h-touch items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {isSubmitting ? "Memproses…" : "Pisahkan Item Terpilih"}
        </button>
      </div>
    </Modal>
  );
}
