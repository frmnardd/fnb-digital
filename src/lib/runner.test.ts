import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getRunnerSummary,
  getWaiterCallLabel,
  groupReadyItemsByOrder,
  sortWaiterCalls,
  WAITER_CALL_LABELS,
  type ReadyItemInput,
  type WaiterCallLike,
} from "./runner";

function makeItem(overrides: Partial<ReadyItemInput> & { id: string; orderId: string }): ReadyItemInput {
  return {
    orderNumber: "ORD-0001",
    tableLabel: "07 - Indoor",
    menuName: "Nasi Goreng",
    quantity: 1,
    modifiers: [],
    station: "KITCHEN",
    readyAt: "2026-11-03T10:00:00.000Z",
    ...overrides,
  };
}

function makeCall(overrides: Partial<WaiterCallLike> & { id: string }): WaiterCallLike {
  return {
    type: "WATER_TISSUE",
    status: "PENDING",
    tableLabel: "07 - Indoor",
    createdAt: "2026-11-03T10:00:00.000Z",
    ...overrides,
  };
}

describe("WAITER_CALL_LABELS & getWaiterCallLabel", () => {
  it("menyediakan label ramah pelanggan", () => {
    assert.equal(WAITER_CALL_LABELS.WATER_TISSUE, "Air / Tisu");
    assert.equal(getWaiterCallLabel("REQUEST_BILL"), "Minta Bill");
  });

  it("mengembalikan tipe apa adanya bila tidak dikenal", () => {
    assert.equal(getWaiterCallLabel("UNKNOWN"), "UNKNOWN");
  });
});

describe("groupReadyItemsByOrder", () => {
  it("mengelompokkan item siap per pesanan", () => {
    const tickets = groupReadyItemsByOrder([
      makeItem({ id: "i1", orderId: "o1" }),
      makeItem({ id: "i2", orderId: "o1", menuName: "Es Teh" }),
      makeItem({ id: "i3", orderId: "o2", orderNumber: "ORD-0002" }),
    ]);

    assert.equal(tickets.length, 2);
    assert.equal(tickets[0]?.items.length, 2);
  });

  it("mengurutkan tiket berdasarkan waktu siap paling awal", () => {
    const tickets = groupReadyItemsByOrder([
      makeItem({ id: "i1", orderId: "late", readyAt: "2026-11-03T10:09:00.000Z" }),
      makeItem({ id: "i2", orderId: "early", readyAt: "2026-11-03T10:01:00.000Z" }),
    ]);

    assert.deepEqual(
      tickets.map((ticket) => ticket.orderId),
      ["early", "late"],
    );
  });

  it("memakai waktu siap paling awal di dalam tiket", () => {
    const tickets = groupReadyItemsByOrder([
      makeItem({ id: "i1", orderId: "o1", readyAt: "2026-11-03T10:05:00.000Z" }),
      makeItem({ id: "i2", orderId: "o1", readyAt: "2026-11-03T10:02:00.000Z" }),
    ]);

    assert.equal(tickets[0]?.readyAt, "2026-11-03T10:02:00.000Z");
  });

  it("mengembalikan daftar kosong untuk input kosong", () => {
    assert.deepEqual(groupReadyItemsByOrder([]), []);
  });
});

describe("sortWaiterCalls", () => {
  it("menempatkan PENDING lebih dulu, lalu ACKNOWLEDGED", () => {
    const sorted = sortWaiterCalls([
      makeCall({ id: "c1", status: "ACKNOWLEDGED", createdAt: "2026-11-03T09:00:00.000Z" }),
      makeCall({ id: "c2", status: "PENDING", createdAt: "2026-11-03T10:00:00.000Z" }),
      makeCall({ id: "c3", status: "RESOLVED" }),
    ]);

    assert.deepEqual(
      sorted.map((call) => call.id),
      ["c2", "c1", "c3"],
    );
  });

  it("mengurutkan berdasarkan waktu pembuatan dalam status yang sama", () => {
    const sorted = sortWaiterCalls([
      makeCall({ id: "later", createdAt: "2026-11-03T10:05:00.000Z" }),
      makeCall({ id: "earlier", createdAt: "2026-11-03T10:01:00.000Z" }),
    ]);

    assert.deepEqual(
      sorted.map((call) => call.id),
      ["earlier", "later"],
    );
  });

  it("tidak memutasi input", () => {
    const calls = [makeCall({ id: "c1", status: "RESOLVED" }), makeCall({ id: "c2" })];
    sortWaiterCalls(calls);
    assert.equal(calls[0]?.id, "c1");
  });
});

describe("getRunnerSummary", () => {
  it("menghitung tiket, item, panggilan, dan meja kotor", () => {
    const tickets = groupReadyItemsByOrder([
      makeItem({ id: "i1", orderId: "o1" }),
      makeItem({ id: "i2", orderId: "o2", orderNumber: "ORD-0002" }),
    ]);
    const calls = [makeCall({ id: "c1" }), makeCall({ id: "c2", status: "ACKNOWLEDGED" })];

    assert.deepEqual(getRunnerSummary({ readyTickets: tickets, calls, dirtyTables: 3 }), {
      readyTickets: 2,
      readyItems: 2,
      pendingCalls: 1,
      dirtyTables: 3,
    });
  });

  it("ringkasan nol untuk data kosong", () => {
    assert.deepEqual(
      getRunnerSummary({ readyTickets: [], calls: [], dirtyTables: 0 }),
      { readyTickets: 0, readyItems: 0, pendingCalls: 0, dirtyTables: 0 },
    );
  });
});
