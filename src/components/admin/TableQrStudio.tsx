"use client";

import { Copy, Loader2, Printer, QrCode } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildOrderUrl,
  chunkTablesForPrint,
  getPrintSheetCount,
  groupTablesByArea,
} from "@/lib/qr-studio";
import type { StudioTable, TableStudioData } from "@/lib/services/table-studio";
import { cn } from "@/lib/utils";

/**
 * Studio QR meja: pratinjau QR, salin link, cetak per meja / batch (4 kartu per A4).
 * QR dirender lewat layanan gambar — TODO(7.3): ganti generator lokal tanpa jaringan.
 */

const QR_SERVICE = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=6&data=";

const STATUS_LABEL: Record<StudioTable["status"], string> = {
  AVAILABLE: "Kosong",
  OCCUPIED: "Terisi",
  NEEDS_CLEANING: "Perlu Dibersihkan",
  RESERVED: "Dipesan",
};

const STATUS_STYLE: Record<StudioTable["status"], string> = {
  AVAILABLE: "bg-success/15 text-success",
  OCCUPIED: "bg-primary/15 text-primary",
  NEEDS_CLEANING: "bg-warning/15 text-warning",
  RESERVED: "bg-secondary text-muted-foreground",
};

export function TableQrStudio({ initialData }: { initialData: TableStudioData }) {
  const [data, setData] = useState<TableStudioData>(initialData);
  const [areaFilter, setAreaFilter] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const groups = useMemo(
    () =>
      groupTablesByArea(
        data.tables.filter((table) => (areaFilter ? table.areaId === areaFilter : true)),
      ),
    [data.tables, areaFilter],
  );

  const printable = useMemo(() => groups.flatMap((group) => group.tables), [groups]);
  const pages = useMemo(() => chunkTablesForPrint(printable, 4), [printable]);

  function qrImage(table: StudioTable): string | null {
    if (!baseUrl) {
      return null;
    }

    return `${QR_SERVICE}${encodeURIComponent(buildOrderUrl(baseUrl, table.qrSlug))}`;
  }

  async function copyLink(table: StudioTable) {
    setError(null);

    if (!baseUrl) {
      setError("Alamat situs belum siap. Coba lagi sesaat.");
      return;
    }

    try {
      await navigator.clipboard.writeText(buildOrderUrl(baseUrl, table.qrSlug));
      setMessage(`Link Meja ${table.tableNumber} disalin.`);
    } catch {
      setError("Browser menolak akses clipboard. Salin manual dari kartu.");
    }
  }

  async function toggleActive(table: StudioTable) {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/tables/${encodeURIComponent(table.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !table.isActive }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Gagal memperbarui meja.");
        return;
      }

      const refreshed = await fetch("/api/admin/tables", { cache: "no-store" });
      const refreshedPayload = (await refreshed.json().catch(() => null)) as {
        data?: TableStudioData;
      } | null;

      if (refreshedPayload?.data) {
        setData(refreshedPayload.data);
      }

      setMessage(`Meja ${table.tableNumber} ${table.isActive ? "dinonaktifkan" : "diaktifkan"}.`);
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2 print:hidden">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Back-office
          </span>
          <h1 className="text-lg font-extrabold">Studio QR Meja</h1>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {data.stats.tables} meja · {data.stats.active} aktif · {data.stats.inactive} nonaktif ·{" "}
            {getPrintSheetCount(printable)} lembar cetak
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={areaFilter}
            onChange={(event) => setAreaFilter(event.target.value)}
            aria-label="Filter area"
            className="h-11 rounded-lg border border-input bg-background px-2 text-xs font-semibold outline-none"
          >
            <option value="">Semua area</option>
            {data.areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>

          <Button onClick={() => window.print()} disabled={printable.length === 0}>
            <Printer className="size-4" aria-hidden />
            Cetak Semua
          </Button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-2 text-[11px] font-semibold text-danger print:hidden">
          {error}
        </p>
      ) : null}

      {message ? (
        <p role="status" className="rounded-lg bg-success/10 p-2 text-[11px] font-semibold text-success print:hidden">
          {message}
        </p>
      ) : null}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 p-8 text-center">
          <QrCode className="size-7 text-muted-foreground" aria-hidden />
          <p className="text-sm font-extrabold">Belum ada meja</p>
          <p className="text-[11px] text-muted-foreground">
            Tambahkan area dan meja lewat seeder atau modul meja.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.areaId} className="flex flex-col gap-2 print:hidden">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              {group.areaName}
            </h2>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.tables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  qrSrc={qrImage(table)}
                  orderUrl={baseUrl ? buildOrderUrl(baseUrl, table.qrSlug) : ""}
                  onCopy={() => void copyLink(table)}
                  onToggle={() => void toggleActive(table)}
                  busy={busy}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {/* Area cetak: 2×2 kartu per halaman A4. */}
      {pages.length > 0 ? (
        <div className="hidden print:block">
          {pages.map((page, pageIndex) => (
            <div
              key={pageIndex}
              className="grid grid-cols-2 gap-4 border-b border-dashed border-border p-2 print:break-after-page"
            >
              {page.map((table) => (
                <div
                  key={table.id}
                  className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {table.areaName}
                  </span>
                  <span className="text-lg font-extrabold">Meja {table.tableNumber}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${QR_SERVICE}${encodeURIComponent(
                      baseUrl ? buildOrderUrl(baseUrl, table.qrSlug) : "",
                    )}`}
                    alt={`QR Meja ${table.tableNumber}`}
                    width={240}
                    height={240}
                    className="size-[180px]"
                  />
                  <span className="text-[10px] font-semibold">Scan untuk memesan</span>
                  <span className="break-all text-[9px] text-muted-foreground">
                    {baseUrl ? buildOrderUrl(baseUrl, table.qrSlug) : ""}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TableCard({
  table,
  qrSrc,
  orderUrl,
  onCopy,
  onToggle,
  busy,
}: {
  table: StudioTable;
  qrSrc: string | null;
  orderUrl: string;
  onCopy: () => void;
  onToggle: () => void;
  busy: boolean;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3",
        table.isActive ? "border-border" : "border-dashed border-border/60 opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-extrabold">Meja {table.tableNumber}</span>
          <span className="text-[10px] text-muted-foreground">
            {table.areaName} · {table.capacity} orang
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase",
            STATUS_STYLE[table.status],
          )}
        >
          {STATUS_LABEL[table.status]}
        </span>
      </div>

      <div className="flex items-center justify-center rounded-lg bg-secondary/40 p-2">
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrSrc}
            alt={`QR Meja ${table.tableNumber}`}
            width={160}
            height={160}
            className="size-[140px]"
          />
        ) : (
          <div className="flex size-[140px] items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>

      <span className="break-all text-[9px] text-muted-foreground">{orderUrl}</span>

      <div className="flex gap-1.5">
        <Button variant="outline" className="flex-1" onClick={onCopy}>
          <Copy className="size-3.5" aria-hidden />
          Salin
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => window.print()}>
          <Printer className="size-3.5" aria-hidden />
          Cetak
        </Button>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onToggle}
        className="min-h-10 rounded-lg border border-border text-[10px] font-bold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
      >
        {table.isActive ? "Nonaktifkan meja" : "Aktifkan meja"}
      </button>
    </article>
  );
}
