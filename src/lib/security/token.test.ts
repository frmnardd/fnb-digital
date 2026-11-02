import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { generateTableSessionToken, hashSessionToken, verifySessionToken } from "./token";

const VALID_SECRET = "unit-test-secret-0123456789abcdefghijklmnop";
const originalSecret = process.env.SESSION_SECRET;

beforeEach(() => {
  process.env.SESSION_SECRET = VALID_SECRET;
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = originalSecret;
  }
});

describe("generateTableSessionToken", () => {
  it("menghasilkan 64 karakter hex", () => {
    const token = generateTableSessionToken();
    assert.match(token, /^[0-9a-f]{64}$/);
  });

  it("selalu berbeda antar pemanggilan", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateTableSessionToken()));
    assert.equal(tokens.size, 50);
  });
});

describe("hashSessionToken", () => {
  it("deterministik dan berupa 64 karakter hex", () => {
    const token = generateTableSessionToken();
    const first = hashSessionToken(token);
    const second = hashSessionToken(token);

    assert.equal(first, second);
    assert.match(first, /^[0-9a-f]{64}$/);
  });

  it("berbeda untuk token berbeda", () => {
    assert.notEqual(hashSessionToken("a".repeat(64)), hashSessionToken("b".repeat(64)));
  });

  it("melempar error bila SESSION_SECRET tidak memenuhi syarat", () => {
    delete process.env.SESSION_SECRET;
    assert.throws(() => hashSessionToken(generateTableSessionToken()), /SESSION_SECRET/);

    process.env.SESSION_SECRET = "terlalu-pendek";
    assert.throws(() => hashSessionToken(generateTableSessionToken()), /SESSION_SECRET/);
  });
});

describe("verifySessionToken", () => {
  it("menerima token yang cocok", () => {
    const token = generateTableSessionToken();
    assert.equal(verifySessionToken(token, hashSessionToken(token)), true);
  });

  it("menolak token yang tidak cocok", () => {
    const token = generateTableSessionToken();
    const other = generateTableSessionToken();
    assert.equal(verifySessionToken(other, hashSessionToken(token)), false);
  });

  it("menolak input dengan format tidak valid tanpa melempar error", () => {
    const hash = hashSessionToken(generateTableSessionToken());
    assert.equal(verifySessionToken("", hash), false);
    assert.equal(verifySessionToken("bukan-hex", hash), false);
    assert.equal(verifySessionToken(generateTableSessionToken(), "short"), false);
    assert.equal(verifySessionToken(generateTableSessionToken(), "z".repeat(64)), false);
  });
});
