# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 7 — Admin / Back-Office & Analitik` (2/4 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `7.2 QR Code Table Studio` ✅
* **Sub-Tugas yang Berikutnya**: `7.3 Manajemen Stok Bahan Baku & Resep (Inventory & HPP)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**385 test**, 127 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `/admin/tables`, `GET /api/admin/tables`, `PATCH /api/admin/tables/[id]` (ƒ).
* **Verifikasi kontrak HTTP**: `/admin/tables` → **200** ("Studio QR Meja", "Cetak Semua", "Semua area", empty state); `GET /api/admin/tables` tanpa DB → 500 rapi; `PATCH` id invalid → 400, body kosong → 422, valid → 500.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 35 dari 37 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/qr-studio.ts` | **Baru** — `buildOrderUrl`, `groupTablesByArea` (urut area & nomor numerik), `chunkTablesForPrint`, `getPrintSheetCount` |
| `src/lib/qr-studio.test.ts` | **Baru** — 14 test |
| `src/lib/services/table-studio.ts` | **Baru** — `getTableStudioData()`: area + meja (kapasitas/status/aktif) + jumlah sesi aktif + statistik |
| `src/app/api/admin/tables/route.ts` | **Baru** — `GET` data studio |
| `src/app/api/admin/tables/[id]/route.ts` | **Baru** — `PATCH { isActive?, capacity? }` (409 bila menonaktifkan meja yang masih bersesi) |
| `src/app/(admin)/layout.tsx` | Diperbarui — menu **Meja & QR** aktif |
| `src/app/(admin)/admin/tables/page.tsx` | **Baru** — server component + fallback kosong |
| `src/components/admin/TableQrStudio.tsx` | **Baru** — kartu QR per meja (layanan gambar interim), salin link, cetak semua (grid 2×2 per A4 lewat `print:break-after-page`), aktif/nonaktifkan meja, filter area |
| `TODO.md` | `7.2` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`7.3 Manajemen Stok Bahan Baku & Resep (Inventory & HPP)`**, ubah menjadi `[/]`.
2. **Skema yang sudah ada** (jangan diubah): `Ingredient { id, name, sku?, unit (IngredientUnit), currentStock Decimal(12,3), minThreshold Decimal(12,3), costPerUnit Int, isActive, lastRestockedAt? }` dan `MenuRecipe { menuItemId, ingredientId, quantity Decimal(12,3), @@unique([menuItemId, ingredientId]) }`. `MenuItem.costPrice Int` = HPP per porsi.
3. **Buat `src/lib/inventory.ts`** (pure + `src/lib/inventory.test.ts`):
   * `computeRecipeCost(lines)` → Σ(`quantity` × `costPerUnit`) dibulatkan (Rupiah bulat).
   * `computeUsage(lines, quantitySold)` → pemakaian per bahan (desimal aman, hasil dibulatkan ke 3 desimal).
   * `applyUsage(currentStock, usage)` → stok baru `max(0, current - usage)`.
   * `getStockStatus(currentStock, minThreshold)` → `"OUT" | "LOW" | "OK"`.
   * `summarizeInventory(ingredients)` → jumlah bahan, rendah, habis.
   * Uji: biaya resep, pemakaian multi-baris, clamp nol, status batas.
4. **Service `src/lib/services/inventory.ts`**:
   * `getInventoryData()` → bahan (stok, min, satuan, biaya) + resep per menu + ringkasan.
   * `deductInventoryForOrder(tx, orderId)` → ambil `OrderItem` non-VOIDED, join `MenuRecipe`, kalikan qty, `decrement` `Ingredient.currentStock` (clamp 0 lewat helper); dipanggil saat order **lunas**.
   * Panggil deduksi dari `POST /api/orders/[orderNumber]/cashier-confirm` (aksi `MARK_PAID`) **dan** webhook `PAID` — cukup sekali; gunakan penanda idempoten (mis. cek `Payment.status` sebelum transisi) agar tidak dobel.
