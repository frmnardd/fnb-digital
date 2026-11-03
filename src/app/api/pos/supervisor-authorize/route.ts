import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import {
  AUTHORIZATION_TTL_MS,
  createAuthorizationToken,
  SUPERVISOR_ACTIONS,
} from "@/lib/security/authorization-token";
import {
  isPinLocked,
  registerPinAttempt,
  resetPinAttempts,
} from "@/lib/security/pin-attempts";
import { verifySupervisorPin } from "@/lib/security/supervisor-pin";

/**
 * POST /api/pos/supervisor-authorize
 *
 * Memverifikasi PIN 6-digit supervisor untuk tindakan sensitif kasir (void item,
 * refund, diskon manual). Bila berhasil, mengembalikan token otorisasi
 * bertanda tangan (berlaku 5 menit) yang dapat diverifikasi endpoint aksi.
 *
 * Keamanan: PIN tidak pernah dikembalikan; pembatasan 5 percobaan / 10 menit
 * per (email + IP) memakai `pin-attempts`.
 *
 * TODO(RBAC): endpoint ini belum memakai sesi staf; ganti `staffEmail` di body
 * dengan identitas dari sesi setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    staffEmail: z.string().trim().toLowerCase().email("Email staf tidak valid."),
    pin: z.string().regex(/^\d{6}$/, "PIN supervisor harus 6 digit angka."),
    action: z.enum(SUPERVISOR_ACTIONS),
    targetId: z.string().min(1).max(64).optional(),
  })
  .strict();

const ALLOWED_ROLES = ["ADMIN", "CASHIER"] as const;

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const input = bodySchema.parse(await readJsonBody(request));

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const attemptKey = `supervisor:${input.staffEmail}:${clientIp}`;

    if (isPinLocked(attemptKey)) {
      throw new ApiError(
        "TOO_MANY_REQUESTS",
        "Terlalu banyak percobaan PIN. Coba lagi beberapa menit lagi.",
        undefined,
        { "Retry-After": "600" },
      );
    }

    const staff = await db.staff.findUnique({
      where: { email: input.staffEmail },
      select: { id: true, name: true, role: true, pinHash: true, isActive: true },
    });

    // Jangan membocorkan apakah email terdaftar atau tidak.
    if (!staff || !staff.isActive || !(ALLOWED_ROLES as readonly string[]).includes(staff.role)) {
      registerPinAttempt(attemptKey);
      throw new ApiError("UNAUTHORIZED", "PIN atau akun supervisor tidak valid.");
    }

    if (!verifySupervisorPin(input.pin, staff.pinHash)) {
      const state = registerPinAttempt(attemptKey);

      if (state.locked) {
        throw new ApiError(
          "TOO_MANY_REQUESTS",
          "Terlalu banyak percobaan PIN. Minta bantuan admin.",
          { remainingAttempts: 0, retryAfterSeconds: state.retryAfterSeconds },
          { "Retry-After": String(state.retryAfterSeconds) },
        );
      }

      throw new ApiError("UNAUTHORIZED", "PIN supervisor salah.", {
        remainingAttempts: state.remainingAttempts,
      });
    }

    resetPinAttempts(attemptKey);

    const { token, payload } = createAuthorizationToken({
      staffId: staff.id,
      action: input.action,
      targetId: input.targetId ?? null,
    });

    return jsonOk({
      authorized: true,
      action: input.action,
      staff: { id: staff.id, name: staff.name, role: staff.role },
      token,
      expiresAt: new Date(payload.exp).toISOString(),
      ttlMs: AUTHORIZATION_TTL_MS,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
