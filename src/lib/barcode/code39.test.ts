import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CODE39_PATTERNS,
  Code39Error,
  encodeCode39,
  isEncodableCode39,
  normalizeCode39,
  toBars,
} from "./code39";

describe("CODE39_PATTERNS", () => {
  it("setiap pola terdiri dari 9 elemen dengan tepat 3 elemen lebar", () => {
    for (const [character, pattern] of Object.entries(CODE39_PATTERNS)) {
      assert.equal(pattern.length, 9, `pola ${character} harus 9 elemen`);
      assert.equal(
        [...pattern].filter((element) => element === "1").length,
        3,
        `pola ${character} harus memiliki 3 elemen lebar`,
      );
      assert.match(pattern, /^[01]{9}$/);
    }
  });

  it("menyediakan start/stop dan karakter umum", () => {
    for (const character of ["*", "0", "9", "A", "Z", "-", ".", " ", "$", "/", "+", "%"]) {
      assert.ok(character in CODE39_PATTERNS, `pola ${character} harus ada`);
    }
  });

  it("setiap karakter memiliki pola unik", () => {
    const patterns = Object.values(CODE39_PATTERNS);
    assert.equal(new Set(patterns).size, patterns.length);
  });
});

describe("normalizeCode39", () => {
  it("mengubah ke huruf besar", () => {
    assert.equal(normalizeCode39("ord-0001"), "ORD-0001");
  });
});

describe("isEncodableCode39", () => {
  it("menerima huruf, angka, dan tanda hubung", () => {
    assert.equal(isEncodableCode39("ORD-0001"), true);
    assert.equal(isEncodableCode39("abc 123"), true);
  });

  it("menolak teks kosong dan karakter asing", () => {
    assert.equal(isEncodableCode39(""), false);
    assert.equal(isEncodableCode39("ORD_0001"), false);
    assert.equal(isEncodableCode39("PESANAN#1"), false);
  });
});

describe("encodeCode39", () => {
  it("menghasilkan panjang modul yang benar (10 karakter × 15 modul + 9 gap)", () => {
    assert.equal(encodeCode39("ORD-0001").length, 10 * 15 + 9);
  });

  it("selalu diawali dan diakhiri pola start/stop", () => {
    const binary = encodeCode39("A");
    const expectedStart = encodeCode39("A").slice(0, 15);

    assert.equal(binary.slice(0, 15), expectedStart);
    assert.equal(binary.slice(-15), expectedStart);
  });

  it("menormalisasi huruf kecil", () => {
    assert.equal(encodeCode39("ord-0001"), encodeCode39("ORD-0001"));
  });

  it("menolak teks yang tidak dapat di-encode", () => {
    assert.throws(() => encodeCode39("ORD_1"), Code39Error);
    assert.throws(() => encodeCode39(""), Code39Error);
  });

  it("hanya berisi karakter biner", () => {
    assert.match(encodeCode39("ORD-0001"), /^[01]+$/);
  });
});

describe("toBars", () => {
  it("mengubah modul 1 menjadi bar dengan posisi & lebar", () => {
    assert.deepEqual(toBars("1110011"), [
      { x: 0, width: 3 },
      { x: 5, width: 2 },
    ]);
  });

  it("mengabaikan spasi di awal dan antar bar", () => {
    assert.deepEqual(toBars("011010"), [
      { x: 1, width: 2 },
      { x: 4, width: 1 },
    ]);
  });

  it("menghasilkan bar untuk barcode pesanan", () => {
    const bars = toBars(encodeCode39("ORD-0001"));
    assert.ok(bars.length > 20);
    assert.ok(bars.every((bar) => bar.width >= 1 && bar.width <= 3));
  });
});
