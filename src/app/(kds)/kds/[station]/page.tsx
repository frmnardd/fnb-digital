import { notFound } from "next/navigation";

import { KdsBoard } from "@/components/kds/KdsBoard";
import { KDS_STATION_LABELS, parseStationSlug, type KdsTicket } from "@/lib/kds";
import { getKdsBoard } from "@/lib/services/kds";

/**
 * Layar KDS per stasiun: /kds/kitchen, /kds/bar, /kds/pastry
 */

export const dynamic = "force-dynamic";

export default async function KdsStationPage({
  params,
}: {
  params: Promise<{ station: string }>;
}) {
  const { station: slug } = await params;
  const station = parseStationSlug(slug);

  if (!station) {
    notFound();
  }

  let tickets: KdsTicket[] = [];

  try {
    const board = await getKdsBoard(station);
    tickets = board.tickets;
  } catch {
    tickets = [];
  }

  return (
    <KdsBoard
      station={station}
      stationLabel={KDS_STATION_LABELS[station]}
      initialTickets={tickets}
    />
  );
}
