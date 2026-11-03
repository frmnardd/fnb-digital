import { MenuManager } from "@/components/admin/MenuManager";
import { getAdminMenuData, type AdminMenuData } from "@/lib/services/admin-menu";

/**
 * Halaman back-office menu: /admin/menu
 */

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  let data: AdminMenuData;

  try {
    data = await getAdminMenuData();
  } catch {
    data = {
      categories: [],
      items: [],
      modifierGroups: [],
      stats: { items: 0, unavailable: 0, categories: 0 },
    };
  }

  return <MenuManager initialData={data} />;
}
