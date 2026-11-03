import { TableQrStudio } from "@/components/admin/TableQrStudio";
import { getTableStudioData, type TableStudioData } from "@/lib/services/table-studio";

/**
 * Halaman studio QR meja: /admin/tables
 */

export const dynamic = "force-dynamic";

export default async function AdminTablesPage() {
  let data: TableStudioData;

  try {
    data = await getTableStudioData();
  } catch {
    data = {
      areas: [],
      tables: [],
      stats: { tables: 0, active: 0, inactive: 0, areas: 0 },
    };
  }

  return <TableQrStudio initialData={data} />;
}
