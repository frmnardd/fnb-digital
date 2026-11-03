import { Banknote, CircleAlert } from "lucide-react";
import Link from "next/link";

import { ManualTransferPanel } from "@/components/customer/ManualTransferPanel";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/pricing";

/**
 * Halaman Transfer Manual: /t/[tableSlug]/pay/[orderNumber]/manual
 */

export const dynamic = "force-dynamic";

interface ManualPageProps {
  params: Promise<{ tableSlug: string; orderNumber: string }>;
}

export default async function PaymentManualPage({ params }: ManualPageProps) {
  const { tableSlug, orderNumber } = await params;

  let order: { orderNumber: string; grandTotal: number } | null = null;
  let isDataUnavailable = false;

  try {
    order = await db.order.findUnique({
      where: { orderNumber },
      select: { orderNumber: true, grandTotal: true },
    });
  } catch {
    isDataUnavailable = true;
  }

  if (!order) {
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
            ? "Data pembayaran belum dapat dimuat. Coba lagi beberapa saat lagi."
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
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Banknote className="size-6" aria-hidden />
        </span>
        <h1 className="text-lg font-extrabold">Transfer Manual</h1>
        <p className="text-xs text-muted-foreground">
          Pesanan <span className="font-bold text-foreground">{order.orderNumber}</span>
        </p>
        <p className="text-2xl font-extrabold tabular-nums">{formatRupiah(order.grandTotal)}</p>
      </header>

      <ManualTransferPanel orderNumber={order.orderNumber} />

      <Link
        href={`/t/${encodeURIComponent(tableSlug)}/pay/${encodeURIComponent(order.orderNumber)}`}
        className="text-center text-[11px] font-bold text-muted-foreground underline-offset-2 hover:underline"
      >
        Ganti metode pembayaran
      </Link>
    </main>
  );
}
