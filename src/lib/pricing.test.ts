import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateDiscount,
  calculateLineTotal,
  calculateOrderTotals,
  calculateServiceCharge,
  calculateSubtotal,
  calculateTax,
  DEFAULT_SERVICE_PERCENT,
  DEFAULT_TAX_PERCENT,
  formatRupiah,
  generateUniqueCode,
  PricingError,
  type PricingItemInput,
} from "./pricing";

const nasiGoreng: PricingItemInput = {
  menuItemId: "menu-nasi-goreng",
  menuName: "Nasi Goreng Kampung",
  basePrice: 38000,
  quantity: 2,
};

describe("calculateLineTotal", () => {
  it("menjumlahkan harga dasar dengan seluruh modifier", () => {
    const line = calculateLineTotal({
      ...nasiGoreng,
      modifiers: [
        { id: "opt-telur", name: "Extra Telur", priceDelta: 5000 },
        { id: "opt-keju", name: "Keju Mozzarella", priceDelta: 7000 },
      ],
    });

    assert.equal(line.modifierTotal, 12000);
    assert.equal(line.unitPrice, 50000);
    assert.equal(line.lineTotal, 100000);
  });

  it("mendukung item tanpa modifier", () => {
    const line = calculateLineTotal(nasiGoreng);
    assert.equal(line.modifierTotal, 0);
    assert.equal(line.unitPrice, 38000);
    assert.equal(line.lineTotal, 76000);
  });

  it("mendukung modifier bernilai negatif (opsi potongan)", () => {
    const line = calculateLineTotal({
      menuItemId: "menu-kopi",
      basePrice: 24000,
      quantity: 1,
      modifiers: [{ id: "opt-disount", name: "Promo Hari Ini", priceDelta: -4000 }],
    });

    assert.equal(line.unitPrice, 20000);
    assert.equal(line.lineTotal, 20000);
  });

  it("menolak kuantitas 0 atau pecahan", () => {
    assert.throws(() => calculateLineTotal({ ...nasiGoreng, quantity: 0 }), PricingError);
    assert.throws(() => calculateLineTotal({ ...nasiGoreng, quantity: 1.5 }), PricingError);
  });

  it("menolak harga dasar negatif atau bukan bilangan bulat", () => {
    assert.throws(() => calculateLineTotal({ ...nasiGoreng, basePrice: -1000 }), PricingError);
    assert.throws(() => calculateLineTotal({ ...nasiGoreng, basePrice: 38000.5 }), PricingError);
  });

  it("menolak harga unit yang menjadi negatif karena modifier", () => {
    assert.throws(
      () =>
        calculateLineTotal({
          menuItemId: "menu-murah",
          basePrice: 3000,
          quantity: 1,
          modifiers: [{ id: "opt-mahal", name: "Diskon Besar", priceDelta: -5000 }],
        }),
      PricingError,
    );
  });
});

describe("calculateSubtotal", () => {
  it("menjumlahkan total seluruh baris", () => {
    const subtotal = calculateSubtotal([
      nasiGoreng,
      { menuItemId: "menu-teh", basePrice: 12000, quantity: 3 },
    ]);

    assert.equal(subtotal, 76000 + 36000);
  });

  it("menolak pesanan kosong", () => {
    assert.throws(() => calculateSubtotal([]), PricingError);
  });
});

describe("calculateDiscount", () => {
  it("menghitung diskon persen", () => {
    assert.equal(calculateDiscount(100000, { type: "PERCENT", value: 10 }), 10000);
  });

  it("membatasi diskon persen dengan maxAmount", () => {
    assert.equal(
      calculateDiscount(100000, { type: "PERCENT", value: 10, maxAmount: 5000 }),
      5000,
    );
  });

  it("membatasi diskon tetap agar tidak melebihi subtotal", () => {
    assert.equal(calculateDiscount(100000, { type: "FIXED", value: 25000 }), 25000);
    assert.equal(calculateDiscount(100000, { type: "FIXED", value: 150000 }), 100000);
  });

  it("mengembalikan 0 bila tanpa diskon", () => {
    assert.equal(calculateDiscount(100000), 0);
    assert.equal(calculateDiscount(100000, { type: "PERCENT", value: 0 }), 0);
  });

  it("menolak persentase di luar 0–100 dan nominal tetap negatif", () => {
    assert.throws(() => calculateDiscount(100000, { type: "PERCENT", value: 101 }), PricingError);
    assert.throws(() => calculateDiscount(100000, { type: "PERCENT", value: -5 }), PricingError);
    assert.throws(() => calculateDiscount(100000, { type: "FIXED", value: -1 }), PricingError);
  });
});

