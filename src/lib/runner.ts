/**
 * Logika aplikasi pelayan/runner (murni & teruji).
 */

export const WAITER_CALL_LABELS = {
  WATER_TISSUE: "Air / Tisu",
  CLEAN_TABLE: "Bersihkan Meja",
  ASK_MENU: "Tanya Menu",
  REQUEST_BILL: "Minta Bill",
} as const;

export type WaiterCallTypeKey = keyof typeof WAITER_CALL_LABELS;

export function getWaiterCallLabel(type: string): string {
  return (WAITER_CALL_LABELS as Record<string, string>)[type] ?? type;
}

export interface ReadyItemInput {
  id: string;
  orderId: string;
  orderNumber: string;
  tableLabel: string | null;
  menuName: string;
  quantity: number;
  modifiers: string[];
  station: string;
  readyAt: string | null;
}

export interface ReadyTicket {
  orderId: string;
  orderNumber: string;
  tableLabel: string | null;
  /** Waktu siap paling awal pada tiket. */
  readyAt: string | null;
  items: ReadyItemInput[];
}

/** Mengelompokkan item siap antar menjadi tiket, terurut waktu siap paling awal. */
export function groupReadyItemsByOrder(items: readonly ReadyItemInput[]): ReadyTicket[] {
  const tickets = new Map<string, ReadyTicket>();

  for (const item of items) {
    const existing = tickets.get(item.orderId);

    if (existing) {
      existing.items.push(item);

      if (
        item.readyAt !== null &&
        (existing.readyAt === null || new Date(item.readyAt).getTime() < new Date(existing.readyAt).getTime())
      ) {
        existing.readyAt = item.readyAt;
      }

      continue;
    }

    tickets.set(item.orderId, {
      orderId: item.orderId,
      orderNumber: item.orderNumber,
      tableLabel: item.tableLabel,
      readyAt: item.readyAt,
      items: [item],
    });
  }

  return [...tickets.values()].sort((a, b) => {
    const timeA = a.readyAt ? new Date(a.readyAt).getTime() : Number.MAX_SAFE_INTEGER;
    const timeB = b.readyAt ? new Date(b.readyAt).getTime() : Number.MAX_SAFE_INTEGER;
    return timeA - timeB;
  });
}

export interface WaiterCallLike {
  id: string;
  type: string;
  status: "PENDING" | "ACKNOWLEDGED" | "RESOLVED";
  tableLabel: string;
  createdAt: string;
}

/** Panggilan belum ditangani lebih dulu, lalu yang sedang ditangani. */
export function sortWaiterCalls<T extends WaiterCallLike>(calls: readonly T[]): T[] {
  const weight: Record<WaiterCallLike["status"], number> = {
    PENDING: 0,
    ACKNOWLEDGED: 1,
    RESOLVED: 2,
  };

  return [...calls].sort((a, b) => {
    const byStatus = weight[a.status] - weight[b.status];

    if (byStatus !== 0) {
      return byStatus;
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export interface RunnerSummary {
  readyTickets: number;
  readyItems: number;
  pendingCalls: number;
  dirtyTables: number;
}

export function getRunnerSummary({
  readyTickets,
  calls,
  dirtyTables,
}: {
  readyTickets: readonly ReadyTicket[];
  calls: readonly WaiterCallLike[];
  dirtyTables: number;
}): RunnerSummary {
  return {
    readyTickets: readyTickets.length,
    readyItems: readyTickets.reduce((total, ticket) => total + ticket.items.length, 0),
    pendingCalls: calls.filter((call) => call.status === "PENDING").length,
    dirtyTables,
  };
}
