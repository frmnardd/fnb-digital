/**
 * Sesi staf: token bertanda tangan HMAC-SHA256 (stateless, edge-safe).
 *
 * Modul ini sengaja TIDAK mengimpor `node:crypto`, Prisma, atau `next/headers`
 * agar bisa dipakai di middleware (Edge Runtime) sekaligus di route handler.
 */

export const STAFF_ROLES = ["ADMIN", "CASHIER", "KITCHEN", "WAITER"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_SESSION_COOKIE = "fnb_staff_session";

/** Masa berlaku sesi staf: 12 jam (satu shift panjang). */
export const STAFF_SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface StaffSessionPayload {
  /** `Staff.id` */
  sub: string;
  role: StaffRole;
  name: string;
  /** Kedaluwarsa dalam epoch detik. */
  exp: number;
}

export interface SignStaffSessionInput {
  staffId: string;
  role: StaffRole;
  name: string;
  ttlSeconds?: number;
  now?: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signData(data: string, secret: string): Promise<Uint8Array> {
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));

  return new Uint8Array(signature);
}

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

/** Membuat token sesi staf. Melempar error bila `SESSION_SECRET` terlalu pendek. */
export async function signStaffSession(
  input: SignStaffSessionInput,
  secret: string,
): Promise<{ token: string; payload: StaffSessionPayload }> {
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET minimal 32 karakter untuk menandatangani sesi staf.");
  }

  const now = input.now ?? Date.now();
  const ttlSeconds = input.ttlSeconds ?? STAFF_SESSION_TTL_SECONDS;

  const payload: StaffSessionPayload = {
    sub: input.staffId,
    role: input.role,
    name: input.name,
    exp: Math.floor(now / 1000) + ttlSeconds,
  };

  const data = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = toBase64Url(await signData(data, secret));

  return { token: `${data}.${signature}`, payload };
}

function parsePayload(data: string, now: number): StaffSessionPayload | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(data)));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const candidate = parsed as Partial<StaffSessionPayload>;

  if (
    typeof candidate.sub !== "string" ||
    candidate.sub.length === 0 ||
    !isStaffRole(candidate.role) ||
    typeof candidate.name !== "string" ||
    typeof candidate.exp !== "number"
  ) {
    return null;
  }

  if (candidate.exp * 1000 <= now) {
    return null;
  }

  return { sub: candidate.sub, role: candidate.role, name: candidate.name, exp: candidate.exp };
}

/** Memverifikasi token; mengembalikan `null` bila rusak, dipalsukan, atau kedaluwarsa. */
export async function verifyStaffSession(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<StaffSessionPayload | null> {
  if (!token || !secret || secret.length < 32) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [data, signature] = parts;

  if (!data || !signature) {
    return null;
  }

  const expected = await signData(data, secret);
  const provided = fromBase64Url(signature);

  if (expected.length !== provided.length) {
    return null;
  }

  // Perbandingan constant-time sederhana.
  let difference = 0;

  for (let index = 0; index < expected.length; index += 1) {
    difference |= (expected[index] ?? 0) ^ (provided[index] ?? 0);
  }

  if (difference !== 0) {
    return null;
  }

  return parsePayload(data, now);
}

/** `true` bila peran sesi termasuk daftar yang diizinkan (kosong = semua staf). */
export function hasStaffRole(
  session: Pick<StaffSessionPayload, "role">,
  roles?: readonly StaffRole[],
): boolean {
  if (!roles || roles.length === 0) {
    return true;
  }

  return roles.includes(session.role);
}