describe("calculateServiceCharge & calculateTax", () => {
  it("memakai tarif default 5% dan 10% (PB1)", () => {
    assert.equal(DEFAULT_SERVICE_PERCENT, 5);
    assert.equal(DEFAULT_TAX_PERCENT, 10);

    assert.equal(calculateServiceCharge(95000), 4750);
    assert.equal(calculateTax(104750), 10475);
  });

  it("membulatkan ke Rupiah bulat terdekat", () => {
    // 33333 × 5% = 1666.65 -> 1667
    assert.equal(calculateServiceCharge(33333), 1667);
    // 104755 × 10% = 10475.5 -> 10476
    assert.equal(calculateTax(104755), 10476);
  });

  it("menolak dasar pengenaan negatif dan tarif tidak wajar", () => {
    assert.throws(() => calculateServiceCharge(-1000), PricingError);
    assert.throws(() => calculateServiceCharge(100000, 100.1), PricingError);
    assert.throws(() => calculateTax(-1), PricingError);
    assert.throws(() => calculateTax(100000, -2), PricingError);
  });
});

describe("generateUniqueCode", () => {
  it("selalu menghasilkan 3 digit antara 100 dan 999", () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateUniqueCode();
      assert.ok(Number.isInteger(code), `kode bukan integer: ${code}`);
      assert.ok(code >= 100 && code <= 999, `kode di luar rentang: ${code}`);
    }
  });
});

describe("calculateOrderTotals", () => {
  it("menghitung total tanpa diskon & tanpa kode unik (QRIS)", () => {
    const totals = calculateOrderTotals({ items: [nasiGoreng] });

    assert.deepEqual(totals, {
      subtotal: 76000,
      discountAmount: 0,
      serviceCharge: 3800,
      taxAmount: 7980,
      uniqueCode: 0,
      grandTotal: 87780,
    });
  });

  it("menerapkan diskon sebelum service charge dan PB1", () => {
    const totals = calculateOrderTotals({
      items: [nasiGoreng],
      discount: { type: "PERCENT", value: 10 },
    });

    // subtotal 76000 - 7600 = 68400; service 3420; PB1 7182
    assert.equal(totals.discountAmount, 7600);
    assert.equal(totals.serviceCharge, 3420);
    assert.equal(totals.taxAmount, 7182);
    assert.equal(totals.grandTotal, 79002);
  });

  it("menambahkan kode unik hanya bila diminta (transfer manual)", () => {
    const totals = calculateOrderTotals({
      items: [nasiGoreng],
      applyUniqueCode: true,
      uniqueCodeGenerator: () => 321,
    });

    assert.equal(totals.uniqueCode, 321);
    assert.equal(totals.grandTotal, 87780 + 321);
  });

  it("mendukung override tarif service & PB1", () => {
    const totals = calculateOrderTotals({
      items: [{ menuItemId: "menu-air", basePrice: 10000, quantity: 1 }],
      servicePercent: 0,
      taxPercent: 0,
    });

    assert.equal(totals.serviceCharge, 0);
    assert.equal(totals.taxAmount, 0);
    assert.equal(totals.grandTotal, 10000);
  });

  it("menolak generator kode unik yang tidak valid", () => {
    assert.throws(
      () =>
        calculateOrderTotals({
          items: [nasiGoreng],
          applyUniqueCode: true,
          uniqueCodeGenerator: () => 42,
        }),
      PricingError,
    );
  });
});

describe("formatRupiah", () => {
  it("memformat nominal tanpa desimal", () => {
    assert.equal(formatRupiah(38000), "Rp 38.000");
    assert.equal(formatRupiah(1234567), "Rp 1.234.567");
    assert.equal(formatRupiah(0), "Rp 0");
  });

  it("menolak nominal yang bukan angka", () => {
    assert.throws(() => formatRupiah(Number.NaN), PricingError);
  });
});
