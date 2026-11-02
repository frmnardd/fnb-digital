/**
 * Akses terpusat ke `SESSION_SECRET`.
 *
 * Dipakai oleh hashing PIN (`pin.ts`) dan hashing token sesi meja (`token.ts`)
 * agar aturan panjang minimum & pesan error konsisten di seluruh aplikasi.
 */

export const MIN_SECRET_LENGTH = 32;

/**
 * Mengambil SESSION_SECRET dari environment.
 * @param minLength panjang minimum yang diminta pemanggil (default 32).
 */
export function getSessionSecret(minLength: number = MIN_SECRET_LENGTH): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < minLength) {
    throw new Error(
      `SESSION_SECRET belum diatur atau kurang dari ${minLength} karakter. Periksa file .env.`,
    );
  }

  return secret;
}
