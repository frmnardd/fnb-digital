import { formatRupiah } from "@/lib/pricing";

/**
 * Generator perintah ESC/POS untuk printer thermal 58 mm & 80 mm.
 *
 * Modul ini murni (tanpa I/O). Payload yang dihasilkan dapat dikirim ke printer
 * lewat jembatan lokal (mis. QZ Tray / WebUSB / agen cetak) — browser biasa
 * tidak dapat mengirim byte mentah ke printer.
 */

export type PaperWidth = 58 | 80;

export const COLUMNS_BY_WIDTH: Record<PaperWidth, number> = {
  58: 32,
  80: 48,
};

const ESC = "\u001B";
const GS = "\u001D";

const INIT = `${ESC}@`;
const ALIGN = { left: `${ESC}a\u0000`, center: `${ESC}a\u0001`, right: `${ESC}a\u0002` };
const BOLD_ON = `${ESC}E\u0001`;
const BOLD_OFF = `${ESC}E\u0000`;
const CUT = `${GS}V\u0041\u0000`;

function feed(lines: number): string {
  const safe = Math.max(0, Math.min(255, Math.trunc(lines)));
  return `${ESC}d${String.fromCharCode(safe)}`;
}

/** Perintah QR code printer (model 2). */
function qrCommand(data: string, moduleSize: number = 6): string {
  const length = data.length + 3;
  const pL = String.fromCharCode(length % 256);
  const pH = String.fromCharCode(Math.floor(length / 256));

  return (
    `${GS}(k\u0004\u00001A2\u0000` +
    `${GS}(k\u0003\u00001C${String.fromCharCode(moduleSize)}` +
    `${GS}(k\u0003\u00001E${String.fromCharCode(49)}` +
    `${GS}(k${pL}${pH}1P0${data}` +
    `${GS}(k\u0003\u00001Q0`
  );
}

export type Alignment = "left" | "center" | "right";

/** Membuang karakter non-ASCII agar aman untuk printer thermal. */
export function toPrintableAscii(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00B7/g, "-")
    .replace(/\u00D7/g, "x")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

export class EscPosBuilder {
  readonly columns: number;
  private buffer: string = INIT;

  constructor(paperWidth: PaperWidth) {
    this.columns = COLUMNS_BY_WIDTH[paperWidth];
  }

  align(value: Alignment): this {
    this.buffer += ALIGN[value];
    return this;
  }

  bold(enabled: boolean): this {
    this.buffer += enabled ? BOLD_ON : BOLD_OFF;
    return this;
  }

  text(value: string): this {
    this.buffer += toPrintableAscii(value);
    return this;
  }

  line(value: string = ""): this {
    this.buffer += `${toPrintableAscii(value)}\n`;
    return this;
  }

  divider(character: string = "-"): this {
    const safe = character.length === 1 ? character : "-";
    this.buffer += `${safe.repeat(this.columns)}\n`;
    return this;
  }

  /** Baris dua kolom dengan nilai rata kanan (dipotong bila melebihi lebar). */
  columnsRow(left: string, right: string): this {
    const leftText = toPrintableAscii(left);
    const rightText = toPrintableAscii(right);
    const available = Math.max(0, this.columns - rightText.length - 1);
    const trimmedLeft = leftText.length > available ? leftText.slice(0, available) : leftText;
    const padding = " ".repeat(Math.max(1, this.columns - trimmedLeft.length - rightText.length));

    this.buffer += `${trimmedLeft}${padding}${rightText}\n`;
    return this;
  }

  qr(data: string, moduleSize: number = 6): this {
    this.buffer += qrCommand(toPrintableAscii(data), moduleSize);
    return this;
  }

  feedLines(lines: number = 1): this {
    this.buffer += feed(lines);
    return this;
  }

  cut(): this {
    this.buffer += CUT;
    return this;
  }

  toString(): string {
    return this.buffer;
  }

  toBytes(): Uint8Array {
    const bytes = new Uint8Array(this.buffer.length);

    for (let index = 0; index < this.buffer.length; index += 1) {
      bytes[index] = this.buffer.charCodeAt(index) & 0xff;
    }

    return bytes;
  }
}

export function createEscPosBuilder(options: { paperWidth: PaperWidth }): EscPosBuilder {
  return new EscPosBuilder(options.paperWidth);
}

// -----------------------------------------------------------------------------
// Format struk
// -----------------------------------------------------------------------------

export interface ReceiptOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers?: string[];
  note?: string | null;
}

