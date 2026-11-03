import { Inbox } from "lucide-react";

import { PosQueueCard } from "@/components/pos/PosQueueCard";
import type { PosQueueOrder } from "@/types/pos";

/**
 * Daftar antrean pesanan POS + empty state.
 */
export function PosQueueList({
  orders,
  selectedId,
  onSelect,
}: {
  orders: PosQueueOrder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Inbox className="size-6" aria-hidden />
        </span>
        <p className="text-sm font-extrabold">Belum ada pesanan masuk</p>
        <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
          Pesanan dari QR meja akan muncul otomatis di sini. Anda juga dapat membuat
          pesanan walk-in saat modulnya tersedia.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {orders.map((order) => (
        <PosQueueCard
          key={order.id}
          order={order}
          isActive={order.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
