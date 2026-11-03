import { NextResponse } from "next/server";

import { handleRouteError, jsonOk } from "@/lib/api/errors";
import { clearStaffSessionCookie } from "@/lib/auth/staff";

/**
 * POST /api/auth/staff/logout — menghapus cookie sesi staf (untuk fetch/AJAX).
 * GET  /api/auth/staff/logout — versi tautan: hapus cookie lalu kembali ke /login.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    await clearStaffSessionCookie();

    return jsonOk({ loggedOut: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(): Promise<Response> {
  try {
    await clearStaffSessionCookie();

    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  } catch (error) {
    return handleRouteError(error);
  }
}
