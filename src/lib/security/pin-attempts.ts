/**
 * Pembatas percobaan PIN meja (anti brute-force).
 *
 * Disimpan di memori proses dengan jendela waktu 10 menit.
 * BATASAN: pada deployment multi-instance (serverless), hitungan tidak dibagi
 * antar-instance. Untuk produksi skala besar pindahkan ke Redis/Postgres.
 */

export const PIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
export const PIN_MAX_ATTEMPTS = 5;

interface AttemptEntry {
  count: number;
  firstAttemptAt: number;
}

const attempts = new Map<string, AttemptEntry>();

export interface PinAttemptState {
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

function getActiveEntry(key: string, now: number): AttemptEntry | null {
  const entry = attempts.get(key);

  if (!entry) {
    return null;
  }

  if (now - entry.firstAttemptAt > PIN_ATTEMPT_WINDOW_MS) {
    attempts.delete(key);
    return null;
  }

  return entry;
}

export function isPinLocked(key: string, now: number = Date.now()): boolean {
  const entry = getActiveEntry(key, now);
  return entry !== null && entry.count >= PIN_MAX_ATTEMPTS;
}

/** Mencatat satu percobaan gagal dan mengembalikan status pembatasannya. */
export function registerPinAttempt(
  key: string,
  now: number = Date.now(),
): PinAttemptState {
  const entry = getActiveEntry(key, now);

  if (!entry) {
    attempts.set(key, { count: 1, firstAttemptAt: now });
    return {
      locked: false,
      remainingAttempts: PIN_MAX_ATTEMPTS - 1,
      retryAfterSeconds: 0,
    };
  }

  entry.count += 1;

  const locked = entry.count >= PIN_MAX_ATTEMPTS;
  const retryAfterSeconds = locked
    ? Math.max(1, Math.ceil((PIN_ATTEMPT_WINDOW_MS - (now - entry.firstAttemptAt)) / 1000))
    : 0;

  return {
    locked,
    remainingAttempts: Math.max(0, PIN_MAX_ATTEMPTS - entry.count),
    retryAfterSeconds,
  };
}

/** Menghapus riwayat percobaan (dipakai setelah PIN benar). */
export function resetPinAttempts(key: string): void {
  attempts.delete(key);
}

/** Hanya untuk test: membersihkan seluruh state. */
export function clearAllPinAttempts(): void {
  attempts.clear();
}
