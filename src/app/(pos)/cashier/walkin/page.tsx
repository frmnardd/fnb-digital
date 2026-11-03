import { WalkInWorkspace } from "@/components/pos/WalkInWorkspace";
import { getCustomerMenuCatalog } from "@/lib/services/customer-menu";
import type { PublicCategory } from "@/types/menu";

/**
 * Halaman kasir walk-in / takeaway: /cashier/walkin
 */

export const dynamic = "force-dynamic";

export default async function WalkInPage() {
  let categories: PublicCategory[] = [];

  try {
    const catalog = await getCustomerMenuCatalog();
    categories = catalog.categories;
  } catch {
    categories = [];
  }

  return <WalkInWorkspace categories={categories} />;
}
