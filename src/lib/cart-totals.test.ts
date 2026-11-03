import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCartLineId, type CartLine } from "@/lib/cart";
import { calculateOrderTotals } from "@/lib/pricing";

import { calculateCartBreakdown, toPricingItems } from "./cart-totals";

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

const lines: CartLine[] = [
  makeLine({
    quantity: 2,
    modifiers: [{ id: "grp-topping:opt-telur", name: "Extra Telur", priceDelta: 5000 }],
    unitPrice: 43000,
  }),
  makeLine({ menuItemId: "menu-teh", name: "Es Teh", basePrice: 12000, unitPrice: 12000, quantity: 3 }),
];

describe("calculateCartBreakdown", () => {
  it("menghitung subtotal, service 5%, PB1 10%, dan total", () => {
    const breakdown = calculateCartBreakdown(lines);

    // 2 × 43.000 = 86.000 ; 3 × 12.000 = 36.000 -> subtotal 122.000
    assert.equal(breakdown.totalQuantity, 5);
    assert.equal(breakdown.subtotal, 122000);
    assert.equal(breakdown.serviceCharge, 6100);
    assert.equal(breakdown.taxAmount, 12810);
    assert.equal(breakdown.grandTotal, 140910);
  });

  it("konsisten dengan calculateOrderTotals (sumber rumus tunggal)", () => {
    const breakdown = calculateCartBreakdown(lines);
    const totals = calculateOrderTotals({ items: toPricingItems(lines) });

    assert.equal(breakdown.subtotal, totals.subtotal);
    assert.equal(breakdown.serviceCharge, totals.serviceCharge);
    assert.equal(breakdown.taxAmount, totals.taxAmount);
    assert.equal(breakdown.grandTotal, totals.grandTotal);
  });

  it("mengembalikan nol untuk keranjang kosong", () => {
    assert.deepEqual(calculateCartBreakdown([]), {
      totalQuantity: 0,
      subtotal: 0,
      serviceCharge: 0,
      taxAmount: 0,
      grandTotal: 0,
    });
  });

  it("mendukung override tarif", () => {
    const breakdown = calculateCartBreakdown(lines, { servicePercent: 0, taxPercent: 0 });
    assert.equal(breakdown.serviceCharge, 0);
    assert.equal(breakdown.taxAmount, 0);
    assert.equal(breakdown.grandTotal, 122000);
  });

  it("membulatkan service & pajak ke Rupiah bulat", () => {
    const odd = [makeLine({ basePrice: 33333, unitPrice: 33333, quantity: 1 })];
    const breakdown = calculateCartBreakdown(odd);

    // 33.333 × 5% = 1.666,65 -> 1.667 ; dasar pajak 34.999,65 -> 35.000
    assert.equal(breakdown.serviceCharge, 1667);
    assert.equal(breakdown.subtotal, 33333);
  });
});

describe("toPricingItems", () => {
  it("memetakan baris keranjang ke input mesin harga", () => {
    const [first] = toPricingItems(lines);

    assert.equal(first?.menuItemId, "menu-nasi");
    assert.equal(first?.basePrice, 38000);
    assert.equal(first?.quantity, 2);
    assert.equal(first?.modifiers?.[0]?.priceDelta, 5000);
  });
});
