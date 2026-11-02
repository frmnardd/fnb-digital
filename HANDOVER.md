# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 2 — Modul Keamanan Sesi QR Meja & API Pelanggan` (Fase 1 **SELESAI** 6/6)
* **Sub-Tugas Terakhir yang Selesai**: `1.6 Modul Kalkulasi Harga (src/lib/pricing.ts)` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `2.1 Validasi QR Meja & Sesi (GET/POST /api/tables/[qrSlug]/session)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (24 test, 7 suite) ✔, `npm run typecheck` ✔, `npm run lint` ✔, `npm run build` ✔.
* **Database**: schema + migrasi init SQL + seeder siap, tetapi **belum pernah dijalankan** (tidak ada PostgreSQL; Docker tidak tersedia). Semua verifikasi DB memakai jalur non-koneksi (`db:seed:dry`).
* **Progress**: 6 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/pricing.ts` | **Baru** — mesin harga murni: `calculateLineTotal`, `calculateSubtotal`, `calculateDiscount` (PERCENT/FIXED + `maxAmount`), `calculateServiceCharge` (5%), `calculateTax` (PB1 10%), `generateUniqueCode` (100–999 via Web Crypto), `calculateOrderTotals`, `formatRupiah`, `roundRupiah`, `PricingError` |
| `src/lib/pricing.test.ts` | **Baru** — 24 unit test (`node:test`), 7 suite: baris & modifier, subtotal, diskon, service/PB1 & pembulatan, kode unik, total pesanan, format Rupiah |
| `package.json` | Tambah script `"test": "node --import tsx --test \"src/**/*.test.ts\""` |
| `README.md` | Tambah perintah `npm run test` |
| `TODO.md` | `1.6` ditandai `[x]` (Fase 1 selesai) |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`2.1 Validasi QR Meja & Sesi`**, ubah menjadi `[/]`.
2. **Prasyarat infrastruktur** (buat sebelum route):
   * `src/lib/db.ts` — Prisma Client singleton (cache di `globalThis` saat `NODE_ENV !== "production"`), ekspor `db`.
   * `src/lib/env.ts` — validasi environment dengan **Zod** (`DATABASE_URL` url, `SESSION_SECRET` min 32 karakter, `NEXT_PUBLIC_APP_URL` optional url). Panggil hanya dari modul server.
   * `src/lib/security/token.ts` — `generateTableSessionToken()` (`crypto.randomBytes(32).toString("hex")`) dan `hashSessionToken(token)` (HMAC-SHA256 + `SESSION_SECRET`, beda domain dari `pin.ts`), plus `verifySessionToken(token, hash)` constant-time. Tambahkan unit test kecil di `src/lib/security/token.test.ts`.
   * `src/lib/api/errors.ts` — helper respons konsisten `{ error: { code, message } }` dengan status HTTP (400/401/403/404/409/429/500).
3. **Route `src/app/api/tables/[qrSlug]/session/route.ts`** (Next.js 15 — `params` adalah `Promise`, wajib `const { qrSlug } = await params`; `cookies()` dari `next/headers` juga async):
   * **GET**: cari `Table` via `qrSlug` (`include: { area: true }`), cek `isActive`; ambil `TableSession` berstatus `ACTIVE | BILL_REQUESTED` (terbaru). Bila cookie `fnb_table_session` ada, cocokkan `hashSessionToken(cookie)` dengan `sessionTokenHash` untuk memastikan sesi milik browser ini. Respons: `{ table: { id, tableNumber, qrSlug, area, status, pinEnabled }, session: { id, status, guestCount, openedAt, isOwner } }`.
   * **POST**: body Zod `{ guestCount?: number (1..20), customerName?: string (max 60) }`. Logika dalam **satu `db.$transaction`**: tutup sesi `ACTIVE` yang `lastActivityAt` lebih tua dari 6 jam (`CLOSED`); bila sudah ada sesi aktif → **join** (perbarui `lastActivityAt`, jangan buat sesi baru); bila belum → buat `TableSession` baru (`sessionTokenHash`) + set `Table.status = OCCUPIED`. Terbitkan cookie httpOnly `fnb_table_session` (`sameSite: "lax"`, `secure` di production, `path: "/"`, `maxAge` 6 jam).
   * **Jangan** pernah mengembalikan `sessionTokenHash` atau `currentPin` ke klien. PIN meja hanya divalidasi di endpoint pembayaran tunai (4.4).
