"use client";

import { CheckCircle2, Loader2, Lock, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BookingCodeCard } from "@/components/customer/BookingCodeCard";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Panel pembayaran tunai di kasir: kode booking + barcode, opsional PIN meja
 * 4 digit sebagai pengesahan (anti prank order), dan polling status pembayaran.
 */

interface PinErrorPayload {
  error?: {
    message?: string;
    details?: { remainingAttempts?: number; retryAfterSeconds?: number };
  };
}

export function CashierPaymentPanel({
  orderNumber,
  amount,
  pinEnabled,
}: {
  orderNumber: string;
  amount: number;
  pinEnabled: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [phase, setPhase] = useState<"idle" | "confirmed" | "paid">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (phase === "paid") {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderNumber)}/payment/status`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as {
          data?: { payment?: { status?: string } | null };
        } | null;

        if (payload?.data?.payment?.status === "PAID") {
          setPhase("paid");
        }
      } catch {
        // abaikan gangguan jaringan kecil
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [phase, orderNumber]);

  function handleDigitChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, "").slice(-1);

    setDigits((previous) => previous.map((value, position) => (position === index ? digit : value)));

    if (digit.length > 0 && index < digits.length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && digits[index]?.length === 0 && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  async function handleSubmit() {
    const pin = digits.join("");

    if (pin.length !== 4 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const payload = (await response.json().catch(() => null)) as PinErrorPayload | null;

      if (!response.ok) {
        setMessage(payload?.error?.message ?? "PIN tidak dapat diverifikasi.");
        const remaining = payload?.error?.details?.remainingAttempts;
        setRemainingAttempts(typeof remaining === "number" ? remaining : null);
        setDigits(["", "", "", ""]);
        inputsRef.current[0]?.focus();
        return;
      }

      setPhase("confirmed");
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (phase === "paid") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-6 text-center">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <p className="text-sm font-extrabold text-success">Pembayaran lunas</p>
        <p className="text-xs text-muted-foreground">Terima kasih. Pesanan Anda sedang disiapkan.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <BookingCodeCard orderNumber={orderNumber} />

      <div className="flex flex-col items-center gap-1 rounded-xl border bg-card p-4 text-center shadow-card-soft">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <Wallet className="size-3.5" aria-hidden />
          Bayar di kasir
        </span>
        <span className="text-2xl font-extrabold tabular-nums">{formatRupiah(amount)}</span>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Tunjukkan kode booking di atas ke kasir. Pembayaran diproses setelah kasir
          menerima uang.
        </p>
      </div>

      {phase === "confirmed" ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-success/40 bg-success/10 p-4 text-center">
          <CheckCircle2 className="size-6 text-success" aria-hidden />
          <p className="text-xs font-extrabold text-success">PIN benar — pesanan diteruskan ke dapur</p>
          <p className="text-[11px] text-muted-foreground">
            Menunggu kasir menerima dan mengonfirmasi pembayaran tunai.
          </p>
        </div>
      ) : pinEnabled ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card-soft">
          <span className="flex items-center gap-1.5 text-xs font-extrabold">
            <Lock className="size-3.5 text-primary" aria-hidden />
            PIN Meja (4 digit)
          </span>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Masukkan PIN meja untuk mengesahkan pesanan tanpa menunggu kasir.
          </p>

          <div className="flex justify-center gap-2">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputsRef.current[index] = element;
                }}
                value={digit}
                onChange={(event) => handleDigitChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                aria-label={`Digit PIN ${index + 1}`}
                className={cn(
                  "size-12 rounded-lg border border-input bg-card text-center text-lg font-extrabold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  message ? "border-danger" : "",
                )}
              />
            ))}
          </div>

          {message ? (
            <p role="alert" className="text-center text-[11px] font-semibold text-danger">
              {message}
              {remainingAttempts !== null ? ` (sisa ${remainingAttempts} percobaan)` : ""}
            </p>
          ) : null}

          <Button
            className="w-full"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || digits.join("").length !== 4}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {isSubmitting ? "Memverifikasi…" : "Konfirmasi PIN"}
          </Button>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed bg-card/60 p-3 text-center text-[11px] leading-relaxed text-muted-foreground">
          PIN meja tidak diaktifkan untuk meja ini. Kasir akan mengonfirmasi pesanan secara
          manual.
        </p>
      )}

      <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
        Halaman ini memperbarui status otomatis setelah pembayaran dikonfirmasi kasir.
      </p>
    </div>
  );
}
