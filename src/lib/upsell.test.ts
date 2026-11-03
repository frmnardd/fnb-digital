import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCartLineId, type CartLine } from "@/lib/cart";
import type { PublicCategory, PublicMenuItem } from "@/types/menu";

import { describeLineModifiers, getUpsellSuggestions } from "./upsell";

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

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  const menuItemId = overrides.menuItemId ?? "menu-nasi";
  const modifiers = overrides.modifiers ?? [];
  const note = overrides.note ?? "";

  return {
    id: buildCartLineId(menuItemId, modifiers, note),
    menuItemId,
    name: "Nasi Goreng",
    imageUrl: null,
    station: "KITCHEN",
    basePrice: 38000,
    unitPrice: 38000,
    quantity: 1,
    modifiers,
    note,
    ...overrides,
  };
}

const nasi = makeItem({ id: "menu-nasi", name: "Nasi Goreng", isBestSeller: true });
const sate = makeItem({ id: "menu-sate", name: "Sate Ayam" });
const habis = makeItem({ id: "menu-habis", name: "Menu Habis", isOrderable: false });
const esTeh = makeItem({ id: "menu-esteh", name: "Es Teh Manis", station: "BAR", isBestSeller: true });
const kopi = makeItem({ id: "menu-kopi", name: "Kopi Susu", station: "BAR" });

const categories: PublicCategory[] = [
  {
    id: "cat-makanan",
    name: "Makanan",
    slug: "makanan-utama",
    description: null,
    imageUrl: null,
    items: [nasi, sate, habis],
  },
  {
    id: "cat-minuman",
    name: "Minuman",
    slug: "minuman-segar",
    description: null,
    imageUrl: null,
    items: [esTeh, kopi],
  },
];

describe("getUpsellSuggestions", () => {
  it("tidak merekomendasikan item yang sudah ada di keranjang", () => {
    const result = getUpsellSuggestions(categories, [makeLine({ menuItemId: "menu-nasi" })]);
    assert.equal(result.some((item) => item.id === "menu-nasi"), false);
  });

  it("hanya merekomendasikan item yang bisa dipesan", () => {
    const result = getUpsellSuggestions(categories, []);
    assert.equal(result.some((item) => item.id === "menu-habis"), false);
  });

  it("memprioritaskan best seller", () => {
    const result = getUpsellSuggestions(categories, [], { limit: 3 });
    assert.equal(result[0]?.id, "menu-esteh"); // best seller + minuman
    assert.equal(result[1]?.id, "menu-nasi"); // best seller
  });

  it("memberi bobot tambahan pada kategori minuman", () => {
    const result = getUpsellSuggestions(categories, [], { limit: 5 });
    const ids = result.map((item) => item.id);
    assert.ok(ids.indexOf("menu-kopi") < ids.indexOf("menu-sate"));
  });

  it("membatasi jumlah rekomendasi", () => {
    assert.equal(getUpsellSuggestions(categories, [], { limit: 2 }).length, 2);
    assert.equal(getUpsellSuggestions(categories, [], { limit: 0 }).length, 0);
  });

  it("mengecualikan semua varian menu yang sudah ada di keranjang", () => {
    const lines = [
      makeLine({ menuItemId: "menu-esteh" }),
      makeLine({
        menuItemId: "menu-esteh",
        modifiers: [{ id: "grp:opt", name: "Less Sugar", priceDelta: 0 }],
        unitPrice: 12000,
      }),
    ];

    const result = getUpsellSuggestions(categories, lines);
    assert.equal(result.some((item) => item.id === "menu-esteh"), false);
  });
});

describe("describeLineModifiers", () => {
  it("menggabungkan modifier dan catatan", () => {
    const line = makeLine({
      modifiers: [
        { id: "a", name: "Pedas", priceDelta: 0 },
        { id: "b", name: "Extra Telur", priceDelta: 5000 },
      ],
      note: "tanpa bawang",
    });

    assert.equal(describeLineModifiers(line), "Pedas · Extra Telur · tanpa bawang");
  });

  it("mengembalikan string kosong bila tanpa modifier & catatan", () => {
    assert.equal(describeLineModifiers(makeLine()), "");
  });

  it("mengabaikan catatan yang hanya berisi spasi", () => {
    assert.equal(describeLineModifiers(makeLine({ note: "   " })), "");
  });
});
