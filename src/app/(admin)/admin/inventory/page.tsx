import { InventoryManager } from "@/components/admin/InventoryManager";
import { getInventoryData, type InventoryData } from "@/lib/services/inventory";

/**
 * Halaman inventori & resep: /admin/inventory
 */

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  let data: InventoryData;

  try {
    data = await getInventoryData();
  } catch {
    data = {
      ingredients: [],
      recipes: [],
      menus: [],
      stats: { total: 0, low: 0, out: 0 },
    };
  }

  return <InventoryManager initialData={data} />;
}
