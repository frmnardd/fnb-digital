import { FloorWorkspace } from "@/components/pos/FloorWorkspace";
import { getPosFloorPlan } from "@/lib/services/pos-tables";
import type { PosFloorArea } from "@/types/pos";

/**
 * Halaman peta meja kasir: /cashier/floor
 *
 * Bila database belum siap, halaman tetap dirender (HTTP 200) dengan empty state.
 */

export const dynamic = "force-dynamic";

export default async function FloorPage() {
  let areas: PosFloorArea[] = [];

  try {
    areas = await getPosFloorPlan();
  } catch {
    areas = [];
  }

  return <FloorWorkspace initialAreas={areas} />;
}
