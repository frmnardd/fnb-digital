/**
 * Logika ketersediaan menu (jadwal tayang & status 86'd).
 *
 * Fungsi di sini MURNI (hanya bergantung pada argumen), sehingga bisa diuji tanpa
 * database dan dipakai ulang di server (API katalog) maupun di komponen client
 * (mis. badge "Habis").
 */

export const DEFAULT_RESTAURANT_TIMEZONE = "Asia/Jakarta";

const MINUTES_PER_DAY = 24 * 60;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Zona waktu restoran (dapat dioverride via env `RESTAURANT_TIMEZONE`). */
export function getRestaurantTimezone(): string {
  const fromEnv = process.env.RESTAURANT_TIMEZONE?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_RESTAURANT_TIMEZONE;
}

/** Mengubah "HH:mm" menjadi menit sejak tengah malam. Null bila kosong/invalid. */
export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const match = TIME_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

/** Menit sejak tengah malam menurut zona waktu restoran. */
export function getRestaurantMinutes(
  now: Date = new Date(),
  timeZone: string = getRestaurantTimezone(),
): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return hour * 60 + minute;
}

/**
 * Menentukan apakah `minutes` berada dalam jadwal tayang.
 *
 * - Keduanya kosong  → selalu tayang.
 * - Hanya `from`     → tayang sejak jam tersebut.
 * - Hanya `until`    → tayang sampai jam tersebut (eksklusif).
 * - `from <= until`  → jadwal normal, mis. 10:00–22:00.
 * - `from > until`   → jadwal melewati tengah malam, mis. 22:00–02:00.
 *
 * Jam akhir bersifat eksklusif (menu 10:00–22:00 tidak tampil tepat pukul 22:00).
 */
export function isWithinSchedule(
  fromTime: string | null | undefined,
  untilTime: string | null | undefined,
  minutes: number,
): boolean {
  const from = parseTimeToMinutes(fromTime);
  const until = parseTimeToMinutes(untilTime);

  if (from === null && until === null) {
    return true;
  }

  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  if (from !== null && until !== null) {
    return from <= until
      ? normalized >= from && normalized < until
      : normalized >= from || normalized < until;
  }

  if (from !== null) {
    return normalized >= from;
  }

  // until !== null
  return normalized < (until ?? 0);
}

export interface MenuAvailabilityInput {
  isAvailable: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
  now?: Date;
  timeZone?: string;
}

/** `true` bila menu boleh dipesan saat ini (stok tersedia DAN dalam jam tayang). */
export function isMenuItemOrderable(input: MenuAvailabilityInput): boolean {
  if (!input.isAvailable) {
    return false;
  }

  const minutes = getRestaurantMinutes(
    input.now ?? new Date(),
    input.timeZone ?? getRestaurantTimezone(),
  );

  return isWithinSchedule(input.availableFrom, input.availableUntil, minutes);
}
