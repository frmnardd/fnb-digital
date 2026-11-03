import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/errors";

import {
  hasStaffRole,
  signStaffSession,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_TTL_SECONDS,
  verifyStaffSession,
  type StaffRole,
  type StaffSessionPayload,
} from "./session";

/**
 * Helper sesi staf untuk Server Component & Route Handler.
 * Jangan diimpor dari komponen client.
 */

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET belum diatur (minimal 32 karakter).");
  }

  return secret;
}

export async function setStaffSessionCookie(input: {
  staffId: string;
  role: StaffRole;
  name: string;
}): Promise<void> {
  const { token } = await signStaffSession(input, getSessionSecret());
  const store = await cookies();

  store.set(STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STAFF_SESSION_TTL_SECONDS,
  });
}

export async function clearStaffSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(STAFF_SESSION_COOKIE);
}

export async function getStaffSession(): Promise<StaffSessionPayload | null> {
  const token = (await cookies()).get(STAFF_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifyStaffSession(token, getSessionSecret());
  } catch {
    return null;
  }
}

/** Untuk Server Component: redirect ke /login bila belum masuk atau peran tidak cocok. */
export async function requireStaffPage(
  roles?: readonly StaffRole[],
): Promise<StaffSessionPayload> {
  const session = await getStaffSession();

  if (!session) {
    redirect("/login");
  }

  if (!hasStaffRole(session, roles)) {
    redirect("/login?error=forbidden");
  }

  return session;
}

/** Untuk Route Handler: melempar ApiError 401/403. */
export async function requireStaffApi(
  roles?: readonly StaffRole[],
): Promise<StaffSessionPayload> {
  const session = await getStaffSession();

  if (!session) {
    throw new ApiError("UNAUTHORIZED", "Silakan login staf terlebih dahulu.");
  }

  if (!hasStaffRole(session, roles)) {
    throw new ApiError("FORBIDDEN", "Peran staf ini tidak memiliki akses ke aksi tersebut.");
  }

  return session;
}
