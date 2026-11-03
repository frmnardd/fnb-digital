import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDynamicQris,
  buildStaticQris,
  createDemoStaticPayload,
  crc16Ccitt,
  encodeTlv,
  parseTlv,
  QrisError,
  validateQrisPayload,
} from "./qris";

const STATIC_FIELDS = [
  { tag: "00", value: "01" },
  { tag: "01", value: "11" },
  { tag: "02", value: "936009140000000000" },
  { tag: "52", value: "5814" },
  { tag: "53", value: "360" },
  { tag: "58", value: "ID" },
  { tag: "59", value: "TOKO KOPI NUSANTARA" },
  { tag: "60", value: "BANDUNG" },
  { tag: "61", value: "40115" },
];

const staticPayload = buildStaticQris(STATIC_FIELDS);

describe("crc16Ccitt", () => {
  it("sesuai vector uji standar CRC-16/CCITT-FALSE", () => {
    assert.equal(crc16Ccitt("123456789"), "29B1");
  });

  it("mengembalikan 4 digit hex", () => {
    assert.match(crc16Ccitt(""), /^[0-9A-F]{4}$/);
  });
});

describe("encodeTlv & parseTlv", () => {
  it("round-trip TLV", () => {
    const payload = encodeTlv("59", "TOKO") + encodeTlv("60", "BANDUNG");
    assert.deepEqual(parseTlv(payload), [
      { tag: "59", value: "TOKO" },
      { tag: "60", value: "BANDUNG" },
    ]);
  });

  it("menolak tag bukan 2 digit", () => {
    assert.throws(() => encodeTlv("5", "X"), QrisError);
  });

  it("berhenti pada byte rusak tanpa melempar", () => {
    const fields = parseTlv("000201" + "ZZ" + "01");
    assert.equal(fields.length, 1);
    assert.equal(fields[0]?.tag, "00");
  });
});

describe("buildStaticQris", () => {
  it("menghasilkan payload dengan CRC yang valid", () => {
    assert.equal(validateQrisPayload(staticPayload).valid, true);
  });

  it("menandai payload statis dengan tag 01 = 11", () => {
    const fields = new Map(parseTlv(staticPayload).map((field) => [field.tag, field.value]));
    assert.equal(fields.get("01"), "11");
  });
});

describe("buildDynamicQris", () => {
  it("menyisipkan nominal pada tag 54 dan menandai dinamis", () => {
    const dynamic = buildDynamicQris({ staticPayload, amount: 140910, merchantRef: "ORD-0001" });
    const fields = new Map(parseTlv(dynamic).map((field) => [field.tag, field.value]));

    assert.equal(fields.get("54"), "140910");
    assert.equal(fields.get("01"), "12");
    assert.equal(validateQrisPayload(dynamic).valid, true);
  });

  it("menambahkan reference label 05 pada tag 62", () => {
    const dynamic = buildDynamicQris({ staticPayload, amount: 50000, merchantRef: "ORD-0042" });
    const fields = new Map(parseTlv(dynamic).map((field) => [field.tag, field.value]));
    const inner = parseTlv(fields.get("62") ?? "");
    const ref = inner.find((field) => field.tag === "05");

    assert.equal(ref?.value, "ORD-0042");
  });

  it("mengganti nominal lama bila payload sudah dinamis", () => {
    const first = buildDynamicQris({ staticPayload, amount: 25000, merchantRef: "ORD-0001" });
    const second = buildDynamicQris({ staticPayload: first, amount: 99000, merchantRef: "ORD-0002" });

    const fields = new Map(parseTlv(second).map((field) => [field.tag, field.value]));
    assert.equal(fields.get("54"), "99000");
    assert.equal(validateQrisPayload(second).valid, true);
  });

  it("menolak nominal tidak valid", () => {
    assert.throws(() => buildDynamicQris({ staticPayload, amount: 0 }), QrisError);
    assert.throws(() => buildDynamicQris({ staticPayload, amount: 1000.5 }), QrisError);
  });

  it("menolak payload yang tidak memiliki tag wajib", () => {
    const broken = "000201" + "52045814";
    assert.throws(() => buildDynamicQris({ staticPayload: broken, amount: 1000 }), QrisError);
  });

  it("tidak mengubah payload asal", () => {
    const before = staticPayload;
    buildDynamicQris({ staticPayload, amount: 12345 });
    assert.equal(staticPayload, before);
  });
});

describe("validateQrisPayload", () => {
  it("mendeteksi CRC yang diubah", () => {
    const tampered = `${staticPayload.slice(0, -4)}0000`;
    const result = validateQrisPayload(tampered);

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes("CRC")));
  });

  it("mendeteksi tag wajib yang hilang", () => {
    const result = validateQrisPayload("0002016304ABCD");
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });
});

describe("createDemoStaticPayload", () => {
  it("menghasilkan payload demo yang valid", () => {
    assert.equal(validateQrisPayload(createDemoStaticPayload()).valid, true);
  });
});
