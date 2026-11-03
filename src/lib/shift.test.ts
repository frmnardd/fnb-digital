import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildShiftSummary,
  CASH_DRAWER_LABELS,
  CASH_DRAWER_TYPES,
  computeExpectedCash,
  computeVariance,
  summarizeDrawerLogs,
} from "./shift";

describe("CASH_DRAWER_TYPES", () => {
  it("memiliki label untuk setiap tipe", () => {
    for (const type of CASH_DRAWER_TYPES) {
      assert.ok(CASH_DRAWER_LABELS[type].length > 0);
    }

    assert.equal(CASH_DRAWER_LABELS.OPENING_FLOAT, "Modal Awal");
    assert.equal(CASH_DRAWER_LABELS.SALE, "Penjualan Tunai");
  });
});

describe("summarizeDrawerLogs", () => {
  it("mengagregasi mutasi per jenis", () => {
    const totals = summarizeDrawerLogs([
      { type: "SALE", amount: 100000 },
      { type: "SALE", amount: 50000 },
      { type: "CASH_IN", amount: 20000 },
      { type: "CASH_OUT", amount: 30000 },
      { type: "REFUND", amount: 11000 },
      { type: "CLOSING_COUNT", amount: 999999 },
      { type: "OPENING_FLOAT", amount: 200000 },
    ]);

    assert.deepEqual(totals, { sales: 150000, cashIn: 20000, cashOut: 30000, refunds: 11000 });
  });

  it("mengembalikan nol untuk log kosong", () => {
    assert.deepEqual(summarizeDrawerLogs([]), {
      sales: 0,
      cashIn: 0,
      cashOut: 0,
      refunds: 0,
    });
  });

  it("memakai nilai absolut (aman untuk nominal negatif)", () => {
    const totals = summarizeDrawerLogs([{ type: "CASH_OUT", amount: -25000 }]);
    assert.equal(totals.cashOut, 25000);
  });
});

describe("computeExpectedCash", () => {
  it("modal awal + penjualan + masuk − keluar − refund", () => {
    const expected = computeExpectedCash({
      startingCash: 200000,
      sales: 150000,
      cashIn: 20000,
      cashOut: 30000,
      refunds: 11000,
    });

    assert.equal(expected, 329000);
  });

  it("mendukung nilai nol", () => {
    assert.equal(
      computeExpectedCash({ startingCash: 0, sales: 0, cashIn: 0, cashOut: 0, refunds: 0 }),
      0,
    );
  });
});

describe("computeVariance", () => {
  it("menghitung selisih positif, nol, dan negatif", () => {
    assert.equal(computeVariance(350000, 329000), 21000);
    assert.equal(computeVariance(329000, 329000), 0);
    assert.equal(computeVariance(300000, 329000), -29000);
  });
});

describe("buildShiftSummary", () => {
  it("menggabungkan log menjadi ringkasan shift", () => {
    const summary = buildShiftSummary({
      startingCash: 100000,
      logs: [
        { type: "SALE", amount: 87780 },
        { type: "CASH_OUT", amount: 20000 },
      ],
    });

    assert.equal(summary.startingCash, 100000);
    assert.equal(summary.sales, 87780);
    assert.equal(summary.cashOut, 20000);
    assert.equal(summary.expectedCash, 167780);
  });
});
