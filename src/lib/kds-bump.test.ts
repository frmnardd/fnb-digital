import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getTicketAgingLabel,
  isTicketReady,
  nextItemStatus,
  type KdsItemStatus,
} from "./kds";

describe("nextItemStatus", () => {
  it("memulai masak dari QUEUED", () => {
    assert.equal(nextItemStatus("QUEUED", "START_COOKING"), "COOKING");
    assert.equal(nextItemStatus("COOKING", "START_COOKING"), null);
    assert.equal(nextItemStatus("READY", "START_COOKING"), null);
  });

  it("menandai siap dari QUEUED atau COOKING", () => {
    assert.equal(nextItemStatus("QUEUED", "MARK_READY"), "READY");
    assert.equal(nextItemStatus("COOKING", "MARK_READY"), "READY");
    assert.equal(nextItemStatus("READY", "MARK_READY"), null);
  });

  it("mengembalikan status satu langkah (REVERT)", () => {
    assert.equal(nextItemStatus("COOKING", "REVERT"), "QUEUED");
    assert.equal(nextItemStatus("READY", "REVERT"), "COOKING");
    assert.equal(nextItemStatus("QUEUED", "REVERT"), null);
    assert.equal(nextItemStatus("SERVED", "REVERT"), null);
    assert.equal(nextItemStatus("VOIDED", "REVERT"), null);
  });
});

describe("isTicketReady", () => {
  it("true bila semua item aktif READY/SERVED", () => {
    assert.equal(isTicketReady(["READY", "READY"]), true);
    assert.equal(isTicketReady(["READY", "SERVED"]), true);
  });

  it("false bila masih ada item QUEUED/COOKING", () => {
    assert.equal(isTicketReady(["READY", "COOKING"]), false);
    assert.equal(isTicketReady(["QUEUED"]), false);
  });

  it("mengabaikan item VOIDED", () => {
    assert.equal(isTicketReady(["READY", "VOIDED"]), true);
    assert.equal(isTicketReady(["VOIDED", "VOIDED"]), false);
  });

  it("false untuk daftar kosong", () => {
    assert.equal(isTicketReady([]), false);
  });
});

describe("getTicketAgingLabel", () => {
  it("menampilkan menit untuk < 1 jam", () => {
    const statuses: KdsItemStatus[] = [];
    assert.equal(statuses.length, 0);
    assert.equal(getTicketAgingLabel(0), "0 mnt");
    assert.equal(getTicketAgingLabel(12), "12 mnt");
    assert.equal(getTicketAgingLabel(59), "59 mnt");
  });

  it("menampilkan jam & menit setelah 1 jam", () => {
    assert.equal(getTicketAgingLabel(60), "1 j 00 mnt");
    assert.equal(getTicketAgingLabel(65), "1 j 05 mnt");
    assert.equal(getTicketAgingLabel(125), "2 j 05 mnt");
  });

  it("aman untuk nilai negatif", () => {
    assert.equal(getTicketAgingLabel(-5), "0 mnt");
  });
});
