/**
 * Perhitungan shift kasir & laci kas (murni & teruji).
 *
 * Ekspektasi kas = modal awal + penjualan tunai + kas masuk − kas keluar − refund.
 */

export const CASH_DRAWER_TYPES = [
  "OPENING_FLOAT",
  "CASH_IN",
  "CASH_OUT",
  "SALE",
  "REFUND",
  "CLOSING_COUNT",
  "ADJUSTMENT",
] as const;

export type CashDrawerTypeKey = (typeof CASH_DRAWER_TYPES)[number];

export const CASH_DRAWER_LABELS: Record<CashDrawerTypeKey, string> = {
  OPENING_FLOAT: "Modal Awal",
  CASH_IN: "Kas Masuk",
  CASH_OUT: "Kas Keluar",
  SALE: "Penjualan Tunai",
  REFUND: "Refund",
  CLOSING_COUNT: "Hitung Fisik",
  ADJUSTMENT: "Koreksi",
};

export interface DrawerLogLike {
  type: CashDrawerTypeKey;
  /** Selalu nilai absolut; arah ditentukan oleh `type`. */
  amount: number;
}

export interface ShiftCashFlow {
  startingCash: number;
  sales: number;
  cashIn: number;
  cashOut: number;
  refunds: number;
}

export interface DrawerTotals {
  sales: number;
  cashIn: number;
  cashOut: number;
  refunds: number;
}

/** Menjumlahkan mutasi laci kas (nominal absolut per jenis). */
export function summarizeDrawerLogs(logs: readonly DrawerLogLike[]): DrawerTotals {
  const totals: DrawerTotals = { sales: 0, cashIn: 0, cashOut: 0, refunds: 0 };

  for (const log of logs) {
    const amount = Math.abs(log.amount);

    if (log.type === "SALE") {
      totals.sales += amount;
    } else if (log.type === "CASH_IN" || log.type === "ADJUSTMENT") {
      totals.cashIn += amount;
    } else if (log.type === "CASH_OUT" || log.type === "CLOSING_COUNT") {
      // CLOSING_COUNT bukan arus kas; diabaikan untuk ekspektasi.
      if (log.type === "CASH_OUT") {
        totals.cashOut += amount;
      }
    } else if (log.type === "REFUND") {
      totals.refunds += amount;
    }
  }

  return totals;
}

export function computeExpectedCash(flow: ShiftCashFlow): number {
  return flow.startingCash + flow.sales + flow.cashIn - flow.cashOut - flow.refunds;
}

/** Selisih kas fisik terhadap ekspektasi (positif = lebih, negatif = kurang). */
export function computeVariance(actualEndingCash: number, expectedCash: number): number {
  return actualEndingCash - expectedCash;
}

export interface ShiftSummary extends ShiftCashFlow {
  expectedCash: number;
}

export function buildShiftSummary({
  startingCash,
  logs,
}: {
  startingCash: number;
  logs: readonly DrawerLogLike[];
}): ShiftSummary {
  const totals = summarizeDrawerLogs(logs);

  return {
    startingCash,
    ...totals,
    expectedCash: computeExpectedCash({ startingCash, ...totals }),
  };
}
