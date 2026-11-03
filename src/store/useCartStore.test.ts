import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { buildCartLineId, type CartLine } from "@/lib/cart";

import {
  selectQuantityByItem,
  selectSubtotal,
  selectTotalQuantity,
  useCartStore,
  type CartState,
} from "./useCartStore";

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  const menuItemId = overrides.menuItemId ?? "menu-nasi";
  const modifiers = overrides.modifiers ?? [];
  const note = overrides.note ?? "";

  return {
    id: buildCartLineId(menuItemId, modifiers, note),
    menuItemId,
    name: "Nasi Goreng",
    imageUrl: null,
    station: "KITCHEN",
    basePrice: 38000,
    unitPrice: 38000,
    quantity: 1,
    modifiers,
    note,
    ...overrides,
  };
}

function readState(): CartState {
  return useCartStore.getState();
}

beforeEach(() => {
  useCartStore.setState({ tableSlug: null, sessionId: null, orderType: "DINE_IN", lines: [] });
});

describe("useCartStore — konteks meja", () => {
  it("default mode pesanan DINE_IN dan keranjang kosong", () => {
    assert.equal(readState().orderType, "DINE_IN");
    assert.deepEqual(readState().lines, []);
  });

  it("menyimpan tableSlug & sessionId", () => {
    readState().setContext({ tableSlug: "meja-01", sessionId: "sess-1" });

    assert.equal(readState().tableSlug, "meja-01");
    assert.equal(readState().sessionId, "sess-1");
  });

  it("mengosongkan keranjang bila meja berubah", () => {
    readState().setContext({ tableSlug: "meja-01", sessionId: "sess-1" });
    readState().addLine(makeLine());
    assert.equal(readState().lines.length, 1);

    readState().setContext({ tableSlug: "meja-02", sessionId: "sess-2" });

    assert.equal(readState().tableSlug, "meja-02");
    assert.deepEqual(readState().lines, []);
  });

  it("mempertahankan keranjang bila meja sama (hanya sesi diperbarui)", () => {
    readState().setContext({ tableSlug: "meja-01", sessionId: "sess-1" });
    readState().addLine(makeLine());

    readState().setContext({ tableSlug: "meja-01", sessionId: "sess-9" });

    assert.equal(readState().lines.length, 1);
    assert.equal(readState().sessionId, "sess-9");
  });
});

describe("useCartStore — baris keranjang", () => {
  it("menjumlahkan baris identik", () => {
    readState().addLine(makeLine({ quantity: 2 }));
    readState().addLine(makeLine({ quantity: 3 }));

    assert.equal(readState().lines.length, 1);
    assert.equal(readState().lines[0]?.quantity, 5);
  });

  it("memisahkan baris dengan modifier berbeda", () => {
    readState().addLine(makeLine());
    readState().addLine(
      makeLine({
        modifiers: [{ id: "grp-topping:opt-telur", name: "Extra Telur", priceDelta: 5000 }],
        unitPrice: 43000,
      }),
    );

    assert.equal(readState().lines.length, 2);
  });

  it("mengubah kuantitas dan menghapus baris saat 0", () => {
    const line = makeLine({ quantity: 2 });
    readState().addLine(line);

    readState().setQuantity(line.id, 4);
    assert.equal(readState().lines[0]?.quantity, 4);

    readState().setQuantity(line.id, 0);
    assert.deepEqual(readState().lines, []);
  });

  it("removeLine & clear", () => {
    const line = makeLine();
    readState().addLine(line);
    readState().removeLine(line.id);
    assert.deepEqual(readState().lines, []);

    readState().addLine(makeLine());
    readState().clear();
    assert.deepEqual(readState().lines, []);
  });

  it("applyRemoteLines mengganti seluruh isi keranjang", () => {
    readState().addLine(makeLine());
    const remote = [makeLine({ menuItemId: "menu-teh", quantity: 3, unitPrice: 12000 })];

    readState().applyRemoteLines(remote);

    assert.deepEqual(
      readState().lines.map((line) => line.menuItemId),
      ["menu-teh"],
    );
  });

  it("setOrderType mengubah mode pesanan", () => {
    readState().setOrderType("TAKEAWAY");
    assert.equal(readState().orderType, "TAKEAWAY");
  });
});

describe("useCartStore — selector", () => {
  it("menghitung total kuantitas, subtotal, dan kuantitas per menu", () => {
    readState().addLine(makeLine({ quantity: 2 }));
    readState().addLine(
      makeLine({
        menuItemId: "menu-teh",
        quantity: 3,
        unitPrice: 12000,
        modifiers: [],
      }),
    );

    const state = readState();
    assert.equal(selectTotalQuantity(state), 5);
    assert.equal(selectSubtotal(state), 2 * 38000 + 3 * 12000);
    assert.equal(selectQuantityByItem(state, "menu-nasi"), 2);
    assert.equal(selectQuantityByItem(state, "menu-teh"), 3);
    assert.equal(selectQuantityByItem(state, "menu-tidak-ada"), 0);
  });
});
