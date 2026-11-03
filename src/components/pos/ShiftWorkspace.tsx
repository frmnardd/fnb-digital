"use client";

import { Loader2, Lock, Printer, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { PosSidebar } from "@/components/pos/PosSidebar";
import { PosTopbar } from "@/components/pos/PosTopbar";
import { Button } from "@/components/ui/button";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { formatRupiah } from "@/lib/pricing";
import type { CurrentShiftView } from "@/lib/services/shift";
import { cn } from "@/lib/utils";

/**
 * Halaman shift kasir: buka shift (modal awal), catat kas masuk/keluar,
 * tutup shift dengan blind count, dan cetak Z-Report lewat dialog cetak browser.
 *
 * TODO(RBAC): email kasir masih diisi manual sampai modul autentikasi staf ada.
 */

interface ShiftEnvelope {
  data?: { shift?: CurrentShiftView | null };
  error?: { message?: string };
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, 9);
}

export function ShiftWorkspace() {
  const [shift, setShift] = useState<CurrentShiftView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [startingCash, setStartingCash] = useState("");
  const [movementType, setMovementType] = useState<"CASH_IN" | "CASH_OUT">("CASH_IN");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [actualEndingCash, setActualEndingCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [lastReport, setLastReport] = useState<{
    expectedCash: number;
    actualEndingCash: number;
    variance: number;
    sales: number;
  } | null>(null);

  const { isEnabled, enable, disable } = useNotificationSound();

  const loadShift = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/pos/shift", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as ShiftEnvelope | null;

      if (!response.ok) {
        setMessage(payload?.error?.message ?? "Gagal memuat data shift.");
        setShift(null);
        return;
      }

      setShift(payload?.data?.shift ?? null);
    } catch {
      setMessage("Tidak dapat menghubungi server.");
      setShift(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShift();
  }, [loadShift]);

  async function handleToggleSound() {
    if (isEnabled) {
      disable();
      return;
    }

    await enable();
  }

  async function postJson(url: string, body: Record<string, unknown>) {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: Record<string, unknown>;
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setMessage(payload?.error?.message ?? "Aksi gagal diproses.");
        return null;
      }

      await loadShift();
      return payload?.data ?? {};
    } catch {
      setMessage("Tidak dapat menghubungi server.");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOpenShift() {
    const cash = Number(startingCash);

    if (!Number.isFinite(cash) || cash < 0) {
      setMessage("Modal awal tidak valid.");
      return;
    }

    const result = await postJson("/api/pos/shift/open", {
      startingCash: cash,
    });

    if (result) {
      setStartingCash("");
      setMessage("Shift dibuka.");
    }
  }

  async function handleMovement() {
    if (!shift) {
      return;
    }

    const amount = Number(movementAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Nominal kas tidak valid.");
      return;
    }

    const result = await postJson("/api/pos/shift/log", {
      shiftId: shift.id,
      type: movementType,
      amount,
      ...(movementReason.trim().length > 0 ? { reason: movementReason.trim() } : {}),
    });

    if (result) {
      setMovementAmount("");
      setMovementReason("");
      setMessage(`${movementType === "CASH_IN" ? "Kas masuk" : "Kas keluar"} dicatat.`);
    }
  }

  async function handleCloseShift() {
    if (!shift) {
      return;
    }

    const actual = Number(actualEndingCash);

    if (!Number.isFinite(actual) || actual < 0) {
      setMessage("Kas fisik tidak valid.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/pos/shift/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: shift.id,
          actualEndingCash: actual,
          ...(closeNotes.trim().length > 0 ? { notes: closeNotes.trim() } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: {
          expectedCash?: number;
          actualEndingCash?: number;
          variance?: number;
          sales?: number;
        };
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.data) {
        setMessage(payload?.error?.message ?? "Gagal menutup shift.");
        return;
      }

      setLastReport({
        expectedCash: payload.data.expectedCash ?? 0,
        actualEndingCash: payload.data.actualEndingCash ?? actual,
        variance: payload.data.variance ?? 0,
        sales: payload.data.sales ?? 0,
      });
      setIsCloseOpen(false);
      setActualEndingCash("");
      setCloseNotes("");
      await loadShift();
    } catch {
      setMessage("Tidak dapat menghubungi server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isPositiveVariance = (lastReport?.variance ?? 0) >= 0;

  return (
    <div className="flex h-dvh">
      <PosSidebar active="shift" />

      <div className="flex min-w-0 flex-1 flex-col">
        <PosTopbar
          cashierName="Kasir"
          shiftLabel={shift ? "Shift terbuka" : "Shift belum dibuka"}
          soundEnabled={isEnabled}
          onToggleSound={() => void handleToggleSound()}
        />

        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 print-hidden">
            <h1 className="text-sm font-extrabold">Shift & Laci Kas</h1>
            <span className="text-[10px] font-semibold text-muted-foreground">
              Kasir: sesi login aktif
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
            </div>
          ) : shift ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-extrabold">
                    <Wallet className="size-4 text-primary" aria-hidden />
                    Ringkasan Shift
                  </span>
                  <span className="text-[10px] font-bold uppercase text-success">Terbuka</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <SummaryTile label="Modal awal" value={formatRupiah(shift.startingCash)} />
                  <SummaryTile label="Penjualan tunai" value={formatRupiah(shift.sales)} />
                  <SummaryTile label="Kas masuk" value={formatRupiah(shift.cashIn)} />
                  <SummaryTile label="Kas keluar" value={formatRupiah(shift.cashOut)} />
                  <SummaryTile label="Refund" value={formatRupiah(shift.refunds)} />
                  <SummaryTile label="Transaksi tunai" value={String(shift.cashTransactions)} />
                </div>

                <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                  <span className="text-[11px] font-bold text-primary">Kas seharusnya</span>
                  <span className="text-base font-extrabold tabular-nums text-primary">
                    {formatRupiah(shift.expectedCash)}
                  </span>
                </div>

                <div className="print-hidden flex flex-col gap-2 rounded-lg border border-border/70 p-2">
                  <span className="text-[11px] font-bold">Kas masuk / keluar</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      aria-pressed={movementType === "CASH_IN"}
                      onClick={() => setMovementType("CASH_IN")}
                      className={cn(
                        "min-h-touch rounded-lg border text-xs font-bold",
                        movementType === "CASH_IN"
                          ? "border-success bg-success/15 text-success"
                          : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      Kas Masuk
                    </button>
                    <button
                      type="button"
                      aria-pressed={movementType === "CASH_OUT"}
                      onClick={() => setMovementType("CASH_OUT")}
                      className={cn(
                        "min-h-touch rounded-lg border text-xs font-bold",
                        movementType === "CASH_OUT"
                          ? "border-danger bg-danger/15 text-danger"
                          : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      Kas Keluar
                    </button>
                  </div>

                  <input
                    value={movementAmount}
                    onChange={(event) => setMovementAmount(digitsOnly(event.target.value))}
                    inputMode="numeric"
                    placeholder="Nominal"
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <input
                    value={movementReason}
                    onChange={(event) => setMovementReason(event.target.value)}
                    maxLength={160}
                    placeholder="Keterangan (opsional)"
                    className="h-11 rounded-lg border border-input bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />

                  <Button variant="secondary" onClick={() => void handleMovement()} disabled={isSubmitting}>
                    Catat Mutasi
                  </Button>
                </div>

                <Button
                  variant="destructive"
                  className="print-hidden"
                  onClick={() => setIsCloseOpen(true)}
                >
                  <Lock className="size-4" aria-hidden />
                  Tutup Shift
                </Button>
              </section>

              <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                <span className="text-xs font-extrabold">Mutasi Laci Kas</span>

                {shift.logs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Belum ada mutasi.</p>
                ) : (
                  <ul className="flex max-h-[360px] flex-col gap-1 overflow-y-auto">
                    {shift.logs.map((log) => (
                      <li
                        key={log.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-2 py-1.5 text-[11px]"
                      >
                        <span className="flex flex-col">
                          <span className="font-bold">{log.type}</span>
                          {log.reason ? (
                            <span className="text-[10px] text-muted-foreground">{log.reason}</span>
                          ) : null}
                        </span>
                        <span className="font-bold tabular-nums">{formatRupiah(log.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : (
            <section className="flex max-w-md flex-col gap-2 rounded-xl border border-border bg-card p-4">
              <span className="text-xs font-extrabold">Buka Shift</span>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Masukkan modal awal laci kas. Shift harus dibuka sebelum menerima pembayaran tunai.
              </p>
              <input
                value={startingCash}
                onChange={(event) => setStartingCash(digitsOnly(event.target.value))}
                inputMode="numeric"
                placeholder="Modal awal (Rp)"
                className="h-12 rounded-lg border border-input bg-background px-3 text-sm font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button onClick={() => void handleOpenShift()} disabled={isSubmitting}>
                Buka Shift
              </Button>
            </section>
          )}

          {message ? (
            <p role="status" className="mt-3 rounded-lg bg-secondary p-2 text-[11px] font-semibold">
              {message}
            </p>
          ) : null}

          {lastReport ? (
            <section className="mt-3 flex max-w-md flex-col gap-2 rounded-xl border border-border bg-card p-3">
              <span className="text-xs font-extrabold">Z-Report (shift terakhir)</span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <SummaryTile label="Penjualan tunai" value={formatRupiah(lastReport.sales)} />
                <SummaryTile label="Kas seharusnya" value={formatRupiah(lastReport.expectedCash)} />
                <SummaryTile label="Kas fisik" value={formatRupiah(lastReport.actualEndingCash)} />
                <SummaryTile
                  label="Selisih"
                  value={formatRupiah(lastReport.variance)}
                />
              </div>
              <p
                className={cn(
                  "rounded-lg p-2 text-[11px] font-bold",
                  isPositiveVariance ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                )}
              >
                {isPositiveVariance ? "Kas lebih" : "Kas kurang"}{" "}
                {formatRupiah(Math.abs(lastReport.variance))}
              </p>
              <Button variant="secondary" className="print-hidden" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden />
                Cetak Z-Report
              </Button>
            </section>
          ) : null}
        </main>
      </div>

      <Modal
        open={isCloseOpen}
        onOpenChange={setIsCloseOpen}
        title="Tutup Shift"
        description="Masukkan hasil hitung fisik kas (blind count)."
      >
        <div className="flex flex-col gap-2">
          <input
            value={actualEndingCash}
            onChange={(event) => setActualEndingCash(digitsOnly(event.target.value))}
            inputMode="numeric"
            placeholder="Kas fisik akhir (Rp)"
            className="h-12 rounded-lg border border-input bg-background px-3 text-base font-extrabold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            value={closeNotes}
            onChange={(event) => setCloseNotes(event.target.value)}
            maxLength={160}
            placeholder="Catatan (opsional)"
            className="h-11 rounded-lg border border-input bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button onClick={() => void handleCloseShift()} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Konfirmasi Tutup Shift
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-secondary/50 p-2">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="font-extrabold tabular-nums">{value}</span>
    </div>
  );
}
