import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  AUTHORIZATION_TTL_MS,
  createAuthorizationToken,
  SUPERVISOR_ACTIONS,
  verifyAuthorizationToken,
} from "./authorization-token";

const originalSecret = process.env.SESSION_SECRET;
const NOW = 1_700_000_000_000;

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

describe("createAuthorizationToken", () => {
  it("membentuk token dua bagian dengan payload lengkap", () => {
    const { token, payload } = createAuthorizationToken({
      staffId: "staff-1",
      action: "VOID_ITEM",
      targetId: "item-9",
      now: NOW,
    });

    assert.equal(token.split(".").length, 2);
    assert.deepEqual(payload, {
      sub: "staff-1",
      act: "VOID_ITEM",
      tid: "item-9",
      iat: NOW,
      exp: NOW + AUTHORIZATION_TTL_MS,
    });
  });

  it("mendukung seluruh aksi supervisor", () => {
    for (const action of SUPERVISOR_ACTIONS) {
      const { token } = createAuthorizationToken({ staffId: "s", action, now: NOW });
      const result = verifyAuthorizationToken(token, NOW);

      assert.equal(result.valid, true);
    }
  });
});

describe("verifyAuthorizationToken", () => {
  it("menerima token yang valid", () => {
    const { token, payload } = createAuthorizationToken({
      staffId: "staff-1",
      action: "REFUND",
      now: NOW,
    });

    const result = verifyAuthorizationToken(token, NOW + 1000);

    assert.equal(result.valid, true);
    if (result.valid) {
      assert.deepEqual(result.payload, payload);
    }
  });

  it("menolak token kedaluwarsa", () => {
    const { token } = createAuthorizationToken({
      staffId: "staff-1",
      action: "MANUAL_DISCOUNT",
      ttlMs: 1000,
      now: NOW,
    });

    const result = verifyAuthorizationToken(token, NOW + 2000);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.reason, "EXPIRED");
    }
  });

  it("menolak signature yang dipalsukan", () => {
    const { token } = createAuthorizationToken({ staffId: "staff-1", action: "REFUND", now: NOW });
    const [data] = token.split(".");
    const forged = `${data}.${Buffer.from("palsu").toString("base64url")}`;

    const result = verifyAuthorizationToken(forged, NOW);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.reason, "BAD_SIGNATURE");
    }
  });

  it("menolak payload yang diubah tanpa signature baru", () => {
    const { token } = createAuthorizationToken({ staffId: "staff-1", action: "REFUND", now: NOW });
    const [, signature] = token.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ sub: "staff-1", act: "REFUND", tid: null, iat: NOW, exp: NOW + 9_999_999 }),
      "utf8",
    ).toString("base64url");

    const result = verifyAuthorizationToken(`${tampered}.${signature}`, NOW);
    assert.equal(result.valid, false);
  });

  it("menolak token rusak", () => {
    for (const value of ["", "abc", "a.b.c", "hanya-payload"]) {
      const result = verifyAuthorizationToken(value, NOW);
      assert.equal(result.valid, false);
    }
  });

  it("menolak payload dengan aksi tak dikenal", () => {
    const { token } = createAuthorizationToken({ staffId: "staff-1", action: "REFUND", now: NOW });
    const [data, signature] = token.split(".");
    const payload = JSON.parse(Buffer.from(data ?? "", "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    payload.act = "HACK";

    const tampered = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const result = verifyAuthorizationToken(`${tampered}.${signature}`, NOW);

    // Signature tidak cocok karena payload berubah → ditolak lebih awal.
    assert.equal(result.valid, false);
  });
});
