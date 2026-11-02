import { parseQrSlug } from "@/lib/api/request";
import { db } from "@/lib/db";
import { verifySessionToken } from "@/lib/security/token";

/**
 * Data konteks meja untuk halaman pelanggan (dibaca langsung dari database pada
 * server component — bukan lewat HTTP ke API sendiri).
 */

const OPEN_SESSION_STATUSES: Array<"ACTIVE" | "BILL_REQUESTED"> = ["ACTIVE", "BILL_REQUESTED"];

export interface CustomerTableInfo {
  id: string;
  tableNumber: string;
  qrSlug: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "NEEDS_CLEANING";
  area: { id: string; name: string; floor: number };
}

export interface CustomerSessionInfo {
  id: string;
  status: "ACTIVE" | "BILL_REQUESTED" | "CLOSED";
  guestCount: number;
  openedAt: Date;
  /** True bila cookie di browser ini memegang token sesi yang sah. */
  isOwner: boolean;
}

export interface CustomerTableContext {
  table: CustomerTableInfo;
  session: CustomerSessionInfo | null;
}

/**
 * Mengambil meja + sesi aktif berdasarkan slug QR.
 * Mengembalikan `null` bila meja tidak ada / tidak aktif.
 * Melempar error bila database tidak dapat dihubungi (ditangani pemanggil).
 */
export async function getCustomerTableContext(
  qrSlug: string,
  sessionToken: string | null,
): Promise<CustomerTableContext | null> {
  const slug = parseQrSlug(qrSlug);

  const table = await db.table.findUnique({
    where: { qrSlug: slug },
    select: {
      id: true,
      tableNumber: true,
      qrSlug: true,
      capacity: true,
      status: true,
      isActive: true,
      area: { select: { id: true, name: true, floor: true } },
    },
  });

  if (!table || !table.isActive) {
    return null;
  }

  const session = await db.tableSession.findFirst({
    where: { tableId: table.id, status: { in: OPEN_SESSION_STATUSES } },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      status: true,
      guestCount: true,
      openedAt: true,
      sessionTokenHash: true,
    },
  });

  return {
    table: {
      id: table.id,
      tableNumber: table.tableNumber,
      qrSlug: table.qrSlug,
      capacity: table.capacity,
      status: table.status,
      area: table.area,
    },
    session: session
      ? {
          id: session.id,
          status: session.status,
          guestCount: session.guestCount,
          openedAt: session.openedAt,
          isOwner: sessionToken
            ? verifySessionToken(sessionToken, session.sessionTokenHash)
            : false,
        }
      : null,
  };
}
