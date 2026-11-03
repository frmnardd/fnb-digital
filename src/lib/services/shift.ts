import { db } from "@/lib/db";
import { buildShiftSummary, type CashDrawerTypeKey } from "@/lib/shift";

/**
 * Ringkasan shift kasir yang sedang terbuka (dipakai API & halaman /cashier/shift).
 */

export interface ShiftLogView {
  id: string;
  type: CashDrawerTypeKey;
  amount: number;
  reason: string | null;
  createdAt: string;
}

export interface CurrentShiftView {
  id: string;
  staffId: string;
  staffName: string;
  status: "OPEN" | "CLOSED";
  startingCash: number;
  openedAt: string;
  closedAt: string | null;
  expectedCash: number;
  actualEndingCash: number | null;
  variance: number | null;
  sales: number;
  cashIn: number;
  cashOut: number;
  refunds: number;
  cashTransactions: number;
  logs: ShiftLogView[];
}

export async function getCurrentShift(staffEmail: string): Promise<CurrentShiftView | null> {
  const staff = await db.staff.findUnique({
    where: { email: staffEmail },
    select: { id: true, name: true },
  });

  if (!staff) {
    return null;
  }

  const shift = await db.cashierShift.findFirst({
    where: { staffId: staff.id, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      status: true,
      startingCash: true,
      openedAt: true,
      closedAt: true,
      actualEndingCash: true,
      variance: true,
      drawerLogs: {
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, amount: true, reason: true, createdAt: true },
      },
    },
  });

  if (!shift) {
    return null;
  }

  const summary = buildShiftSummary({
    startingCash: shift.startingCash,
    logs: shift.drawerLogs.map((log) => ({ type: log.type, amount: log.amount })),
  });

  const cashPayments = await db.payment.count({
    where: { shiftId: shift.id, status: "PAID", method: "CASH" },
  });

  return {
    id: shift.id,
    staffId: staff.id,
    staffName: staff.name,
    status: shift.status,
    startingCash: shift.startingCash,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt?.toISOString() ?? null,
    expectedCash: summary.expectedCash,
    actualEndingCash: shift.actualEndingCash,
    variance: shift.variance,
    sales: summary.sales,
    cashIn: summary.cashIn,
    cashOut: summary.cashOut,
    refunds: summary.refunds,
    cashTransactions: cashPayments,
    logs: shift.drawerLogs.map((log) => ({
      id: log.id,
      type: log.type,
      amount: log.amount,
      reason: log.reason,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}
