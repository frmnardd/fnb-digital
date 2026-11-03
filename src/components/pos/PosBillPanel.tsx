import { ReceiptText } from "lucide-react";

import { formatRupiah } from "@/lib/pricing";
import type { PosQueueOrder } from "@/types/pos";

/**
 * Panel kanan POS: ringkasan pesanan terpilih.
 * Tombol aksi (validasi bayar, cetak, split bill) ditambahkan pada 5.2–5.5.
 */
export function PosBillPanel({ order }: { order: PosQueueOrder | null }) {
  if (!order) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <ReceiptText className="size-6" aria-hidden />
        </span>
        <p className="text-sm font-extrabold">Pilih pesanan</p>
        <p className="max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">
          Detail tagihan dan tombol aksi kasir akan muncul di panel ini.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Pesanan terpilih
        </span>
        <span className="text-base font-extrabold tabular-nums">{order.orderNumber}</span>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {order.tableLabel ?? "Takeaway"} · {order.itemCount} item
        </span>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">Total tagihan</span>
        <span className="text-base font-extrabold tabular-nums">{formatRupiah(order.total)}</span>
      </div>

      <p className="rounded-lg border border-dashed border-border/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
        Aksi kasir (validasi pembayaran, kalkulator tunai, split bill) akan tersedia pada
        sub-tugas berikutnya.
      </p>
    </div>
  );
}
