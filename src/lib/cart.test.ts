import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCartLineId,
  findQuantityByItem,
  mergeCartLines,
  normalizeCartNote,
  summarizeCart,
  updateLineQuantity,
  type CartLine,
} from "./cart";

const telur = { id: "grp-topping:opt-telur", name: "Extra Telur", priceDelta: 5000 };
const keju = { id: "grp-topping:opt-keju", name: "Keju", priceDelta: 7000 };

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  const modifiers = overrides.modifiers ?? [];
  const note = overrides.note ?? "";
  const menuItemId = overrides.menuItemId ?? "menu-nasi";

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

describe("normalizeCartNote", () => {
  it("merapikan spasi dan huruf besar/kecil", () => {
    assert.equal(normalizeCartNote("  Tanpa   Bawang "), "tanpa bawang");
    assert.equal(normalizeCartNote(""), "");
  });
});

describe("buildCartLineId", () => {
  it("stabil untuk kombinasi yang sama (urutan modifier tidak berpengaruh)", () => {
    const a = buildCartLineId("menu-nasi", [telur, keju], "Tanpa Bawang");
    const b = buildCartLineId("menu-nasi", [keju, telur], "tanpa  bawang");
    assert.equal(a, b);
  });

  it("berbeda untuk menu, modifier, atau catatan yang berbeda", () => {
    const base = buildCartLineId("menu-nasi", [], "");
    assert.notEqual(base, buildCartLineId("menu-mie", [], ""));
    assert.notEqual(base, buildCartLineId("menu-nasi", [telur], ""));
    assert.notEqual(base, buildCartLineId("menu-nasi", [], "pedas"));
    assert.notEqual(
      buildCartLineId("menu-nasi", [telur], ""),
      buildCartLineId("menu-nasi", [keju], ""),
    );
  });
});

describe("mergeCartLines", () => {
  it("menambahkan baris baru bila ID belum ada", () => {
    const line = makeLine();
    assert.deepEqual(mergeCartLines([], line), [line]);
  });

  it("menjumlahkan kuantitas bila ID sama", () => {
    const first = makeLine({ quantity: 2 });
    const second = makeLine({ quantity: 3 });
    const merged = mergeCartLines([first], second);

    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.quantity, 5);
  });

  it("memperbarui harga satuan dari baris terbaru", () => {
    const first = makeLine({ quantity: 1, unitPrice: 38000 });
    const second = makeLine({ quantity: 1, unitPrice: 40000 });
    const merged = mergeCartLines([first], second);

    assert.equal(merged[0]?.unitPrice, 40000);
    assert.equal(merged[0]?.quantity, 2);
  });

  it("menjaga baris dengan modifier berbeda tetap terpisah", () => {
    const plain = makeLine();
    const withTelur = makeLine({ modifiers: [telur], unitPrice: 43000 });
    const merged = mergeCartLines([plain], withTelur);

    assert.equal(merged.length, 2);
  });

  it("tidak memutasi array asal", () => {
    const original = [makeLine({ quantity: 1 })];
    mergeCartLines(original, makeLine({ quantity: 1 }));
    assert.equal(original[0]?.quantity, 1);
  });
});

describe("updateLineQuantity", () => {
  it("mengubah kuantitas baris terkait", () => {
    const line = makeLine({ quantity: 2 });
    const updated = updateLineQuantity([line], line.id, 5);
    assert.equal(updated[0]?.quantity, 5);
  });

  it("menghapus baris saat kuantitas 0 atau negatif", () => {
    const line = makeLine({ quantity: 2 });
    assert.deepEqual(updateLineQuantity([line], line.id, 0), []);
    assert.deepEqual(updateLineQuantity([line], line.id, -3), []);
  });
});

describe("summarizeCart", () => {
  it("menjumlahkan kuantitas dan subtotal", () => {
    const lines = [
      makeLine({ quantity: 2, unitPrice: 38000 }),
      makeLine({ menuItemId: "menu-teh", quantity: 3, unitPrice: 12000, modifiers: [] }),
    ];

    assert.deepEqual(summarizeCart(lines), { totalQuantity: 5, subtotal: 112000 });
  });

  it("mengembalikan nol untuk keranjang kosong", () => {
    assert.deepEqual(summarizeCart([]), { totalQuantity: 0, subtotal: 0 });
  });
});

describe("findQuantityByItem", () => {
  it("menjumlahkan seluruh varian dari menu yang sama", () => {
    const lines = [
      makeLine({ quantity: 2 }),
      makeLine({ quantity: 1, modifiers: [telur], unitPrice: 43000 }),
      makeLine({ menuItemId: "menu-teh", quantity: 4, unitPrice: 12000, modifiers: [] }),
    ];

    assert.equal(findQuantityByItem(lines, "menu-nasi"), 3);
    assert.equal(findQuantityByItem(lines, "menu-teh"), 4);
    assert.equal(findQuantityByItem(lines, "menu-tidak-ada"), 0);
  });
});
