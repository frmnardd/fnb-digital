import { db } from "@/lib/db";
import {
  getRunnerSummary,
  groupReadyItemsByOrder,
  sortWaiterCalls,
  type ReadyItemInput,
  type ReadyTicket,
  type RunnerSummary,
  type WaiterCallLike,
} from "@/lib/runner";

/**
 * Data aplikasi pelayan/runner (dipakai API & halaman /runner).
 */

export interface RunnerCallView extends WaiterCallLike {
  note: string | null;
}

export interface DirtyTableView {
  id: string;
  tableNumber: string;
  areaName: string;
}

export interface RunnerData {
  generatedAt: string;
  readyTickets: ReadyTicket[];
  waiterCalls: RunnerCallView[];
  dirtyTables: DirtyTableView[];
  summary: RunnerSummary;
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

export async function getRunnerData(): Promise<RunnerData> {
  const [items, calls, dirtyTables] = await Promise.all([
    db.orderItem.findMany({
      where: {
        status: "READY",
        order: { status: { notIn: ["CANCELLED", "COMPLETED"] } },
      },
      orderBy: { readyAt: "asc" },
      select: {
        id: true,
        orderId: true,
        menuName: true,
        quantity: true,
        modifiers: true,
        station: true,
        readyAt: true,
        order: {
          select: {
            orderNumber: true,
            tableSession: {
              select: {
                table: { select: { tableNumber: true, area: { select: { name: true } } } },
              },
            },
          },
        },
      },
    }),
    db.waiterCall.findMany({
      where: { status: { in: ["PENDING", "ACKNOWLEDGED"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        status: true,
        note: true,
        createdAt: true,
        table: { select: { tableNumber: true, area: { select: { name: true } } } },
      },
    }),
    db.table.findMany({
      where: { status: "NEEDS_CLEANING", isActive: true },
      orderBy: { tableNumber: "asc" },
      select: { id: true, tableNumber: true, area: { select: { name: true } } },
    }),
  ]);

  const readyItems: ReadyItemInput[] = items.map((item) => ({
    id: item.id,
    orderId: item.orderId,
    orderNumber: item.order.orderNumber,
    tableLabel: item.order.tableSession?.table
      ? `${item.order.tableSession.table.tableNumber} - ${item.order.tableSession.table.area.name}`
      : null,
    menuName: item.menuName,
    quantity: item.quantity,
    modifiers: parseModifierNames(item.modifiers),
    station: item.station,
    readyAt: item.readyAt?.toISOString() ?? null,
  }));

  const readyTickets = groupReadyItemsByOrder(readyItems);

  const waiterCalls: RunnerCallView[] = sortWaiterCalls(
    calls.map((call) => ({
      id: call.id,
      type: call.type,
      status: call.status as WaiterCallLike["status"],
      tableLabel: `${call.table.tableNumber} - ${call.table.area.name}`,
      createdAt: call.createdAt.toISOString(),
      note: call.note,
    })),
  );

  const dirtyViews: DirtyTableView[] = dirtyTables.map((table) => ({
    id: table.id,
    tableNumber: table.tableNumber,
    areaName: table.area.name,
  }));

  return {
    generatedAt: new Date().toISOString(),
    readyTickets,
    waiterCalls,
    dirtyTables: dirtyViews,
    summary: getRunnerSummary({
      readyTickets,
      calls: waiterCalls,
      dirtyTables: dirtyViews.length,
    }),
  };
}
