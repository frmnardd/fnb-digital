import type { NextRequest } from "next/server";

import { ApiError } from "./errors";

/**
 * Helper bersama untuk route handler API.
 */

const QR_SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

/** Menormalkan & memvalidasi slug QR meja (`/t/[tableSlug]`). */
export function parseQrSlug(raw: string): string {
  const slug = raw.trim().toLowerCase();

  if (!QR_SLUG_PATTERN.test(slug)) {
    throw new ApiError("BAD_REQUEST", "Kode QR meja tidak valid.");
  }

  return slug;
}

/** Membaca body JSON; body kosong diperlakukan sebagai `{}`. */
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  const raw = await request.text();

  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError("BAD_REQUEST", "Body permintaan bukan JSON yang valid.");
  }
}
