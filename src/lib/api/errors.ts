import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Kontrak respons API FnB Digital.
 *
 * Sukses : { data: ... }
 * Gagal  : { error: { code, message, details? } }
 *
 * Semua route handler WAJIB memakai `ApiError`/`jsonOk` (bukan `NextResponse.json`
 * ad-hoc) agar kode status, header, dan bentuk respons konsisten di semua modul.
 */

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
};

export type ApiHeaders = Record<string, string>;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly headers?: ApiHeaders;

  constructor(code: ApiErrorCode, message: string, details?: unknown, headers?: ApiHeaders) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
    this.headers = headers;
  }
}

export function jsonOk<T>(data: T, status: number = 200, headers?: ApiHeaders): NextResponse {
  return NextResponse.json({ data }, { status, headers });
}

/** Mengubah error apa pun menjadi respons JSON yang seragam. */
export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      { status: error.status, headers: error.headers },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data yang dikirim tidak valid.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: STATUS_BY_CODE.VALIDATION_ERROR },
    );
  }

  console.error("[api] unexpected error:", error);

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server." } },
    { status: STATUS_BY_CODE.INTERNAL_ERROR },
  );
}
