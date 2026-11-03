import { CashierWorkspace } from "@/components/pos/CashierWorkspace";
import { db } from "@/lib/db";
import type { PosQueueOrder } from "@/types/pos";

/**
 * Halaman kasir POS: /cashier
 *
 * Memuat antrean pesanan aktif dari database. Bila database belum siap,
 * halaman tetap dirender (HTTP 200) dengan empty state — bukan error 500.
 */

export const dynamic = "force-dynamic";

const QUEUE_STATUSES = [
  "PENDING_PAYMENT",
  "WAITING_CASHIER_APPROVAL",
  "CONFIRMED",
] as const;

export default async function CashierPage() {
  const orders = await loadQueue();

  return <CashierWorkspace initialOrders={orders} cashierName="Kasir" />;
}

async function loadQueue(): Promise<PosQueueOrder[]> {
  try {
    const rows = await db.order.findMany({
      where: { status: { in: [...QUEUE_STATUSES] } },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        orderType: true,
        grandTotal: true,
        createdAt: true,
        tableSession: {
          select: {
            table: { select: { tableNumber: true, area: { select: { name: true } } } },
          },
        },
        _count: { select: { items: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      orderType: row.orderType,
      tableLabel: row.tableSession?.table
        ? `${row.tableSession.table.tableNumber} · ${row.tableSession.table.area.name}`
        : null,
      total: row.grandTotal,
      itemCount: row._count.items,
      createdAt: row.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}
