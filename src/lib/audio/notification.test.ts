import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { playNotificationTone, resetNotificationAudio, unlockAudioContext } from "./notification";

describe("notification audio di lingkungan tanpa browser", () => {
  it("unlockAudioContext mengembalikan false tanpa melempar", async () => {
    assert.equal(await unlockAudioContext(), false);
  });

  it("playNotificationTone mengembalikan false tanpa AudioContext", () => {
    assert.equal(playNotificationTone("new-order"), false);
    assert.equal(playNotificationTone("waiter-call"), false);
  });

  it("tidak melempar saat volume di luar rentang", () => {
    assert.equal(playNotificationTone("new-order", { volume: 5 }), false);
    assert.equal(playNotificationTone("new-order", { volume: -2 }), false);
  });

  it("resetNotificationAudio aman dipanggil walau konteks belum ada", () => {
    assert.doesNotThrow(() => resetNotificationAudio());
  });
});
