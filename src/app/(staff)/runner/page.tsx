import { RunnerBoard } from "@/components/runner/RunnerBoard";
import { getRunnerData, type RunnerData } from "@/lib/services/runner";

/**
 * Halaman mobile pelayan/runner: /runner
 */

export const dynamic = "force-dynamic";

export default async function RunnerPage() {
  let data: RunnerData;

  try {
    data = await getRunnerData();
  } catch {
    data = {
      generatedAt: new Date().toISOString(),
      readyTickets: [],
      waiterCalls: [],
      dirtyTables: [],
      summary: { readyTickets: 0, readyItems: 0, pendingCalls: 0, dirtyTables: 0 },
    };
  }

  return <RunnerBoard initialData={data} />;
}
