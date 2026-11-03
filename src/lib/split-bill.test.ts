import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  recalculateTotalsFromItems,
  SplitBillError,
  splitEqually,
  splitItemsBySelection,
  type SplittableItem,
} from "./split-bill";

const nasi: SplittableItem = {
  id: "item-1",
  basePrice: 38000,
  quantity: 2,
  modifiers: [],
};

const nasiTelur: SplittableItem = {
  id: "item-2",
  basePrice: 38000,
  quantity: 1,
  modifiers: [{ id: "grp:telur", name: "Extra Telur", priceDelta: 5000 }],
};

const esTeh: SplittableItem = {
  id: "item-3",
  basePrice: 12000,
  quantity: 3,
  modifiers: [],
};

const items = [nasi, nasiTelur, esTeh];

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof SplitBillError);
    assert.equal(error.code, code);
    return;
  }

  assert.fail(`seharusnya melempar SplitBillError ${code}`);
}

describe("splitItemsBySelection", () => {
  it("memisahkan item terpilih dan sisanya", () => {
    const result = splitItemsBySelection(items, ["item-2"]);

    assert.deepEqual(result.moved.map((item) => item.id), ["item-2"]);
    assert.deepEqual(result.remaining.map((item) => item.id), ["item-1", "item-3"]);
  });

  it("mendukung beberapa item sekaligus", () => {
    const result = splitItemsBySelection(items, ["item-1", "item-3"]);
    assert.equal(result.moved.length, 2);
    assert.equal(result.remaining.length, 1);
  });

  it("menolak pilihan kosong", () => {
    expectCode(() => splitItemsBySelection(items, []), "EMPTY_SELECTION");
  });

  it("menolak seluruh item dipilih", () => {
    expectCode(
      () => splitItemsBySelection(items, ["item-1", "item-2", "item-3"]),
      "ALL_SELECTED",
    );
  });

  it("menolak id asing dan duplikat", () => {
    expectCode(() => splitItemsBySelection(items, ["item-asing"]), "UNKNOWN_ITEM");
    expectCode(() => splitItemsBySelection(items, ["item-1", "item-1"]), "DUPLICATE_SELECTION");
  });

  it("tidak memutasi input", () => {
    splitItemsBySelection(items, ["item-1"]);
    assert.equal(items.length, 3);
  });
});

describe("recalculateTotalsFromItems", () => {
  it("menghitung subtotal, service 5%, dan PB1 10%", () => {
    const totals = recalculateTotalsFromItems([nasiTelur]);

    // 38.000 + 5.000 = 43.000 ; service 2.150 ; PB1 4.515
    assert.equal(totals.subtotal, 43000);
    assert.equal(totals.serviceCharge, 2150);
    assert.equal(totals.taxAmount, 4515);
    assert.equal(totals.grandTotal, 49665);
  });

  it("menjumlahkan beberapa item", () => {
    const totals = recalculateTotalsFromItems([nasi, esTeh]);
    assert.equal(totals.subtotal, 2 * 38000 + 3 * 12000);
  });

  it("mendukung override tarif", () => {
    const totals = recalculateTotalsFromItems([nasiTelur], { servicePercent: 0, taxPercent: 0 });
    assert.equal(totals.serviceCharge, 0);
    assert.equal(totals.taxAmount, 0);
    assert.equal(totals.grandTotal, 43000);
  });
});

describe("splitEqually", () => {
  it("membagi rata ketika habis dibagi", () => {
    assert.deepEqual(splitEqually(120000, 3), [40000, 40000, 40000]);
  });

  it("memberikan sisa pembulatan ke bagian pertama", () => {
    const parts = splitEqually(100000, 3);
    assert.deepEqual(parts, [33334, 33333, 33333]);
    assert.equal(
      parts.reduce((total, part) => total + part, 0),
      100000,
    );
  });

  it("mendukung satu bagian", () => {
    assert.deepEqual(splitEqually(87780, 1), [87780]);
  });

  it("menolak total atau jumlah bagian tidak valid", () => {
    expectCode(() => splitEqually(-1, 2), "INVALID_PARTS");
    expectCode(() => splitEqually(1000.5, 2), "INVALID_PARTS");
    expectCode(() => splitEqually(1000, 0), "INVALID_PARTS");
    expectCode(() => splitEqually(1000, 21), "INVALID_PARTS");
  });
});
