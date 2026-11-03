"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";
import type { SupervisorAction } from "@/lib/security/authorization-token";
import { cn } from "@/lib/utils";

/**
 * Modal otorisasi supervisor: email staf + PIN 6 digit.
 * Sukses → `onAuthorized(token)` dengan token berlaku 5 menit.
 */

const ACTION_LABEL: Record<SupervisorAction, string> = {
  VOID_ITEM: "Void Item",
  REFUND: "Refund",
  MANUAL_DISCOUNT: "Diskon Manual",
};

export function SupervisorPinModal({
  open,
  onOpenChange,
  action,
  targetId,
  onAuthorized,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: SupervisorAction;
  targetId?: string;
  onAuthorized: (token: string) => void;
}) {
  const [staffEmail, setStaffEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (open) {
      setDigits(["", "", "", "", "", ""]);
      setMessage(null);
      setRemainingAttempts(null);
      setIsSubmitting(false);
      inputsRef.current[0]?.focus();
    }
  }, [open]);

  function handleDigitChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, "").slice(-1);

    setDigits((previous) =>
      previous.map((value, position) => (position === index ? digit : value)),
    );

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

    if (pin.length !== 6 || staffEmail.trim().length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/pos/supervisor-authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffEmail: staffEmail.trim(),
          pin,
          action,
          ...(targetId === undefined ? {} : { targetId }),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { token?: string };
        error?: { message?: string; details?: { remainingAttempts?: number } };
      } | null;

      if (!response.ok || !payload?.data?.token) {
        setMessage(payload?.error?.message ?? "Otorisasi gagal.");
        const remaining = payload?.error?.details?.remainingAttempts;
        setRemainingAttempts(typeof remaining === "number" ? remaining : null);
        setDigits(["", "", "", "", "", ""]);
        inputsRef.current[0]?.focus();
        return;
      }

      onAuthorized(payload.data.token);
      onOpenChange(false);
    } catch {
      setMessage("Tidak dapat menghubungi server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Otorisasi ${ACTION_LABEL[action]}`}
      description="Masukkan email staf dan PIN supervisor 6 digit."
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold">Email staf</span>
          <input
            type="email"
            value={staffEmail}
            onChange={(event) => setStaffEmail(event.target.value)}
            placeholder="kasir@fnb.local"
            autoComplete="off"
            className="h-12 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-bold">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden />
            PIN Supervisor (6 digit)
          </span>

          <div className="flex justify-between gap-1.5">
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
                  "h-12 w-full rounded-lg border border-input bg-background text-center text-lg font-extrabold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  message ? "border-danger" : "",
                )}
              />
            ))}
          </div>
        </div>

        {message ? (
          <p role="alert" className="rounded-lg bg-danger/10 p-2 text-[11px] font-semibold text-danger">
            {message}
            {remainingAttempts !== null ? ` (sisa ${remainingAttempts} percobaan)` : ""}
          </p>
        ) : null}

        <button
          type="button"
          disabled={isSubmitting || digits.join("").length !== 6 || staffEmail.trim().length === 0}
          onClick={() => void handleSubmit()}
          className="flex min-h-touch items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {isSubmitting ? "Memverifikasi…" : "Otorisasi"}
        </button>

        <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
          Token otorisasi berlaku 5 menit setelah PIN terverifikasi.
        </p>
      </div>
    </Modal>
  );
}
