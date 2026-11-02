# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 1 — Inisialisasi Proyek, Skema Database, & Utilitas Inti`
* **Sub-Tugas Terakhir yang Selesai**: `1.4 Skema Prisma — Order, Payment, Shift Kasir, & Call Waiter` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `1.5 Database Seeder (prisma/seed.ts)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `tsc --noEmit` exit `0`; `prisma validate`/`format`/`generate` ✔ (Client 6.19.3). Schema final Fase 1: **16 model** (`Area, Table, TableSession, Category, MenuItem, ModifierGroup, ModifierOption, Ingredient, MenuRecipe, Staff, Order, OrderItem, Payment, CashierShift, CashDrawerLog, WaiterCall`), 13 enum.
* **Migrasi**: SQL awal sudah di-generate ke `prisma/migrations/20261103000000_init/migration.sql` (529 baris, 17 tabel termasuk join `_MenuItemToModifierGroup`) + `prisma/migrations/migration_lock.toml`. **BELUM di-apply** karena PostgreSQL tidak tersedia di lingkungan ini.
* **Progress**: 4 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `prisma/schema.prisma` | **Diperbarui** (+363 baris) — enum `StaffRole`, `OrderType`, `OrderStatus`, `OrderItemStatus`, `PaymentMethod`, `PaymentStatus`, `WaiterCallType`, `WaiterCallStatus`, `CashierShiftStatus`, `CashDrawerLogType`; model `Staff`, `Order`, `OrderItem`, `Payment`, `CashierShift`, `CashDrawerLog`, `WaiterCall`; relasi balik `Table.waiterCalls`, `TableSession.orders`, `TableSession.waiterCalls`, `MenuItem.orderItems` |
| `prisma/migrations/20261103000000_init/migration.sql` | **Baru** — DDL lengkap 17 tabel (UTF-8 tanpa BOM) |
| `prisma/migrations/migration_lock.toml` | **Baru** — `provider = "postgresql"` |
| `TODO.md` | `1.4` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`1.5 Database Seeder (prisma/seed.ts)`**, ubah menjadi `[/]`. Jangan ubah schema kecuali benar-benar perlu (bila perlu, buat migrasi baru — jangan edit migrasi init).
2. **Buat `src/lib/security/pin.ts`** (dibutuhkan seeder, dipakai ulang di 2.1): `hashPin(pin: string): string` & `verifyPin(pin: string, hash: string): boolean` memakai `node:crypto` HMAC-SHA256 dengan `process.env.SESSION_SECRET` (gagal jelas bila env kosong). Tanpa library baru.
3. **Buat `prisma/seed-data.ts`** — data murni (tanpa koneksi DB) yang di-export sebagai konstanta, agar bisa diaudit tanpa PostgreSQL:
   * **2 Area**: `Indoor` (`slug: "indoor"`, floor 1), `Outdoor` (`slug: "outdoor"`, floor 2).
   * **10 Meja**: `meja-01` … `meja-05` di Indoor, `meja-06` … `meja-10` di Outdoor. `tableNumber` = `"01"`…`"10"`, `capacity` 2–6 bervariasi, `qrSlug` = `"meja-01"` dst, `status: AVAILABLE`, `pinEnabled: true` untuk 3 meja pertama + `currentPin: hashPin("1234")`.
   * **4 Kategori**: `Makanan Utama` (`makanan-utama`), `Camilan` (`camilan`), `Kopi & Teh` (`kopi-teh`), `Minuman Segar` (`minuman-segar`), masing-masing `sortOrder` 0..3.
   * **12 Menu** (harga Rupiah bulat, `costPrice` ≈ 35–40% harga jual, `station` sesuai: makanan/camilan → `KITCHEN`, kopi/minuman → `BAR`): Nasi Goreng Kampung 38000, Mie Ayam Bakso 35000, Ayam Geprek Sambal Ijo 32000, Sate Ayam Madura 45000, Kentang Goreng 22000, Pisang Goreng Keju 25000, Kopi Susu Gula Aren 24000, Americano 20000, Cappuccino 28000, Es Teh Manis 12000, Lemon Tea Segar 18000, Jus Alpukat 26000. Isi `tags` (mis. `["PEDAS"]`, `["BARU"]`, `["BEST_SELLER"]`), `prepTimeMinutes` 5–20, `imageUrl` boleh `null`.
   * **4 Modifier Group** + opsinya:
     - `Level Pedas` (SINGLE, `isRequired: true`, min 1 / max 1) → Tidak Pedas (0), Sedang (0), Pedas (0), Extra Pedas (0) — tempel ke menu makanan pedas (Nasi Goreng, Ayam Geprek, Mie Ayam).
     - `Ukuran` (SINGLE, required, min 1 / max 1) → Reguler (0), Large (+8000) — tempel ke semua minuman & kopi.
     - `Extra Topping` (MULTIPLE, opsional, min 0 / max 3) → Extra Telur (+5000), Keju Mozzarella (+7000), Extra Ayam (+10000) — tempel ke makanan utama & camilan.
     - `Level Gula` (SINGLE, required untuk minuman) → Tanpa Gula (0), Less Sugar (0), Normal (0), Extra Manis (0) — tempel ke kopi/teh & jus.
   * **Staf contoh** (PIN di-hash via `hashPin`, jangan plaintext): `admin@fnb.local` (ADMIN, PIN `111111`), `kasir@fnb.local` (CASHIER, PIN `222222`), `dapur@fnb.local` (KITCHEN, PIN `333333`), opsional `waiter@fnb.local` (WAITER, PIN `444444`).
4. **Buat `prisma/seed.ts`** — idempoten (pakai `upsert` dengan kunci alami: `slug`/`qrSlug`/`email`/`name`), menghapus data lama secara terarah bila perlu, `console.log` ringkasan jumlah data. Tambahkan flag `--dry-run` yang hanya memvalidasi & mencetak jumlah data tanpa konek DB (dipakai untuk verifikasi di lingkungan tanpa PostgreSQL).
5. **Update `package.json`**: ganti script `"db:seed": "tsx prisma/seed.ts"` → `"db:seed": "prisma db seed"` dan tambahkan blok `"prisma": { "seed": "tsx prisma/seed.ts" }`.
6. **Verifikasi** (tanpa DB): `npx tsc --noEmit` (seed & seed-data ikut type-check) dan `npx tsx prisma/seed.ts --dry-run` → harus mencetak 2 area, 10 meja, 4 kategori, 12 menu, 4 modifier group, 4 staf. Bila ada PostgreSQL, jalankan `npx prisma migrate deploy` lalu `npm run db:seed`.
7. Tandai `[x]`, perbarui `HANDOVER.md`, `git commit` (`feat(db): add idempotent database seeder with sample catalog`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Model `Staff` adalah tambahan wajib** (tidak eksplisit di `CONTEXT.md` §4, tetapi diwajibkan oleh sub-tugas 1.5 yang men-*seed* akun Admin/Kasir/Dapur dan oleh relasi kasir pada `Payment`/`CashierShift`). Jangan dihapus.
* **Mata uang = Rupiah bulat (`Int`)**. Stok bahan `Decimal(12,3)`. Semua nominal order (`subtotal`, `discountAmount`, `serviceCharge`, `taxAmount`, `uniqueCode`, `grandTotal`, `amountPaid`, `changeAmount`) `Int`.
* **`orderNumber` unik** berformat `ORD-1024` (tanpa `#` di DB; `#` hanya di UI). Generator nomor urut dibuat di 4.1.
* **Status awal order**: `PENDING_PAYMENT` (QRIS/VA) atau `WAITING_CASHIER_APPROVAL` (bayar di kasir) — lihat `1.4`/`2.1`.
* **Snapshot pada OrderItem**: `menuName`, `station`, `unitPrice`, `modifierTotal`, `modifiers Json` disalin saat pesanan dibuat supaya riwayat tidak berubah saat menu diedit.
* **Relasi**: `Order.tableSessionId` nullable (TAKEAWAY/walk-in). `Payment.gatewayRefId` unik (anti double-webhook). `OrderItem.menuItemId` `SetNull` agar riwayat aman saat menu dihapus.
* **Migrasi belum ter-apply**: PostgreSQL lokal tidak tersedia (port 5432 tertutup). SQL init sudah di-commit; jalankan `npx prisma migrate deploy` saat `DATABASE_URL` siap. **Jangan** mengedit `migration.sql` init — perubahan schema berikutnya membuat migrasi baru.
* **Penamaan DB**: tabel `snake_case` plural (`orders`, `order_items`, `payments`, `cashier_shifts`, `cash_drawer_logs`, `waiter_calls`, `staff`, dst); enum type `snake_case`; kolom camelCase.
* **PIN & token** selalu disimpan sebagai hash HMAC-SHA256 + `SESSION_SECRET` (`Table.currentPin`, `Staff.pinHash`). Belum ada helper terpusat — dibuat di 1.5 (`src/lib/security/pin.ts`).
* **Sandbox**: `npm install` wajib `--ignore-scripts` (spawn ber-pipe EPERM); cache npm `./.npm-cache`. `next/font/google` tidak bisa dipakai (font via `<link>` + fallback `--font-sans`).
* **Tema**: `:root` Customer Warm Light, `.dark` POS/KDS Slate Dark. `min-h-touch` 56px (POS/KDS), `min-h-12` 48px (pelanggan). Angka wajib `tabular-nums`.
* **Belum ada**: `src/lib/db.ts`, `src/lib/pricing.ts` (1.6), `src/components/`, `src/store/`, `src/types/`.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya setiap sesi.

