import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getSessionSecret } from "./secret";

/**
 * Token sesi meja (TableSessionToken).
 *
 * Alur: browser pelanggan memegang token MENTAH di cookie httpOnly; database
 * hanya menyimpan HMAC-SHA256-nya (`TableSession.sessionTokenHash`). Dengan
 * begitu, bocornya isi tabel tidak cukup untuk membajak sesi meja.
 *
 * Domain HMAC diberi prefiks "table-session:" agar tidak bentrok dengan hash PIN.
 */

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const HMAC_PREFIX = "table-session:";

/** Membuat token acak 32 byte (64 karakter hex). */
export function generateTableSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/** Menghitung hash token untuk disimpan/dibandingkan di database. */
export function hashSessionToken(token: string): string {
  return createHmac("sha256", getSessionSecret()).update(`${HMAC_PREFIX}${token}`).digest("hex");
}

/** Membandingkan token mentah dengan hash tersimpan secara constant-time. */
export function verifySessionToken(token: string, expectedHash: string): boolean {
  if (!TOKEN_PATTERN.test(token) || !HASH_PATTERN.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashSessionToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
