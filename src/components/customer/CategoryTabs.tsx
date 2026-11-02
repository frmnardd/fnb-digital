"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Tab kategori yang menempel di bawah header saat halaman di-scroll.
 *
 * - Tab aktif ditentukan `IntersectionObserver` terhadap `<section id="kategori-*">`.
 * - Klik tab → smooth scroll ke bagian terkait.
 * - `offsetPx` = tinggi header sticky (lihat `CUSTOMER_HEADER_OFFSET_PX`).
 */

export interface CategoryTab {
  slug: string;
  name: string;
}

export function CategoryTabs({
  categories,
  offsetPx,
}: {
  categories: CategoryTab[];
  offsetPx: number;
}) {
  const [activeSlug, setActiveSlug] = useState<string>(categories[0]?.slug ?? "");

  useEffect(() => {
    if (categories.length === 0) {
      return;
    }

    setActiveSlug((previous) =>
      categories.some((category) => category.slug === previous)
        ? previous
        : (categories[0]?.slug ?? ""),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        const target = visible[0]?.target;
        const slug = target?.getAttribute("data-category-slug");

        if (slug) {
          setActiveSlug(slug);
        }
      },
      {
        rootMargin: `-${offsetPx + 16}px 0px -55% 0px`,
        threshold: [0, 0.2, 0.6],
      },
    );

    for (const category of categories) {
      const element = document.getElementById(`kategori-${category.slug}`);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [categories, offsetPx]);

  function handleSelect(slug: string) {
    const element = document.getElementById(`kategori-${slug}`);

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSlug(slug);
    }
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Kategori menu"
      className="sticky z-20 -mx-4 border-b border-border/70 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85"
      style={{ top: offsetPx }}
    >
      <ul className="no-scrollbar flex gap-1.5 overflow-x-auto py-2">
        {categories.map((category) => {
          const isActive = category.slug === activeSlug;

          return (
            <li key={category.slug} className="shrink-0">
              <button
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => handleSelect(category.slug)}
                className={cn(
                  "h-10 rounded-full px-3.5 text-xs font-bold transition",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {category.name}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
