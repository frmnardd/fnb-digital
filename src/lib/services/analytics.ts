import {
  classifyMenuEngineering,
  getPeakHours,
  groupPaymentMethods,
  groupRevenueByDay,
  summarizeSales,
  type DailyRevenue,
  type MenuEngineeringInput,
  type MenuEngineeringRow,
  type PaymentMixRow,
  type PeakHourRow,
} from "@/lib/analytics";
import { db } from "@/lib/db";

/**
 * Data dashboard analitik back-office.
 */

export interface DashboardKpi {
  revenue: number;
  orderCount: number;
  averageTicket: number;
  itemsSold: number;
}

export interface DashboardData {
  generatedAt: string;
  days: number;
  kpi: DashboardKpi;
  daily: DailyRevenue[];
  paymentMix: PaymentMixRow[];
  peakHours: PeakHourRow[];
  menuEngineering: MenuEngineeringRow[];
}

export async function getDashboardData({ days = 7 }: { days?: number } = {}): Promise<DashboardData> {
  const windowDays = Math.min(90, Math.max(1, Math.trunc(days)));
  const since = new Date(Date.now() - windowDays * 86_400_000);

  const [orders, payments, items] = await Promise.all([
    db.order.findMany({
      where: { status: { not: "CANCELLED" }, createdAt: { gte: since } },
      select: { grandTotal: true, createdAt: true },
    }),
    db.payment.findMany({
      where: { status: "PAID", paidAt: { gte: since } },
      select: { method: true, amountPaid: true },
    }),
    db.orderItem.findMany({
      where: {
        status: { not: "VOIDED" },
        order: { status: { not: "CANCELLED" }, createdAt: { gte: since } },
      },
      select: {
        menuItemId: true,
        menuName: true,
        quantity: true,
        unitPrice: true,
        menuItem: { select: { costPrice: true } },
      },
    }),
  ]);

  const menuRows = new Map<string, MenuEngineeringInput>();
  let itemsSold = 0;

  for (const item of items) {
    itemsSold += item.quantity;

    const key = item.menuItemId ?? `custom:${item.menuName}`;
    const marginPerUnit = item.unitPrice - (item.menuItem?.costPrice ?? 0);
    const existing = menuRows.get(key);

    if (existing) {
      existing.quantitySold += item.quantity;
      existing.revenue += item.unitPrice * item.quantity;
      continue;
    }

    menuRows.set(key, {
      menuItemId: key,
      name: item.menuName,
      quantitySold: item.quantity,
      revenue: item.unitPrice * item.quantity,
      marginPerUnit,
    });
  }

  const sales = summarizeSales(orders);

  return {
    generatedAt: new Date().toISOString(),
    days: windowDays,
    kpi: { ...sales, itemsSold },
    daily: groupRevenueByDay(orders, windowDays),
    paymentMix: groupPaymentMethods(
      payments.map((payment) => ({ method: payment.method, amount: payment.amountPaid })),
    ),
    peakHours: getPeakHours(orders),
    menuEngineering: classifyMenuEngineering([...menuRows.values()]),
  };
}
