import { CircleAlert } from "lucide-react";
import Link from "next/link";

import { OrderTracker } from "@/components/customer/OrderTracker";
import { db } from "@/lib/db";
import { buildOrderTrackPayload, type OrderTrackPayload } from "@/lib/order-tracking";

/**
 * Halaman pelacakan pesanan: /t/[tableSlug]/order/[orderNumber]
 */

export const dynamic = "force-dynamic";

interface OrderTrackerPageProps {
  params: Promise<{ tableSlug: string; orderNumber: string }>;
}

export default async function OrderTrackerPage({ params }: OrderTrackerPageProps) {
  const { tableSlug, orderNumber } = await params;

  let payload: OrderTrackPayload | null = null;
  let isDataUnavailable = false;

  try {
    const order = await db.order.findUnique({
      where: { orderNumber },
      select: {
        orderNumber: true,
        status: true,
        orderType: true,
        grandTotal: true,
        confirmedAt: true,
        completedAt: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
        items: {
          orderBy: { createdAt: "asc" },
          select: { menuName: true, quantity: true, status: true, station: true },
        },
      },
    });

    if (order) {
      payload = buildOrderTrackPayload({
        orderNumber: order.orderNumber,
        status: order.status,
        orderType: order.orderType,
        grandTotal: order.grandTotal,
        paymentStatus: order.payments[0]?.status ?? null,
        confirmedAt: order.confirmedAt,
        completedAt: order.completedAt,
        items: order.items.map((item) => ({
          name: item.menuName,
          quantity: item.quantity,
          status: item.status,
          station: item.station,
        })),
      });
    }
  } catch {
    isDataUnavailable = true;
  }

  if (!payload) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CircleAlert className="size-8" aria-hidden />
        </span>
        <h1 className="text-lg font-extrabold">
          {isDataUnavailable ? "Sistem belum siap" : "Pesanan tidak ditemukan"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isDataUnavailable
            ? "Status pesanan belum dapat dimuat. Coba lagi beberapa saat lagi."
            : `Nomor pesanan ${orderNumber} tidak dikenali.`}
        </p>
        <Link
          href={`/t/${encodeURIComponent(tableSlug)}`}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          Kembali ke menu
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-lg font-extrabold">Lacak Pesanan</h1>
        <p className="text-xs text-muted-foreground">
          Pesanan <span className="font-bold text-foreground">{payload.orderNumber}</span>
        </p>
      </header>

      <OrderTracker initial={payload} tableSlug={tableSlug} />
    </main>
  );
}
