import { Flame, Plus, Sparkles, Star } from "lucide-react";

import { getOrderabilityLabel, getOrderabilityText } from "@/lib/menu";
import { formatRupiah } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PublicMenuItem } from "@/types/menu";

/**
 * Kartu menu pelanggan.
 *
 * - Thumbnail rasio 1:1, grayscale + overlay "Habis" saat stok mati (86'd).
 * - Badge jumlah item di keranjang pada pojok thumbnail.
 * - Tombol tambah 48×48 (standar touch target pelanggan) atau label status bila
 *   menu tidak bisa dipesan.
 *
 * Komponen ini dirender di dalam Client Component (`MenuBrowser`) sehingga boleh
 * menerima handler `onAdd`.
 */

export interface MenuCardProps {
  item: PublicMenuItem;
  /** Jumlah item ini yang sudah ada di keranjang (0 = belum ada). */
  quantityInCart?: number;
  onAdd?: (item: PublicMenuItem) => void;
}

export function MenuCard({ item, quantityInCart = 0, onAdd }: MenuCardProps) {
  const isSoldOut = !item.isAvailable;
  const availability = getOrderabilityLabel(item);
  const isOrderable = availability === "TERSEDIA";
  const tags = item.tags.map((tag) => tag.toUpperCase());
  const actionLabel = isOrderable
    ? `Tambah ${item.name} ke keranjang`
    : `${item.name}: ${getOrderabilityText(availability)}`;

  return (
    <article
      className={cn(
        "flex gap-3 rounded-xl border bg-card p-3 shadow-card-soft transition",
        !isOrderable && "border-dashed opacity-80",
      )}
    >
      <div className="relative aspect-square w-[104px] shrink-0 overflow-hidden rounded-lg bg-secondary">
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

        {quantityInCart > 0 ? (
          <span
            className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-primary-foreground shadow-sm tabular"
            aria-label={`${quantityInCart} di keranjang`}
          >
            {quantityInCart}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-extrabold tabular-nums">
              {formatRupiah(item.basePrice)}
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">
              ±{item.prepTimeMinutes} mnt
            </span>
          </div>

          {isOrderable ? (
            <button
              type="button"
              onClick={() => onAdd?.(item)}
              aria-label={actionLabel}
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Plus className="size-5" aria-hidden />
            </button>
          ) : (
            <span
              className={cn(
                "flex h-9 shrink-0 items-center rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wide",
                isSoldOut ? "bg-danger/10 text-danger" : "bg-secondary text-muted-foreground",
              )}
            >
              {getOrderabilityText(availability)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
