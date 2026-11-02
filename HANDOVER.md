# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 1 — Inisialisasi Proyek, Skema Database, & Utilitas Inti`
* **Sub-Tugas Terakhir yang Selesai**: `1.1 Setup Next.js & Konfigurasi Dasar` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `1.2 Skema Prisma — Area, Meja, & Sesi Meja`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm run lint`, `npm run typecheck` (`tsc --noEmit`), dan `npm run build` semuanya exit `0`. Halaman `/` sudah diuji HTTP 200 via `next start`.
* **Progress**: 1 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `package.json` | Baru — Next 15.5.28, React 19.2.9, TS 5.9.3, Tailwind 3.4.19, Prisma 6.19.3, Zod 3.25.76, Zustand 5.0.16, lucide-react 0.577.0, framer-motion 12.43.0, clsx, tailwind-merge, class-variance-authority, tailwindcss-animate, tsx |
| `tsconfig.json` | Baru — `strict: true`, alias `@/*` → `src/*`, plugin Next |
| `next.config.ts` | Baru — `reactStrictMode`, `poweredByHeader: false`, `images.remotePatterns` (Supabase Storage & Unsplash), format `webp` |
| `tailwind.config.ts` | Baru — `darkMode: ["class"]`, token `success/warning/danger/brand/pos`, `animation: blink-danger` (SLA KDS), `min-h/w-touch: 56px` |
| `postcss.config.mjs` | Baru |
| `eslint.config.mjs` | Baru — flat config (`next/core-web-vitals` + `next/typescript`), rule `no-page-custom-font` dimatikan untuk App Router |
| `components.json` | Baru — konfigurasi shadcn/ui (style `new-york`, RSC, alias `@/components`) |
| `src/app/globals.css` | Baru — **design token ganda**: `:root` (Customer Warm Light) & `.dark` (POS/KDS Slate Dark) + utility `.tabular`, `.no-scrollbar`, `.safe-area-pb` |
| `src/app/layout.tsx` | Baru — root layout `lang="id"`, metadata & viewport PWA, stylesheet Plus Jakarta Sans |
| `src/app/page.tsx` | Baru — halaman pemeriksaan visual token tema + peta 5 modul |
| `src/lib/utils.ts` | Baru — helper `cn()` (clsx + tailwind-merge) standar shadcn |
| `.env.example` | Baru — template `DATABASE_URL`, `SESSION_SECRET`, kredensial Midtrans, Supabase |
| `.gitignore` | Baru — Next/Prisma/env + `/.npm-cache` |
| `README.md` | Baru — ringkasan stack, perintah, tema, struktur folder |
| `CONTEXT.md`, `TODO.md`, `HANDOVER.md` | Disalin ke root repo agar ikut versioned; `1.1` sudah ditandai `[x]` |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil tugas **`1.2 Skema Prisma — Area, Meja, & Sesi Meja`** di `TODO.md`, ubah menjadi `[/]`.
2. Jalankan `npx prisma init --datasource-provider postgresql` (Prisma **6.19.3** — jangan upgrade ke Prisma 7, generator & layout-nya berbeda).
3. Buat model berikut di `prisma/schema.prisma` (semua wajib punya `id`, `createdAt`, `updatedAt`):
   * `Area`: `name`, `slug` unik, `floor` (Int), relasi `tables Table[]`.
   * `Table`: `tableNumber`, `qrSlug` unik (dipakai URL `/t/[tableSlug]`), `capacity`, `status` (`TableStatus`: `AVAILABLE | OCCUPIED | NEEDS_CLEANING`), `currentPin` (String? 4 digit, di-hash/plaintext sesuai keputusan), `areaId`, relasi `sessions TableSession[]`, `@@unique([areaId, tableNumber])`.
   * `TableSession`: `tableId`, `status` (`TableSessionStatus`: `ACTIVE | BILL_REQUESTED | CLOSED`), `guestCount`, `openedAt`, `closedAt`, `sessionTokenHash`, relasi `orders Order[]` (akan ditambah di 1.4), index pada `[tableId, status]`.
4. Tambahkan `generator client` + `datasource db` (`env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")` opsional) hanya sekali di file ini; **jangan** hapus model pada sub-tugas 1.3 & 1.4 nanti — file ini akan ditumbuhkan bertahap.
5. Verifikasi dengan `npx prisma validate` dan `npx prisma format` (belum perlu `migrate`; migrasi dijalankan di 1.4). `npx prisma generate` boleh dijalankan untuk memastikan schema valid.
6. Setelah lolos, tandai `[x]` di `TODO.md`, perbarui `HANDOVER.md`, lalu `git commit` (`feat(db): add area, table, and table session schema`).

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Sandbox / instalasi**: `npm install` harus memakai `--ignore-scripts` karena sandbox memblokir *spawn* ber-pipe (EPERM). Bila butuh postinstall (mis. `prisma generate`), jalankan manual. Cache npm diarahkan ke `./.npm-cache` (sudah di-`.gitignore`).
* **Font**: `next/font/google` gagal di lingkungan ini (`An error occurred in next/font` → network). Solusi terpasang: stylesheet `<link>` ke Google Fonts + stack fallback `--font-sans` di `globals.css`. Jangan kembalikan ke `next/font/google` tanpa menguji `npm run build`.
* **Tema ganda**: `:root` = Customer Warm Light (`#FAF8F5`, primary Terracotta `#D9381E`, accent `#EA580C`); `.dark` = POS/KDS Slate Dark (`#0F172A` background, `#1E293B` card, primary Emerald `#10B981`). Layout POS/KDS nanti cukup `className="dark"`. Token status tersedia sebagai `success`/`warning`/`danger` dan `pos.bg|surface|elevated`.
* **Standar angka**: gunakan class `tabular-nums` (built-in Tailwind) atau utility `.tabular` untuk semua harga, kuantitas, dan timer KDS (CONTEXT §5.2).
* **Touch target**: `min-h-touch` / `min-w-touch` = `56px` untuk tombol POS/KDS; tombol pelanggan minimal `48px` (`min-h-12`).
* **Kalkulasi harga**: seluruh perhitungan subtotal, *modifiers*, PB1 10%, *service charge* 5% wajib terpusat di `src/lib/pricing.ts` (dibuat di 1.6) dan divalidasi ulang di server.
* **Anti-prank order**: pesanan QR dengan metode **Bayar di Kasir (Tunai)** berstatus awal `WAITING_CASHIER_APPROVAL` sampai kasir konfirmasi atau PIN Meja 4-digit valid dimasukkan.
* **Memory files**: `CONTEXT.md`, `TODO.md`, `HANDOVER.md` ada di root repo **dan** di `C:\Users\Firman Ardiansyah\Downloads\`; setiap sesi wajib memperbarui keduanya agar tidak terjadi divergensi.
* **Node & versi**: Node 24.22.1, npm 11.19.1. Repo belum punya `prisma/`, `src/components/`, `src/store/`, `src/types/` — akan dibuat bertahap sesuai fase.

## 5. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0 — Inisialisasi Arsitektur]**: Menyelesaikan perencanaan desain sistem FnB menyeluruh dan menyusun 3 file memori eksternal (`CONTEXT.md`, `TODO.md`, `HANDOVER.md`). Siap dieksekusi oleh Coder Agent pada tugas `1.1`.
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Repo `frmnardd/fnb-digital` di-clone (kosong), lalu scaffold Next.js 15.5.28 App Router + TS strict + Tailwind 3.4.19 + token tema ganda + `cn()` + `components.json` shadcn + `.env.example`. Lint, typecheck, dan build hijau; smoke test HTTP 200. Dua kendala lingkungan dipecahkan: npm cache ke dalam workspace (`--ignore-scripts`) dan font Google via `<link>`. Commit pending untuk tugas ini.
