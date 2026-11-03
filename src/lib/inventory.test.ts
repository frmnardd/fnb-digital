import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyUsage,
  computeRecipeCost,
  computeUsage,
  getStockStatus,
  summarizeInventory,
} from "./inventory";

describe("computeRecipeCost", () => {
  it("menjumlahkan biaya seluruh baris resep", () => {
    const cost = computeRecipeCost([
      { quantity: 150, costPerUnit: 20 }, // 3.000
      { quantity: 2, costPerUnit: 1500 }, // 3.000
    ]);

    assert.equal(cost, 6000);
  });

  it("membulatkan ke Rupiah bulat", () => {
    assert.equal(computeRecipeCost([{ quantity: 0.333, costPerUnit: 1000 }]), 333);
  });

  it("mengembalikan nol untuk resep kosong", () => {
    assert.equal(computeRecipeCost([]), 0);
  });
});

describe("computeUsage", () => {
  it("mengalikan takaran dengan jumlah porsi", () => {
    assert.deepEqual(
      computeUsage(
        [
          { ingredientId: "beras", quantity: 120 },
          { ingredientId: "telur", quantity: 1 },
        ],
        3,
      ),
      [
        { ingredientId: "beras", quantity: 360 },
        { ingredientId: "telur", quantity: 3 },
      ],
    );
  });

  it("menggabungkan baris dengan bahan yang sama", () => {
    assert.deepEqual(
      computeUsage(
        [
          { ingredientId: "saus", quantity: 10 },
          { ingredientId: "saus", quantity: 5 },
        ],
        2,
      ),
      [{ ingredientId: "saus", quantity: 30 }],
    );
  });

  it("mempertahankan 3 desimal", () => {
    assert.deepEqual(computeUsage([{ ingredientId: "garam", quantity: 0.3335 }], 3), [
      { ingredientId: "garam", quantity: 1.001 },
    ]);
  });

  it("mengembalikan kosong untuk porsi nol", () => {
    assert.deepEqual(computeUsage([{ ingredientId: "a", quantity: 5 }], 0), [
      { ingredientId: "a", quantity: 0 },
    ]);
  });
});

describe("applyUsage", () => {
  it("mengurangi stok", () => {
    assert.equal(applyUsage(1000, 250.5), 749.5);
  });

  it("tidak pernah negatif", () => {
    assert.equal(applyUsage(10, 25), 0);
  });

  it("membulatkan ke 3 desimal", () => {
    assert.equal(applyUsage(1, 0.0006), 0.999);
  });
});

describe("getStockStatus", () => {
  it("menandai stok habis", () => {
    assert.equal(getStockStatus(0, 10), "OUT");
  });

  it("menandai stok rendah pada/ di bawah ambang", () => {
    assert.equal(getStockStatus(5, 10), "LOW");
    assert.equal(getStockStatus(10, 10), "LOW");
  });

  it("menandai stok aman", () => {
    assert.equal(getStockStatus(11, 10), "OK");
  });
});

describe("summarizeInventory", () => {
  it("menghitung total, rendah, dan habis", () => {
    assert.deepEqual(
      summarizeInventory([
        { id: "a", currentStock: 0, minThreshold: 5 },
        { id: "b", currentStock: 3, minThreshold: 5 },
        { id: "c", currentStock: 100, minThreshold: 5 },
      ]),
      { total: 3, low: 1, out: 1 },
    );
  });

  it("ringkasan nol untuk daftar kosong", () => {
    assert.deepEqual(summarizeInventory([]), { total: 0, low: 0, out: 0 });
  });
});
