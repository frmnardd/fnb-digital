/**
 * Helper peta meja interaktif POS (murni & teruji).
 */

export type TableStatusKey = "AVAILABLE" | "OCCUPIED" | "NEEDS_CLEANING";

export const TABLE_STATUS_META: Record<
  TableStatusKey,
  { label: string; cardClass: string; badgeClass: string; dotClass: string }
> = {
  AVAILABLE: {
    label: "Tersedia",
    cardClass: "border-border bg-card hover:border-primary/40",
    badgeClass: "bg-secondary text-muted-foreground",
    dotClass: "bg-muted-foreground/50",
  },
  OCCUPIED: {
    label: "Terisi",
    cardClass: "border-primary/50 bg-primary/10 hover:border-primary",
    badgeClass: "bg-primary/20 text-primary",
    dotClass: "bg-primary",
  },
  NEEDS_CLEANING: {
    label: "Perlu Dibersihkan",
    cardClass: "border-warning/50 bg-warning/10 hover:border-warning",
    badgeClass: "bg-warning/20 text-warning",
    dotClass: "bg-warning",
  },
};

/**
 * Durasi tamu duduk, mis. "12 mnt" atau "1 j 05 mnt".
 * Durasi negatif (clock skew) diperlakukan sebagai 0.
 */
export function formatSeatedDuration(openedAt: Date, now: Date = new Date()): string {
  const elapsedMs = now.getTime() - openedAt.getTime();
  const totalMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));

  if (totalMinutes < 60) {
    return `${totalMinutes} mnt`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours} j ${String(minutes).padStart(2, "0")} mnt`;
}

export interface FloorPlanSummary {
  available: number;
  occupied: number;
  cleaning: number;
  total: number;
}

export function getFloorPlanSummary(
  tables: ReadonlyArray<{ status: TableStatusKey }>,
): FloorPlanSummary {
  const summary: FloorPlanSummary = { available: 0, occupied: 0, cleaning: 0, total: 0 };

  for (const table of tables) {
    summary.total += 1;

    if (table.status === "AVAILABLE") {
      summary.available += 1;
    } else if (table.status === "OCCUPIED") {
      summary.occupied += 1;
    } else {
      summary.cleaning += 1;
    }
  }

  return summary;
}
