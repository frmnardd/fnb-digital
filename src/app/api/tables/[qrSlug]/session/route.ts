import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { parseQrSlug, readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import {
  generateTableSessionToken,
  hashSessionToken,
  verifySessionToken,
} from "@/lib/security/token";

/**
 * GET/POST /api/tables/[qrSlug]/session
 *
 * GET  — validasi hasil scan QR meja: kembalikan identitas meja + sesi aktif
 *        (bila ada) beserta penanda `isOwner` untuk cookie milik browser ini.
 * POST — buka sesi meja baru atau bergabung ke sesi aktif yang sudah ada.
 *        Menerbitkan `TableSessionToken` di cookie httpOnly; database hanya
 *        menyimpan hash-nya.
 *
 * Keamanan:
 * - `currentPin` dan `sessionTokenHash` TIDAK pernah dikirim ke klien.
 * - Satu meja hanya boleh punya satu sesi aktif; sesi basi (> 6 jam tanpa
 *   aktivitas) ditutup otomatis di dalam transaksi.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_COOKIE = "fnb_table_session";
const SESSION_TTL_SECONDS = 6 * 60 * 60;
const STALE_SESSION_MS = SESSION_TTL_SECONDS * 1000;

/** Sesi masih dianggap "meja terisi" bila salah satu status ini. */
const OPEN_SESSION_STATUSES: Array<"ACTIVE" | "BILL_REQUESTED"> = ["ACTIVE", "BILL_REQUESTED"];

const createSessionSchema = z
  .object({
    guestCount: z
      .number()
      .int("Jumlah tamu harus bilangan bulat.")
      .min(1, "Jumlah tamu minimal 1.")
      .max(20, "Jumlah tamu maksimal 20.")
      .optional(),
    customerName: z
      .string()
      .trim()
      .min(1, "Nama tidak boleh kosong.")
      .max(60, "Nama maksimal 60 karakter.")
      .optional(),
  })
  .strict();

const tableSelect = {
  id: true,
  tableNumber: true,
  qrSlug: true,
  capacity: true,
  status: true,
  pinEnabled: true,
  isActive: true,
  area: { select: { id: true, name: true, slug: true, floor: true } },
} as const satisfies Prisma.TableSelect;

const sessionSelect = {
  id: true,
  status: true,
  guestCount: true,
  customerName: true,
  openedAt: true,
  lastActivityAt: true,
  closedAt: true,
  sessionTokenHash: true,
} as const satisfies Prisma.TableSessionSelect;

type TableRow = Prisma.TableGetPayload<{ select: typeof tableSelect }>;
type SessionRow = Prisma.TableSessionGetPayload<{ select: typeof sessionSelect }>;
type RouteContext = { params: Promise<{ qrSlug: string }> };

async function findTableOrThrow(qrSlug: string): Promise<TableRow> {
  const table = await db.table.findUnique({ where: { qrSlug }, select: tableSelect });

  if (!table || !table.isActive) {
    throw new ApiError("NOT_FOUND", "Meja tidak ditemukan atau sudah tidak aktif.");
  }

  return table;
}

function toPublicTable(table: TableRow) {
  return {
    id: table.id,
    tableNumber: table.tableNumber,
    qrSlug: table.qrSlug,
    capacity: table.capacity,
    status: table.status,
    pinEnabled: table.pinEnabled,
    area: table.area,
  };
}

function toPublicSession(session: SessionRow, isOwner: boolean) {
  return {
    id: session.id,
    status: session.status,
    guestCount: session.guestCount,
    customerName: session.customerName,
    openedAt: session.openedAt,
    lastActivityAt: session.lastActivityAt,
    closedAt: session.closedAt,
    isOwner,
  };
}

export async function GET(_request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { qrSlug } = await context.params;
    const table = await findTableOrThrow(parseQrSlug(qrSlug));

    const session = await db.tableSession.findFirst({
      where: { tableId: table.id, status: { in: OPEN_SESSION_STATUSES } },
      orderBy: { openedAt: "desc" },
      select: sessionSelect,
    });

    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const isOwner = session && token ? verifySessionToken(token, session.sessionTokenHash) : false;

    return jsonOk({
      table: toPublicTable(table),
      session: session ? toPublicSession(session, isOwner) : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { qrSlug } = await context.params;
    const slug = parseQrSlug(qrSlug);
    // Validasi payload lebih dulu agar request cacat tidak menyentuh database.
    const input = createSessionSchema.parse(await readJsonBody(request));
    const table = await findTableOrThrow(slug);

    const cookieStore = await cookies();
    const existingToken = cookieStore.get(SESSION_COOKIE)?.value ?? null;

    const result = await db.$transaction(async (tx) => {
      const now = new Date();

      // Tutup sesi yang sudah terlalu lama tidak aktif (mencegah sesi menggantung).
      await tx.tableSession.updateMany({
        where: {
          tableId: table.id,
          status: { in: OPEN_SESSION_STATUSES },
          lastActivityAt: { lt: new Date(now.getTime() - STALE_SESSION_MS) },
        },
        data: { status: "CLOSED", closedAt: now },
      });

      const activeSession = await tx.tableSession.findFirst({
        where: { tableId: table.id, status: { in: OPEN_SESSION_STATUSES } },
        orderBy: { openedAt: "desc" },
        select: sessionSelect,
      });

      if (activeSession) {
        const ownsSession =
          existingToken !== null
            ? verifySessionToken(existingToken, activeSession.sessionTokenHash)
            : false;

        // Bila browser ini belum memiliki token sah, rotasi token (pemilik baru).
        const token = ownsSession && existingToken ? existingToken : generateTableSessionToken();

        const updated = await tx.tableSession.update({
          where: { id: activeSession.id },
          data: {
            lastActivityAt: now,
            ...(ownsSession ? {} : { sessionTokenHash: hashSessionToken(token) }),
            ...(input.guestCount === undefined ? {} : { guestCount: input.guestCount }),
            ...(input.customerName === undefined ? {} : { customerName: input.customerName }),
          },
          select: sessionSelect,
        });

        await tx.table.update({ where: { id: table.id }, data: { status: "OCCUPIED" } });

        return { session: updated, token, created: false };
      }

      const token = generateTableSessionToken();

      const created = await tx.tableSession.create({
        data: {
          tableId: table.id,
          status: "ACTIVE",
          guestCount: input.guestCount ?? 1,
          customerName: input.customerName ?? null,
          sessionTokenHash: hashSessionToken(token),
          lastActivityAt: now,
        },
        select: sessionSelect,
      });

      await tx.table.update({ where: { id: table.id }, data: { status: "OCCUPIED" } });

      return { session: created, token, created: true };
    });

    cookieStore.set({
      name: SESSION_COOKIE,
      value: result.token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return jsonOk(
      {
        table: toPublicTable(table),
        session: { ...toPublicSession(result.session, true), isNew: result.created },
      },
      result.created ? 201 : 200,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
