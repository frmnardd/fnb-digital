import { NextResponse, type NextRequest } from "next/server";

import {
  hasStaffRole,
  STAFF_SESSION_COOKIE,
  verifyStaffSession,
} from "@/lib/auth/session";

/**
 * Middleware proteksi area staf.
 *
 * - Halaman `/cashier`, `/kds`, `/runner`, `/admin` → redirect ke `/login?next=…`
 * - API `/api/pos`, `/api/kds`, `/api/runner`, `/api/admin` → 401 JSON
 * - Area admin hanya untuk peran ADMIN (403 / redirect ke /cashier)
 *
 * Verifikasi signature dilakukan di sini (bukan hanya mengecek keberadaan cookie).
 */

const STAFF_PAGE_PREFIXES = ["/cashier", "/kds", "/runner", "/admin"] as const;
const STAFF_API_PREFIXES = ["/api/pos", "/api/kds", "/api/runner", "/api/admin"] as const;
const ADMIN_PREFIXES = ["/admin", "/api/admin"] as const;

function matches(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (!matches(pathname, [...STAFF_PAGE_PREFIXES, ...STAFF_API_PREFIXES])) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api/");
  const secret = process.env.SESSION_SECRET ?? "";
  const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value ?? "";

  let session = null;

  try {
    session = token ? await verifyStaffSession(token, secret) : null;
  } catch {
    session = null;
  }

  if (!session) {
    if (isApi) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Silakan login staf terlebih dahulu.",
          },
        },
        { status: 401 },
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (matches(pathname, ADMIN_PREFIXES) && !hasStaffRole(session, ["ADMIN"])) {
    if (isApi) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Hanya admin yang boleh mengakses area ini.",
          },
        },
        { status: 403 },
      );
    }

    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/cashier";
    deniedUrl.search = "?error=forbidden";

    return NextResponse.redirect(deniedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/cashier/:path*",
    "/kds/:path*",
    "/runner/:path*",
    "/admin/:path*",
    "/api/pos/:path*",
    "/api/kds/:path*",
    "/api/runner/:path*",
    "/api/admin/:path*",
  ],
};
