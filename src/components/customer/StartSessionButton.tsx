"use client";

import { Loader2, QrCode, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface ApiErrorPayload {
  error?: { message?: string };
}

/**
 * CTA "Mulai Pesan" — membuka TableSession baru lewat API 2.1 lalu me-refresh
 * halaman agar server component memuat sesi terbaru.
 */
export function StartSessionButton({ tableSlug }: { tableSlug: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tables/${encodeURIComponent(tableSlug)}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
        setError(payload?.error?.message ?? "Gagal memulai sesi meja. Coba lagi.");
        return;
      }

      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleStart} disabled={isLoading} className="w-full">
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <QrCode className="size-4" aria-hidden />
        )}
        {isLoading ? "Membuka sesi..." : "Mulai Pesan di Meja Ini"}
      </Button>

      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Users className="size-3.5" aria-hidden />
        Satu sesi meja bisa dipakai bergantian oleh semua tamu di meja ini.
      </p>
    </div>
  );
}
