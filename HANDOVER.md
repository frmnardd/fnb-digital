# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 2 — Modul Keamanan Sesi QR Meja & API Pelanggan` (2/3 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `2.2 API Katalog Menu Publik (GET /api/menu)` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `2.3 API Call Waiter (POST /api/tables/[qrSlug]/call-waiter)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (45 test, 14 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔. Route terdaftar: `/api/menu` (ƒ) & `/api/tables/[qrSlug]/session` (ƒ).
* **Database**: belum tersedia (PostgreSQL 5432 tertutup). Kontrak HTTP diuji manual; **belum ada uji end-to-end** dengan data.
* **Progress**: 8 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/menu.ts` | **Baru** — `getRestaurantTimezone()` (env `RESTAURANT_TIMEZONE`, default `Asia/Jakarta`), `parseTimeToMinutes()`, `getRestaurantMinutes()` (`Intl` h23), `isWithinSchedule()` (jam akhir eksklusif + jadwal lintas tengah malam), `isMenuItemOrderable()` |
| `src/lib/menu.test.ts` | **Baru** — 13 test (parse jam invalid, konversi zona waktu, jadwal normal/lintas malam, batas eksklusif, normalisasi menit, kombinasi `isAvailable`) |
| `src/app/api/menu/route.ts` | **Baru** — `GET /api/menu` dengan `select` eksplisit (tanpa `costPrice`), `?category=` opsional (Zod), `isOrderable` dihitung server, `timezone` & `generatedAt` disertakan |
| `TODO.md` | `2.2` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`2.3 API Call Waiter`**, ubah menjadi `[/]`.
2. **Buat `src/lib/waiter-call.ts`** (pure + teruji), ekspor:
   * `CALL_WAITER_COOLDOWN_MS = 2 * 60 * 1000` (maksimal 1 panggilan / 2 menit / meja).
   * `evaluateCallWaiterLimit(lastCallAt: Date | null, now: Date = new Date(), cooldownMs = CALL_WAITER_COOLDOWN_MS)` → `{ allowed: boolean; retryAfterSeconds: number }` (`retryAfterSeconds` dibulatkan ke atas, minimal 1; `allowed: true` bila `lastCallAt` null atau sudah lewat cooldown).
   * `WAITER_CALL_TYPES` sebagai tuple `["WATER_TISSUE","CLEAN_TABLE","ASK_MENU","REQUEST_BILL"]` untuk dipakai Zod enum.
   * Unit test `src/lib/waiter-call.test.ts`: belum pernah menelepon, tepat di batas cooldown, 1 detik sebelum cooldown, `lastCallAt` di masa depan (clock skew → tolak), dan pembulatan `retryAfterSeconds`.
3. **Buat `src/app/api/tables/[qrSlug]/call-waiter/route.ts`** — `POST` (`force-dynamic`, `runtime = "nodejs"`):
   * Urutan validasi: `getServerEnv()` → parse `qrSlug` (`/^[a-z0-9-]{1,64}$/`) → Zod body `{ type: <enum>, note?: string.max(160) }` (strict) → query DB.
   * Cari `Table` aktif via `qrSlug`; **wajib** ada `TableSession` berstatus `ACTIVE`/`BILL_REQUESTED`. Bila tidak ada → `ApiError("CONFLICT", "Sesi meja belum dibuka...")`.
   * Rate limit berbasis database: `waiterCall.findFirst({ where: { tableId, createdAt: { gte: new Date(now - cooldown) } }, orderBy: { createdAt: "desc" } })`; bila ada → `throw new ApiError("TOO_MANY_REQUESTS", ..., { retryAfterSeconds })` **dan** set header `Retry-After` (tambahkan dukungan `headers` pada `jsonOk`/`ApiError` di `src/lib/api/errors.ts` bila perlu — jaga bentuk `{ error: { code, message, details } }`).
   * Buat `WaiterCall` (`status: PENDING`, `tableId`, `tableSessionId`, `type`, `note`) → respons `201 { data: { id, type, status, createdAt, retryAfterSeconds: CALL_WAITER_COOLDOWN_MS/1000 } }`.
   * Jangan bocorkan data internal; cukup field publik.
4. **Verifikasi tanpa DB**: `npm test` (test baru), `npm run typecheck`, `npm run lint`, `npm run build`. Smoke test HTTP opsional seperti 2.1/2.2 (slug invalid → 400, body invalid → 422, tanpa DB → 500 berformat benar).
5. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke **Fase 3.1: `CustomerHeader` & Quick Action Bar**), `git commit` (`feat(api): add call waiter endpoint with rate limiting`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Katalog menu** mengirim `isAvailable` (stok) **dan** `isOrderable` (stok + jam tayang). UI wajib memakai `isOrderable` untuk mengaktifkan tombol pesan, dan `isAvailable=false` untuk badge "Habis" + grayscale.
* **Rahasia**: `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`, stok bahan — **jangan pernah** masuk respons publik. Selalu pakai `select` eksplisit.
* **Jam tayang**: `availableFrom`/`availableUntil` format `HH:mm`, jam akhir **eksklusif**; jadwal lintas tengah malam didukung (`22:00`–`02:00`). Zona waktu dari `RESTAURANT_TIMEZONE` (default `Asia/Jakarta`).
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; `ApiError` + `handleRouteError` (ZodError → 422). Urutan validasi: env → slug/query → body → DB.
* **Cookie sesi meja**: `fnb_table_session` (httpOnly, lax, 6 jam); DB menyimpan HMAC-SHA256 token. `isOwner` hanya penanda browser pemegang token; group ordering tidak boleh bergantung pada `isOwner`.
* **Pricing**: gunakan `src/lib/pricing.ts`; urutan subtotal → diskon → service 5% → PB1 10% → kode unik (khusus `MANUAL_TRANSFER`).
* **Seeder**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`.
* **Migrasi init jangan diedit**; perubahan schema = migrasi baru. PostgreSQL belum tersedia — bila nanti ada, jalankan `npx prisma migrate deploy && npm run db:seed`.
* **Next.js 15**: `params`/`cookies()` async; route dinamis butuh `export const dynamic = "force-dynamic"`.
* **Sandbox**: `npm install` pakai `--ignore-scripts`; cache npm `./.npm-cache`; `next/font/google` tidak dipakai.
* **Tema**: `:root` Customer Warm Light, `.dark` POS/KDS Slate Dark; `min-h-touch` 56px (POS/KDS), `min-h-12` 48px (pelanggan); angka wajib `tabular-nums`.
* **Belum ada**: `src/components/`, `src/store/`, `src/types/`, halaman modul mana pun (Fase 3). `src/app/page.tsx` masih halaman pemeriksaan token tema.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya setiap sesi.

