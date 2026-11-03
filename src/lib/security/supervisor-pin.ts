import { verifyPin } from "./pin";

/**
 * PIN supervisor (6 digit) untuk tindakan sensitif kasir.
 * Memakai hashing HMAC yang sama dengan PIN staf (`src/lib/security/pin.ts`),
 * sehingga `Staff.pinHash` dapat langsung diverifikasi di sini.
 */

export const SUPERVISOR_PIN_LENGTH = 6;

const SUPERVISOR_PIN_PATTERN = /^\d{6}$/;

export function isValidSupervisorPin(pin: string): boolean {
  return SUPERVISOR_PIN_PATTERN.test(pin);
}

/** Verifikasi PIN supervisor terhadap hash tersimpan (constant-time). */
export function verifySupervisorPin(pin: string, pinHash: string): boolean {
  if (!isValidSupervisorPin(pin)) {
    return false;
  }

  return verifyPin(pin, pinHash);
}
