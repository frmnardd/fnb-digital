import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getRestaurantMinutes,
  isMenuItemOrderable,
  isWithinSchedule,
  parseTimeToMinutes,
} from "./menu";

describe("parseTimeToMinutes", () => {
  it("mengubah HH:mm menjadi menit", () => {
    assert.equal(parseTimeToMinutes("00:00"), 0);
    assert.equal(parseTimeToMinutes("10:30"), 630);
    assert.equal(parseTimeToMinutes("23:59"), 1439);
  });

  it("mengembalikan null untuk input kosong atau tidak valid", () => {
    assert.equal(parseTimeToMinutes(null), null);
    assert.equal(parseTimeToMinutes(undefined), null);
    assert.equal(parseTimeToMinutes(""), null);
    assert.equal(parseTimeToMinutes("24:00"), null);
    assert.equal(parseTimeToMinutes("9:00"), null);
    assert.equal(parseTimeToMinutes("10:75"), null);
    assert.equal(parseTimeToMinutes("pagi"), null);
  });
});

describe("getRestaurantMinutes", () => {
  it("menggunakan zona waktu restoran (Asia/Jakarta = UTC+7)", () => {
    const now = new Date("2026-11-03T05:00:00.000Z"); // 12:00 WIB
    assert.equal(getRestaurantMinutes(now, "Asia/Jakarta"), 12 * 60);
    assert.equal(getRestaurantMinutes(now, "UTC"), 5 * 60);
  });

  it("mengembalikan 0 pada tengah malam (bukan 1440)", () => {
    const midnight = new Date("2026-11-03T17:00:00.000Z"); // 00:00 WIB keesokan hari
    assert.equal(getRestaurantMinutes(midnight, "Asia/Jakarta"), 0);
  });
});

describe("isWithinSchedule", () => {
  it("selalu tayang bila jadwal kosong", () => {
    assert.equal(isWithinSchedule(null, null, 600), true);
    assert.equal(isWithinSchedule(undefined, undefined, 0), true);
  });

  it("menerapkan jadwal normal dengan jam akhir eksklusif", () => {
    const from = "10:00";
    const until = "22:00";

    assert.equal(isWithinSchedule(from, until, 9 * 60 + 59), false);
    assert.equal(isWithinSchedule(from, until, 10 * 60), true);
    assert.equal(isWithinSchedule(from, until, 21 * 60 + 59), true);
    assert.equal(isWithinSchedule(from, until, 22 * 60), false);
  });

  it("mendukung jadwal melewati tengah malam (22:00–02:00)", () => {
    const from = "22:00";
    const until = "02:00";

    assert.equal(isWithinSchedule(from, until, 22 * 60), true);
    assert.equal(isWithinSchedule(from, until, 23 * 60 + 30), true);
    assert.equal(isWithinSchedule(from, until, 1 * 60 + 59), true);
    assert.equal(isWithinSchedule(from, until, 2 * 60), false);
    assert.equal(isWithinSchedule(from, until, 3 * 60), false);
  });

  it("mendukung hanya batas mulai atau hanya batas selesai", () => {
    assert.equal(isWithinSchedule("08:00", null, 7 * 60 + 59), false);
    assert.equal(isWithinSchedule("08:00", null, 8 * 60), true);

    assert.equal(isWithinSchedule(null, "17:00", 16 * 60), true);
    assert.equal(isWithinSchedule(null, "17:00", 17 * 60), false);
  });

  it("memperlakukan jam tidak valid sebagai tanpa jadwal", () => {
    assert.equal(isWithinSchedule("bukan-jam", "juga-salah", 600), true);
  });

  it("menormalkan menit di luar 0–1439", () => {
    assert.equal(isWithinSchedule("10:00", "22:00", 24 * 60 + 12 * 60), true);
    assert.equal(isWithinSchedule("10:00", "22:00", -12 * 60), true);
  });
});

describe("isMenuItemOrderable", () => {
  const noonWib = new Date("2026-11-03T05:00:00.000Z"); // 12:00 WIB

  it("menolak menu yang ditandai habis (86'd)", () => {
    assert.equal(isMenuItemOrderable({ isAvailable: false, now: noonWib }), false);
  });

  it("menerima menu tersedia tanpa jadwal", () => {
    assert.equal(isMenuItemOrderable({ isAvailable: true, now: noonWib }), true);
  });

  it("menerapkan jam tayang terhadap waktu restoran", () => {
    assert.equal(
      isMenuItemOrderable({
        isAvailable: true,
        availableFrom: "11:00",
        availableUntil: "14:00",
        now: noonWib,
      }),
      true,
    );

    assert.equal(
      isMenuItemOrderable({
        isAvailable: true,
        availableFrom: "18:00",
        availableUntil: "22:00",
        now: noonWib,
      }),
      false,
    );
  });
});
