import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyMenuEngineering,
  getMedian,
  getPeakHours,
  groupPaymentMethods,
  groupRevenueByDay,
  summarizeSales,
} from "./analytics";

const NOW = new Date("2026-11-03T10:00:00.000Z"); // 17:00 WIB

describe("summarizeSales", () => {
  it("menghitung omzet, jumlah pesanan, dan rata-rata", () => {
    assert.deepEqual(
      summarizeSales([
        { grandTotal: 100000, createdAt: NOW },
        { grandTotal: 50000, createdAt: NOW },
        { grandTotal: 30000, createdAt: NOW },
      ]),
      { revenue: 180000, orderCount: 3, averageTicket: 60000 },
    );
  });

  it("aman untuk daftar kosong", () => {
    assert.deepEqual(summarizeSales([]), { revenue: 0, orderCount: 0, averageTicket: 0 });
  });
});

describe("groupRevenueByDay", () => {
  it("membuat seri 7 hari dengan hari kosong", () => {
    const series = groupRevenueByDay(
      [
        { grandTotal: 87780, createdAt: "2026-11-03T03:00:00.000Z" },
        { grandTotal: 50000, createdAt: "2026-11-01T03:00:00.000Z" },
      ],
      7,
      NOW,
    );

    assert.equal(series.length, 7);
    assert.equal(series[6]?.date, "2026-11-03");
    assert.equal(series[6]?.revenue, 87780);
    assert.equal(series[4]?.date, "2026-11-01");
    assert.equal(series[4]?.orders, 1);
    assert.equal(series[5]?.orders, 0);
  });

  it("mengabaikan transaksi di luar jendela", () => {
    const series = groupRevenueByDay(
      [{ grandTotal: 999, createdAt: "2026-01-01T03:00:00.000Z" }],
      3,
      NOW,
    );

    assert.equal(series.reduce((total, row) => total + row.revenue, 0), 0);
  });
});

describe("groupPaymentMethods", () => {
  it("mengagregasi nominal & porsi per metode", () => {
    const rows = groupPaymentMethods([
      { method: "CASH", amount: 60000 },
      { method: "CASH", amount: 20000 },
      { method: "QRIS_DYNAMIC", amount: 20000 },
    ]);

    assert.equal(rows[0]?.method, "CASH");
    assert.equal(rows[0]?.amount, 80000);
    assert.equal(rows[0]?.count, 2);
    assert.equal(rows[0]?.share, 0.8);
    assert.equal(rows[1]?.share, 0.2);
  });

  it("mengembalikan kosong untuk tanpa pembayaran", () => {
    assert.deepEqual(groupPaymentMethods([]), []);
  });
});

describe("getPeakHours", () => {
  it("menghitung pesanan per jam (WIB)", () => {
    const hours = getPeakHours([
      { grandTotal: 1, createdAt: "2026-11-03T04:30:00.000Z" }, // 11:30 WIB
      { grandTotal: 1, createdAt: "2026-11-03T04:45:00.000Z" }, // 11:45 WIB
      { grandTotal: 1, createdAt: "2026-11-03T11:00:00.000Z" }, // 18:00 WIB
    ]);

    assert.equal(hours.length, 24);
    assert.equal(hours[11]?.orders, 2);
    assert.equal(hours[18]?.orders, 1);
  });
});

describe("getMedian", () => {
  it("median ganjil & genap", () => {
    assert.equal(getMedian([1, 2, 3]), 2);
    assert.equal(getMedian([1, 2, 3, 4]), 2.5);
  });

  it("nol untuk daftar kosong", () => {
    assert.equal(getMedian([]), 0);
  });
});

describe("classifyMenuEngineering", () => {
  it("mengelompokkan keempat kuadran", () => {
    const rows = classifyMenuEngineering([
      { menuItemId: "star", name: "Star", quantitySold: 100, revenue: 1_000_000, marginPerUnit: 30000 },
      { menuItemId: "horse", name: "Plowhorse", quantitySold: 90, revenue: 900_000, marginPerUnit: 5000 },
      { menuItemId: "puzzle", name: "Puzzle", quantitySold: 10, revenue: 400_000, marginPerUnit: 25000 },
      { menuItemId: "dog", name: "Dog", quantitySold: 5, revenue: 50_000, marginPerUnit: 2000 },
    ]);

    const byId = new Map(rows.map((row) => [row.menuItemId, row.quadrant]));

    assert.equal(byId.get("star"), "STAR");
    assert.equal(byId.get("horse"), "PLOWHORSE");
    assert.equal(byId.get("puzzle"), "PUZZLE");
    assert.equal(byId.get("dog"), "DOG");
  });

  it("mengembalikan kosong untuk tanpa menu", () => {
    assert.deepEqual(classifyMenuEngineering([]), []);
  });
});
