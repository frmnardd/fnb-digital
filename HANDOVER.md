# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 1 — Inisialisasi Proyek, Skema Database, & Utilitas Inti`
* **Sub-Tugas Terakhir yang Selesai**: `1.3 Skema Prisma — Katalog Menu, Modifiers, & Resep` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `1.4 Skema Prisma — Order, Payment, Shift Kasir, & Call Waiter`
* **Kondisi Build / Kompilasi**: **HIJAU** — `tsc --noEmit` exit `0`; `npx prisma validate` ✔, `format` ✔, `generate` ✔ (Client 6.19.3). 9 model terdaftar: `Area, Table, TableSession, Category, MenuItem, ModifierGroup, ModifierOption, Ingredient, MenuRecipe`.
* **Progress**: 3 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `prisma/schema.prisma` | **Diperbarui** (+209 baris) — enum `StationType` (`KITCHEN/BAR/PASTRY`), `ModifierSelectionType` (`SINGLE/MULTIPLE`), `IngredientUnit` (`GRAM/ML/PIECE/PACK/SLICE`); model `Category`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `Ingredient`, `MenuRecipe` |
| `TODO.md` | `1.3` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`1.4 Skema Prisma — Order, Payment, Shift Kasir, & Call Waiter`**, ubah menjadi `[/]`. Jangan hapus/ubah model yang sudah ada — hanya menambah.
2. **Tambahkan model pendukung `Staff`** (wajib, karena sub-tugas 1.5 harus men-*seed* akun Admin/Kasir/Dapur dan 1.4 butuh referensi kasir pada shift & payment):
   * `enum StaffRole { ADMIN CASHIER KITCHEN WAITER }` → `@@map("staff_role")`.
   * `Staff`: `name`, `email String @unique`, `pinHash String` (PIN supervisor 6-digit, HMAC-SHA256), `role StaffRole`, `isActive Boolean @default(true)`, relasi `shifts CashierShift[]`, `payments Payment[]`, `resolvedCalls WaiterCall[]`, `@@map("staff")`.
3. **Enum wajib** (semua dengan `@@map("...")` snake_case):
   * `OrderType { DINE_IN TAKEAWAY }`, `OrderStatus { PENDING_PAYMENT WAITING_CASHIER_APPROVAL CONFIRMED PREPARING READY SERVED COMPLETED CANCELLED }`, `OrderItemStatus { QUEUED COOKING READY SERVED VOIDED }`.
   * `PaymentMethod { QRIS_DYNAMIC VIRTUAL_ACCOUNT MANUAL_TRANSFER CASH EDC_CARD }`, `PaymentStatus { PENDING PAID FAILED REFUNDED EXPIRED }`.
   * `WaiterCallType { WATER_TISSUE CLEAN_TABLE ASK_MENU REQUEST_BILL }`, `WaiterCallStatus { PENDING ACKNOWLEDGED RESOLVED }`.
   * `CashierShiftStatus { OPEN CLOSED }`, `CashDrawerLogType { OPENING_FLOAT CASH_IN CASH_OUT SALE REFUND CLOSING_COUNT ADJUSTMENT }`.
4. **Model** (semua `id @default(cuid())` + `createdAt`/`updatedAt`, nominal `Int` Rupiah bulat):
   * `Order`: `orderNumber String @unique` (format `ORD-1024`, tanda `#` hanya di UI), `orderType`, `status @default(PENDING_PAYMENT)`, `tableSessionId String?` + relasi `tableSession TableSession?` (`onDelete: Restrict`) — **null** untuk walk-in/takeaway, `customerName?`, `customerPhone?`, `subtotal Int`, `discountAmount Int @default(0)`, `serviceCharge Int @default(0)`, `taxAmount Int @default(0)`, `uniqueCode Int @default(0)`, `grandTotal Int`, `notes?`, `confirmedAt?`, `completedAt?`, `cancelledAt?`, `@@index([status, createdAt])`, `@@index([tableSessionId])`, `@@map("orders")`.
   * `OrderItem`: `orderId`, `menuItemId String?` (`onDelete: SetNull`, snapshot tetap aman), `menuName String` & `station StationType` (snapshot), `quantity Int`, `unitPrice Int` (harga dasar setelah modifier per unit), `modifierTotal Int @default(0)`, `modifiers Json?` (snapshot `[{groupId,name,optionId,name,priceDelta}]`), `notes String?`, `status OrderItemStatus @default(QUEUED)`, `voidReason String?`, `queuedAt DateTime @default(now())`, `cookingAt?`, `readyAt?`, `servedAt?`, `@@index([orderId])`, `@@index([status, station])`, `@@map("order_items")`.
   * `Payment`: `orderId`, `method PaymentMethod`, `status PaymentStatus @default(PENDING)`, `amountPaid Int`, `changeAmount Int @default(0)`, `provider String?`, `gatewayRefId String? @unique`, `gatewayPayload Json?`, `proofImageUrl String?`, `paidAt?`, `expiresAt?`, `cashierId String?` + relasi `cashier Staff?`, `shiftId String?`, `@@index([orderId])`, `@@index([status, method])`, `@@map("payments")`.
   * `CashierShift`: `staffId`, `status CashierShiftStatus @default(OPEN)`, `startingCash Int`, `expectedCash Int @default(0)`, `actualEndingCash Int?`, `variance Int?`, `openedAt @default(now())`, `closedAt?`, `notes?`; relasi `staff`, `drawerLogs CashDrawerLog[]`, `payments Payment[]`; `@@index([staffId, status])`, `@@map("cashier_shifts")`.
   * `CashDrawerLog`: `shiftId`, `type CashDrawerLogType`, `amount Int`, `reason?`, `orderId String?`, `staffId String?`, relasi `shift CashierShift` (`onDelete: Cascade`); `@@index([shiftId, createdAt])`, `@@map("cash_drawer_logs")`.
   * `WaiterCall`: `tableId`, `tableSessionId String?`, `type WaiterCallType`, `status WaiterCallStatus @default(PENDING)`, `note?`, `acknowledgedAt?`, `resolvedAt?`, `resolvedByStaffId String?` + relasi `resolvedBy Staff?`; `@@index([status, createdAt])`, `@@index([tableId, createdAt])`, `@@map("waiter_calls")`.
