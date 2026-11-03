import { ShiftWorkspace } from "@/components/pos/ShiftWorkspace";

/**
 * Halaman manajemen shift kasir: /cashier/shift
 * Identitas kasir diambil dari sesi login staf.
 */

export const dynamic = "force-dynamic";

export default function ShiftPage() {
  return <ShiftWorkspace />;
}
