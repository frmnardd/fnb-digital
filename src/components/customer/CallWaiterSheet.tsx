"use client";

import {
  CheckCircle2,
  GlassWater,
  Loader2,
  MessageCircleQuestion,
  ReceiptText,
  Sparkles,
  Timer,
} from "lucide-react";
import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CallType = "WATER_TISSUE" | "CLEAN_TABLE" | "ASK_MENU" | "REQUEST_BILL";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

interface ApiErrorPayload {
  error?: {
    message?: string;
    details?: { retryAfterSeconds?: number };
  };
}

const ACTIONS: Array<{
  type: CallType;
  label: string;
  description: string;
  icon: typeof GlassWater;
}> = [
  {
    type: "WATER_TISSUE",
    label: "Air / Tisu",
    description: "Minta air minum atau tisu",
    icon: GlassWater,
  },
  {
    type: "CLEAN_TABLE",
    label: "Bersihkan Meja",
    description: "Meja perlu dibersihkan",
    icon: Sparkles,
  },
  {
    type: "ASK_MENU",
    label: "Tanya Menu",
    description: "Butuh rekomendasi pelayan",
    icon: MessageCircleQuestion,
  },
  {
    type: "REQUEST_BILL",
    label: "Minta Bill",
    description: "Siap untuk membayar",
    icon: ReceiptText,
  },
];

export function CallWaiterSheet({
  tableSlug,
  open,
  onOpenChange,
}: {
  tableSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<CallType>("WATER_TISSUE");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Hitung mundur anti-spam setelah server membalas 429.
  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setTimeout(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStatus("idle");
      setMessage(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit() {
    if (status === "submitting" || cooldown > 0) {
      return;
    }

    setStatus("submitting");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/tables/${encodeURIComponent(tableSlug)}/call-waiter`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: selected,
            ...(note.trim().length > 0 ? { note: note.trim() } : {}),
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;

      if (response.ok) {
        setStatus("success");
        setMessage("Pelayan akan segera datang ke meja Anda.");
        setNote("");
        return;
      }

      if (response.status === 429) {
        const seconds = payload?.error?.details?.retryAfterSeconds ?? 120;
        setCooldown(seconds);
        setStatus("error");
        setMessage(`Mohon tunggu ${seconds} detik sebelum memanggil pelayan lagi.`);
        return;
      }

      setStatus("error");
      setMessage(payload?.error?.message ?? "Panggilan gagal dikirim. Coba lagi.");
    } catch {
      setStatus("error");
      setMessage("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Panggil Pelayan"
      description="Pilih kebutuhan Anda, pelayan terdekat akan datang ke meja."
    >
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const isSelected = selected === action.type;

          return (
            <button
              key={action.type}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(action.type)}
              className={cn(
                "flex min-h-24 flex-col items-start gap-2 rounded-xl border p-3 text-left transition",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:bg-secondary",
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg",
                  isSelected ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold leading-tight">{action.label}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {action.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">
          Catatan tambahan (opsional)
        </span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={160}
          rows={2}
          placeholder="Contoh: tolong bawa 2 gelas air"
          className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="self-end text-[10px] tabular text-muted-foreground">
          {note.length}/160
        </span>
      </label>

      {status === "success" ? (
        <div className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-xs font-semibold leading-relaxed">{message}</p>
        </div>
      ) : null}

      {status === "error" && message ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-3 text-xs font-semibold text-danger">
          {message}
        </p>
      ) : null}

      <Button
        onClick={handleSubmit}
        disabled={status === "submitting" || cooldown > 0}
        className="w-full"
      >
        {status === "submitting" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : cooldown > 0 ? (
          <Timer className="size-4" aria-hidden />
        ) : null}
        {cooldown > 0
          ? `Tunggu ${cooldown} detik`
          : status === "submitting"
            ? "Mengirim panggilan..."
            : "Panggil Sekarang"}
      </Button>
    </BottomSheet>
  );
}
