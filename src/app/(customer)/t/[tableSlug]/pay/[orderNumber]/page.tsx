import { CircleAlert, ReceiptText } from "lucide-react";
import Link from "next/link";

import { PaymentQrisPanel } from "@/components/customer/PaymentQrisPanel";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/pricing";

/**
 * Halaman tunggu pembayaran QRIS: /t/[tableSlug]/pay/[orderNumber]
 *
 * Server component hanya mengambil ringkasan pesanan; pembuatan instruksi QRIS
 * dan polling status dilakukan client (`PaymentQrisPanel`).
 */

export const dynamic = "force-dynamic";

interface PayPageProps {
  params: Promise<{ tableSlug: string; orderNumber: string }>;
}

export default async function PaymentPage({ params }: PayPageProps) {
  const { tableSlug, orderNumber } = await params;

  let order: { orderNumber: string; grandTotal: number; status: string } | null = null;
  let isDataUnavailable = false;

  try {
    order = await db.order.findUnique({
      where: { orderNumber },
      select: { orderNumber: true, grandTotal: true, status: true },
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
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-extrabold">
            {isDataUnavailable ? "Sistem belum siap" : "Pesanan tidak ditemukan"}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isDataUnavailable
              ? "Kami tidak dapat memuat data pembayaran saat ini. Coba lagi beberapa saat lagi."
              : `Nomor pesanan ${orderNumber} tidak dikenali.`}
          </p>
        </div>
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
          <ReceiptText className="size-6" aria-hidden />
        </span>
        <h1 className="text-lg font-extrabold">Pembayaran QRIS</h1>
        <p className="text-xs text-muted-foreground">
          Pesanan <span className="font-bold text-foreground">{order.orderNumber}</span>
        </p>
        <p className="text-2xl font-extrabold tabular-nums">{formatRupiah(order.grandTotal)}</p>
      </header>

      <PaymentQrisPanel
        orderNumber={order.orderNumber}
        amount={order.grandTotal}
        tableSlug={tableSlug}
      />
    </main>
  );
}
