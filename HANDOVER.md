# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 2 — Modul Keamanan Sesi QR Meja & API Pelanggan` (1/3 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `2.1 Validasi QR Meja & Sesi` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `2.2 API Katalog Menu Publik (GET /api/menu)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (32 test, 10 suite) ✔, `npm run typecheck` ✔, `npm run lint` ✔, `npm run build` ✔ (route `/api/tables/[qrSlug]/session` terdaftar sebagai **ƒ Dynamic**).
* **Database**: belum tersedia (PostgreSQL port 5432 tertutup, Docker tidak ada). Endpoint sudah diuji kontrak HTTP-nya, tetapi **belum diuji end-to-end** dengan data nyata.
* **Progress**: 7 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/db.ts` | **Baru** — Prisma Client singleton (cache `globalThis` saat non-production) |
| `src/lib/env.ts` | **Baru** — validasi env dengan Zod (`DATABASE_URL` PostgreSQL, `SESSION_SECRET` ≥ 32, `NEXT_PUBLIC_APP_URL`), fail-fast + cache, `resetServerEnvCache()` untuk test |
| `src/lib/security/secret.ts` | **Baru** — `getSessionSecret()` terpusat (min 32 karakter) |
| `src/lib/security/pin.ts` | Diperbarui — memakai `getSessionSecret()` bersama (bukan duplikasi logika) |
| `src/lib/security/token.ts` | **Baru** — `generateTableSessionToken()`, `hashSessionToken()` (HMAC-SHA256, domain `table-session:`), `verifySessionToken()` constant-time |
| `src/lib/security/token.test.ts` | **Baru** — 8 test token (format, unik, determinisme, salah token, input invalid, secret hilang/pendek) |
| `src/lib/api/errors.ts` | **Baru** — `ApiError` + peta status HTTP, `jsonOk()`, `handleRouteError()` (menangani `ZodError` → 422) |
| `src/app/api/tables/[qrSlug]/session/route.ts` | **Baru** — GET (validasi scan QR, `isOwner`) & POST (buka/gabung sesi, rotasi token, cookie httpOnly 6 jam, tutup sesi basi dalam transaksi) |
| `TODO.md` | `2.1` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`2.2 API Katalog Menu Publik`**, ubah menjadi `[/]`.
2. **Buat `src/lib/menu.ts`** (pure, mudah diuji tanpa DB):
   * `toMinutes("HH:mm")` → menit sejak tengah malam; `isWithinSchedule(from?, until?, minutes)` mendukung jadwal melewati tengah malam (mis. `22:00`–`02:00` berarti `from > until` → cek `minutes >= from || minutes < until`); bila `from`/`until` null → selalu tampil.
   * `getRestaurantMinutes(now = new Date(), timeZone = "Asia/Jakarta")` memakai `Intl.DateTimeFormat` (`hour: "2-digit", minute: "2-digit", hour12: false`).
   * `isMenuItemOrderable({ isAvailable, availableFrom, availableUntil, now })`.
   * Tulis `src/lib/menu.test.ts` dengan `node:test` (jadwal normal, lintas tengah malam, tanpa jadwal, batas tepat di menit mulai/selesai).
3. **Buat `src/app/api/menu/route.ts`** (`export const dynamic = "force-dynamic"`, `runtime = "nodejs"`):
   * Query Prisma: `category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { menuItems: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { modifierGroups: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { options: { where: { isAvailable: true }, orderBy: { sortOrder: "asc" } } } } }, orderBy … } } })`.
   * **WAJIB pakai `select` eksplisit**: jangan pernah mengirim `costPrice` (HPP) atau field internal ke klien.
   * Respons: `{ data: { timezone, generatedAt, categories: [{ id, name, slug, description, imageUrl, items: [{ id, name, slug, description, imageUrl, basePrice, station, isBestSeller, tags, prepTimeMinutes, isAvailable, isOrderable, availableFrom, availableUntil, modifierGroups: [{ id, name, selectionType, isRequired, minSelect, maxSelect, options: [{ id, name, priceDelta, isDefault }] }] }] }] } }`.
   * `isOrderable = isAvailable && isWithinSchedule(...)`; `isAvailable` tetap dikirim agar UI bisa menampilkan badge "Habis" (grayscale pada `MenuCard` nanti).
   * Gunakan `getServerEnv()` untuk fail-fast dan `handleRouteError()` untuk error; dukung `?category=<slug>` opsional untuk filter (validasi dengan Zod).
4. **Verifikasi tanpa DB**: `npm test` (test `menu.ts`), `npm run typecheck`, `npm run lint`, `npm run build`. Opsional smoke test HTTP seperti pada 2.1 (`npx next start -p <port>` lalu probe) — endpoint akan 500 tanpa DB, yang penting kontrak error 400/422 benar.
5. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `2.3 API Call Waiter`), `git commit` (`feat(api): add public menu catalog endpoint`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Cookie sesi meja**: nama `fnb_table_session`, `httpOnly`, `sameSite=lax`, `secure` di production, `path=/`, umur 6 jam. DB hanya menyimpan `sessionTokenHash` (HMAC-SHA256 + `SESSION_SECRET`, domain `table-session:`).
* **Kepemilikan sesi (`isOwner`)**: browser pertama pemegang token sah; bila ada browser lain POST tanpa token sah, token **dirotasi** (pemilik pindah) — group ordering (3.5) tidak boleh bergantung pada `isOwner` untuk menambah item, cukup pada sesi meja.
* **Anti sesi ganda**: dalam satu `db.$transaction`, sesi `ACTIVE/BILL_REQUESTED` dengan `lastActivityAt` > 6 jam ditutup (`CLOSED`), lalu cek sesi aktif sebelum membuat baru. Selalu set `Table.status = OCCUPIED` saat sesi dibuka/diperbarui.
* **Postur respons API**: sukses `{ data }`; gagal `{ error: { code, message, details? } }` dengan `ApiError` — JANGAN membuat bentuk respons lain.
* **Urutan validasi di route**: parse slug → validasi body (Zod) → query database, supaya request cacat tidak menyentuh DB (ditemukan & diperbaiki saat smoke test 2.1).
* **Jangan bocorkan** `currentPin`, `pinHash`, `sessionTokenHash`, `costPrice` ke klien.
* **Pricing**: gunakan `src/lib/pricing.ts` (`calculateOrderTotals`, `formatRupiah`) — jangan menulis ulang rumus. Urutan: subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (hanya `MANUAL_TRANSFER`).
* **Seeder**: `npm run db:seed` (butuh PostgreSQL) / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`.
* **Migrasi init jangan diedit**; perubahan schema = migrasi baru.
* **Next.js 15**: `params` & `cookies()` async (wajib `await`); route dinamis butuh `export const dynamic = "force-dynamic"`.
* **Sandbox**: `npm install` wajib `--ignore-scripts`; cache npm `./.npm-cache`; `next/font/google` tidak dipakai.
* **Tema**: `:root` Customer Warm Light, `.dark` POS/KDS Slate Dark; `min-h-touch` 56px (POS/KDS), `min-h-12` 48px (pelanggan); angka wajib `tabular-nums`.
* **Belum ada**: `src/components/`, `src/store/`, `src/types/`, halaman modul mana pun. `src/app/page.tsx` masih halaman pemeriksaan token tema.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya setiap sesi.

