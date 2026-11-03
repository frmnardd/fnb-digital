"use client";

import { Copy } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { encodeCode39, toBars } from "@/lib/barcode/code39";

/**
 * Kartu kode booking pesanan untuk pembayaran di kasir.
 * Barcode digambar sebagai SVG dari encoder Code 39 lokal (tanpa dependency).
 */

const MODULE_WIDTH = 2;
const BAR_HEIGHT = 72;
const PADDING = 12;

export function BookingCodeCard({ orderNumber }: { orderNumber: string }) {
  const [notice, setNotice] = useState<string | null>(null);

  const bars = useMemo(() => {
    try {
      return toBars(encodeCode39(orderNumber));
    } catch {
      return [];
    }
  }, [orderNumber]);

  const totalModules = bars.reduce((max, bar) => Math.max(max, bar.x + bar.width), 0);
  const width = totalModules * MODULE_WIDTH + PADDING * 2;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setNotice("Kode booking disalin.");
    } catch {
      setNotice("Gagal menyalin otomatis. Salin manual kode di atas.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-4 shadow-card-soft">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Kode Booking
      </span>

      <p className="text-2xl font-extrabold tracking-[0.2em] tabular-nums">{orderNumber}</p>

      {bars.length > 0 ? (
        <svg
          viewBox={`0 0 ${width} ${BAR_HEIGHT}`}
          width="100%"
          height={BAR_HEIGHT}
          role="img"
          aria-label={`Barcode Code 39 untuk pesanan ${orderNumber}`}
          className="max-w-xs"
        >
          <rect width={width} height={BAR_HEIGHT} fill="#ffffff" />
          {bars.map((bar) => (
            <rect
              key={`${bar.x}-${bar.width}`}
              x={PADDING + bar.x * MODULE_WIDTH}
              y={0}
              width={bar.width * MODULE_WIDTH}
              height={BAR_HEIGHT}
              fill="#111111"
            />
          ))}
        </svg>
      ) : null}

      <Button variant="outline" className="w-full" onClick={() => void handleCopy()}>
        <Copy className="size-4" aria-hidden />
        Salin Kode
      </Button>

      {notice ? (
        <p role="status" className="text-[11px] font-semibold text-muted-foreground">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
