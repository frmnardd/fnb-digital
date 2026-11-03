import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COLUMNS_BY_WIDTH,
  createEscPosBuilder,
  EscPosBuilder,
  formatReceiptLines,
  toEscPos,
  toPrintableAscii,
  type ReceiptOrderInput,
} from "./escpos";

const order: ReceiptOrderInput = {
  orderNumber: "ORD-0001",
  orderType: "DINE_IN",
  tableLabel: "07 - Indoor",
  customerName: "Rina",
  createdAt: new Date("2026-11-03T05:00:00.000Z"),
  items: [
    {
      name: "Nasi Goreng Kampung",
      quantity: 2,
      unitPrice: 43000,
      modifiers: ["Pedas", "Extra Telur"],
      note: "tanpa bawang",
    },
    { name: "Es Teh Manis", quantity: 3, unitPrice: 12000 },
  ],
  totals: {
    subtotal: 122000,
    discountAmount: 0,
    serviceCharge: 6100,
    taxAmount: 12810,
    uniqueCode: 0,
    grandTotal: 140910,
  },
  payment: { method: "CASH", status: "PAID" },
};

describe("COLUMNS_BY_WIDTH", () => {
  it("memakai 32 kolom untuk 58 mm dan 48 kolom untuk 80 mm", () => {
    assert.equal(COLUMNS_BY_WIDTH[58], 32);
    assert.equal(COLUMNS_BY_WIDTH[80], 48);
  });
});

describe("toPrintableAscii", () => {
  it("mengganti karakter non-ASCII", () => {
    assert.equal(toPrintableAscii("Rp 38.000 — ok"), "Rp 38.000 - ok");
    assert.equal(toPrintableAscii("a·b…c"), "a-b...c");
    assert.equal(toPrintableAscii("2×3"), "2x3");
  });

  it("mempertahankan ASCII dan newline", () => {
    assert.equal(toPrintableAscii("Halo\nDunia"), "Halo\nDunia");
  });
});

describe("EscPosBuilder", () => {
  it("memuat perintah init di awal", () => {
    const builder = createEscPosBuilder({ paperWidth: 58 });
    assert.ok(builder.toString().startsWith("\u001B@"));
  });

  it("membuat baris dua kolom rata kanan sesuai lebar", () => {
    const builder = createEscPosBuilder({ paperWidth: 58 });
    builder.columnsRow("Subtotal", "Rp 122.000");
    const line = (builder.toString().split("\n")[0] ?? "").replace("\u001B@", "");

    assert.equal(line.length, 32);
    assert.ok(line.startsWith("Subtotal"));
    assert.ok(line.endsWith("Rp 122.000"));
  });

  it("memotong kolom kiri yang terlalu panjang", () => {
    const builder = createEscPosBuilder({ paperWidth: 58 });
    builder.columnsRow("Nama menu yang sangat panjang sekali", "Rp 1.000");
    const line = (builder.toString().split("\n")[0] ?? "").replace("\u001B@", "");

    assert.equal(line.length, 32);
    assert.ok(line.endsWith("Rp 1.000"));
  });

  it("menghasilkan divider sepanjang lebar kertas", () => {
    const builder = createEscPosBuilder({ paperWidth: 80 });
    builder.divider("=");
    const line = (builder.toString().split("\n")[0] ?? "").replace("\u001B@", "");

    assert.equal(line, "=".repeat(48));
  });

  it("menyertakan perintah cut dan feed", () => {
    const builder = createEscPosBuilder({ paperWidth: 58 });
    builder.feedLines(2).cut();

    assert.ok(builder.toString().includes("\u001DVA\u0000"));
    assert.ok(builder.toString().includes("\u001Bd\u0002"));
  });

  it("menyertakan perintah QR", () => {
    const builder = createEscPosBuilder({ paperWidth: 58 });
    builder.qr("ORD-0001");

    assert.ok(builder.toString().includes("\u001D(k"));
    assert.ok(builder.toString().includes("ORD-0001"));
  });

  it("toBytes mengembalikan Uint8Array sesuai panjang teks", () => {
    const builder = new EscPosBuilder(58);
    builder.line("ABC");
    const bytes = builder.toBytes();

    assert.ok(bytes instanceof Uint8Array);
    assert.equal(bytes.length, builder.toString().length);
  });
});

describe("formatReceiptLines", () => {
  it("memuat nomor pesanan, total, dan pembayaran", () => {
    const lines = formatReceiptLines(order, { paperWidth: 58 }).join("\n");

    assert.ok(lines.includes("ORD-0001"));
    assert.ok(lines.includes("Rp 140.910"));
    assert.ok(lines.includes("Tunai"));
    assert.ok(lines.includes("Lunas"));
  });

  it("setiap baris tidak melebihi lebar kertas", () => {
    for (const paperWidth of [58, 80] as const) {
      const columns = COLUMNS_BY_WIDTH[paperWidth];

      for (const line of formatReceiptLines(order, { paperWidth })) {
        assert.ok(line.length <= columns, `"${line}" melebihi ${columns} kolom`);
      }
    }
  });

  it("menampilkan modifier dan catatan item", () => {
    const lines = formatReceiptLines(order, { paperWidth: 80 }).join("\n");
    assert.ok(lines.includes("Pedas, Extra Telur"));
    assert.ok(lines.includes("tanpa bawang"));
  });

  it("menampilkan diskon & kode unik bila ada", () => {
    const lines = formatReceiptLines(
      {
        ...order,
        totals: { ...order.totals, discountAmount: 5000, uniqueCode: 321 },
      },
      { paperWidth: 80 },
    ).join("\n");

    assert.ok(lines.includes("Diskon"));
    assert.ok(lines.includes("Kode unik"));
  });
});

describe("toEscPos", () => {
  it("menggabungkan perintah init, struk, dan cut", () => {
    const payload = toEscPos(order, { paperWidth: 58 });

    assert.ok(payload.startsWith("\u001B@"));
    assert.ok(payload.includes("ORD-0001"));
    assert.ok(payload.includes("\u001DVA\u0000"));
    assert.ok(payload.includes("Rp 140.910"));
  });

  it("menambahkan QR bila qrData diberikan", () => {
    const payload = toEscPos(order, { paperWidth: 80, qrData: "ORD-0001" });
    assert.ok(payload.includes("\u001D(k"));
  });
});
