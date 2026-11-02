# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 3 — Antarmuka Halaman Pelanggan (Mobile-First)` — **Fase 2 SELESAI (3/3)**
* **Sub-Tugas Terakhir yang Selesai**: `2.3 API Call Waiter` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `3.1 Header Meja & Quick Action Bar`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (54 test, 16 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔. Route aktif: `/api/menu`, `/api/tables/[qrSlug]/session`, `/api/tables/[qrSlug]/call-waiter` (semua ƒ Dynamic).
* **Database**: belum tersedia. Kontrak API sudah diverifikasi via HTTP probe (400/422/500 berformat benar); belum ada uji end-to-end dengan data.
* **Progress**: 9 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/waiter-call.ts` | **Baru** — `WAITER_CALL_TYPES`, `CALL_WAITER_COOLDOWN_MS` (2 menit), `evaluateCallWaiterLimit()` (termasuk penolakan `lastCallAt` di masa depan, pembulatan `retryAfterSeconds`) |
| `src/lib/waiter-call.test.ts` | **Baru** — 9 test (konstanta, belum pernah memanggil, tepat di batas, 1 ms sebelum batas, sisa waktu, clock skew, cooldown kustom) |
| `src/lib/api/request.ts` | **Baru** — helper bersama `parseQrSlug()` & `readJsonBody()` |
| `src/lib/api/errors.ts` | Diperbarui — `ApiError`/`jsonOk` mendukung `headers` (mis. `Retry-After`) |
| `src/app/api/tables/[qrSlug]/call-waiter/route.ts` | **Baru** — `POST` panggilan pelayan: wajib sesi aktif, rate limit 1×/2 menit per meja (query DB), transaksi create + bump `lastActivityAt`, 429 + `Retry-After` |
| `src/app/api/tables/[qrSlug]/session/route.ts` | Diperbarui — memakai helper `parseQrSlug`/`readJsonBody` bersama |
| `TODO.md` | `2.3` ditandai `[x]` (Fase 2 selesai) |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`3.1 Header Meja & Quick Action Bar`**, ubah menjadi `[/]`.
2. **Buat fondasi UI minimal dulu** (tanpa menambah dependency baru — Radix belum terpasang):
   * `src/components/ui/button.tsx` — tombol `cva` (varian `default`, `secondary`, `outline`, `ghost`, `destructive`; ukuran `sm`, `default`, `lg`, `icon`) memakai `cn()`; tinggi minimum `48px` untuk konteks pelanggan (`h-12`).
   * `src/components/ui/bottom-sheet.tsx` — *client component*: overlay + panel `motion.div` (Framer Motion) `animate-slide-up`, tutup via backdrop/Esc, `role="dialog"` + `aria-modal`, fokus awal ke panel. Tanpa portal library tambahan (pakai `createPortal` dari `react-dom`).
   * `src/components/ui/skeleton.tsx` — bila perlu placeholder loading.
3. **Buat route group pelanggan**:
   * `src/app/(customer)/layout.tsx` — tema terang hangat: `min-h-dvh bg-background`, kontainer `mx-auto w-full max-w-md`, `pb-24` (ruang floating cart nanti), `lang` tetap dari root layout.
   * `src/app/(customer)/t/[tableSlug]/page.tsx` — **server component**: `const { tableSlug } = await params`; ambil data meja+sesi langsung via `db` (bukan fetch ke API sendiri) dengan `cookies()` untuk memverifikasi `fnb_table_session` (reuse `verifySessionToken`). Bungkus query dalam `try/catch` agar tanpa database halaman menampilkan *empty state* ramah ("Meja tidak ditemukan / sistem belum siap") alih-alih crash. Tambahkan `export const dynamic = "force-dynamic"`.
   * Bila sesi belum ada, tampilkan CTA "Mulai Pesan" yang memanggil `POST /api/tables/[tableSlug]/session` (client component) lalu `router.refresh()`.
4. **Buat `src/components/customer/CustomerHeader.tsx`** (client) — sesuai CONTEXT §5:
   * Identitas restoran (nama + tagline singkat), **nomor meja aktif** + nama area, ikon `UtensilsCrossed`/`QrCode`.
   * **Switcher Dine-In / Takeaway** (dua tombol *segmented*, target ≥ 48px, state lokal/`useState` untuk sekarang; store Zustand menyusul di 3.5).
   * Tombol **Panggil Pelayan** (ikon `ConciergeBell`) membuka `BottomSheet` berisi 4 aksi: Minta Air/Tisu (`WATER_TISSUE`), Bersihkan Meja (`CLEAN_TABLE`), Tanya Menu (`ASK_MENU`), Minta Bill (`REQUEST_BILL`) + catatan opsional (max 160). Submit ke `POST /api/tables/[tableSlug]/call-waiter`; tangani `201` (pesan sukses), `429` (tampilkan hitung mundur `retryAfterSeconds` dan nonaktifkan tombol), `409` (sesi belum dibuka), error lain (pesan generik). Tampilkan state loading & disable saat request berjalan.
   * Sticky di atas (`sticky top-0 z-30 backdrop-blur border-b`) dan aman untuk *safe-area* iOS.
5. **Verifikasi**: `npm run typecheck`, `npm run lint`, `npm run build`, lalu smoke test `npx next start -p <port>` + `Invoke-WebRequest http://127.0.0.1:<port>/t/meja-01` (tanpa DB harus tetap HTTP 200 dengan empty state, **bukan** 500). Catat hasilnya.
6. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `3.2 CategoryTabs & Pencarian Instan`), `git commit` (`feat(customer): add table header with order mode switcher and call waiter`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Rate limit call waiter disimpan di database** (bukan memori), agar konsisten multi-instance. Respons 429 menyertakan header `Retry-After` + `details.retryAfterSeconds`.
* **Endpoint publik** (`/api/menu`, session, call-waiter) tidak memerlukan login; sesi meja diikat cookie `fnb_table_session` (httpOnly, 6 jam) yang hash-nya ada di `TableSession.sessionTokenHash`.
* **Rahasia**: `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`, stok bahan — jangan pernah ke klien. Selalu pakai `select` eksplisit.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; validasi berurutan env → slug/query → body → DB.
* **Pricing**: `src/lib/pricing.ts` (`calculateOrderTotals`, `formatRupiah`) — jangan menulis ulang. Urutan: subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (khusus `MANUAL_TRANSFER`).
* **Jam tayang menu**: `isOrderable` dari server; jangan hitung ulang di client kecuali butuh refresh berkala.
* **Teknologi UI**: React 19 + Next 15 App Router; state client memakai Zustand (belum ada store — akan dibuat di 3.5). Framer Motion 12 sudah terpasang dan boleh dipakai untuk bottom sheet/transisi.
* **Jangan menambah dependency baru** (Radix/Vitest/toast library) tanpa persetujuan pengguna. Gunakan `createPortal`, `framer-motion`, `lucide-react`, `cva`, `cn`.
* **Seeder**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`.
* **Migrasi init jangan diedit**; bila DB tersedia: `npx prisma migrate deploy && npm run db:seed`.
* **Sandbox**: `npm install` pakai `--ignore-scripts`; cache npm `./.npm-cache`; `next/font/google` tidak dipakai (font via `<link>`).
* **Tema**: `:root` Customer Warm Light (`#FAF8F5`, primary `#D9381E`), `.dark` POS/KDS Slate Dark; target sentuh pelanggan ≥ 48px (`min-h-12`), POS/KDS 56px (`min-h-touch`); angka wajib `tabular-nums`.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya setiap sesi.

## 5. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0 — Inisialisasi Arsitektur]**: Perencanaan sistem FnB menyeluruh + 3 file memori eksternal. Siap dieksekusi di `1.1`.
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Scaffold Next.js 15.5.28 + TS strict + Tailwind 3.4.19 + token tema ganda + shadcn base. Commit `5011a02`.
* **[Sesi #1 — 2026-11-03 · 1.2 Schema Area/Meja/Sesi]**: `prisma/schema.prisma` + `.env`. Commit `2dcd2b8`.
* **[Sesi #1 — 2026-11-03 · 1.3 Schema Katalog Menu & Resep]**: 3 enum + 6 model katalog. Commit `cb77c24`.
* **[Sesi #1 — 2026-11-03 · 1.4 Schema Order/Payment/Shift/Call Waiter]**: 16 model + migrasi init SQL. Commit `359f265`.
* **[Sesi #1 — 2026-11-03 · 1.5 Seeder]**: `pin.ts`, `seed-data.ts`, `seed.ts` + `db:seed:dry`. Commit `8481e23`.
* **[Sesi #1 — 2026-11-03 · 1.6 Pricing Engine]**: `pricing.ts` + 24 test. Fase 1 tuntas. Commit `6bf645d`.
* **[Sesi #1 — 2026-11-03 · 2.1 Sesi QR Meja]**: `db.ts`, `env.ts`, `security/token.ts`, `api/errors.ts`, route session. Commit `f5ce4e3`.
* **[Sesi #1 — 2026-11-03 · 2.2 Katalog Menu Publik]**: `menu.ts` + 13 test, route `GET /api/menu`. Commit `2c7e45e`.
* **[Sesi #1 — 2026-11-03 · 2.3 Call Waiter]**: `waiter-call.ts` + 9 test, helper `api/request.ts`, `ApiError`/`jsonOk` mendukung header, route `POST /call-waiter` (sesi wajib aktif, rate limit DB, 429 + `Retry-After`). Kontrak HTTP diuji: slug invalid → 400, tipe invalid → 422, field asing → 422, catatan 200 karakter → 422, valid tanpa DB → 500 berformat benar. Fase 2 tuntas. Commit menyusul.
