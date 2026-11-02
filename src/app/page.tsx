import {
  BarChart3,
  ChefHat,
  ClipboardList,
  ConciergeBell,
  QrCode,
  ScanLine,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

const MODULES = [
  {
    icon: ScanLine,
    title: "Customer Web App",
    href: "/t/meja-01",
    scope: "QR ordering, group order, QRIS/VA/tunai",
  },
  {
    icon: Wallet,
    title: "POS Kasir",
    href: "/cashier",
    scope: "Antrean QR, floor plan, split bill, shift",
  },
  {
    icon: ChefHat,
    title: "KDS Dapur & Bar",
    href: "/kds/kitchen",
    scope: "Tiket per stasiun + SLA aging timer",
  },
  {
    icon: ConciergeBell,
    title: "Runner Pelayan",
    href: "/runner",
    scope: "Antar pesanan siap & respons call waiter",
  },
  {
    icon: BarChart3,
    title: "Admin Back-Office",
    href: "/admin/dashboard",
    scope: "Menu, QR studio, stok, menu engineering",
  },
] as const;

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-8 rounded-md border border-black/5", className)} aria-hidden />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:py-16">
      <header className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <QrCode className="size-4" aria-hidden />
          Fase 1 · Fondasi Proyek
        </span>
        <h1 className="text-balance text-3xl font-extrabold leading-tight sm:text-4xl">
          FnB Digital — Satu Sistem untuk QR Ordering, Kasir, Dapur &amp; Owner
        </h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Fondasi Next.js 15 (App Router) + TypeScript strict + Tailwind + shadcn/ui sudah siap.
          Gunakan halaman ini sebagai pemeriksaan visual token warna sebelum modul
          pelanggan, POS, dan KDS dibangun.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        {/* Tema Pelanggan — Warm Light */}
        <div className="overflow-hidden rounded-xl border bg-card shadow-card-soft">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <UtensilsCrossed className="size-4 text-primary" aria-hidden />
              Tema Pelanggan · Warm Alabaster
            </h2>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              :root
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-3">
            <Swatch className="bg-background" label="bg #FAF8F5" />
            <Swatch className="bg-card" label="card #FFFFFF" />
            <Swatch className="bg-primary" label="primary #D9381E" />
            <Swatch className="bg-accent" label="accent #EA580C" />
            <Swatch className="bg-secondary" label="secondary" />
            <Swatch className="bg-muted-foreground" label="muted fg" />
          </div>
          <div className="flex flex-col gap-3 border-t px-5 py-4">
            <button
              type="button"
              className="min-h-12 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition active:scale-[0.99]"
            >
              Tambah ke Keranjang · <span className="tabular-nums">Rp 48.000</span>
            </button>
            <button
              type="button"
              className="min-h-12 rounded-lg border bg-card px-4 text-sm font-semibold text-foreground"
            >
              Panggil Pelayan
            </button>
          </div>
        </div>

        {/* Tema POS/KDS — Slate Dark */}
        <div className="dark overflow-hidden rounded-xl border bg-background text-foreground shadow-pos-panel">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <ClipboardList className="size-4 text-primary" aria-hidden />
              Tema POS / KDS · Slate Dark
            </h2>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              .dark
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-3">
            <Swatch className="bg-background" label="bg #0F172A" />
            <Swatch className="bg-card" label="card #1E293B" />
            <Swatch className="bg-secondary" label="secondary #334155" />
            <Swatch className="bg-success" label="lunas #10B981" />
            <Swatch className="bg-warning" label="warning #F59E0B" />
            <Swatch className="bg-danger" label="overdue #EF4444" />
          </div>
          <div className="flex flex-col gap-3 border-t px-5 py-4">
            <div className="flex items-center justify-between rounded-lg bg-card px-4 py-3">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">#ORD-1024 · Meja 07</span>
                <span className="text-sm font-semibold">2× Nasi Goreng · 1× Es Teh</span>
              </div>
              <span className="rounded-md bg-warning/15 px-2 py-1 text-xs font-bold text-warning tabular-nums">
                03:12
              </span>
            </div>
            <button
              type="button"
              className="min-h-14 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
            >
              Konfirmasi Lunas
            </button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Peta Modul Aplikasi</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ icon: Icon, title, href, scope }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-card-soft"
            >
              <span className="rounded-lg bg-secondary p-2 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold">{title}</span>
                <code className="text-[11px] text-muted-foreground">{href}</code>
                <span className="text-xs leading-snug text-muted-foreground">{scope}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto border-t pt-4 text-xs text-muted-foreground">
        Sub-tugas berikutnya: <span className="font-semibold">1.2 Skema Prisma — Area, Meja, &amp; Sesi Meja</span>
      </footer>
    </main>
  );
}
