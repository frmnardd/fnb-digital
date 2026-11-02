# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 1 — Inisialisasi Proyek, Skema Database, & Utilitas Inti`
* **Sub-Tugas Terakhir yang Selesai**: `1.2 Skema Prisma — Area, Meja, & Sesi Meja` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `1.3 Skema Prisma — Katalog Menu, Modifiers, & Resep`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm run lint`, `npm run typecheck`, `npm run build` exit `0`. `npx prisma validate` ✔, `npx prisma format` ✔, `npx prisma generate` ✔ (Prisma Client 6.19.3).
* **Progress**: 2 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `prisma/schema.prisma` | **Baru** — `generator client` (`prisma-client-js`), `datasource db` (`postgresql`, `url`/`directUrl`), enum `TableStatus` & `TableSessionStatus`, model `Area`, `Table`, `TableSession` |
| `.env` | **Baru (lokal, gitignored)** — `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, kredensial dummy. Prisma CLI otomatis memuat file ini |
| `TODO.md` | `1.2` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil tugas **`1.3 Skema Prisma — Katalog Menu, Modifiers, & Resep`**, ubah menjadi `[/]`.
2. **JANGAN** mengubah/menghapus model `Area`, `Table`, `TableSession` yang sudah ada — cukup tambahkan model baru di bawahnya (schema ditumbuhkan bertahap pada 1.4 juga).
3. Tambahkan enum `StationType { KITCHEN BAR PASTRY }` (`@@map("station_type")`) — dipakai filter tiket KDS.
4. Tambahkan model berikut (semua: `id String @id @default(cuid())`, `createdAt`, `updatedAt`):
   * `Category`: `name`, `slug @unique`, `description?`, `imageUrl?`, `sortOrder Int @default(0)`, `isActive Boolean @default(true)`, relasi `menuItems MenuItem[]`, `@@map("categories")`.
   * `MenuItem`: `categoryId`, `name`, `slug @unique`, `description?`, `imageUrl?`, **`basePrice Int`** & **`costPrice Int @default(0)`** (Rupiah BULAT — lihat catatan §4), `station StationType @default(KITCHEN)`, `isAvailable Boolean @default(true)` (sakelar 86'd), `isBestSeller Boolean @default(false)`, `prepTimeMinutes Int @default(10)`, `availableFrom String? @db.VarChar(5)` & `availableUntil String? @db.VarChar(5)` (format `HH:mm`, jadwal tayang), `sortOrder Int @default(0)`, `isActive Boolean @default(true)`; relasi `category`, `modifierGroups ModifierGroup[]`, `recipeItems MenuRecipe[]`; index `[categoryId, isActive]`, `[station]`, `@@map("menu_items")`.
   * `ModifierGroup`: `name`, `selectionType ModifierSelectionType @default(SINGLE)`, `isRequired Boolean @default(false)`, `minSelect Int @default(0)`, `maxSelect Int @default(1)`, `sortOrder`, `isActive`; relasi implisit many-to-many `menuItems MenuItem[]` + `options ModifierOption[]`; `@@map("modifier_groups")`.
   * `enum ModifierSelectionType { SINGLE MULTIPLE }` (`@@map("modifier_selection_type")`).
   * `ModifierOption`: `groupId`, `name`, `priceDelta Int @default(0)`, `isDefault Boolean @default(false)`, `isAvailable Boolean @default(true)`, `sortOrder`; index `[groupId]`, `@@map("modifier_options")`.
   * `Ingredient`: `name`, `sku String? @unique`, `unit IngredientUnit`, `currentStock Decimal @db.Decimal(12, 3) @default(0)`, `minThreshold Decimal @db.Decimal(12, 3) @default(0)`, `costPerUnit Int @default(0)`, `isActive`; relasi `recipeItems MenuRecipe[]`; `@@map("ingredients")`.
   * `enum IngredientUnit { GRAM ML PIECE PACK SLICE }` (`@@map("ingredient_unit")`).
   * `MenuRecipe` (join resep/BOM): `menuItemId`, `ingredientId`, `quantity Decimal @db.Decimal(12, 3)`; relasi ke `MenuItem` (`onDelete: Cascade`) & `Ingredient` (`onDelete: Restrict`); `@@unique([menuItemId, ingredientId])`, index `[ingredientId]`, `@@map("menu_recipes")`.
5. Verifikasi: `npx prisma validate`, `npx prisma format`, `npx prisma generate` (semua harus exit 0). Cek nama model baru muncul: `node -e "console.log(Object.keys(require('@prisma/client').Prisma.ModelName))"`.
6. Setelah lolos: tandai `[x]` di `TODO.md`, perbarui `HANDOVER.md`, `git commit` (`feat(db): add menu catalog, modifiers, and recipe models`), lalu push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Mata uang = Rupiah bulat (Int, tanpa sen)**. Semua kolom harga (`basePrice`, `costPrice`, `priceDelta`, `costPerUnit`) memakai `Int` agar kalkulasi server bebas galat pembulatan & mudah dijumlahkan. Kolom stok resep memakai `Decimal(12,3)` karena butuh pecahan (gram/ml).
* **Naming DB**: nama tabel di-*map* ke `snake_case` plural (`areas`, `tables`, `table_sessions`); nama kolom tetap camelCase (default Prisma). Enum type di-*map* ke `snake_case` (`table_status`, `table_session_status`). Akses DB hanya via Prisma, bukan raw SQL.
* **PIN meja disimpan sebagai hash** (HMAC-SHA256 + `SESSION_SECRET`) pada `Table.currentPin` — walau nama kolom sesuai CONTEXT, isinya tidak boleh plaintext. Helper hashing akan dibuat di sub-tugas 2.1.
* **`TableSession.sessionTokenHash` unik** — token mentah hanya dipegang cookie httpOnly pelanggan; `TableSession` belum punya relasi `orders`, ditambahkan saat model `Order` dibuat di 1.4.
* **Satu sesi ACTIVE per meja** tidak bisa dijamin murni oleh schema (partial unique index). Wajib dijaga di layer aplikasi pada sub-tugas 2.1 (transaksi: tutup sesi lama → buat sesi baru).
* **Sandbox / instalasi**: `npm install` harus memakai `--ignore-scripts` (spawn ber-pipe diblokir, EPERM). Cache npm di `./.npm-cache` (gitignored). `npx prisma generate` berjalan normal.
* **Font**: `next/font/google` gagal di lingkungan ini; font dimuat via `<link>` + fallback `--font-sans`. Jangan dikembalikan ke `next/font/google` tanpa uji `npm run build`.
* **Tema ganda**: `:root` Customer Warm Light, `.dark` POS/KDS Slate Dark. Token `success`/`warning`/`danger`/`brand`/`pos` tersedia di Tailwind. Touch target: `min-h-touch` (56px) untuk POS/KDS, `min-h-12` (48px) untuk pelanggan. Angka wajib `tabular-nums`.
* **Kalkulasi harga** terpusat di `src/lib/pricing.ts` (dibuat 1.6): subtotal, modifier, PB1 10%, service 5%, kode unik 3 digit.
* **Anti-prank order**: metode **Bayar di Kasir** → status awal `WAITING_CASHIER_APPROVAL` sampai kasir konfirmasi / PIN 4-digit valid.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya setiap sesi.
* **Belum ada**: migrasi database (dijadwalkan 1.4, butuh PostgreSQL aktif; bila tidak ada DB, gunakan `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` untuk menghasilkan SQL tanpa apply), `prisma/seed.ts` (1.5), `src/lib/db.ts`, `src/components/`, `src/store/`, `src/types/`.

## 5. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0 — Inisialisasi Arsitektur]**: Menyelesaikan perencanaan desain sistem FnB menyeluruh dan menyusun 3 file memori eksternal (`CONTEXT.md`, `TODO.md`, `HANDOVER.md`). Siap dieksekusi oleh Coder Agent pada tugas `1.1`.
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Repo `frmnardd/fnb-digital` di-clone (kosong), lalu scaffold Next.js 15.5.28 App Router + TS strict + Tailwind 3.4.19 + token tema ganda + `cn()` + `components.json` shadcn + `.env.example`. Lint/typecheck/build hijau, smoke test HTTP 200. Kendala lingkungan dipecahkan: npm cache ke workspace (`--ignore-scripts`) dan font Google via `<link>`. Commit `5011a02` di-push ke `origin/main`.
* **[Sesi #1 — 2026-11-03 · 1.2 Skema Prisma Area/Meja/Sesi]**: Menambahkan `prisma/schema.prisma` (generator `prisma-client-js`, datasource PostgreSQL, enum `TableStatus`/`TableSessionStatus`, model `Area`/`Table`/`TableSession` dengan `qrSlug` unik, `currentPin` hashed, koordinat denah, index sesi) + `.env` lokal. `prisma validate`/`format`/`generate` hijau (Client 6.19.3); model terverifikasi: `Area, Table, TableSession`. Siap lanjut ke 1.3.