## 5. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0 — Inisialisasi Arsitektur]**: Perencanaan sistem FnB menyeluruh + 3 file memori eksternal. Siap dieksekusi di `1.1`.
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Scaffold Next.js 15.5.28 + TS strict + Tailwind 3.4.19 + token tema ganda + shadcn base. Lint/typecheck/build hijau, smoke test HTTP 200. Commit `5011a02`.
* **[Sesi #1 — 2026-11-03 · 1.2 Schema Area/Meja/Sesi]**: `prisma/schema.prisma` + `.env`; model `Area`/`Table`/`TableSession`, enum status meja & sesi. Commit `2dcd2b8`.
* **[Sesi #1 — 2026-11-03 · 1.3 Schema Katalog Menu & Resep]**: 3 enum + 6 model katalog; m2m implisit modifier, `tags String[]`, jadwal tayang `HH:mm`, resep `Decimal(12,3)`. Commit `cb77c24`.
* **[Sesi #1 — 2026-11-03 · 1.4 Schema Order/Payment/Shift/Call Waiter]**: Menambahkan `Staff` (pendukung seed & relasi kasir), 10 enum operasional, dan 7 model transaksional lengkap dengan relasi balik; menghasilkan migrasi init SQL 529 baris (17 tabel) tanpa apply karena tidak ada PostgreSQL. Commit menyusul.