export interface ReceiptOrderInput {
  orderNumber: string;
  orderType: "DINE_IN" | "TAKEAWAY";
  tableLabel: string | null;
  customerName: string | null;
  createdAt: Date;
  items: ReceiptOrderItem[];
  totals: {
    subtotal: number;
    discountAmount: number;
    serviceCharge: number;
    taxAmount: number;
    uniqueCode: number;
    grandTotal: number;
  };
  payment: { method: string; status: string } | null;
  restaurantName?: string;
  timeZone?: string;
}

const PAYMENT_LABEL: Record<string, string> = {
  QRIS_DYNAMIC: "QRIS",
  VIRTUAL_ACCOUNT: "Virtual Account",
  MANUAL_TRANSFER: "Transfer Manual",
  CASH: "Tunai",
  EDC_CARD: "Kartu EDC",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  PAID: "Lunas",
  FAILED: "Gagal",
  REFUNDED: "Refund",
  EXPIRED: "Kedaluwarsa",
};

function formatDateTime(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(value);
}

/** Menyusun baris struk (sudah dipotong sesuai lebar kertas). */
export function formatReceiptLines(
  order: ReceiptOrderInput,
  options: { paperWidth: PaperWidth },
): string[] {
  const columns = COLUMNS_BY_WIDTH[options.paperWidth];
  const lines: string[] = [];
  const push = (left: string, right?: string) => {
    if (right === undefined) {
      lines.push(left.slice(0, columns));
      return;
    }

    const available = Math.max(0, columns - right.length - 1);
    const trimmedLeft = left.length > available ? left.slice(0, available) : left;
    lines.push(`${trimmedLeft}${" ".repeat(Math.max(1, columns - trimmedLeft.length - right.length))}${right}`);
  };

  lines.push((order.restaurantName ?? "FnB Digital").toUpperCase());
  lines.push("Struk Pembayaran");
  lines.push("-".repeat(columns));
  push("No", order.orderNumber);
  push("Meja", order.tableLabel ?? "Takeaway");
  push("Tipe", order.orderType === "DINE_IN" ? "Dine In" : "Takeaway");
  push("Waktu", formatDateTime(order.createdAt, order.timeZone ?? "Asia/Jakarta"));

  if (order.customerName) {
    push("Pemesan", order.customerName);
  }

  lines.push("-".repeat(columns));

  for (const item of order.items) {
    push(`${item.quantity}x ${item.name}`, formatRupiah(item.unitPrice * item.quantity));

    if (item.modifiers && item.modifiers.length > 0) {
      lines.push(`  ${item.modifiers.join(", ")}`.slice(0, columns));
    }

    if (item.note && item.note.trim().length > 0) {
      lines.push(`  ${item.note.trim()}`.slice(0, columns));
    }
  }

  lines.push("-".repeat(columns));
  push("Subtotal", formatRupiah(order.totals.subtotal));

  if (order.totals.discountAmount > 0) {
    push("Diskon", `-${formatRupiah(order.totals.discountAmount)}`);
  }

  push("Service 5%", formatRupiah(order.totals.serviceCharge));
  push("PB1 10%", formatRupiah(order.totals.taxAmount));

  if (order.totals.uniqueCode > 0) {
    push("Kode unik", String(order.totals.uniqueCode));
  }

  push("TOTAL", formatRupiah(order.totals.grandTotal));
  lines.push("-".repeat(columns));

  push(
    "Bayar",
    order.payment ? (PAYMENT_LABEL[order.payment.method] ?? order.payment.method) : "-",
  );
  push(
    "Status",
    order.payment ? (PAYMENT_STATUS_LABEL[order.payment.status] ?? order.payment.status) : "-",
  );

  lines.push("");
  lines.push("Terima kasih atas kunjungan Anda");

  return lines;
}

/** Payload ESC/POS lengkap (perintah + struk + QR opsional). */
export function toEscPos(
  order: ReceiptOrderInput,
  options: { paperWidth: PaperWidth; qrData?: string },
): string {
  const builder = createEscPosBuilder({ paperWidth: options.paperWidth });

  builder.align("center").bold(true).line(order.restaurantName ?? "FnB Digital").bold(false);
  builder.line("Struk Pembayaran");
  builder.align("left").divider("-");

  for (const line of formatReceiptLines(order, { paperWidth: options.paperWidth }).slice(3)) {
    builder.line(line);
  }

  if (options.qrData) {
    builder.align("center").qr(options.qrData, 5).line("");
  }

  builder.align("center").line("Terima kasih").feedLines(3).cut();

  return builder.toString();
}
