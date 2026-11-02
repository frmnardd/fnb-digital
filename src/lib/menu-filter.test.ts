import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicCategory, PublicMenuItem } from "../types/menu";

import {
  countMatchingItems,
  DIETARY_FILTERS,
  filterCategories,
  filterMenuItems,
  type DietaryFilter,
} from "./menu-filter";

function makeItem(overrides: Partial<PublicMenuItem> & { id: string; name: string }): PublicMenuItem {
  return {
    slug: overrides.id,
    description: null,
    imageUrl: null,
    basePrice: 20000,
    station: "KITCHEN",
    isBestSeller: false,
    tags: [],
    prepTimeMinutes: 5,
    isAvailable: true,
    isOrderable: true,
    availableFrom: null,
    availableUntil: null,
    modifierGroups: [],
    ...overrides,
  };
}

const nasiGoreng = makeItem({
  id: "nasi-goreng",
  name: "Nasi Goreng Kampung",
  description: "Nasi goreng dengan telur mata sapi",
  isBestSeller: true,
  tags: ["PEDAS"],
});

const esTeh = makeItem({
  id: "es-teh",
  name: "Es Teh Manis",
  description: "Teh tubruk klasik",
  station: "BAR",
});

const lemonTea = makeItem({
  id: "lemon-tea",
  name: "Lemon Tea Segar",
  description: "Teh hitam dingin dengan lemon",
  station: "BAR",
  tags: ["BARU"],
});

const pisangGoreng = makeItem({
  id: "pisang-goreng",
  name: "Pisang Goreng Keju",
  description: "Pisang goreng dengan keju parut",
});

const categories: PublicCategory[] = [
  {
    id: "cat-makanan",
    name: "Makanan Utama",
    slug: "makanan-utama",
    description: null,
    imageUrl: null,
    items: [nasiGoreng],
  },
  {
    id: "cat-camilan",
    name: "Camilan",
    slug: "camilan",
    description: null,
    imageUrl: null,
    items: [pisangGoreng],
  },
  {
    id: "cat-minuman",
    name: "Minuman",
    slug: "minuman",
    description: null,
    imageUrl: null,
    items: [esTeh, lemonTea],
  },
];

describe("DIETARY_FILTERS", () => {
  it("menyediakan tiga filter sesuai kebutuhan UI", () => {
    assert.deepEqual(
      DIETARY_FILTERS.map((filter) => filter.id),
      ["BEST_SELLER", "PEDAS", "BARU"],
    );
  });
});

describe("filterMenuItems — pencarian", () => {
  it("mengembalikan semua item bila kata kunci kosong", () => {
    assert.equal(filterMenuItems([nasiGoreng, esTeh]).length, 2);
    assert.equal(filterMenuItems([nasiGoreng, esTeh], { search: "   " }).length, 2);
  });

  it("mencocokkan sebagian nama tanpa peduli huruf besar/kecil", () => {
    const result = filterMenuItems([nasiGoreng, esTeh, lemonTea], { search: "teh" });
    assert.deepEqual(
      result.map((item) => item.id),
      ["es-teh", "lemon-tea"],
    );
  });

  it("mencocokkan deskripsi", () => {
    const result = filterMenuItems([nasiGoreng, esTeh], { search: "telur" });
    assert.deepEqual(
      result.map((item) => item.id),
      ["nasi-goreng"],
    );
  });

  it("mengembalikan daftar kosong bila tidak ada yang cocok", () => {
    assert.deepEqual(filterMenuItems([nasiGoreng, esTeh], { search: "sushi" }), []);
  });
});

describe("filterMenuItems — filter dietary", () => {
  const items = [nasiGoreng, esTeh, lemonTea, pisangGoreng];

  it("memfilter Best Seller berdasarkan flag", () => {
    assert.deepEqual(
      filterMenuItems(items, { dietaryFilters: ["BEST_SELLER"] }).map((item) => item.id),
      ["nasi-goreng"],
    );
  });

  it("memfilter Pedas & Baru berdasarkan tag", () => {
    assert.deepEqual(
      filterMenuItems(items, { dietaryFilters: ["PEDAS"] }).map((item) => item.id),
      ["nasi-goreng"],
    );
    assert.deepEqual(
      filterMenuItems(items, { dietaryFilters: ["BARU"] }).map((item) => item.id),
      ["lemon-tea"],
    );
  });

  it("menerapkan semua filter sekaligus (AND)", () => {
    const result = filterMenuItems(items, {
      dietaryFilters: ["BEST_SELLER", "PEDAS"] as DietaryFilter[],
    });
    assert.deepEqual(
      result.map((item) => item.id),
      ["nasi-goreng"],
    );

    assert.deepEqual(
      filterMenuItems(items, { dietaryFilters: ["BEST_SELLER", "BARU"] }),
      [],
    );
  });

  it("menggabungkan pencarian dan filter dietary", () => {
    const result = filterMenuItems(items, {
      search: "teh",
      dietaryFilters: ["BARU"],
    });
    assert.deepEqual(
      result.map((item) => item.id),
      ["lemon-tea"],
    );
  });
});

describe("filterCategories", () => {
  it("membuang kategori yang tidak memiliki item cocok", () => {
    const result = filterCategories(categories, { search: "teh" });
    assert.deepEqual(
      result.map((category) => category.slug),
      ["minuman"],
    );
    assert.equal(result[0]?.items.length, 2);
  });

  it("mempertahankan semua kategori saat tanpa filter", () => {
    assert.equal(filterCategories(categories).length, 3);
  });

  it("tidak memutasi kategori asal", () => {
    filterCategories(categories, { search: "teh" });
    assert.equal(categories[2]?.items.length, 2);
  });
});

describe("countMatchingItems", () => {
  it("menghitung total item yang cocok lintas kategori", () => {
    assert.equal(countMatchingItems(categories), 4);
    assert.equal(countMatchingItems(categories, { search: "teh" }), 2);
    assert.equal(countMatchingItems(categories, { search: "sushi" }), 0);
  });
});
