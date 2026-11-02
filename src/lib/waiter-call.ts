/**
 * Aturan & logika panggilan pelayan (Call Waiter).
 *
 * Dipisahkan sebagai fungsi murni agar aturan anti-spam bisa diuji tanpa database.
 * Rate limit disimpan di database (bukan memori proses) supaya tetap konsisten
 * ketika aplikasi berjalan di beberapa instance.
 */

/** Jenis panggilan yang didukung (selaras dengan enum Prisma `WaiterCallType`). */
export const WAITER_CALL_TYPES = [
  "WATER_TISSUE",
  "CLEAN_TABLE",
  "ASK_MENU",
  "REQUEST_BILL",
] as const;

export type WaiterCallTypeKey = (typeof WAITER_CALL_TYPES)[number];

/** Maksimal 1 panggilan per 2 menit per meja. */
export const CALL_WAITER_COOLDOWN_MS = 2 * 60 * 1000;
export const CALL_WAITER_COOLDOWN_SECONDS = CALL_WAITER_COOLDOWN_MS / 1000;

export interface CallWaiterLimitResult {
  allowed: boolean;
  /** Detik sampai panggilan berikutnya diperbolehkan (0 bila `allowed`). */
  retryAfterSeconds: number;
}

/**
 * Menentukan apakah meja boleh memanggil pelayan lagi.
 *
 * `lastCallAt` di masa depan (mis. jam server mundur / data aneh) juga ditolak
 * agar tidak membuka celah spam.
 */
export function evaluateCallWaiterLimit(
  lastCallAt: Date | null,
  now: Date = new Date(),
  cooldownMs: number = CALL_WAITER_COOLDOWN_MS,
): CallWaiterLimitResult {
  if (!lastCallAt) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const elapsedMs = now.getTime() - lastCallAt.getTime();

  if (elapsedMs >= cooldownMs) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const remainingMs = cooldownMs - elapsedMs;

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
  };
}
