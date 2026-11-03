import { db } from "@/lib/db";
import type { StudioTableLike } from "@/lib/qr-studio";

/**
 * Data studio QR meja (dipakai API admin & halaman /admin/tables).
 */

export interface StudioTable extends StudioTableLike {
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "NEEDS_CLEANING" | "RESERVED";
  isActive: boolean;
  activeSessionCount: number;
}

export interface StudioAreaView {
  id: string;
  name: string;
}

export interface TableStudioData {
  areas: StudioAreaView[];
  tables: StudioTable[];
  stats: { tables: number; active: number; inactive: number; areas: number };
}

export async function getTableStudioData(): Promise<TableStudioData> {
  const tables = await db.table.findMany({
    orderBy: [{ area: { name: "asc" } }, { tableNumber: "asc" }],
    select: {
      id: true,
      tableNumber: true,
      qrSlug: true,
      capacity: true,
      status: true,
      isActive: true,
      area: { select: { id: true, name: true } },
    },
  });

  const activeSessions = await db.tableSession.findMany({
    where: {
      tableId: { in: tables.map((table) => table.id) },
      status: { in: ["ACTIVE", "BILL_REQUESTED"] },
    },
    select: { tableId: true },
  });

  const sessionCounts = new Map<string, number>();

  for (const session of activeSessions) {
    sessionCounts.set(session.tableId, (sessionCounts.get(session.tableId) ?? 0) + 1);
  }

  const areas = new Map<string, StudioAreaView>();

  const views: StudioTable[] = tables.map((table) => {
    areas.set(table.area.id, { id: table.area.id, name: table.area.name });

    return {
      id: table.id,
      tableNumber: table.tableNumber,
      qrSlug: table.qrSlug,
      areaId: table.area.id,
      areaName: table.area.name,
      capacity: table.capacity,
      status: table.status,
      isActive: table.isActive,
      activeSessionCount: sessionCounts.get(table.id) ?? 0,
    };
  });

  return {
    areas: [...areas.values()].sort((a, b) => a.name.localeCompare(b.name, "id")),
    tables: views,
    stats: {
      tables: views.length,
      active: views.filter((table) => table.isActive).length,
      inactive: views.filter((table) => !table.isActive).length,
      areas: areas.size,
    },
  };
}
