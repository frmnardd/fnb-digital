# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 1 — Inisialisasi Proyek, Skema Database, & Utilitas Inti`
* **Sub-Tugas Terakhir yang Selesai**: `1.5 Database Seeder (prisma/seed.ts)` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `1.6 Modul Kalkulasi Harga (src/lib/pricing.ts)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm run lint` ✔, `npm run build` ✔, `tsc --noEmit` ✔, `npx tsx prisma/seed.ts --dry-run` ✔ (2 area / 10 meja / 4 kategori / 12 menu / 4 grup / 13 opsi / 4 staf, validasi LULUS).
* **Database**: schema 16 model + migrasi init SQL sudah ada, tetapi **belum pernah dijalankan** — tidak ada PostgreSQL di lingkungan ini (port 5432 tertutup, Docker tidak terpasang).
* **Progress**: 5 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/security/pin.ts` | **Baru** — `hashPin()`, `verifyPin()` (HMAC-SHA256 + `timingSafeEqual`), `isValidPinFormat()`; pola 4–8 digit; gagal jelas bila `SESSION_SECRET` < 16 karakter |
| `prisma/seed-data.ts` | **Baru** — data murni: 2 area, 10 meja (3 ber-PIN `1234`), 4 kategori, 12 menu, 4 modifier group (13 opsi), 4 staf + fungsi `validateSeedData()` |
| `prisma/seed.ts` | **Baru** — seeder idempoten (upsert), memuat `.env` via `process.loadEnvFile()`, mendukung `--dry-run`, ringkasan `count()` setelah seeding |
| `package.json` | Diperbarui — `"prisma": { "seed": "tsx prisma/seed.ts" }`, `db:seed` → `prisma db seed`, tambah `db:seed:dry` |
| `TODO.md` | `1.5` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`1.6 Modul Kalkulasi Harga (src/lib/pricing.ts)`**, ubah menjadi `[/]`.
2. **Buat `src/lib/pricing.ts`** — semua *pure function*, tanpa I/O, tanpa `any`:
   * Tipe input: `PricingModifierInput { id, name, priceDelta }`, `PricingItemInput { menuItemId, basePrice, quantity, modifiers, notes? }`, `PricingDiscountInput { type: "PERCENT" | "FIXED"; value: number; maxAmount?: number }`.
   * `calculateLineTotal(item)` → `unitPrice` (basePrice + Σ priceDelta), `lineTotal` (unitPrice × quantity), `modifierTotal`.
   * `calculateSubtotal(items)`, `calculateDiscount(subtotal, discount?)` (PERCENT dibatasi `maxAmount`, FIXED tidak boleh melebihi subtotal, hasil dibulatkan ke Rupiah bulat).
   * `calculateServiceCharge(netSubtotal, ratePercent = 5)`, `calculateTax(netSubtotal + serviceCharge, pb1Percent = 10)` — PB1 mengikuti CONTEXT (10%) dan service (5%), keduanya **dibulatkan `Math.round`**.
   * `generateUniqueCode()` → 3 digit `100–999` (untuk transfer manual; berbasis `crypto.randomInt` agar tidak deterministik).
   * `calculateOrderTotals({ items, discount?, applyUniqueCode?, serviceRate?, taxRate? })` → `{ subtotal, discountAmount, serviceCharge, taxAmount, uniqueCode, grandTotal }` dengan urutan: subtotal → diskon → service (dari subtotal setelah diskon) → PB1 (dari subtotal setelah diskon + service) → kode unik **hanya** bila `applyUniqueCode` (metode transfer manual).
   * Sertakan `PricingError` / hasil validasi untuk input negatif, kuantitas < 1, atau rate di luar 0–100.
3. **Unit test tanpa library baru** (jangan tambah Vitest/Jest): pakai `node:test` + `node:assert/strict` di `src/lib/pricing.test.ts`. Tambahkan script `"test": "node --import tsx --test src/lib/**/*.test.ts"` di `package.json`.
4. **Cakupan test minimal**: (a) subtotal item + modifier, (b) diskon persen dengan `maxAmount`, (c) diskon tetap > subtotal, (d) service 5% & PB1 10% dengan pembulatan, (e) kode unik 3 digit berulang kali selalu 100–999, (f) grand total tanpa kode unik untuk QRIS, (g) input tidak valid melempar error.
5. **Verifikasi**: `npm run test` hijau, `npm run typecheck`, `npm run lint`. (Opsional `npm run build`.)
6. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke **Fase 2.1: `GET/POST /api/tables/[qrSlug]/session`**), `git commit` (`feat(pricing): add server-side order pricing engine with unit tests`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Urutan kalkulasi harga (WAJIB konsisten di seluruh aplikasi)**: `subtotal` → `discountAmount` → `serviceCharge = 5% × (subtotal − diskon)` → `taxAmount = 10% × (subtotal − diskon + service)` → `grandTotal = (subtotal − diskon + service + tax) + uniqueCode`. Semua Rupiah bulat hasil `Math.round`.
* **`uniqueCode` hanya untuk `MANUAL_TRANSFER`** (QRIS/VA/cash tidak memakai kode unik).
* **PIN**: `src/lib/security/pin.ts` sudah tersedia (HMAC-SHA256 + `SESSION_SECRET`). Seed meja `meja-01..03` memakai PIN `1234`; staf: `admin@fnb.local`/`111111`, `kasir@fnb.local`/`222222`, `dapur@fnb.local`/`333333`, `waiter@fnb.local`/`444444`.
* **Seeder idempoten**: upsert berdasarkan `slug`/`qrSlug`/`email`/nama grup. Catatan: `ModifierGroup.name` **belum unik** di schema sehingga seeder memakai `findFirst` lalu `update`; opsi grup **dihapus lalu dibuat ulang** setiap seeding (aman karena `OrderItem.modifiers` hanya snapshot JSON). Bila nanti ingin upsert opsi per baris, tambahkan `@@unique([groupId, name])` + migrasi baru.
* **Meja di-reset ke `AVAILABLE`** setiap seeding — jangan jalankan seeder di database produksi yang sedang beroperasi.
* **Menjalankan seeder butuh PostgreSQL**: `npx prisma migrate deploy` lalu `npm run db:seed`. Tanpa DB, gunakan `npm run db:seed:dry` (validasi + ringkasan tanpa koneksi).
* **`.env` dimuat manual** oleh `prisma/seed.ts` (`process.loadEnvFile`), jadi `npx tsx prisma/seed.ts` tetap bisa membaca `SESSION_SECRET`/`DATABASE_URL`.
* **`prisma db seed` config** memakai kunci `"prisma": { "seed": ... }` di `package.json` (Prisma 6; di Prisma 7 kunci ini berubah — jangan upgrade tanpa migrasi).
* **Migrasi init jangan diedit** (`prisma/migrations/20261103000000_init/migration.sql`); perubahan schema berikutnya wajib membuat migrasi baru.
* **Sandbox**: `npm install` wajib `--ignore-scripts` (spawn ber-pipe EPERM); cache npm `./.npm-cache`. `next/font/google` gagal — font dimuat via `<link>` + fallback `--font-sans`.
* **Tema**: `:root` Customer Warm Light, `.dark` POS/KDS Slate Dark. `min-h-touch` 56px (POS/KDS), `min-h-12` 48px (pelanggan). Angka wajib `tabular-nums`.
* **Belum ada**: `src/lib/db.ts` (Prisma singleton — bisa dibuat saat 2.1), `src/components/`, `src/store/`, `src/types/`.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya setiap sesi.

## 5. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0 — Inisialisasi Arsitektur]**: Perencanaan sistem FnB menyeluruh + 3 file memori eksternal. Siap dieksekusi di `1.1`.
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Scaffold Next.js 15.5.28 + TS strict + Tailwind 3.4.19 + token tema ganda + shadcn base. Commit `5011a02`.
* **[Sesi #1 — 2026-11-03 · 1.2 Schema Area/Meja/Sesi]**: `prisma/schema.prisma` + `.env`; model `Area`/`Table`/`TableSession`. Commit `2dcd2b8`.
* **[Sesi #1 — 2026-11-03 · 1.3 Schema Katalog Menu & Resep]**: 3 enum + 6 model katalog. Commit `cb77c24`.
* **[Sesi #1 — 2026-11-03 · 1.4 Schema Order/Payment/Shift/Call Waiter]**: 16 model total + migrasi init SQL 529 baris. Commit `359f265`.
* **[Sesi #1 — 2026-11-03 · 1.5 Seeder]**: `src/lib/security/pin.ts` (HMAC PIN), `prisma/seed-data.ts` (data murni + validator), `prisma/seed.ts` (idempoten + `--dry-run`), konfigurasi `prisma db seed`. Dry-run LULUS: 2 area/10 meja/4 kategori/12 menu/4 grup/13 opsi/4 staf; PIN hash & verifikasi teruji runtime. Lint/build/typecheck hijau. Commit menyusul.
