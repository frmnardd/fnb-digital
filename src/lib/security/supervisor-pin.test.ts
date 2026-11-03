import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { hashPin } from "./pin";
import { isValidSupervisorPin, verifySupervisorPin } from "./supervisor-pin";

const originalSecret = process.env.SESSION_SECRET;

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret-0123456789abcdefghijklmnop";
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = originalSecret;
  }
});

describe("isValidSupervisorPin", () => {
  it("menerima tepat 6 digit angka", () => {
    assert.equal(isValidSupervisorPin("123456"), true);
    assert.equal(isValidSupervisorPin("000000"), true);
  });

  it("menolak panjang atau karakter lain", () => {
    assert.equal(isValidSupervisorPin("1234"), false);
    assert.equal(isValidSupervisorPin("1234567"), false);
    assert.equal(isValidSupervisorPin("12345a"), false);
    assert.equal(isValidSupervisorPin(""), false);
  });
});

describe("verifySupervisorPin", () => {
  it("menerima PIN yang cocok dengan hash staf", () => {
    const hash = hashPin("222222");
    assert.equal(verifySupervisorPin("222222", hash), true);
  });

  it("menolak PIN salah", () => {
    const hash = hashPin("222222");
    assert.equal(verifySupervisorPin("111111", hash), false);
  });

  it("menolak format PIN yang tidak valid tanpa memanggil hashing", () => {
    const hash = hashPin("222222");
    assert.equal(verifySupervisorPin("2222", hash), false);
  });
});
