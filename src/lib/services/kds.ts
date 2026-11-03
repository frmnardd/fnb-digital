import {
  getKdsSummary,
  groupItemsByOrder,
  type KdsStation,
  type KdsSummary,
  type KdsTicket,
  type KdsTicketItemInput,
} from "@/lib/kds";
import { db } from "@/lib/db";

/**
 * Data board KDS per stasiun (dipakai API & halaman /kds/[station]).
 */

const ACTIVE_ORDER_STATUSES = ["CONFIRMED", "PREPARING", "READY"] as const;
const ACTIVE_ITEM_STATUSES = ["QUEUED", "COOKING"] as const;

export interface KdsBoardData {
  station: KdsStation;
  generatedAt: string;
  tickets: KdsTicket[];
  summary: KdsSummary;
}

function parseModifierNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "object" && entry !== null && "name" in entry) {
        const name = (entry as { name?: unknown }).name;
        return typeof name === "string" ? name : null;
      }

      return null;
    })
    .filter((name): name is string => name !== null && name.length > 0);
}

export async function getKdsBoard(station: KdsStation): Promise<KdsBoardData> {
  const rows = await db.orderItem.findMany({
    where: {
      station,
      status: { in: [...ACTIVE_ITEM_STATUSES] },
      order: { status: { in: [...ACTIVE_ORDER_STATUSES] } },
    },
    orderBy: { queuedAt: "asc" },
    select: {
      id: true,
      orderId: true,
      menuName: true,
      quantity: true,
      modifiers: true,
      notes: true,
      status: true,
      station: true,
      queuedAt: true,
      order: {
        select: {
          orderNumber: true,
          orderType: true,
          tableSession: {
            select: {
              table: { select: { tableNumber: true, area: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  const items: KdsTicketItemInput[] = rows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order.orderNumber,
    tableLabel: row.order.tableSession?.table
      ? `${row.order.tableSession.table.tableNumber} - ${row.order.tableSession.table.area.name}`
      : null,
    orderType: row.order.orderType,
    menuName: row.menuName,
    quantity: row.quantity,
    modifiers: parseModifierNames(row.modifiers),
    note: row.notes,
    status: row.status as "QUEUED" | "COOKING",
    station: row.station,
    queuedAt: row.queuedAt.toISOString(),
  }));

  const tickets = groupItemsByOrder(items);

  return {
    station,
    generatedAt: new Date().toISOString(),
    tickets,
    summary: getKdsSummary(tickets),
  };
}
