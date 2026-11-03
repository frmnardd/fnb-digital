/**
 * Perhitungan analitik penjualan & Menu Engineering (murni & teruji).
 */

export const ANALYTICS_TIME_ZONE = "Asia/Jakarta";

export interface SalesOrderLike {
  grandTotal: number;
  createdAt: string | Date;
}

export interface SalesSummary {
  revenue: number;
  orderCount: number;
  averageTicket: number;
}

export function summarizeSales(orders: readonly SalesOrderLike[]): SalesSummary {
  const revenue = orders.reduce((total, order) => total + order.grandTotal, 0);
  const orderCount = orders.length;

  return {
    revenue,
    orderCount,
    averageTicket: orderCount === 0 ? 0 : Math.round(revenue / orderCount),
  };
}

function dayKey(value: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(value));
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

/** Seri harian (termasuk hari tanpa transaksi) untuk N hari terakhir. */
export function groupRevenueByDay(
  orders: readonly SalesOrderLike[],
  days: number,
  now: Date = new Date(),
  timeZone: string = ANALYTICS_TIME_ZONE,
): DailyRevenue[] {
  const windowDays = Math.max(1, Math.trunc(days));
  const buckets = new Map<string, DailyRevenue>();
  const series: DailyRevenue[] = [];

  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - offset * 86_400_000);
    const key = dayKey(date, timeZone);

    if (!buckets.has(key)) {
      const row: DailyRevenue = { date: key, revenue: 0, orders: 0 };
      buckets.set(key, row);
      series.push(row);
    }
  }

  for (const order of orders) {
    const bucket = buckets.get(dayKey(order.createdAt, timeZone));

    if (bucket) {
      bucket.revenue += order.grandTotal;
      bucket.orders += 1;
    }
  }

  return series;
}

export interface PaymentLike {
  method: string;
  amount: number;
}

export interface PaymentMixRow {
  method: string;
  amount: number;
  count: number;
  share: number;
}

export function groupPaymentMethods(payments: readonly PaymentLike[]): PaymentMixRow[] {
  const totals = new Map<string, { amount: number; count: number }>();

  for (const payment of payments) {
    const existing = totals.get(payment.method) ?? { amount: 0, count: 0 };
    totals.set(payment.method, {
      amount: existing.amount + payment.amount,
      count: existing.count + 1,
    });
  }

  const grandTotal = [...totals.values()].reduce((total, entry) => total + entry.amount, 0);

  return [...totals.entries()]
    .map(([method, entry]) => ({
      method,
      amount: entry.amount,
      count: entry.count,
      share: grandTotal === 0 ? 0 : Math.round((entry.amount / grandTotal) * 1000) / 1000,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface PeakHourRow {
  hour: number;
  orders: number;
}

export function getPeakHours(
  orders: readonly SalesOrderLike[],
  timeZone: string = ANALYTICS_TIME_ZONE,
): PeakHourRow[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }));

  for (const order of orders) {
    const label = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone,
    }).format(new Date(order.createdAt));
    const hour = Number.parseInt(label, 10);

    if (Number.isFinite(hour) && hour >= 0 && hour < 24) {
      const bucket = buckets[hour];

      if (bucket) {
        bucket.orders += 1;
      }
    }
  }

  return buckets;
}

export interface MenuEngineeringInput {
  menuItemId: string;
  name: string;
  quantitySold: number;
  revenue: number;
  marginPerUnit: number;
}

export type MenuQuadrant = "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG";

export interface MenuEngineeringRow extends MenuEngineeringInput {
  quadrant: MenuQuadrant;
}

export function getMedian(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Kuadran Menu Engineering:
 * - STAR      : populer & margin tinggi
 * - PLOWHORSE : populer, margin rendah
 * - PUZZLE    : kurang populer, margin tinggi
 * - DOG       : kurang populer & margin rendah
 */
export function classifyMenuEngineering(
  rows: readonly MenuEngineeringInput[],
): MenuEngineeringRow[] {
  if (rows.length === 0) {
    return [];
  }

  const medianPopularity = getMedian(rows.map((row) => row.quantitySold));
  const medianMargin = getMedian(rows.map((row) => row.marginPerUnit));

  return rows.map((row) => {
    const popular = row.quantitySold >= medianPopularity;
    const profitable = row.marginPerUnit >= medianMargin;

    const quadrant: MenuQuadrant = popular
      ? profitable
        ? "STAR"
        : "PLOWHORSE"
      : profitable
        ? "PUZZLE"
        : "DOG";

    return { ...row, quadrant };
  });
}
