"use client";

import { Check, Copy, Loader2, Timer, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { BANK_OPTIONS, type BankCode } from "@/lib/payment/va";
import { formatRupiah } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Panel Virtual Account: pilih bank, terima nomor VA, salin, dan pantau status.
 */

interface VaData {
  paymentId: string;
  orderNumber: string;
  bank: BankCode;
  vaNumber: string;
  amount: number;
  expiresAt: string;
  mode: "gateway" | "demo";
}

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function VirtualAccountPanel({
  orderNumber,
  amount,
}: {
  orderNumber: string;
  amount: number;
}) {
  const [bank, setBank] = useState<BankCode>("BCA");
  const [data, setData] = useState<VaData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "paid">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setMessage(null);

    async function load() {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderNumber)}/payment/va`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bank }),
          },
        );
        const payload = (await response.json().catch(() => null)) as ApiEnvelope<VaData> | null;

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!response.ok || !payload?.data) {
          setStatus("error");
          setMessage(payload?.error?.message ?? "Gagal membuat nomor Virtual Account.");
          return;
        }

        setData(payload.data);
        setStatus("ready");
      } catch {
        if (requestId === requestIdRef.current) {
          setStatus("error");
          setMessage("Tidak dapat menghubungi server.");
        }
      }
    }

    void load();
  }, [bank, orderNumber]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const update = () => {
      const diff = Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000);
      setRemaining(Math.max(0, diff));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [data]);

  useEffect(() => {
    if (status !== "ready") {
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

  async function handleCopy() {
    if (!data) {
      return;
    }

    try {
      await navigator.clipboard.writeText(data.vaNumber);
      setNotice("Nomor Virtual Account disalin.");
    } catch {
      setNotice("Gagal menyalin otomatis. Salin manual dari nomor di atas.");
    }
  }

  if (status === "paid") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-6 text-center">
        <Check className="size-8 text-success" aria-hidden />
        <p className="text-sm font-extrabold text-success">Pembayaran diterima</p>
        <p className="text-xs text-muted-foreground">Pesanan Anda diteruskan ke dapur.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border bg-card p-3 shadow-card-soft">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Pilih bank
        </p>
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Pilih bank">
          {BANK_OPTIONS.map((option) => (
            <button
              key={option.code}
              type="button"
              aria-pressed={bank === option.code}
              onClick={() => setBank(option.code)}
              className={cn(
                "h-12 rounded-lg border text-xs font-bold transition",
                bank === option.code
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-4 shadow-card-soft">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <Wallet className="size-3.5" aria-hidden />
          Nomor Virtual Account
        </span>

        {status === "loading" ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          </div>
        ) : status === "error" ? (
          <p role="alert" className="py-4 text-center text-xs font-semibold text-danger">
            {message ?? "Gagal memuat nomor Virtual Account."}
          </p>
        ) : (
          <>
            <p className="text-2xl font-extrabold tracking-wider tabular-nums">
              {data?.vaNumber}
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Atas nama{" "}
              <span className="font-bold text-foreground">FnB Digital</span> · transfer tepat{" "}
              <span className="font-extrabold text-foreground tabular-nums">
                {formatRupiah(amount)}
              </span>
            </p>

            <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">
              <Timer className="size-3.5" aria-hidden />
              <span className="tabular-nums">{formatCountdown(remaining)}</span>
            </div>

            <Button variant="outline" className="w-full" onClick={() => void handleCopy()}>
              <Copy className="size-4" aria-hidden />
              Salin Nomor VA
            </Button>

            {data?.mode === "demo" ? (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-center text-[10px] font-semibold leading-snug text-warning">
                Nomor VA dibuat lokal (mode demo) karena kredensial gateway belum diatur.
              </p>
            ) : null}

            {notice ? (
              <p role="status" className="text-[11px] font-semibold text-muted-foreground">
                {notice}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
