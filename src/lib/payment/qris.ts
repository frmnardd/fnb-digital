/**
 * Generator QRIS dinamis (EMVCo Merchant Presented Mode).
 *
 * Alur: ambil payload QRIS **statis** milik merchant, ganti tag `54`
 * (transaction amount), tandai tag `01` = `12` (dynamic), opsional tambahkan
 * reference label pada tag `62`, lalu hitung ulang CRC tag `63`
 * (CRC-16/CCITT-FALSE, poly `0x1021`, init `0xFFFF`).
 *
 * Modul ini murni & tanpa network sehingga bisa diuji penuh secara offline.
 */

export class QrisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QrisError";
  }
}

export interface QrisField {
  tag: string;
  value: string;
}

/** Tag yang wajib ada pada payload QRIS merchant. */
const REQUIRED_STATIC_TAGS = ["00", "52", "53", "58", "59", "60"];

/** Urutan tag sesuai spesifikasi EMVCo (CRC `63` selalu terakhir). */
const TAG_ORDER = [
  "00",
  "01",
  "02",
  "03",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
  "60",
  "61",
  "62",
  "64",
];

/** Encode satu field TLV: tag (2) + panjang (2) + nilai. */
export function encodeTlv(tag: string, value: string): string {
  if (!/^\d{2}$/.test(tag)) {
    throw new QrisError(`Tag TLV harus 2 digit (diterima: "${tag}").`);
  }

  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

/** Parse payload TLV menjadi daftar field (mengabaikan sisa byte yang rusak). */
export function parseTlv(payload: string): QrisField[] {
  const fields: QrisField[] = [];
  let index = 0;

  while (index + 4 <= payload.length) {
    const tag = payload.slice(index, index + 2);
    const lengthText = payload.slice(index + 2, index + 4);

    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthText)) {
      break;
    }

    const length = Number(lengthText);
    const value = payload.slice(index + 4, index + 4 + length);

    if (value.length !== length) {
      break;
    }

    fields.push({ tag, value });
    index += 4 + length;
  }

  return fields;
}

/**
 * CRC-16/CCITT-FALSE — checksum yang dipakai EMVCo QR.
 * Nilai uji standar: crc16Ccitt("123456789") === "29B1".
 */
export function crc16Ccitt(payload: string): string {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function serializeFields(fields: QrisField[], includeCrc: boolean): string {
  const body = fields
    .map((field) => encodeTlv(field.tag, field.value))
    .join("");

  if (!includeCrc) {
    return body;
  }

  const withCrcTag = `${body}6304`;
  return `${withCrcTag}${crc16Ccitt(withCrcTag)}`;
}

function sortFields(fields: QrisField[]): QrisField[] {
  return [...fields].sort((a, b) => {
    const indexA = TAG_ORDER.indexOf(a.tag);
    const indexB = TAG_ORDER.indexOf(b.tag);

    if (indexA !== indexB) {
      return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) -
        (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB);
    }

    return a.tag.localeCompare(b.tag);
  });
}

/** Membuat payload QRIS statis (dipakai untuk data demo & test). */
export function buildStaticQris(fields: QrisField[]): string {
  const withoutCrc = fields.filter((field) => field.tag !== "63");
  const normalised = withoutCrc.some((field) => field.tag === "01")
    ? withoutCrc
    : [...withoutCrc, { tag: "01", value: "11" }];

  return serializeFields(sortFields(normalised), true);
}

/** Memeriksa CRC & tag wajib pada payload QRIS. */
export function validateQrisPayload(payload: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const fields = parseTlv(payload);
  const tags = new Set(fields.map((field) => field.tag));

  for (const tag of REQUIRED_STATIC_TAGS) {
    if (!tags.has(tag)) {
      errors.push(`Tag wajib ${tag} tidak ditemukan.`);
    }
  }

  const crcField = fields.find((field) => field.tag === "63");

  if (!crcField) {
    errors.push("Tag CRC 63 tidak ditemukan.");
  } else if (payload.length < 4) {
    errors.push("Payload terlalu pendek untuk memverifikasi CRC.");
  } else {
    const expected = crc16Ccitt(payload.slice(0, -4));

    if (expected !== crcField.value.toUpperCase()) {
      errors.push(`CRC tidak cocok (diharapkan ${expected}, ditemukan ${crcField.value}).`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface DynamicQrisInput {
  /** Payload QRIS statis milik merchant. */
  staticPayload: string;
  /** Nominal dalam Rupiah bulat (tanpa desimal). */
  amount: number;
  /** Nomor referensi merchant (nomor pesanan) untuk rekonsiliasi. */
  merchantRef?: string;
}

/**
 * Mengubah payload QRIS statis menjadi QRIS dinamis dengan nominal tertentu.
 * Nominal dibulatkan ke Rupiah bulat; payload lama (tag 54 & 63) diganti.
 */
export function buildDynamicQris({ staticPayload, amount, merchantRef }: DynamicQrisInput): string {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new QrisError(`Nominal QRIS harus bilangan bulat Rupiah >= 1 (diterima: ${amount}).`);
  }

  const parsed = parseTlv(staticPayload);

  if (parsed.length === 0) {
    throw new QrisError("Payload QRIS statis tidak dapat dibaca.");
  }

  const fields = new Map(parsed.filter((field) => field.tag !== "63").map((field) => [field.tag, field.value]));

  for (const tag of REQUIRED_STATIC_TAGS) {
    if (!fields.has(tag)) {
      throw new QrisError(`Payload QRIS statis tidak memiliki tag wajib ${tag}.`);
    }
  }

  fields.set("01", "12"); // 12 = dynamic QR
  fields.set("54", String(amount));

  if (merchantRef && merchantRef.trim().length > 0) {
    const existing = fields.get("62");
    const inner = existing ? parseTlv(existing).filter((field) => field.tag !== "05") : [];
    inner.push({ tag: "05", value: merchantRef.trim().slice(0, 25) });
    fields.set(
      "62",
      inner.map((field) => encodeTlv(field.tag, field.value)).join(""),
    );
  }

  const sorted = sortFields(
    [...fields.entries()].map(([tag, value]) => ({ tag, value })),
  );

  return serializeFields(sorted, true);
}

/**
 * Payload QRIS statis contoh untuk mode demo (tanpa kredensial gateway).
 * BUKAN akun merchant nyata — jangan dipakai untuk transaksi produksi.
 */
export function createDemoStaticPayload(): string {
  return buildStaticQris([
    { tag: "00", value: "01" },
    { tag: "01", value: "11" },
    { tag: "02", value: "936009140000000000" },
    { tag: "52", value: "5814" },
    { tag: "53", value: "360" },
    { tag: "58", value: "ID" },
    { tag: "59", value: "DEMO FNB DIGITAL" },
    { tag: "60", value: "JAKARTA" },
    { tag: "61", value: "10110" },
  ]);
}
