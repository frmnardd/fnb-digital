import { Flame, Sparkles, Star } from "lucide-react";

import { formatRupiah } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PublicMenuItem } from "@/types/menu";

/**
 * Kartu menu pelanggan.
 * Versi ringkas untuk sub-tugas 3.2 — gambar rasio 1:1, badge stok, dan
 * indikator keranjang akan dilengkapi pada sub-tugas 3.3.
 */
export function MenuCard({ item }: { item: PublicMenuItem }) {
  const isSoldOut = !item.isAvailable;
  const tags = item.tags.map((tag) => tag.toUpperCase());

  return (
    <article
      className={cn(
        "flex gap-3 rounded-xl border bg-card p-3 shadow-card-soft",
        !item.isOrderable && "opacity-70",
      )}
    >
      <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-secondary">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- host foto menu belum tentu terdaftar di next.config; validasi domain dilakukan di back-office.
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className={cn("size-full object-cover", isSoldOut && "grayscale")}
          />
        ) : (
          <span className="flex size-full items-center justify-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {item.name.slice(0, 2)}
          </span>
        )}

        {isSoldOut ? (
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/55 text-[10px] font-extrabold uppercase tracking-wide text-background">
            Habis
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug">{item.name}</h3>
          {item.isBestSeller ? (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-warning">
              <Star className="size-2.5" aria-hidden />
              Best
            </span>
          ) : null}
        </div>

        {item.description ? (
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {item.description}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1">
          {tags.includes("PEDAS") ? (
            <span className="flex items-center gap-0.5 rounded-full bg-danger/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-danger">
              <Flame className="size-2.5" aria-hidden />
              Pedas
            </span>
          ) : null}
          {tags.includes("BARU") ? (
            <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
              <Sparkles className="size-2.5" aria-hidden />
              Baru
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-extrabold tabular">{formatRupiah(item.basePrice)}</span>
          <span className="text-[10px] font-semibold text-muted-foreground">
            ±{item.prepTimeMinutes} mnt
          </span>
        </div>
      </div>
    </article>
  );
}
