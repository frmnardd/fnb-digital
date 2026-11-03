"use client";

import { CheckCircle2, Copy, Download, Loader2, QrCode, RefreshCw, Timer } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Panel pembayaran QRIS (client): mengambil instruksi QR dari API, menampilkan
 * hitung mundur, tombol simpan/salin, dan polling status pembayaran.
 *
 * Catatan render QR: encoder QR lokal belum diizinkan sebagai dependency baru,
 * sehingga sementara memakai image service publik + fallback teks payload.
 * TODO(4.2): ganti ke encoder lokal (mis. package `qrcode`) setelah disetujui.
 */

interface QrisData {
  paymentId: string;
  orderNumber: string;
  amount: number;
  qrString: string;
  qrUrl: string | null;
  expiresAt: string;
  mode: "gateway" | "demo";
}

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

function qrImageUrl(qrString: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=${encodeURIComponent(qrString)}`;
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PaymentQrisPanel({
  orderNumber,
  amount,
  tableSlug,
}: {
  orderNumber: string;
  amount: number;
  tableSlug: string;
}) {
  const [data, setData] = useState<QrisData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "paid">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const loadQris = useCallback(async () => {
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/payment/qris`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<QrisData> | null;

      if (!response.ok || !payload?.data) {
        setStatus("error");
        setMessage(payload?.error?.message ?? "Gagal menyiapkan pembayaran QRIS.");
        return;
      }

      setData(payload.data);
      setStatus("ready");
    } catch {
      setStatus("error");
      setMessage("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    }
  }, [orderNumber]);

  useEffect(() => {
    void loadQris();
  }, [loadQris]);

  // Hitung mundur masa berlaku QR.
  useEffect(() => {
    if (!data) {
      return;
    }

    const update = () => {
      const diff = Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000);
      setRemainingSeconds(Math.max(0, diff));
    };

    update();
    const timer = setInterval(update, 1000);

    return () => clearInterval(timer);
  }, [data]);

  // Polling status pembayaran.
  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderNumber)}/payment/status`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
          payment?: { status?: string } | null;
          orderStatus?: string;
        }> | null;

        if (payload?.data?.payment?.status === "PAID" || payload?.data?.orderStatus === "CONFIRMED") {
          setStatus("paid");
        }
      } catch {
        // Abaikan gangguan jaringan singkat; polling berikutnya akan mencoba lagi.
      }
    };

    const timer = setInterval(() => {
      void poll();
    }, 5000);

    return () => clearInterval(timer);
  }, [status, orderNumber]);

  async function handleSave() {
    if (!data) {
      return;
    }

    const source = data.qrUrl ?? qrImageUrl(data.qrString);

    try {
      const response = await fetch(source, { mode: "cors" });
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = `qris-${orderNumber}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setNotice("Gambar QRIS berhasil disimpan.");
    } catch {
      setNotice("Unduhan otomatis gagal. Tekan lama pada gambar QR untuk menyimpannya.");
    }
  }

  async function handleCopy() {
    if (!data) {
      return;
    }

    try {
      await navigator.clipboard.writeText(data.qrString);
      setNotice("Kode QRIS disalin.");
    } catch {
      setNotice("Gagal menyalin otomatis. Salin manual dari kolom kode di bawah.");
    }
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center shadow-card-soft">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-semibold">Menyiapkan QRIS…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-card-soft">
        <p role="alert" className="text-sm font-bold text-danger">
          {message ?? "Pembayaran gagal disiapkan."}
        </p>
        <Button variant="secondary" onClick={() => void loadQris()}>
          <RefreshCw className="size-4" aria-hidden />
          Coba lagi
        </Button>
      </div>
    );
  }

  if (status === "paid") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-6 text-center">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <p className="text-sm font-extrabold text-success">Pembayaran diterima</p>
        <p className="text-xs text-muted-foreground">
          Pesanan Anda sedang diteruskan ke dapur. Terima kasih!
        </p>
        <Link
          href={`/t/${encodeURIComponent(tableSlug)}`}
          className="mt-1 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          Kembali ke menu
        </Link>
      </div>
    );
  }

  const isExpired = remainingSeconds <= 0;
  const source = data?.qrUrl ?? (data ? qrImageUrl(data.qrString) : "");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-4 shadow-card-soft">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <QrCode className="size-3.5" aria-hidden />
          Scan dengan aplikasi bank / e-wallet
        </div>

        {data ? (
          <div className="relative overflow-hidden rounded-lg bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- gambar QR dari service/gateway eksternal */}
            <img
              src={source}
              alt={`QRIS pembayaran ${orderNumber}`}
              width={320}
              height={320}
              className={cn("size-64 object-contain", isExpired && "opacity-30 grayscale")}
            />
            {isExpired ? (
              <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs font-extrabold uppercase tracking-wide text-danger">
                QR kedaluwarsa
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">
          <Timer className="size-3.5" aria-hidden />
          <span className={cn("tabular-nums", isExpired ? "text-danger" : "text-foreground")}>
            {isExpired ? "Kedaluwarsa" : formatCountdown(remainingSeconds)}
          </span>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Bayar tepat{" "}
          <span className="font-extrabold text-foreground tabular-nums">
            {formatRupiah(amount)}
          </span>{" "}
          sesuai nominal.
        </p>

        {data?.mode === "demo" ? (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-center text-[10px] font-semibold leading-snug text-warning">
            Mode demo: QRIS dibuat lokal karena kredensial gateway belum diatur. Pembayaran
            nyata belum aktif.
          </p>
        ) : null}

        <div className="flex w-full gap-2">
          <Button variant="outline" className="flex-1" onClick={() => void handleSave()} disabled={isExpired}>
            <Download className="size-4" aria-hidden />
            Simpan QR
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => void handleCopy()}>
            <Copy className="size-4" aria-hidden />
            Salin Kode
          </Button>
        </div>

        {isExpired ? (
          <Button className="w-full" onClick={() => void loadQris()}>
            <RefreshCw className="size-4" aria-hidden />
            Buat ulang QR
          </Button>
        ) : null}

        {notice ? (
          <p role="status" className="text-center text-[11px] font-semibold text-muted-foreground">
            {notice}
          </p>
        ) : null}
      </div>

      <details className="rounded-xl border bg-card p-3">
        <summary className="cursor-pointer text-[11px] font-bold text-muted-foreground">
          Kode QRIS (fallback manual)
        </summary>
        <textarea
          readOnly
          value={data?.qrString ?? ""}
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border border-input bg-background p-2 text-[10px] leading-relaxed"
        />
      </details>
    </div>
  );
}
