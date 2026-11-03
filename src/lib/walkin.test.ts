import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCartLineId, type CartLine } from "@/lib/cart";

import {
  calculateWalkInTotals,
  generateWalkInReference,
  validateWalkInCart,
} from "./walkin";

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  const menuItemId = overrides.menuItemId ?? "menu-nasi";
  const modifiers = overrides.modifiers ?? [];

  return {
    id: buildCartLineId(menuItemId, modifiers, ""),
    menuItemId,
    name: "Nasi Goreng",
    imageUrl: null,
    station: "KITCHEN",
    basePrice: 38000,
    unitPrice: 38000,
    quantity: 1,
    modifiers,
    note: "",
    ...overrides,
  };
}

describe("validateWalkInCart", () => {
  it("menolak keranjang kosong", () => {
    const result = validateWalkInCart([]);
    assert.equal(result.valid, false);
    assert.match(result.error ?? "", /kosong/i);
  });

  it("menerima keranjang berisi item valid", () => {
    assert.deepEqual(validateWalkInCart([makeLine({ quantity: 2 })]), { valid: true });
  });

  it("menolak kuantitas tidak valid", () => {
    assert.equal(validateWalkInCart([makeLine({ quantity: 0 })]).valid, false);
    assert.equal(validateWalkInCart([makeLine({ quantity: 1.5 })]).valid, false);
  });
});

describe("calculateWalkInTotals", () => {
  it("mengembalikan nol untuk keranjang kosong", () => {
    assert.deepEqual(calculateWalkInTotals([]), {
      totalQuantity: 0,
      subtotal: 0,
      serviceCharge: 0,
      taxAmount: 0,
      grandTotal: 0,
    });
  });

  it("menghitung subtotal, service 5%, dan PB1 10%", () => {
    const totals = calculateWalkInTotals([makeLine({ quantity: 2 })]);

    assert.equal(totals.totalQuantity, 2);
    assert.equal(totals.subtotal, 76000);
    assert.equal(totals.serviceCharge, 3800);
    assert.equal(totals.taxAmount, 7980);
    assert.equal(totals.grandTotal, 87780);
  });

  it("menjumlahkan beberapa baris", () => {
    const totals = calculateWalkInTotals([
      makeLine({ quantity: 2 }),
      makeLine({ menuItemId: "menu-teh", basePrice: 12000, unitPrice: 12000, quantity: 3 }),
    ]);

    assert.equal(totals.totalQuantity, 5);
    assert.equal(totals.subtotal, 76000 + 36000);
  });

  it("mendukung override tarif", () => {
    const totals = calculateWalkInTotals([makeLine()], { servicePercent: 0, taxPercent: 0 });
    assert.equal(totals.serviceCharge, 0);
    assert.equal(totals.taxAmount, 0);
    assert.equal(totals.grandTotal, 38000);
  });
});

describe("generateWalkInReference", () => {
  it("membentuk referensi berawalan WI-", () => {
    const reference = generateWalkInReference(new Date("2026-11-03T10:00:00.000Z"));
    assert.match(reference, /^WI-[0-9A-Z]+$/);
  });
});