5. **Update relasi balik pada model lama** (jangan bikin duplikat): `TableSession.orders Order[]`, `Table.waiterCalls WaiterCall[]`, `MenuItem.orderItems OrderItem[]`.
6. Verifikasi: `npx prisma validate` → `format` → `generate` (exit 0). Cek model: `node -e "console.log(Object.keys(require('@prisma/client').Prisma.ModelName))"`.
7. **Migrasi awal**: PostgreSQL lokal **TIDAK tersedia** (port 5432 tertutup, sudah diprobe). Jangan menghabiskan waktu menunggu `migrate dev`. Jalankan generator SQL saja:
   `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` → simpan ke `prisma/migrations/20261103000000_init/migration.sql` (+ `migration_lock.toml` berisi `provider = "postgresql"`), lalu commit. Catat di HANDOVER bahwa `npx prisma migrate deploy` harus dijalankan saat DATABASE_URL tersedia.
8. Tandai `[x]`, perbarui `HANDOVER.md`, `git commit` (`feat(db): add order, payment, shift, and waiter call models`), lalu push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Mata uang = Rupiah bulat (`Int`, tanpa sen)** untuk semua nominal (`basePrice`, `costPrice`, `priceDelta`, `costPerUnit`, dan nanti `subtotal`/`grandTotal`/`amountPaid`). Stok bahan memakai `Decimal(12,3)`.
* **Harga server-side**: semua nominal order dihitung ulang di `src/lib/pricing.ts` (dibuat 1.6) dari `basePrice` + `priceDelta` di database; jangan percaya harga dari browser.
* **Naming DB**: tabel `@@map` ke `snake_case` plural; enum type `@@map` ke snake_case; kolom tetap camelCase. Akses hanya via Prisma.
* **MenuItem.modifierGroups ↔ ModifierGroup.menuItems** memakai **implicit many-to-many** (tabel join otomatis `_MenuItemToModifierGroup`) — jangan membuat model join manual.
* **`tags String[]`** (Postgres array) untuk filter dietary pelanggan (`PEDAS`, `BARU`, `VEGAN`, dst). `isBestSeller` tetap kolom terpisah.
* **Jadwal tayang** disimpan sebagai string `"HH:mm"` di `availableFrom`/`availableUntil` (`VarChar(5)`); validasi format & konversi ke menit dilakukan di API katalog (2.2), bukan di DB.
* **PIN meja** (`Table.currentPin`) & **PIN staf** (`Staff.pinHash`, nanti) disimpan sebagai hash HMAC-SHA256 + `SESSION_SECRET` — tidak pernah plaintext.
* **`TableSession.sessionTokenHash`** unik; token mentah hanya di cookie httpOnly. Satu sesi `ACTIVE` per meja dijaga di layer aplikasi (2.1).
* **Sandbox**: `npm install` wajib `--ignore-scripts` (spawn ber-pipe EPERM); cache npm di `./.npm-cache`. `next/font/google` tidak bisa dipakai (font via `<link>` + fallback `--font-sans`).
* **Tema**: `:root` Customer Warm Light, `.dark` POS/KDS Slate Dark. `min-h-touch` = 56px (POS/KDS), `min-h-12` = 48px (pelanggan). Angka wajib `tabular-nums`.
* **Belum ada**: `src/lib/db.ts`, `src/lib/pricing.ts` (1.6), `prisma/seed.ts` (1.5), migrasi ter-apply (lihat §3.7), `src/components/`, `src/store/`, `src/types/`.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya setiap sesi.

## 5. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0 — Inisialisasi Arsitektur]**: Perencanaan sistem FnB menyeluruh + 3 file memori eksternal. Siap dieksekusi di `1.1`.
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Scaffold Next.js 15.5.28 + TS strict + Tailwind 3.4.19 + token tema ganda + shadcn base. Lint/typecheck/build hijau, smoke test HTTP 200. Commit `5011a02`.
* **[Sesi #1 — 2026-11-03 · 1.2 Schema Area/Meja/Sesi]**: `prisma/schema.prisma` + `.env`; model `Area`/`Table`/`TableSession`, enum status meja & sesi. `validate`/`format`/`generate` hijau. Commit `2dcd2b8`.
* **[Sesi #1 — 2026-11-03 · 1.3 Schema Katalog Menu & Resep]**: Menambahkan 3 enum + 6 model (`Category`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `Ingredient`, `MenuRecipe`) dengan m2m implisit modifier, `tags String[]`, jadwal tayang `HH:mm`, dan resep `Decimal(12,3)`. `validate`/`format`/`generate` hijau; diff SQL dari empty schema berhasil digenerate (275 baris) sebagai bukti schema dapat dimigrasikan.
