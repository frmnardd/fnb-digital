import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  clearAllPinAttempts,
  isPinLocked,
  PIN_ATTEMPT_WINDOW_MS,
  PIN_MAX_ATTEMPTS,
  registerPinAttempt,
  resetPinAttempts,
} from "./pin-attempts";

const KEY = "ORD-0001:127.0.0.1";
const START = 1_700_000_000_000;

beforeEach(() => {
  clearAllPinAttempts();
});

describe("registerPinAttempt", () => {
  it("mengurangi sisa percobaan setiap kali gagal", () => {
    const first = registerPinAttempt(KEY, START);
    assert.equal(first.locked, false);
    assert.equal(first.remainingAttempts, PIN_MAX_ATTEMPTS - 1);

    const second = registerPinAttempt(KEY, START + 1000);
    assert.equal(second.remainingAttempts, PIN_MAX_ATTEMPTS - 2);
  });

  it("mengunci setelah jumlah percobaan maksimum", () => {
    let state = registerPinAttempt(KEY, START);

    for (let attempt = 1; attempt < PIN_MAX_ATTEMPTS; attempt += 1) {
      state = registerPinAttempt(KEY, START + attempt * 1000);
    }

    assert.equal(state.locked, true);
    assert.equal(state.remainingAttempts, 0);
    assert.ok(state.retryAfterSeconds > 0);
    assert.equal(isPinLocked(KEY, START + 6000), true);
  });

  it("membuka kunci setelah jendela waktu lewat", () => {
    for (let attempt = 0; attempt < PIN_MAX_ATTEMPTS; attempt += 1) {
      registerPinAttempt(KEY, START + attempt);
    }

    assert.equal(isPinLocked(KEY, START + 1000), true);
    assert.equal(isPinLocked(KEY, START + PIN_ATTEMPT_WINDOW_MS + 1), false);

    const afterWindow = registerPinAttempt(KEY, START + PIN_ATTEMPT_WINDOW_MS + 2);
    assert.equal(afterWindow.locked, false);
    assert.equal(afterWindow.remainingAttempts, PIN_MAX_ATTEMPTS - 1);
  });

  it("mengunci per kunci (pesanan + klien) secara terpisah", () => {
    for (let attempt = 0; attempt < PIN_MAX_ATTEMPTS; attempt += 1) {
      registerPinAttempt(KEY, START + attempt);
    }

    assert.equal(isPinLocked(KEY, START + 10), true);
    assert.equal(isPinLocked("ORD-0002:127.0.0.1", START + 10), false);
  });
});

describe("resetPinAttempts", () => {
  it("menghapus riwayat setelah PIN benar", () => {
    registerPinAttempt(KEY, START);
    registerPinAttempt(KEY, START + 1);

    resetPinAttempts(KEY);

    assert.equal(isPinLocked(KEY, START + 2), false);
    assert.equal(registerPinAttempt(KEY, START + 3).remainingAttempts, PIN_MAX_ATTEMPTS - 1);
  });
});

describe("isPinLocked", () => {
  it("mengembalikan false untuk kunci yang belum pernah dicoba", () => {
    assert.equal(isPinLocked("belum-pernah"), false);
  });
});