5. **Endpoint** (`TODO(RBAC)`): `GET /api/admin/inventory`, `POST /api/admin/ingredients`, `PATCH /api/admin/ingredients/[id]` (stok masuk/keluar, `minThreshold`, `costPerUnit`), `PUT /api/admin/menu-items/[id]/recipe` (body `{ lines: [{ ingredientId, quantity }] }` → `deleteMany` + `createMany`, hitung ulang `MenuItem.costPrice` dari resep).
6. **UI**: aktifkan menu **Inventori** di layout admin; `/admin/inventory` + `InventoryManager` (tabel bahan dengan status stok berwarna, modal restock/adjust, editor resep per menu yang menampilkan HPP hasil hitung).
7. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`; probe `/admin/inventory` → 200, API id invalid → 400, body invalid → 422, tanpa DB → 500 rapi.
8. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `7.4 Dashboard Analitik & Menu Engineering`), `git commit` (`feat(admin): add inventory management with recipe based stock deduction`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **QR interim**: gambar QR memakai `https://api.qrserver.com` (tanpa dependensi baru). Catat `TODO(7.3)`/`TODO(7.4)` untuk generator lokal; jangan klaim QR offline.
* **Studio QR**: URL memakai `window.location.origin` (baru tersedia setelah mount) — jangan render QR di server.
* **Port bentrok**: cek `Get-NetTCPConnection -LocalPort <port>` sebelum `next start`; bila semua route 404, request mengenai proses lain di IPv4. Pakai port baru (terakhir: 3213).
* **Belum ada sesi staf/RBAC**: endpoint admin masih terbuka (`TODO(RBAC)`).
* **PENTING — jangan menulis file non-ASCII memakai PowerShell `Set-Content`/`Add-Content`** (mojibake & BOM). Gunakan `write`/`edit`.
* **Lint JSX**: apostrof di teks JSX wajib `&apos;`.
* **Soft delete menu**: `DELETE /api/admin/menu-items/[id]` hanya menonaktifkan.
* **Satu jalur order**: `createOrder()` (`src/lib/services/order-creation.ts`).
* **POS/KDS** `.dark`, 56px touch, `tabular-nums`; modul pelanggan/admin bertema terang.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice` (jangan kirim ke endpoint publik), `pinHash`, `currentPin`, `sessionTokenHash`.
* **BUG SSR ZUSTAND**: guard `useCartStore.persist`.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`.
* **Seed**: `npm run db:seed` / `db:seed:dry`; meja `meja-01..03` PIN `1234`; staf `kasir@fnb.local/222222`.
* **Migrasi init jangan diedit**; bila DB tersedia: `npx prisma migrate deploy && npm run db:seed`.
* **Sandbox**: `npm install --ignore-scripts`; cache `./.npm-cache`; tanpa `next/font/google`.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya.

