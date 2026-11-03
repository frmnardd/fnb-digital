import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BANK_OPTIONS, buildVirtualAccount, getBankLabel, isValidBank } from "./va";

describe("BANK_OPTIONS", () => {
  it("menyediakan empat bank", () => {
    assert.deepEqual(
      BANK_OPTIONS.map((bank) => bank.code),
      ["BCA", "MANDIRI", "BNI", "BRI"],
    );
  });
});

describe("isValidBank", () => {
  it("menerima kode bank yang terdaftar", () => {
    assert.equal(isValidBank("BCA"), true);
    assert.equal(isValidBank("BRI"), true);
  });

  it("menolak kode bank asing atau huruf kecil", () => {
    assert.equal(isValidBank("MANDIRI"), true);
    assert.equal(isValidBank("bca"), false);
    assert.equal(isValidBank("CIMB"), false);
  });
});

describe("getBankLabel", () => {
  it("mengembalikan label tampilan", () => {
    assert.equal(getBankLabel("MANDIRI"), "Mandiri");
  });
});

describe("buildVirtualAccount", () => {
  it("menghasilkan 12 digit dengan prefix bank", () => {
    const va = buildVirtualAccount({ bank: "BCA", orderNumber: "ORD-0001" });

    assert.match(va, /^\d{12}$/);
    assert.ok(va.startsWith("8808"));
  });

  it("deterministik untuk pesanan yang sama", () => {
    const first = buildVirtualAccount({ bank: "BNI", orderNumber: "ORD-0042" });
    const second = buildVirtualAccount({ bank: "BNI", orderNumber: "ORD-0042" });
    assert.equal(first, second);
  });

  it("berbeda antar bank", () => {
    const bca = buildVirtualAccount({ bank: "BCA", orderNumber: "ORD-0042" });
    const bri = buildVirtualAccount({ bank: "BRI", orderNumber: "ORD-0042" });
    assert.notEqual(bca, bri);
  });

  it("berbeda antar pesanan", () => {
    const first = buildVirtualAccount({ bank: "BCA", orderNumber: "ORD-0001" });
    const second = buildVirtualAccount({ bank: "BCA", orderNumber: "ORD-0002" });
    assert.notEqual(first, second);
  });

  it("menolak nomor pesanan tanpa digit", () => {
    assert.throws(() => buildVirtualAccount({ bank: "BCA", orderNumber: "ORD-ABCD" }), /digit/);
  });
});
