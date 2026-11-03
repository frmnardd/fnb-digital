import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getTrackerState,
  mapOrderStatusToStep,
  TRACKER_STEPS,
  type ItemStatusKey,
  type OrderStatusKey,
} from "./order-tracking";

const noItems: ItemStatusKey[] = [];

describe("TRACKER_STEPS", () => {
  it("memiliki empat tahapan sesuai label pelanggan", () => {
    assert.deepEqual(
      TRACKER_STEPS.map((step) => step.label),
      ["Diterima", "Dimasak", "Siap Diantar", "Selesai"],
    );
  });
});

describe("mapOrderStatusToStep", () => {
  it("memetakan seluruh status order", () => {
    assert.equal(mapOrderStatusToStep("PENDING_PAYMENT"), "RECEIVED");
    assert.equal(mapOrderStatusToStep("WAITING_CASHIER_APPROVAL"), "RECEIVED");
    assert.equal(mapOrderStatusToStep("CONFIRMED"), "RECEIVED");
    assert.equal(mapOrderStatusToStep("PREPARING"), "COOKING");
    assert.equal(mapOrderStatusToStep("READY"), "READY");
    assert.equal(mapOrderStatusToStep("SERVED"), "SERVED");
    assert.equal(mapOrderStatusToStep("COMPLETED"), "SERVED");
    assert.equal(mapOrderStatusToStep("CANCELLED"), null);
  });
});

describe("getTrackerState — status order", () => {
  it("menunggu pembayaran ditandai isWaitingPayment", () => {
    const state = getTrackerState({ status: "PENDING_PAYMENT", itemStatuses: noItems });

    assert.equal(state.currentStep, "RECEIVED");
    assert.equal(state.isWaitingPayment, true);
    assert.equal(state.steps[0]?.state, "current");
    assert.equal(state.progressPercent, 0);
  });

  it("status CONFIRMED tetap di tahap Diterima", () => {
    const state = getTrackerState({ status: "CONFIRMED", itemStatuses: noItems });
    assert.equal(state.currentStep, "RECEIVED");
    assert.equal(state.isWaitingPayment, false);
  });

  it("PREPARING → Dimasak, READY → Siap Diantar", () => {
    assert.equal(
      getTrackerState({ status: "PREPARING", itemStatuses: noItems }).currentStep,
      "COOKING",
    );
    assert.equal(getTrackerState({ status: "READY", itemStatuses: noItems }).currentStep, "READY");
  });

  it("SERVED menandai tahap terakhir sebagai current", () => {
    const state = getTrackerState({ status: "SERVED", itemStatuses: noItems });

    assert.equal(state.currentStep, "SERVED");
    assert.equal(state.progressPercent, 100);
    assert.equal(state.steps[3]?.state, "current");
  });

  it("COMPLETED menandai seluruh tahap selesai", () => {
    const state = getTrackerState({ status: "COMPLETED", itemStatuses: noItems });

    assert.equal(state.progressPercent, 100);
    assert.ok(state.steps.every((step) => step.state === "done"));
  });

  it("CANCELLED tidak menampilkan progres", () => {
    const state = getTrackerState({ status: "CANCELLED", itemStatuses: noItems });

    assert.equal(state.isCancelled, true);
    assert.equal(state.currentStep, null);
    assert.equal(state.progressPercent, 0);
    assert.ok(state.steps.every((step) => step.state === "todo"));
  });
});

describe("getTrackerState — status item", () => {
  it("mendorong maju saat semua item READY walau order masih CONFIRMED", () => {
    const state = getTrackerState({
      status: "CONFIRMED",
      itemStatuses: ["READY", "READY"],
    });

    assert.equal(state.currentStep, "READY");
    assert.equal(state.steps[0]?.state, "done");
    assert.equal(state.steps[1]?.state, "done");
  });

  it("tidak mundur saat order lebih maju daripada item", () => {
    const state = getTrackerState({
      status: "READY",
      itemStatuses: ["QUEUED"],
    });

    assert.equal(state.currentStep, "READY");
  });

  it("mengabaikan item VOIDED", () => {
    const state = getTrackerState({
      status: "PREPARING",
      itemStatuses: ["VOIDED", "COOKING"],
    });

    assert.equal(state.currentStep, "COOKING");
  });

  it("semua item VOIDED kembali ke tahap Diterima", () => {
    const state = getTrackerState({
      status: "CONFIRMED",
      itemStatuses: ["VOIDED"],
    });

    assert.equal(state.currentStep, "RECEIVED");
  });

  it("semua item SERVED menandai tahap selesai", () => {
    const state = getTrackerState({
      status: "READY",
      itemStatuses: ["SERVED", "SERVED"],
    });

    assert.equal(state.currentStep, "SERVED");
  });
});

describe("getTrackerState — kombinasi status order", () => {
  it("menghitung progress 0/33/67/100", () => {
    const statuses: Array<[OrderStatusKey, number]> = [
      ["CONFIRMED", 0],
      ["PREPARING", 33],
      ["READY", 67],
      ["SERVED", 100],
    ];

    for (const [status, expected] of statuses) {
      assert.equal(getTrackerState({ status, itemStatuses: noItems }).progressPercent, expected);
    }
  });
});
