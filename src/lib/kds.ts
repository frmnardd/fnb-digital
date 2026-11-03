/**
 * Logika Kitchen Display System (KDS) — murni & teruji.
 */

export const KDS_STATION_SLUGS = {
  kitchen: "KITCHEN",
  bar: "BAR",
  pastry: "PASTRY",
} as const;

export type KdsStationSlug = keyof typeof KDS_STATION_SLUGS;
export type KdsStation = (typeof KDS_STATION_SLUGS)[KdsStationSlug];

export const KDS_STATION_LABELS: Record<KdsStation, string> = {
  KITCHEN: "Dapur",
  BAR: "Bar",
  PASTRY: "Pastry",
};

export function parseStationSlug(slug: string): KdsStation | null {
  const normalized = slug.trim().toLowerCase();

  if (!(normalized in KDS_STATION_SLUGS)) {
    return null;
  }

  return KDS_STATION_SLUGS[normalized as KdsStationSlug];
}

/** SLA default (menit) sebelum tiket dianggap terlambat. */
export const KDS_SLA_MINUTES = 10;

export type TicketAgeState = "FRESH" | "WARNING" | "OVERDUE";

export interface TicketAge {
  state: TicketAgeState;
  agingMinutes: number;
}

/** Menghitung umur tiket: hijau (<50% SLA), kuning (>=50%), merah (>SLA). */
export function getTicketAgeState(
  queuedAt: Date,
  now: Date = new Date(),
  slaMinutes: number = KDS_SLA_MINUTES,
): TicketAge {
  const elapsedMs = now.getTime() - queuedAt.getTime();
  const agingMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  const warningThreshold = Math.floor(slaMinutes / 2);

  if (agingMinutes > slaMinutes) {
    return { state: "OVERDUE", agingMinutes };
  }

  if (agingMinutes >= warningThreshold) {
    return { state: "WARNING", agingMinutes };
  }

  return { state: "FRESH", agingMinutes };
}

export interface KdsTicketItemInput {
  id: string;
  orderId: string;
  orderNumber: string;
  tableLabel: string | null;
  orderType: "DINE_IN" | "TAKEAWAY";
  menuName: string;
  quantity: number;
  modifiers: string[];
  note: string | null;
  status: "QUEUED" | "COOKING";
  station: KdsStation;
  queuedAt: string;
}

export interface KdsTicket {
  orderId: string;
  orderNumber: string;
  tableLabel: string | null;
  orderType: "DINE_IN" | "TAKEAWAY";
  station: KdsStation;
  /** Waktu masuk paling awal di antara item tiket. */
  queuedAt: string;
  items: KdsTicketItemInput[];
}

/** Mengelompokkan item menjadi tiket per pesanan (urutan stabil berdasarkan waktu masuk). */
export function groupItemsByOrder(items: readonly KdsTicketItemInput[]): KdsTicket[] {
  const tickets = new Map<string, KdsTicket>();

  for (const item of items) {
    const existing = tickets.get(item.orderId);

    if (existing) {
      existing.items.push(item);

      if (new Date(item.queuedAt).getTime() < new Date(existing.queuedAt).getTime()) {
        existing.queuedAt = item.queuedAt;
      }

      continue;
    }

    tickets.set(item.orderId, {
      orderId: item.orderId,
      orderNumber: item.orderNumber,
      tableLabel: item.tableLabel,
      orderType: item.orderType,
      station: item.station,
      queuedAt: item.queuedAt,
      items: [item],
    });
  }

  return [...tickets.values()].sort(
    (a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime(),
  );
}

export interface KdsSummary {
  tickets: number;
  items: number;
  overdue: number;
}

export function getKdsSummary(
  tickets: readonly KdsTicket[],
  now: Date = new Date(),
  slaMinutes: number = KDS_SLA_MINUTES,
): KdsSummary {
  let items = 0;
  let overdue = 0;

  for (const ticket of tickets) {
    items += ticket.items.length;

    const age = getTicketAgeState(new Date(ticket.queuedAt), now, slaMinutes);

    if (age.state === "OVERDUE") {
      overdue += 1;
    }
  }

  return { tickets: tickets.length, items, overdue };
}