## 5. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0 — Inisialisasi Arsitektur]**: Perencanaan sistem FnB menyeluruh + 3 file memori eksternal. Siap dieksekusi di `1.1`.
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Scaffold Next.js 15.5.28 + TS strict + Tailwind 3.4.19 + token tema ganda + shadcn base. Commit `5011a02`.
* **[Sesi #1 — 2026-11-03 · 1.2 Schema Area/Meja/Sesi]**: `prisma/schema.prisma` + `.env`; model `Area`/`Table`/`TableSession`. Commit `2dcd2b8`.
* **[Sesi #1 — 2026-11-03 · 1.3 Schema Katalog Menu & Resep]**: 3 enum + 6 model katalog. Commit `cb77c24`.
* **[Sesi #1 — 2026-11-03 · 1.4 Schema Order/Payment/Shift/Call Waiter]**: 16 model total + migrasi init SQL 529 baris. Commit `359f265`.
* **[Sesi #1 — 2026-11-03 · 1.5 Seeder]**: `pin.ts`, `seed-data.ts`, `seed.ts` (idempoten + dry-run). Commit `8481e23`.
* **[Sesi #1 — 2026-11-03 · 1.6 Pricing Engine]**: `pricing.ts` + 24 unit test. Fase 1 tuntas. Commit `6bf645d`.
* **[Sesi #1 — 2026-11-03 · 2.1 Sesi QR Meja]**: `db.ts`, `env.ts`, `security/secret.ts`, `security/token.ts` (+8 test), `api/errors.ts`, dan route `GET/POST /api/tables/[qrSlug]/session` (join/rotate token, tutup sesi basi, cookie httpOnly). Kontrak HTTP diuji: slug invalid → 400, JSON rusak → 400, `guestCount` 99 → 422, field asing → 422, tanpa DB → 500 berformat benar. Commit menyusul.
