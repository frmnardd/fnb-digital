import { CircleAlert } from "lucide-react";
import Link from "next/link";

import { PrintReceiptButton } from "@/components/customer/PrintReceiptButton";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/pricing";

/**
 * E-Struk pelanggan: /t/[tableSlug]/order/[orderNumber]/receipt
 *
 * Dirender selebar kertas thermal 80 mm dan siap dicetak/disimpan sebagai PDF
 * lewat dialog cetak browser (`window.print()`).
 */

export const dynamic = "force-dynamic";

const PAYMENT_LABEL: Record<string, string> = {
  QRIS_DYNAMIC: "QRIS",
  VIRTUAL_ACCOUNT: "Virtual Account",
  MANUAL_TRANSFER: "Transfer Manual",
  CASH: "Tunai",
  EDC_CARD: "Kartu EDC",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  PAID: "Lunas",
  FAILED: "Gagal",
  REFUNDED: "Dikembalikan",
  EXPIRED: "Kedaluwarsa",
};

function parseModifierNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "object" && entry !== null && "name" in entry) {
        const name = (entry as { name?: unknown }).name;
        return typeof name === "string" ? name : null;
      }

      return null;
    })
    .filter((name): name is string => name !== null && name.length > 0);
}

interface ReceiptPageProps {
  params: Promise<{ tableSlug: string; orderNumber: string }>;
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { tableSlug, orderNumber } = await params;

  let order: Awaited<ReturnType<typeof loadReceiptOrder>> = null;
  let isDataUnavailable = false;

  try {
    order = await loadReceiptOrder(orderNumber);
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
          {isDataUnavailable ? "Sistem belum siap" : "Struk tidak ditemukan"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isDataUnavailable
            ? "Struk belum dapat dimuat. Coba lagi beberapa saat lagi."
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

  const payment = order.payments[0] ?? null;
  const createdAt = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(order.createdAt);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-3 px-4 py-6">
      <div className="receipt-paper w-full max-w-[320px] rounded-xl border bg-white p-4 text-[11px] leading-relaxed text-black shadow-card-soft">
        <div className="flex flex-col items-center gap-0.5 border-b border-dashed border-black/30 pb-3 text-center">
          <span className="text-sm font-extrabold uppercase tracking-wide">FnB Digital</span>
          <span className="text-[10px]">Struk Pembayaran</span>
        </div>

        <div className="flex flex-col gap-0.5 py-2">
          <div className="flex justify-between">
            <span>No. Pesanan</span>
            <span className="font-bold tabular-nums">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Meja</span>
            <span className="font-semibold">
              {order.tableSession?.table
                ? `${order.tableSession.table.tableNumber} · ${order.tableSession.table.area.name}`
                : "Takeaway"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tipe</span>
            <span className="font-semibold">
              {order.orderType === "DINE_IN" ? "Dine In" : "Takeaway"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Waktu</span>
            <span className="tabular-nums">{createdAt}</span>
          </div>
          {order.customerName ? (
            <div className="flex justify-between">
              <span>Pemesan</span>
              <span className="font-semibold">{order.customerName}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 border-y border-dashed border-black/30 py-2">
          {order.items.map((item, index) => {
            const modifiers = parseModifierNames(item.modifiers);
            const lineTotal = item.unitPrice * item.quantity;

            return (
              <div key={`${item.menuName}-${index}`} className="flex flex-col">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">
                    {item.quantity}× {item.menuName}
                  </span>
                  <span className="tabular-nums">{formatRupiah(lineTotal)}</span>
                </div>
                {modifiers.length > 0 ? (
                  <span className="pl-3 text-[10px] text-black/70">
                    {modifiers.join(", ")}
                  </span>
                ) : null}
                {item.notes ? (
                  <span className="pl-3 text-[10px] italic text-black/70">{item.notes}</span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-0.5 py-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatRupiah(order.subtotal)}</span>
          </div>
          {order.discountAmount > 0 ? (
            <div className="flex justify-between">
              <span>Diskon</span>
              <span className="tabular-nums">-{formatRupiah(order.discountAmount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span>Service charge (5%)</span>
            <span className="tabular-nums">{formatRupiah(order.serviceCharge)}</span>
          </div>
          <div className="flex justify-between">
            <span>PB1 (10%)</span>
            <span className="tabular-nums">{formatRupiah(order.taxAmount)}</span>
          </div>
          {order.uniqueCode > 0 ? (
            <div className="flex justify-between">
              <span>Kode unik</span>
              <span className="tabular-nums">{order.uniqueCode}</span>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between border-t border-black/30 pt-1 text-[12px] font-extrabold">
            <span>TOTAL</span>
            <span className="tabular-nums">{formatRupiah(order.grandTotal)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 border-t border-dashed border-black/30 pt-2">
          <div className="flex justify-between">
            <span>Pembayaran</span>
            <span className="font-semibold">
              {payment ? (PAYMENT_LABEL[payment.method] ?? payment.method) : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className="font-semibold">
              {payment ? (PAYMENT_STATUS_LABEL[payment.status] ?? payment.status) : "—"}
            </span>
          </div>
        </div>

        <p className="mt-3 text-center text-[10px]">
          Terima kasih telah memesan. Simpan struk ini sebagai bukti pembayaran.
        </p>
      </div>

      <PrintReceiptButton />

      <Link
        href={`/t/${encodeURIComponent(tableSlug)}/order/${encodeURIComponent(order.orderNumber)}`}
        className="print-hidden text-center text-[11px] font-bold text-muted-foreground underline-offset-2 hover:underline"
      >
        Kembali ke pelacakan pesanan
      </Link>
    </main>
  );
}

async function loadReceiptOrder(orderNumber: string) {
  return db.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      orderType: true,
      status: true,
      createdAt: true,
      subtotal: true,
      discountAmount: true,
      serviceCharge: true,
      taxAmount: true,
      uniqueCode: true,
      grandTotal: true,
      customerName: true,
      tableSession: {
        select: { table: { select: { tableNumber: true, area: { select: { name: true } } } } },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { method: true, status: true, paidAt: true },
      },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          menuName: true,
          quantity: true,
          unitPrice: true,
          modifiers: true,
          notes: true,
        },
      },
    },
  });
}
