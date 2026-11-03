import { db } from "@/lib/db";
import type { PosFloorArea } from "@/types/pos";

/**
 * Data peta meja POS: area + meja + sesi aktif + total bill berjalan.
 * Dipakai bersama oleh route `GET /api/pos/tables` dan halaman `/cashier/floor`.
 */

const OPEN_SESSION_STATUSES: Array<"ACTIVE" | "BILL_REQUESTED"> = ["ACTIVE", "BILL_REQUESTED"];

export async function getPosFloorPlan(): Promise<PosFloorArea[]> {
  const areas = await db.area.findMany({
    where: { isActive: true },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      floor: true,
      tables: {
        where: { isActive: true },
        orderBy: { tableNumber: "asc" },
        select: {
          id: true,
          tableNumber: true,
          capacity: true,
          status: true,
          positionX: true,
          positionY: true,
          sessions: {
            where: { status: { in: OPEN_SESSION_STATUSES } },
            orderBy: { openedAt: "desc" },
            take: 1,
            select: {
              id: true,
              guestCount: true,
              openedAt: true,
              orders: {
                where: { status: { not: "CANCELLED" } },
                select: { grandTotal: true },
              },
            },
          },
        },
      },
    },
  });

  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    floor: area.floor,
    tables: area.tables.map((table) => {
      const session = table.sessions[0] ?? null;

      return {
        id: table.id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        status: table.status,
        positionX: table.positionX,
        positionY: table.positionY,
        session: session
          ? {
              id: session.id,
              guestCount: session.guestCount,
              openedAt: session.openedAt.toISOString(),
            }
          : null,
        runningBill: session
          ? session.orders.reduce((total, order) => total + order.grandTotal, 0)
          : 0,
      };
    }),
  }));
}
