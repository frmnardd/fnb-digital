import { DashboardView } from "@/components/admin/DashboardView";
import { getDashboardData, type DashboardData } from "@/lib/services/analytics";

/**
 * Halaman dashboard analitik: /admin/dashboard
 */

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let data: DashboardData;

  try {
    data = await getDashboardData({ days: 7 });
  } catch {
    data = {
      generatedAt: new Date().toISOString(),
      days: 7,
      kpi: { revenue: 0, orderCount: 0, averageTicket: 0, itemsSold: 0 },
      daily: [],
      paymentMix: [],
      peakHours: Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 })),
      menuEngineering: [],
    };
  }

  return <DashboardView initialData={data} />;
}
