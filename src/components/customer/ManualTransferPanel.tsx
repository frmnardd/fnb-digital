"use client";

import { CheckCircle2, Copy, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/pricing";

/**
 * Panel Transfer Manual: nominal + kode unik, rekening tujuan, dan unggah bukti.
 * Status tetap PENDING sampai kasir memverifikasi bukti (sub-tugas 5.2).
 */

interface ManualAccount {
  bank: string;
  accountNumber: string;
  accountHolder: string;
}

interface ManualData {
  paymentId: string;
  orderNumber: string;
  amount: number;
  uniqueCode: number;
  accounts: ManualAccount[];
  expiresAt: string;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

export function ManualTransferPanel({
  orderNumber,
  tableSlug,
}: {
  orderNumber: string;
  tableSlug: string;
}) {
  const [data, setData] = useState<ManualData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "uploaded" | "paid">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderNumber)}/payment/manual`,
          { method: "POST" },
        );
        const payload = (await response.json().catch(() => null)) as ApiEnvelope<ManualData> | null;

        if (!response.ok || !payload?.data) {
          setStatus("error");
          setMessage(payload?.error?.message ?? "Gagal memuat instruksi transfer.");
          return;
        }

        setData(payload.data);
        setStatus("ready");
      } catch {
        setStatus("error");
        setMessage("Tidak dapat menghubungi server.");
      }
    }

    void load();
  }, [orderNumber]);

  useEffect(() => {
    if (status !== "ready" && status !== "uploaded") {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderNumber)}/payment/status`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
          payment?: { status?: string } | null;
        }> | null;

        if (payload?.data?.payment?.status === "PAID") {
          setStatus("paid");
        }
      } catch {
        // abaikan gangguan jaringan
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [status, orderNumber]);

  async function handleCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} disalin.`);
    } catch {
      setNotice("Gagal menyalin otomatis.");
    }
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setNotice("Pilih file bukti terlebih dahulu.");
      return;
    }

    setIsUploading(true);
    setNotice(null);

    try {
      const form = new FormData();
      form.append("proof", file);

      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/payment/proof`,
        { method: "POST", body: form },
      );
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<{
        proofImageUrl?: string;
      }> | null;

      if (!response.ok || !payload?.data?.proofImageUrl) {
        setNotice(payload?.error?.message ?? "Gagal mengunggah bukti transfer.");
        return;
      }

      setProofUrl(payload.data.proofImageUrl);
      setStatus("uploaded");
    } catch {
      setNotice("Tidak dapat menghubungi server saat mengunggah bukti.");
    } finally {
      setIsUploading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-semibold">Menyiapkan instruksi transfer…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <p role="alert" className="rounded-xl border bg-card p-4 text-center text-sm font-semibold text-danger">
        {message ?? "Instruksi transfer tidak dapat dimuat."}
      </p>
    );
  }

  if (status === "paid") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-6 text-center">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <p className="text-sm font-extrabold text-success">Pembayaran dikonfirmasi kasir</p>
        <p className="text-xs text-muted-foreground">Pesanan Anda diteruskan ke dapur.</p>
        <Link
          href={`/t/${encodeURIComponent(tableSlug)}/order/${encodeURIComponent(orderNumber)}`}
          className="mt-1 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          Lacak Pesanan
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-1 rounded-xl border bg-card p-4 text-center shadow-card-soft">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Nominal transfer
        </span>
        <span className="text-2xl font-extrabold tabular-nums">{formatRupiah(data?.amount ?? 0)}</span>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Sudah termasuk kode unik{" "}
          <span className="font-extrabold text-primary tabular-nums">{data?.uniqueCode ?? 0}</span>{" "}
          — transfer <span className="font-semibold">tepat</span> sebesar nominal ini.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {data?.accounts.map((account) => (
          <div
            key={`${account.bank}-${account.accountNumber}`}
            className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3"
          >
            <div className="flex flex-col">
              <span className="text-xs font-extrabold">{account.bank}</span>
              <span className="text-sm font-bold tabular-nums">{account.accountNumber}</span>
              <span className="text-[10px] text-muted-foreground">{account.accountHolder}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCopy(account.accountNumber, "Nomor rekening")}
            >
              <Copy className="size-3.5" aria-hidden />
              Salin
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
        <p className="text-xs font-bold">Unggah bukti transfer</p>
        <p className="text-[10px] leading-snug text-muted-foreground">
          JPG, PNG, WEBP, atau PDF · maksimal 2 MB.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-bold"
        />

        <Button onClick={() => void handleUpload()} disabled={isUploading} className="w-full">
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          {isUploading ? "Mengunggah…" : "Kirim Bukti"}
        </Button>

        {proofUrl ? (
          <div className="flex flex-col gap-1 rounded-lg bg-success/10 p-2 text-center">
            <p className="text-[11px] font-bold text-success">
              Bukti terkirim. Menunggu verifikasi kasir.
            </p>
            <a
              href={proofUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-semibold text-primary underline"
            >
              Lihat bukti yang diunggah
            </a>
          </div>
        ) : null}

        {notice ? (
          <p role="status" className="text-[11px] font-semibold text-muted-foreground">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
