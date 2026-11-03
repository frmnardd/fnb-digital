import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CASH_DENOMINATIONS,
  CASH_INPUT_MAX_DIGITS,
  formatCashInput,
  getCashShortcuts,
  parseCashInput,
} from "./cash";

describe("CASH_DENOMINATIONS", () => {
  it("berisi pecahan tunai yang diharapkan", () => {
    assert.deepEqual([...CASH_DENOMINATIONS], [20000, 50000, 100000]);
  });
});

describe("getCashShortcuts", () => {
  it("menyertakan uang pas dan membuang pecahan di bawah total", () => {
    assert.deepEqual(getCashShortcuts(87780), [87780, 100000]);
  });

  it("hanya uang pas bila seluruh pecahan lebih kecil dari total", () => {
    assert.deepEqual(getCashShortcuts(120000), [120000]);
  });

  it("mengembalikan pecahan yang lebih besar bila total kecil", () => {
    assert.deepEqual(getCashShortcuts(12000), [12000, 20000, 50000, 100000]);
  });

  it("tidak menduplikasi nominal (total sama dengan pecahan)", () => {
    assert.deepEqual(getCashShortcuts(50000), [50000, 100000]);
  });

  it("mengembalikan array kosong untuk total tidak valid", () => {
    assert.deepEqual(getCashShortcuts(0), []);
    assert.deepEqual(getCashShortcuts(-1), []);
    assert.deepEqual(getCashShortcuts(1000.5), []);
  });
});

describe("parseCashInput", () => {
  it("mengambil digit dari input bebas", () => {
    assert.equal(parseCashInput("100.000"), 100000);
    assert.equal(parseCashInput("Rp 87.780"), 87780);
  });

  it("mengembalikan 0 untuk input tanpa digit", () => {
    assert.equal(parseCashInput(""), 0);
    assert.equal(parseCashInput("abc"), 0);
  });

  it("membatasi jumlah digit", () => {
    const raw = "1234567890123";
    assert.equal(String(parseCashInput(raw)).length, CASH_INPUT_MAX_DIGITS);
  });
});

describe("formatCashInput", () => {
  it("memformat dengan pemisah ribuan", () => {
    assert.equal(formatCashInput(87780), "87.780");
    assert.equal(formatCashInput(1000000), "1.000.000");
  });

  it("menangani nilai tidak valid", () => {
    assert.equal(formatCashInput(-5), "0");
    assert.equal(formatCashInput(Number.NaN), "0");
  });
});
