import { CircleAlert, QrCode, Users, Utensils } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { StartSessionButton } from "@/components/customer/StartSessionButton";
import { ApiError } from "@/lib/api/errors";
import { TABLE_SESSION_COOKIE } from "@/lib/security/token";
import { getCustomerTableContext, type CustomerTableContext } from "@/lib/services/customer-table";

/**
 * Halaman pelanggan per meja: /t/[tableSlug]
 *
 * Server component — membaca meja & sesi langsung dari database (bukan fetch ke
 * API sendiri) lalu merender header + status sesi. Bila database belum siap,
 * halaman tetap 200 dengan empty state yang ramah.
 */

export const dynamic = "force-dynamic";

export default async function CustomerTablePage({
  params,
}: {
  params: Promise<{ tableSlug: string }>;
}) {
  const { tableSlug } = await params;

  let context: CustomerTableContext | null = null;
  let isDataUnavailable = false;

  try {
    const sessionToken = (await cookies()).get(TABLE_SESSION_COOKIE)?.value ?? null;
    context = await getCustomerTableContext(tableSlug, sessionToken);
  } catch (error) {
    // Slug tidak valid bukan masalah infrastruktur — tampilkan sebagai meja tak dikenal.
    isDataUnavailable = !(error instanceof ApiError && error.code === "BAD_REQUEST");
  }

  if (!context) {
    return <TableUnavailableState tableSlug={tableSlug} isDataUnavailable={isDataUnavailable} />;
  }

  const { table, session } = context;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <CustomerHeader
        tableSlug={table.qrSlug}
        tableNumber={table.tableNumber}
        areaName={table.area.name}
        sessionStatus={session && session.status !== "CLOSED" ? session.status : null}
      />

      <main className="flex flex-1 flex-col gap-3 px-4 py-4">
        {session ? (
          <section className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-card-soft">
            <span className="flex items-center gap-2 text-sm font-bold">
              <Users className="size-4 text-primary" aria-hidden />
              <span className="tabular">{session.guestCount}</span> tamu
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {session.status === "BILL_REQUESTED" ? "Bill diminta" : "Sedang memesan"}
            </span>
          </section>
        ) : (
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card-soft">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-extrabold">Selamat datang di Meja {table.tableNumber}</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Mulai sesi untuk memesan bersama tamu lain di meja ini. Pesanan langsung
                diteruskan ke dapur setelah dikonfirmasi.
              </p>
            </div>
            <StartSessionButton tableSlug={table.qrSlug} />
          </section>
        )}

        <section className="flex flex-col gap-1.5 rounded-xl border border-dashed bg-card/60 p-4">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <Utensils className="size-4" aria-hidden />
            Katalog menu
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tab kategori, pencarian instan, dan kartu menu akan tampil pada langkah
            berikutnya (sub-tugas 3.2 &amp; 3.3).
          </p>
        </section>
      </main>
    </div>
  );
}

function TableUnavailableState({
  tableSlug,
  isDataUnavailable,
}: {
  tableSlug: string;
  isDataUnavailable: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {isDataUnavailable ? (
          <CircleAlert className="size-8" aria-hidden />
        ) : (
          <QrCode className="size-8" aria-hidden />
        )}
      </span>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-extrabold">
          {isDataUnavailable ? "Sistem belum siap" : "Meja tidak ditemukan"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isDataUnavailable ? (
            "Kami tidak dapat memuat data meja saat ini. Periksa koneksi lalu coba lagi."
          ) : (
            <>
              Kode meja{" "}
              <span className="font-semibold text-foreground">{tableSlug}</span> tidak
              dikenali. Pastikan Anda memindai QR yang benar di meja.
            </>
          )}
        </p>
      </div>

      <Link
        href={`/t/${encodeURIComponent(tableSlug)}`}
        className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
      >
        Coba lagi
      </Link>
    </main>
  );
}
