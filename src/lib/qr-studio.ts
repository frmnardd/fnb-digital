/**
 * Helper studio QR meja (murni & teruji).
 */

export interface StudioTableLike {
  id: string;
  tableNumber: string;
  qrSlug: string;
  areaId: string;
  areaName: string;
}

/** URL pemesanan untuk sebuah meja. */
export function buildOrderUrl(baseUrl: string, qrSlug: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  return `${base}/t/${qrSlug}`;
}

function compareTableNumber(a: string, b: string): number {
  const numberA = Number.parseInt(a.replace(/\D/g, ""), 10);
  const numberB = Number.parseInt(b.replace(/\D/g, ""), 10);

  if (Number.isFinite(numberA) && Number.isFinite(numberB) && numberA !== numberB) {
    return numberA - numberB;
  }

  return a.localeCompare(b, "id");
}

export interface AreaGroup<T extends StudioTableLike> {
  areaId: string;
  areaName: string;
  tables: T[];
}

/** Mengelompokkan meja per area, urut nama area & nomor meja. */
export function groupTablesByArea<T extends StudioTableLike>(
  tables: readonly T[],
): Array<AreaGroup<T>> {
  const groups = new Map<string, AreaGroup<T>>();

  for (const table of tables) {
    const existing = groups.get(table.areaId);

    if (existing) {
      existing.tables.push(table);
      continue;
    }

    groups.set(table.areaId, {
      areaId: table.areaId,
      areaName: table.areaName,
      tables: [table],
    });
  }

  return [...groups.values()]
    .sort((a, b) => a.areaName.localeCompare(b.areaName, "id"))
    .map((group) => ({
      ...group,
      tables: [...group.tables].sort((a, b) => compareTableNumber(a.tableNumber, b.tableNumber)),
    }));
}

/** Membagi meja menjadi halaman cetak (default 4 kartu per halaman A4). */
export function chunkTablesForPrint<T>(tables: readonly T[], perPage: number = 4): T[][] {
  const size = Math.max(1, Math.trunc(perPage));
  const pages: T[][] = [];

  for (let index = 0; index < tables.length; index += size) {
    pages.push(tables.slice(index, index + size) as T[]);
  }

  return pages;
}

export function getPrintSheetCount(tables: readonly unknown[], perPage: number = 4): number {
  return chunkTablesForPrint(tables, perPage).length;
}