4. **Anti sesi ganda**: satu meja hanya boleh punya satu sesi `ACTIVE`. Karena PostgreSQL tidak mendukung partial unique index via Prisma, jaga di transaksi: `updateMany({ where: { tableId, status: { in: ["ACTIVE","BILL_REQUESTED"] } }, data: { status: "CLOSED", closedAt: now } })` hanya untuk sesi kedaluwarsa, lalu `findFirst` sesi aktif sebelum membuat yang baru.
5. **Verifikasi tanpa database**: `npm run typecheck`, `npm run lint`, `npm run build` (route ikut terkompilasi), `npm test` untuk helper token. Bila tidak ada DB, **jangan** mengklaim endpoint sudah diuji end-to-end — catat di HANDOVER bahwa pengujian HTTP butuh PostgreSQL (`npx prisma migrate deploy && npm run db:seed`).
6. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `2.2 API Katalog Menu Publik`), `git commit` (`feat(api): add qr table session validation endpoint`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Urutan kalkulasi harga (WAJIB konsisten)**: `subtotal` → `discountAmount` → `serviceCharge = 5% × (subtotal − diskon)` → `taxAmount = 10% × (subtotal − diskon + service)` → `grandTotal = (subtotal − diskon + service + tax) + uniqueCode`. Semua `Math.round` (Rupiah bulat). Implementasi: `src/lib/pricing.ts` — **selalu pakai modul ini**, jangan menulis ulang rumus di route/komponen.
* **`uniqueCode` hanya untuk `MANUAL_TRANSFER`** (`applyUniqueCode: true`).
* **API harga**: `calculateOrderTotals` menerima `basePrice` & `priceDelta` **dari database**, bukan dari body request klien. Body klien hanya berisi `menuItemId`, kuantitas, id modifier, dan catatan.
* **`formatRupiah()`** tersedia untuk UI (hasil `Rp 38.000`, NBSP sudah dinormalisasi menjadi spasi).
* **PIN**: `src/lib/security/pin.ts` (HMAC-SHA256). Seed: meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`.
* **Seeder**: `npm run db:seed` (butuh PostgreSQL) / `npm run db:seed:dry` (validasi saja). Meja di-reset `AVAILABLE` setiap seeding; opsi modifier dihapus & dibuat ulang.
* **Migrasi init jangan diedit**; perubahan schema berikutnya wajib migrasi baru.
* **Next.js 15 API**: `params` & `cookies()`/`headers()` bersifat async — wajib `await`. Route handler dinamis: `export const dynamic = "force-dynamic"` bila perlu menghindari cache.
* **Zod 3.25**: gunakan `z.object`, `safeParse`, dan pesan error berbahasa Indonesia.
* **Sandbox**: `npm install` wajib `--ignore-scripts`; cache npm `./.npm-cache`; `next/font/google` tidak dipakai (font via `<link>`).
* **Tema**: `:root` Customer Warm Light, `.dark` POS/KDS Slate Dark; `min-h-touch` 56px (POS/KDS), `min-h-12` 48px (pelanggan); angka wajib `tabular-nums`.
* **Belum ada**: `src/components/`, `src/store/`, `src/types/`, `src/lib/db.ts`, `src/lib/env.ts`, halaman modul mana pun.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya setiap sesi.

## 5. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0 — Inisialisasi Arsitektur]**: Perencanaan sistem FnB menyeluruh + 3 file memori eksternal. Siap dieksekusi di `1.1`.
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Scaffold Next.js 15.5.28 + TS strict + Tailwind 3.4.19 + token tema ganda + shadcn base. Commit `5011a02`.
* **[Sesi #1 — 2026-11-03 · 1.2 Schema Area/Meja/Sesi]**: `prisma/schema.prisma` + `.env`; model `Area`/`Table`/`TableSession`. Commit `2dcd2b8`.
* **[Sesi #1 — 2026-11-03 · 1.3 Schema Katalog Menu & Resep]**: 3 enum + 6 model katalog. Commit `cb77c24`.
* **[Sesi #1 — 2026-11-03 · 1.4 Schema Order/Payment/Shift/Call Waiter]**: 16 model total + migrasi init SQL 529 baris. Commit `359f265`.
* **[Sesi #1 — 2026-11-03 · 1.5 Seeder]**: `pin.ts`, `seed-data.ts`, `seed.ts` (idempoten + dry-run), konfigurasi `prisma db seed`. Commit `8481e23`.
* **[Sesi #1 — 2026-11-03 · 1.6 Pricing Engine]**: `src/lib/pricing.ts` (diskon, service 5%, PB1 10%, kode unik 3 digit, format Rupiah, `PricingError`) + 24 unit test `node:test` (semua lulus). Script `npm test` memakai `tsx` tanpa library tambahan. Fase 1 tuntas. Commit menyusul.
