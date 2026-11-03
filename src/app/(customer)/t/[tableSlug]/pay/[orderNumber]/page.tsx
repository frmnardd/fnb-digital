import { Banknote, Building2, CircleAlert, QrCode, ReceiptText, Wallet } from "lucide-react";
import Link from "next/link";

import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/pricing";

/**
 * Hub pembayaran: /t/[tableSlug]/pay/[orderNumber]
 *
 * Menampilkan ringkasan pesanan + pilihan metode pembayaran. Order sudah dibuat
 * sebelumnya (`POST /api/orders`), jadi halaman ini TIDAK membuat order baru.
 */

export const dynamic = "force-dynamic";

const METHOD_LINKS = [
  {
    href: "qris",
    label: "QRIS",
    hint: "Scan dengan aplikasi bank / e-wallet",
    icon: QrCode,
  },
  {
    href: "va",
    label: "Transfer Virtual Account",
    hint: "Nomor VA otomatis per bank",
    icon: Building2,
  },
  {
    href: "manual",
    label: "Transfer Manual",
    hint: "Nominal + kode unik, unggah bukti",
    icon: Banknote,
  },
] as const;

interface PayHubProps {
  params: Promise<{ tableSlug: string; orderNumber: string }>;
}

export default async function PaymentHubPage({ params }: PayHubProps) {
  const { tableSlug, orderNumber } = await params;

  let order: {
    orderNumber: string;
    grandTotal: number;
    status: string;
    payments: Array<{ method: string; status: string }>;
  } | null = null;
  let isDataUnavailable = false;

  try {
    order = await db.order.findUnique({
      where: { orderNumber },
      select: {
        orderNumber: true,
        grandTotal: true,
        status: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { method: true, status: true },
        },
      },
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

  const latestMethod = order.payments[0]?.method ?? null;
  const isCashPayment =
    latestMethod === "CASH" ||
    latestMethod === "EDC_CARD" ||
    order.status === "WAITING_CASHIER_APPROVAL";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex flex-col items-center gap-1 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ReceiptText className="size-6" aria-hidden />
        </span>
        <h1 className="text-lg font-extrabold">Pilih Metode Pembayaran</h1>
        <p className="text-xs text-muted-foreground">
          Pesanan <span className="font-bold text-foreground">{order.orderNumber}</span>
        </p>
        <p className="text-2xl font-extrabold tabular-nums">{formatRupiah(order.grandTotal)}</p>
      </header>

      {isCashPayment ? (
        <section className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 text-center shadow-card-soft">
          <span className="flex size-12 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Wallet className="size-6" aria-hidden />
          </span>
          <h2 className="text-sm font-extrabold">Bayar di Kasir</h2>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Tunjukkan kode pesanan berikut ke kasir. Pesanan diproses setelah kasir
            mengonfirmasi pembayaran.
          </p>
          <p className="mt-1 rounded-lg bg-secondary px-4 py-2 text-lg font-extrabold tracking-wider tabular-nums">
            {order.orderNumber}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
            Menunggu konfirmasi kasir
          </p>
          <Link
            href={`/t/${encodeURIComponent(tableSlug)}/pay/${encodeURIComponent(order.orderNumber)}/cashier`}
            className="mt-1 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            Lihat kode booking &amp; PIN meja
          </Link>
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          {METHOD_LINKS.map((method) => {
            const Icon = method.icon;

            return (
              <Link
                key={method.href}
                href={`/t/${encodeURIComponent(tableSlug)}/pay/${encodeURIComponent(order.orderNumber)}/${method.href}`}
                className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 shadow-card-soft transition hover:bg-secondary"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-extrabold">{method.label}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    {method.hint}
                  </span>
                </span>
              </Link>
            );
          })}
        </section>
      )}

      <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
        Halaman ini akan diperbarui otomatis ketika pembayaran dikonfirmasi.
      </p>

      <Link
        href={`/t/${encodeURIComponent(tableSlug)}/order/${encodeURIComponent(order.orderNumber)}`}
        className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card px-5 text-sm font-bold text-foreground"
      >
        Lacak Pesanan
      </Link>

      <Link
        href={`/t/${encodeURIComponent(tableSlug)}`}
        className="text-center text-[11px] font-bold text-muted-foreground underline-offset-2 hover:underline"
      >
        Kembali ke menu
      </Link>
    </main>
  );
}
