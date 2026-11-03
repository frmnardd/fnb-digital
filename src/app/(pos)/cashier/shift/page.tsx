import { ShiftWorkspace } from "@/components/pos/ShiftWorkspace";

/**
 * Halaman manajemen shift kasir: /cashier/shift
 * Data shift dimuat di client (butuh email kasir sampai modul auth tersedia).
 */

export const dynamic = "force-dynamic";

export default function ShiftPage() {
  return <ShiftWorkspace initialStaffEmail="kasir@fnb.local" />;
}
