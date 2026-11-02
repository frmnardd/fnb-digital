import { createHmac, timingSafeEqual } from "node:crypto";

import { getSessionSecret } from "./secret";

/**
 * Helper hashing PIN (meja 4-digit & PIN otorisasi staf 6-digit).
 *
 * PIN TIDAK PERNAH disimpan sebagai plaintext. Nilai yang masuk database adalah
 * HMAC-SHA256 dari `pin` dengan kunci `SESSION_SECRET`, sehingga bocornya isi
 * tabel tetap tidak langsung membuka PIN.
 *
 * Catatan: PIN meja bersifat rahasia bersama (bukan password akun), jadi hash
 * tanpa salt per-baris + perbandingan constant-time dianggap cukup.
 */

const PIN_PATTERN = /^\d{4,8}$/;

/** Hash PIN menjadi 64 karakter hex (HMAC-SHA256). Melempar error bila PIN tidak valid. */
export function hashPin(pin: string): string {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error("PIN harus berupa 4-8 digit angka.");
  }
  return createHmac("sha256", getSessionSecret()).update(`fnb-pin:${pin}`).digest("hex");
}

/** Membandingkan PIN dengan hash tersimpan secara constant-time (anti timing attack). */
export function verifyPin(pin: string, expectedHash: string): boolean {
  if (!PIN_PATTERN.test(pin) || expectedHash.length !== 64) {
    return false;
  }

  const actual = Buffer.from(hashPin(pin), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

/** Validasi format PIN tanpa melakukan hashing (dipakai seeder saat dry-run). */
export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}
