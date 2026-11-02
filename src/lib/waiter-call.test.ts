import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CALL_WAITER_COOLDOWN_MS,
  CALL_WAITER_COOLDOWN_SECONDS,
  evaluateCallWaiterLimit,
  WAITER_CALL_TYPES,
} from "./waiter-call";

const NOW = new Date("2026-11-03T05:00:00.000Z");

function atOffsetMs(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

describe("konstanta call waiter", () => {
  it("memakai cooldown 2 menit", () => {
    assert.equal(CALL_WAITER_COOLDOWN_MS, 120_000);
    assert.equal(CALL_WAITER_COOLDOWN_SECONDS, 120);
  });

  it("mendukung empat jenis panggilan", () => {
    assert.deepEqual(
      [...WAITER_CALL_TYPES],
      ["WATER_TISSUE", "CLEAN_TABLE", "ASK_MENU", "REQUEST_BILL"],
    );
  });
});

describe("evaluateCallWaiterLimit", () => {
  it("mengizinkan bila meja belum pernah memanggil", () => {
    assert.deepEqual(evaluateCallWaiterLimit(null, NOW), {
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("mengizinkan tepat saat cooldown berakhir", () => {
    const lastCallAt = atOffsetMs(-CALL_WAITER_COOLDOWN_MS);
    assert.deepEqual(evaluateCallWaiterLimit(lastCallAt, NOW), {
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("menolak 1 ms sebelum cooldown berakhir", () => {
    const lastCallAt = atOffsetMs(-(CALL_WAITER_COOLDOWN_MS - 1));
    const result = evaluateCallWaiterLimit(lastCallAt, NOW);

    assert.equal(result.allowed, false);
    assert.equal(result.retryAfterSeconds, 1);
  });

  it("menghitung sisa waktu pemanggilan 30 detik lalu", () => {
    const result = evaluateCallWaiterLimit(atOffsetMs(-30_000), NOW);

    assert.equal(result.allowed, false);
    assert.equal(result.retryAfterSeconds, 90);
  });

  it("membulatkan sisa waktu ke atas", () => {
    // 118.5 detik lalu -> sisa 1.5 detik -> 2 detik
    const result = evaluateCallWaiterLimit(atOffsetMs(-118_500), NOW);
    assert.equal(result.retryAfterSeconds, 2);
  });

  it("menolak bila waktu panggilan terakhir berada di masa depan (clock skew)", () => {
    const result = evaluateCallWaiterLimit(atOffsetMs(60_000), NOW);

    assert.equal(result.allowed, false);
    assert.equal(result.retryAfterSeconds, CALL_WAITER_COOLDOWN_SECONDS + 60);
  });

  it("mendukung cooldown kustom", () => {
    const result = evaluateCallWaiterLimit(atOffsetMs(-10_000), NOW, 5_000);
    assert.deepEqual(result, { allowed: true, retryAfterSeconds: 0 });
  });
});