## 5. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0 — Inisialisasi Arsitektur]**: Perencanaan sistem FnB menyeluruh + 3 file memori eksternal.
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Scaffold Next.js 15.5.28 + TS strict + Tailwind 3.4.19 + tema ganda. Commit `5011a02`.
* **[Sesi #1 — 2026-11-03 · 1.2 Schema Area/Meja/Sesi]**: `prisma/schema.prisma` + `.env`. Commit `2dcd2b8`.
* **[Sesi #1 — 2026-11-03 · 1.3 Schema Katalog Menu & Resep]**: 3 enum + 6 model katalog. Commit `cb77c24`.
* **[Sesi #1 — 2026-11-03 · 1.4 Schema Order/Payment/Shift/Call Waiter]**: 16 model + migrasi init SQL. Commit `359f265`.
* **[Sesi #1 — 2026-11-03 · 1.5 Seeder]**: `pin.ts`, `seed-data.ts`, `seed.ts` + `db:seed:dry`. Commit `8481e23`.
* **[Sesi #1 — 2026-11-03 · 1.6 Pricing Engine]**: `pricing.ts` + 24 test. Commit `6bf645d`.
* **[Sesi #1 — 2026-11-03 · 2.1 Sesi QR Meja]**: `db.ts`, `env.ts`, `security/token.ts`, `api/errors.ts`. Commit `f5ce4e3`.
* **[Sesi #1 — 2026-11-03 · 2.2 Katalog Menu Publik]**: `menu.ts` + 13 test, `GET /api/menu`. Commit `2c7e45e`.
* **[Sesi #1 — 2026-11-03 · 2.3 Call Waiter]**: `waiter-call.ts` + 9 test, `api/request.ts`. Commit `f0913e1`.
* **[Sesi #1 — 2026-11-03 · 3.1 Header Meja]**: UI pelanggan + `CallWaiterSheet`. Commit `3e4faee`.
* **[Sesi #1 — 2026-11-03 · 3.2 Kategori & Pencarian]**: `menu-filter.ts` (+13 test), `MenuBrowser`. Commit `91e698f`.
* **[Sesi #1 — 2026-11-03 · 3.3 Kartu Menu]**: `MenuCard`. Commit `d69ee24`.
* **[Sesi #1 — 2026-11-03 · 3.4 Modifier Sheet]**: `modifier-selection.ts` (+21 test). Commit `35ecdb4`.
* **[Sesi #1 — 2026-11-03 · 3.5 Cart Store & Sync]**: `cart.ts` (+13), `useCartStore` (+11), fix SSR `persist`. Commit `6787d5b`.
* **[Sesi #1 — 2026-11-03 · 3.6 Cart Sheet & Upselling]**: `upsell.ts` (+9), `cart-totals.ts` (+6). Commit `6f551dc`.
* **[Sesi #1 — 2026-11-03 · 4.1 API Orders]**: `order-draft.ts` (+18 test). Commit `4a60c78`.
* **[Sesi #1 — 2026-11-03 · 4.2 QRIS]**: `payment/qris.ts` (+16 test), adapter Midtrans. Commit `a213e7e`.
* **[Sesi #1 — 2026-11-03 · 4.3 Transfer Bank]**: `va.ts` (+9), `manual-transfer.ts` (+11). Commit `f1cdf07`.
* **[Sesi #1 — 2026-11-03 · 4.4 Tunai di Kasir]**: `code39.ts` (+12), `pin-attempts.ts` (+7). Commit `a20adae`.
* **[Sesi #1 — 2026-11-03 · 4.5 Webhook]**: `payment/webhook.ts` (+18 test). Commit `b6901ef`.
* **[Sesi #1 — 2026-11-03 · 4.6 Tracker & E-Struk]**: `order-tracking.ts` (+14 test). Commit `02f7877`.
* **[Sesi #1 — 2026-11-03 · 5.1 POS 3-Panel]**: `notification.ts` (+4 test), komponen POS. Commit `165f938`.
* **[Sesi #1 — 2026-11-03 · 5.2 Validasi Bayar]**: `calculateCashChange` (+4 test), API `bill` & `cashier-confirm`. Commit `10b7368`.
* **[Sesi #1 — 2026-11-03 · 5.3 Cash Modal]**: `cash.ts` (+11 test), `CashPaymentModal`. Commit `7dbc98a`.
* **[Sesi #1 — 2026-11-03 · 5.4 Floor Plan]**: `floor-plan.ts` (+7 test), `/cashier/floor`. Commit `2335760`.
* **[Sesi #1 — 2026-11-03 · 5.5 Split/Merge/Move]**: `split-bill.ts` (+13 test), `SplitBillModal`. Commit `e08a6f7`.
* **[Sesi #1 — 2026-11-03 · 5.6 Walk-In]**: `services/order-creation.ts`, `/cashier/walkin`. Commit `60d01ba`.
* **[Sesi #1 — 2026-11-03 · 5.7 Supervisor PIN]**: `authorization-token.ts` (+8 test), `SupervisorPinModal`. Commit `916aad4`.
* **[Sesi #1 — 2026-11-03 · 5.8 Shift & Laci Kas]**: `shift.ts` (+9 test), `ShiftWorkspace`. Commit `f1ba2e7`.
* **[Sesi #1 — 2026-11-03 · 5.9 ESC/POS]**: `printer/escpos.ts` (+19 test). Commit `db96455`.
* **[Sesi #1 — 2026-11-03 · 6.1 KDS board]**: `kds.ts` (+14 test), `/kds/[station]`. Commit `2a4916e`.
* **[Sesi #1 — 2026-11-03 · 6.2 Bump actions]**: `nextItemStatus` dkk (+14 test), 2 endpoint bump. Commit `0070f5e`.
* **[Sesi #1 — 2026-11-03 · 6.3 Runner]**: `runner.ts` (+7 test), `/runner`. Commit `7cee248`.
* **[Sesi #1 — 2026-11-03 · 7.1 Admin Menu]**: `admin-menu.ts` (+14 test), CRUD menu/kategori, toggle 86'd. Commit `d56f2ae`.
* **[Sesi #1 — 2026-11-03 · 7.2 QR Studio]**: `qr-studio.ts` (+14 test), service & API meja, `/admin/tables` + `TableQrStudio` (cetak batch 2×2). 385 test lulus; probe 200/400/422/500. Commit menyusul.
