import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasStaffRole,
  signStaffSession,
  STAFF_SESSION_TTL_SECONDS,
  verifyStaffSession,
} from "./session";

const SECRET = "unit-test-secret-0123456789abcdefghijklmnop";
const NOW = 1_700_000_000_000;

describe("signStaffSession", () => {
  it("membuat token dua bagian dengan payload benar", async () => {
    const { token, payload } = await signStaffSession(
      { staffId: "staff-1", role: "CASHIER", name: "Rina", now: NOW },
      SECRET,
    );

    assert.equal(token.split(".").length, 2);
    assert.equal(payload.sub, "staff-1");
    assert.equal(payload.role, "CASHIER");
    assert.equal(payload.exp, Math.floor(NOW / 1000) + STAFF_SESSION_TTL_SECONDS);
  });

  it("menolak secret terlalu pendek", async () => {
    await assert.rejects(
      () => signStaffSession({ staffId: "s", role: "ADMIN", name: "A" }, "pendek"),
      /minimal 32 karakter/,
    );
  });
});

describe("verifyStaffSession", () => {
  it("menerima token valid", async () => {
    const { token, payload } = await signStaffSession(
      { staffId: "staff-1", role: "ADMIN", name: "Budi", now: NOW },
      SECRET,
    );

    const result = await verifyStaffSession(token, SECRET, NOW + 1000);
    assert.deepEqual(result, payload);
  });

  it("menolak token kedaluwarsa", async () => {
    const { token } = await signStaffSession(
      { staffId: "staff-1", role: "WAITER", name: "Sari", ttlSeconds: 60, now: NOW },
      SECRET,
    );

    assert.equal(await verifyStaffSession(token, SECRET, NOW + 61_000), null);
  });

  it("menolak signature yang dipalsukan", async () => {
    const { token } = await signStaffSession(
      { staffId: "staff-1", role: "ADMIN", name: "Budi", now: NOW },
      SECRET,
    );
    const [data] = token.split(".");
    const forged = `${data}.${btoa("palsu")}`;

    assert.equal(await verifyStaffSession(forged, SECRET, NOW), null);
  });

  it("menolak token yang ditandatangani secret lain", async () => {
    const { token } = await signStaffSession(
      { staffId: "staff-1", role: "ADMIN", name: "Budi", now: NOW },
      SECRET,
    );

    assert.equal(
      await verifyStaffSession(token, "secret-lain-yang-juga-cukup-panjang-123456", NOW),
      null,
    );
  });

  it("menolak payload yang diubah tanpa signature baru", async () => {
    const { token } = await signStaffSession(
      { staffId: "staff-1", role: "CASHIER", name: "Rina", now: NOW },
      SECRET,
    );
    const [, signature] = token.split(".");
    const tampered = btoa(
      JSON.stringify({
        sub: "staff-1",
        role: "ADMIN",
        name: "Rina",
        exp: Math.floor(NOW / 1000) + 9_999,
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    assert.equal(await verifyStaffSession(`${tampered}.${signature}`, SECRET, NOW), null);
  });

  it("menolak token rusak / kosong", async () => {
    for (const value of ["", "abc", "a.b.c", "."]) {
      assert.equal(await verifyStaffSession(value, SECRET, NOW), null);
    }
  });

  it("menolak bila secret tidak memenuhi panjang minimum", async () => {
    const { token } = await signStaffSession(
      { staffId: "staff-1", role: "ADMIN", name: "Budi", now: NOW },
      SECRET,
    );

    assert.equal(await verifyStaffSession(token, "pendek", NOW), null);
  });
});

describe("hasStaffRole", () => {
  it("mengizinkan semua staf bila daftar peran kosong", () => {
    assert.equal(hasStaffRole({ role: "WAITER" }), true);
    assert.equal(hasStaffRole({ role: "WAITER" }, []), true);
  });

  it("membatasi sesuai daftar peran", () => {
    assert.equal(hasStaffRole({ role: "ADMIN" }, ["ADMIN"]), true);
    assert.equal(hasStaffRole({ role: "KITCHEN" }, ["ADMIN", "CASHIER"]), false);
  });
});
