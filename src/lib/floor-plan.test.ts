import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatSeatedDuration,
  getFloorPlanSummary,
  TABLE_STATUS_META,
  type TableStatusKey,
} from "./floor-plan";

describe("TABLE_STATUS_META", () => {
  it("menyediakan label & kelas untuk ketiga status", () => {
    const statuses: TableStatusKey[] = ["AVAILABLE", "OCCUPIED", "NEEDS_CLEANING"];

    for (const status of statuses) {
      assert.ok(TABLE_STATUS_META[status].label.length > 0);
      assert.ok(TABLE_STATUS_META[status].cardClass.length > 0);
      assert.ok(TABLE_STATUS_META[status].badgeClass.length > 0);
    }

    assert.equal(TABLE_STATUS_META.OCCUPIED.label, "Terisi");
    assert.equal(TABLE_STATUS_META.NEEDS_CLEANING.label, "Perlu Dibersihkan");
  });
});

describe("formatSeatedDuration", () => {
  const now = new Date("2026-11-03T10:00:00.000Z");

  it("menampilkan menit untuk durasi < 1 jam", () => {
    assert.equal(formatSeatedDuration(new Date("2026-11-03T10:00:00.000Z"), now), "0 mnt");
    assert.equal(formatSeatedDuration(new Date("2026-11-03T09:59:00.000Z"), now), "1 mnt");
    assert.equal(formatSeatedDuration(new Date("2026-11-03T09:01:00.000Z"), now), "59 mnt");
  });

  it("menampilkan jam & menit setelah 1 jam", () => {
    assert.equal(formatSeatedDuration(new Date("2026-11-03T09:00:00.000Z"), now), "1 j 00 mnt");
    assert.equal(formatSeatedDuration(new Date("2026-11-03T08:55:00.000Z"), now), "1 j 05 mnt");
    assert.equal(formatSeatedDuration(new Date("2026-11-03T06:30:00.000Z"), now), "3 j 30 mnt");
  });

  it("membulatkan ke bawah (detik diabaikan)", () => {
    assert.equal(formatSeatedDuration(new Date("2026-11-03T09:58:59.000Z"), now), "1 mnt");
  });

  it("aman untuk durasi negatif (clock skew)", () => {
    assert.equal(formatSeatedDuration(new Date("2026-11-03T10:05:00.000Z"), now), "0 mnt");
  });
});

describe("getFloorPlanSummary", () => {
  it("menghitung jumlah meja per status", () => {
    const summary = getFloorPlanSummary([
      { status: "AVAILABLE" },
      { status: "AVAILABLE" },
      { status: "OCCUPIED" },
      { status: "NEEDS_CLEANING" },
    ]);

    assert.deepEqual(summary, { available: 2, occupied: 1, cleaning: 1, total: 4 });
  });

  it("mengembalikan nol untuk daftar kosong", () => {
    assert.deepEqual(getFloorPlanSummary([]), {
      available: 0,
      occupied: 0,
      cleaning: 0,
      total: 0,
    });
  });
});
