import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getKdsSummary,
  getTicketAgeState,
  groupItemsByOrder,
  KDS_SLA_MINUTES,
  KDS_STATION_LABELS,
  parseStationSlug,
  type KdsTicketItemInput,
} from "./kds";

function makeItem(overrides: Partial<KdsTicketItemInput> & { id: string; orderId: string }): KdsTicketItemInput {
  return {
    orderNumber: "ORD-0001",
    tableLabel: "07 - Indoor",
    orderType: "DINE_IN",
    menuName: "Nasi Goreng",
    quantity: 1,
    modifiers: [],
    note: null,
    status: "QUEUED",
    station: "KITCHEN",
    queuedAt: "2026-11-03T09:55:00.000Z",
    ...overrides,
  };
}

describe("parseStationSlug", () => {
  it("memetakan slug ke stasiun", () => {
    assert.equal(parseStationSlug("kitchen"), "KITCHEN");
    assert.equal(parseStationSlug("BAR"), "BAR");
    assert.equal(parseStationSlug(" pastry "), "PASTRY");
  });

  it("menolak slug asing", () => {
    assert.equal(parseStationSlug("gudang"), null);
    assert.equal(parseStationSlug(""), null);
  });

  it("menyediakan label stasiun", () => {
    assert.equal(KDS_STATION_LABELS.KITCHEN, "Dapur");
    assert.equal(KDS_STATION_LABELS.BAR, "Bar");
  });
});

describe("getTicketAgeState", () => {
  const now = new Date("2026-11-03T10:00:00.000Z");

  it("hijau sebelum setengah SLA", () => {
    const age = getTicketAgeState(new Date("2026-11-03T09:56:00.000Z"), now);
    assert.deepEqual(age, { state: "FRESH", agingMinutes: 4 });
  });

  it("kuning mulai setengah SLA", () => {
    assert.equal(
      getTicketAgeState(new Date("2026-11-03T09:55:00.000Z"), now).state,
      "WARNING",
    );
    assert.equal(
      getTicketAgeState(new Date("2026-11-03T09:50:00.000Z"), now).state,
      "WARNING",
    );
  });

  it("merah setelah melewati SLA", () => {
    const age = getTicketAgeState(new Date("2026-11-03T09:49:00.000Z"), now);
    assert.equal(age.state, "OVERDUE");
    assert.equal(age.agingMinutes, 11);
  });

  it("aman untuk clock skew (waktu di masa depan)", () => {
    const age = getTicketAgeState(new Date("2026-11-03T10:05:00.000Z"), now);
    assert.equal(age.agingMinutes, 0);
    assert.equal(age.state, "FRESH");
  });

  it("menggunakan SLA default 10 menit", () => {
    assert.equal(KDS_SLA_MINUTES, 10);
  });
});

describe("groupItemsByOrder", () => {
  it("mengelompokkan item menjadi tiket per pesanan", () => {
    const items = [
      makeItem({ id: "i1", orderId: "o1" }),
      makeItem({ id: "i2", orderId: "o1", menuName: "Es Teh", station: "BAR" }),
      makeItem({ id: "i3", orderId: "o2", orderNumber: "ORD-0002" }),
    ];

    const tickets = groupItemsByOrder(items);

    assert.equal(tickets.length, 2);
    assert.equal(tickets[0]?.orderId, "o1");
    assert.equal(tickets[0]?.items.length, 2);
    assert.equal(tickets[1]?.orderId, "o2");
  });

  it("mengurutkan tiket berdasarkan waktu masuk paling awal", () => {
    const items = [
      makeItem({ id: "i1", orderId: "late", queuedAt: "2026-11-03T09:59:00.000Z" }),
      makeItem({ id: "i2", orderId: "early", queuedAt: "2026-11-03T09:50:00.000Z" }),
    ];

    const tickets = groupItemsByOrder(items);
    assert.deepEqual(
      tickets.map((ticket) => ticket.orderId),
      ["early", "late"],
    );
  });

  it("memakai waktu masuk paling awal di dalam satu tiket", () => {
    const items = [
      makeItem({ id: "i1", orderId: "o1", queuedAt: "2026-11-03T09:58:00.000Z" }),
      makeItem({ id: "i2", orderId: "o1", queuedAt: "2026-11-03T09:51:00.000Z" }),
    ];

    assert.equal(groupItemsByOrder(items)[0]?.queuedAt, "2026-11-03T09:51:00.000Z");
  });

  it("mengembalikan daftar kosong untuk input kosong", () => {
    assert.deepEqual(groupItemsByOrder([]), []);
  });
});

describe("getKdsSummary", () => {
  it("menghitung tiket, item, dan tiket terlambat", () => {
    const now = new Date("2026-11-03T10:05:00.000Z");
    const tickets = groupItemsByOrder([
      makeItem({ id: "i1", orderId: "o1", queuedAt: "2026-11-03T09:50:00.000Z" }),
      makeItem({ id: "i2", orderId: "o2", orderNumber: "ORD-0002", queuedAt: "2026-11-03T10:03:00.000Z" }),
    ]);

    assert.deepEqual(getKdsSummary(tickets, now), { tickets: 2, items: 2, overdue: 1 });
  });

  it("ringkasan nol untuk board kosong", () => {
    assert.deepEqual(getKdsSummary([], new Date()), { tickets: 0, items: 0, overdue: 0 });
  });
});