## 5. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0 — Inisialisasi Arsitektur]**: Perencanaan sistem FnB menyeluruh + 3 file memori eksternal. Siap dieksekusi di `1.1`.
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Scaffold Next.js 15.5.28 + TS strict + Tailwind 3.4.19 + token tema ganda + shadcn base. Commit `5011a02`.
* **[Sesi #1 — 2026-11-03 · 1.2 Schema Area/Meja/Sesi]**: `prisma/schema.prisma` + `.env`; model `Area`/`Table`/`TableSession`. Commit `2dcd2b8`.
* **[Sesi #1 — 2026-11-03 · 1.3 Schema Katalog Menu & Resep]**: 3 enum + 6 model katalog. Commit `cb77c24`.
* **[Sesi #1 — 2026-11-03 · 1.4 Schema Order/Payment/Shift/Call Waiter]**: 16 model total + migrasi init SQL 529 baris. Commit `359f265`.
* **[Sesi #1 — 2026-11-03 · 1.5 Seeder]**: `pin.ts`, `seed-data.ts`, `seed.ts` (idempoten + dry-run). Commit `8481e23`.
* **[Sesi #1 — 2026-11-03 · 1.6 Pricing Engine]**: `pricing.ts` + 24 unit test. Fase 1 tuntas. Commit `6bf645d`.
* **[Sesi #1 — 2026-11-03 · 2.1 Sesi QR Meja]**: `db.ts`, `env.ts`, `security/secret.ts`, `security/token.ts` (+8 test), `api/errors.ts`, route `GET/POST /api/tables/[qrSlug]/session`. Commit `f5ce4e3`.
* **[Sesi #1 — 2026-11-03 · 2.2 Katalog Menu Publik]**: `menu.ts` (jadwal tayang + zona waktu) + 13 test, route `GET /api/menu` dengan `select` eksplisit & filter kategori. Kontrak HTTP diuji: kategori invalid → 422, param asing diabaikan, tanpa DB → 500 berformat benar. Commit menyusul.
