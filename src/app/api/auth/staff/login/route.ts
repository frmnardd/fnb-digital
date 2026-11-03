import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { setStaffSessionCookie } from "@/lib/auth/staff";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { verifyPin } from "@/lib/security/pin";
import { isPinLocked, registerPinAttempt, resetPinAttempts } from "@/lib/security/pin-attempts";

/**
 * POST /api/auth/staff/login
 *
 * Login staf dengan email + PIN 6 digit. Sukses → cookie sesi httpOnly (12 jam).
 * Dibatasi 5 percobaan / 10 menit per (email + IP).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email tidak valid."),
    pin: z.string().regex(/^\d{6}$/, "PIN harus 6 digit angka."),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  try {
    getServerEnv();

    const input = bodySchema.parse(await readJsonBody(request));

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const attemptKey = `staff-login:${input.email}:${clientIp}`;

    if (isPinLocked(attemptKey)) {
      throw new ApiError(
        "TOO_MANY_REQUESTS",
        "Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.",
        undefined,
        { "Retry-After": "600" },
      );
    }

    const staff = await db.staff.findUnique({
      where: { email: input.email },
      select: { id: true, name: true, role: true, pinHash: true, isActive: true },
    });

    // Pesan seragam agar tidak membocorkan email mana yang terdaftar.
    if (!staff || !staff.isActive) {
      registerPinAttempt(attemptKey);
      throw new ApiError("UNAUTHORIZED", "Email atau PIN salah.");
    }

    if (!verifyPin(input.pin, staff.pinHash)) {
      const state = registerPinAttempt(attemptKey);

      if (state.locked) {
        throw new ApiError(
          "TOO_MANY_REQUESTS",
          "Terlalu banyak percobaan PIN. Minta bantuan admin.",
          { remainingAttempts: 0, retryAfterSeconds: state.retryAfterSeconds },
          { "Retry-After": String(state.retryAfterSeconds) },
        );
      }

      throw new ApiError("UNAUTHORIZED", "Email atau PIN salah.", {
        remainingAttempts: state.remainingAttempts,
      });
    }

    resetPinAttempts(attemptKey);

    await setStaffSessionCookie({ staffId: staff.id, role: staff.role, name: staff.name });

    return jsonOk({
      staff: { id: staff.id, name: staff.name, role: staff.role },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
