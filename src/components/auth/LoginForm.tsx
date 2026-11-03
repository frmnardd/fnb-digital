"use client";

import { Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Form login staf: email + PIN 6 digit.
 * Sukses → reload penuh ke halaman tujuan agar cookie sesi langsung dipakai.
 */
export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setRemaining(null);

    try {
      const response = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), pin }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string; details?: { remainingAttempts?: number } };
      } | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Login gagal.");
        const left = payload?.error?.details?.remainingAttempts;
        setRemaining(typeof left === "number" ? left : null);
        setPin("");
        return;
      }

      window.location.assign(nextPath);
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Email staf
        </span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          placeholder="kasir@fnb.local"
          className="h-12 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          PIN (6 digit)
        </span>
        <input
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="current-password"
          required
          minLength={6}
          maxLength={6}
          placeholder="••••••"
          className="h-12 rounded-lg border border-input bg-background px-3 text-center text-lg font-extrabold tracking-[0.4em] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-2 text-[11px] font-semibold text-danger">
          {error}
          {remaining !== null ? ` (sisa ${remaining} percobaan)` : ""}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting || pin.length !== 6}>
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <LockKeyhole className="size-4" aria-hidden />
        )}
        {isSubmitting ? "Memeriksa…" : "Masuk"}
      </Button>

      {process.env.NODE_ENV !== "production" ? (
        <div className="rounded-lg border border-dashed border-border p-2 text-[10px] leading-relaxed text-muted-foreground">
          <p className="font-bold">Akun seed (hanya mode pengembangan):</p>
          <p>admin@fnb.local / 111111 · kasir@fnb.local / 222222</p>
          <p>dapur@fnb.local / 333333 · waiter@fnb.local / 444444</p>
        </div>
      ) : null}
    </form>
  );
}
