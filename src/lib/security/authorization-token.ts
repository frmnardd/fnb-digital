import { createHmac, timingSafeEqual } from "node:crypto";

import { getSessionSecret } from "./secret";

/**
 * Token otorisasi supervisor (sekali pakai, berlaku singkat).
 *
 * Dipakai setelah PIN 6-digit supervisor terverifikasi, mis. untuk Void Item,
 * Refund, atau Diskon Manual. Token ditandatangani HMAC-SHA256 dengan
 * `SESSION_SECRET` sehingga tidak bisa dipalsukan dari sisi klien.
 */

export const SUPERVISOR_ACTIONS = ["VOID_ITEM", "REFUND", "MANUAL_DISCOUNT"] as const;

export type SupervisorAction = (typeof SUPERVISOR_ACTIONS)[number];

export const AUTHORIZATION_TTL_MS = 5 * 60 * 1000;

export interface AuthorizationPayload {
  /** ID staf pemberi otorisasi (`Staff.id`). */
  sub: string;
  act: SupervisorAction;
  /** ID entitas target (mis. `OrderItem.id`), boleh null. */
  tid: string | null;
  /** Waktu terbit (epoch ms). */
  iat: number;
  /** Waktu kedaluwarsa (epoch ms). */
  exp: number;
}

export type AuthorizationVerification =
  | { valid: true; payload: AuthorizationPayload }
  | { valid: false; reason: "MALFORMED" | "BAD_SIGNATURE" | "EXPIRED" };

function sign(data: string): Buffer {
  return createHmac("sha256", getSessionSecret()).update(`authorization:${data}`).digest();
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createAuthorizationToken({
  staffId,
  action,
  targetId = null,
  ttlMs = AUTHORIZATION_TTL_MS,
  now = Date.now(),
}: {
  staffId: string;
  action: SupervisorAction;
  targetId?: string | null;
  ttlMs?: number;
  now?: number;
}): { token: string; payload: AuthorizationPayload } {
  const payload: AuthorizationPayload = {
    sub: staffId,
    act: action,
    tid: targetId,
    iat: now,
    exp: now + ttlMs,
  };

  const data = encode(JSON.stringify(payload));
  const signature = sign(data).toString("base64url");

  return { token: `${data}.${signature}`, payload };
}

function isSupervisorAction(value: unknown): value is SupervisorAction {
  return typeof value === "string" && (SUPERVISOR_ACTIONS as readonly string[]).includes(value);
}

export function verifyAuthorizationToken(
  token: string,
  now: number = Date.now(),
): AuthorizationVerification {
  const parts = token.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: "MALFORMED" };
  }

  const [data, signature] = parts as [string, string];
  const expected = sign(data);
  const received = Buffer.from(signature, "base64url");

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { valid: false, reason: "BAD_SIGNATURE" };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(decode(data));
  } catch {
    return { valid: false, reason: "MALFORMED" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { valid: false, reason: "MALFORMED" };
  }

  const candidate = parsed as Partial<AuthorizationPayload>;

  if (
    typeof candidate.sub !== "string" ||
    !isSupervisorAction(candidate.act) ||
    typeof candidate.iat !== "number" ||
    typeof candidate.exp !== "number" ||
    (candidate.tid !== null && candidate.tid !== undefined && typeof candidate.tid !== "string")
  ) {
    return { valid: false, reason: "MALFORMED" };
  }

  if (candidate.exp <= now) {
    return { valid: false, reason: "EXPIRED" };
  }

  return {
    valid: true,
    payload: {
      sub: candidate.sub,
      act: candidate.act,
      tid: candidate.tid ?? null,
      iat: candidate.iat,
      exp: candidate.exp,
    },
  };
}
