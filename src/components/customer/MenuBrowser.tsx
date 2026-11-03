"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { CategoryTabs } from "@/components/customer/CategoryTabs";
import { MenuCard } from "@/components/customer/MenuCard";
import { Button } from "@/components/ui/button";
import { CUSTOMER_HEADER_OFFSET_PX } from "@/lib/constants";
import {
  countMatchingItems,
  DIETARY_FILTERS,
  filterCategories,
  type DietaryFilter,
} from "@/lib/menu-filter";
import { cn } from "@/lib/utils";
import type { PublicCategory, PublicMenuItem } from "@/types/menu";

/**
 * Penjelajah menu pelanggan: pencarian instan, filter dietary, dan tab kategori
 * sticky. Seluruh pemfilteran dilakukan di client atas data yang sudah dimuat
 * server (tanpa request tambahan).
 */
export function MenuBrowser({ categories }: { categories: PublicCategory[] }) {
  const [search, setSearch] = useState("");
  const [dietaryFilters, setDietaryFilters] = useState<DietaryFilter[]>([]);

  /**
   * SEMENTARA (sub-tugas 3.3): hitungan keranjang lokal hanya untuk umpan balik
   * visual pada `MenuCard`. Akan diganti Zustand cart store pada sub-tugas 3.5 —
   * jangan menambah logika bisnis keranjang di sini.
   */
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});

  function handleAddToCart(item: PublicMenuItem) {
    setCartQuantities((previous) => ({
      ...previous,
      [item.id]: (previous[item.id] ?? 0) + 1,
    }));
  }

  const filterOptions = useMemo(
    () => ({ search, dietaryFilters }),
    [search, dietaryFilters],
  );

  const filteredCategories = useMemo(
    () => filterCategories(categories, filterOptions),
    [categories, filterOptions],
  );

  const matchingItems = useMemo(
    () => countMatchingItems(categories, filterOptions),
    [categories, filterOptions],
  );

  const hasActiveFilter = search.trim().length > 0 || dietaryFilters.length > 0;

  function toggleDietaryFilter(filter: DietaryFilter) {
    setDietaryFilters((previous) =>
      previous.includes(filter)
        ? previous.filter((value) => value !== filter)
        : [...previous, filter],
    );
  }

  function resetFilters() {
    setSearch("");
    setDietaryFilters([]);
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/60 p-6 text-center">
        <p className="text-sm font-extrabold">Katalog menu belum tersedia</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Menu akan tampil setelah katalog diisi dari back-office.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari menu atau bahan..."
          aria-label="Cari menu"
          className="h-12 w-full rounded-lg border border-input bg-card pl-10 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {search.length > 0 ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Hapus pencarian"
            className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {DIETARY_FILTERS.map((filter) => {
          const isActive = dietaryFilters.includes(filter.id);

          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => toggleDietaryFilter(filter.id)}
              className={cn(
                "h-10 shrink-0 rounded-full border px-3.5 text-xs font-bold transition",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <CategoryTabs
        categories={filteredCategories.map((category) => ({
          slug: category.slug,
          name: category.name,
        }))}
        offsetPx={CUSTOMER_HEADER_OFFSET_PX}
      />

      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {hasActiveFilter ? `${matchingItems} hasil ditemukan` : `${matchingItems} menu tersedia`}
        </p>
        {hasActiveFilter ? (
          <button
            type="button"
            onClick={resetFilters}
            className="text-[11px] font-bold text-primary underline-offset-2 hover:underline"
          >
            Reset
          </button>
        ) : null}
      </div>

      {filteredCategories.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card/60 p-6 text-center">
          <p className="text-sm font-extrabold">Menu tidak ditemukan</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Coba kata kunci lain atau hapus filter yang aktif.
          </p>
          <Button variant="secondary" size="sm" onClick={resetFilters}>
            Reset filter
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {filteredCategories.map((category) => (
            <section
              key={category.slug}
              id={`kategori-${category.slug}`}
              data-category-slug={category.slug}
              className="flex scroll-mt-[190px] flex-col gap-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-extrabold">{category.name}</h2>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {category.items.length} menu
                </span>
              </div>

              {category.description ? (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {category.description}
                </p>
              ) : null}

              <div className="flex flex-col gap-2">
                {category.items.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    quantityInCart={cartQuantities[item.id] ?? 0}
                    onAdd={handleAddToCart}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
