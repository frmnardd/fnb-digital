# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 7 — Admin / Back-Office & Analitik` (3/4 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `7.3 Manajemen Stok Bahan Baku & Resep (Inventory & HPP)` ✅
* **Sub-Tugas yang Berikutnya**: `7.4 Dashboard Analitik Penjualan & Menu Engineering` (sub-tugas TERAKHIR)
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**400 test**, 132 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `/admin/inventory`, `GET /api/admin/inventory`, `POST /api/admin/ingredients`, `PATCH /api/admin/ingredients/[id]`, `PUT /api/admin/menu-items/[id]/recipe` (ƒ).
* **Verifikasi kontrak HTTP**: `/admin/inventory` → **200** ("Inventori & Resep", tab "Stok Bahan"/"Resep & HPP", "Tambah Bahan"); `GET /api/admin/inventory` tanpa DB → 500 rapi; ingredient id invalid → 400, body kosong → 422, `unit: KG` → 422 (enum disebut), recipe `quantity` negatif → 422, valid → 500.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 36 dari 37 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/inventory.ts` | **Baru** — `computeRecipeCost`, `computeUsage` (3 desimal, gabung per bahan), `applyUsage` (clamp 0), `getStockStatus` (OUT/LOW/OK), `summarizeInventory` |
| `src/lib/inventory.test.ts` | **Baru** — 15 test |
| `src/lib/services/inventory.ts` | **Baru** — `getInventoryData()` (bahan + resep per menu + HPP hitung + statistik), `deductInventoryForOrder(tx, orderId)` (agregasi qty × resep → set stok baru, lewati `menuItemId` null) |
| `src/app/api/admin/inventory/route.ts` | **Baru** — `GET` data inventori |
| `src/app/api/admin/ingredients/route.ts` | **Baru** — `POST` bahan (unit enum, stok desimal) |
| `src/app/api/admin/ingredients/[id]/route.ts` | **Baru** — `PATCH` stok/minimum/biaya satuan/aktif |
| `src/app/api/admin/menu-items/[id]/recipe/route.ts` | **Baru** — `PUT` resep (ganti semua baris, hitung ulang `MenuItem.costPrice`) |
| `src/app/api/orders/[orderNumber]/cashier-confirm/route.ts` | Diperbarui — memanggil `deductInventoryForOrder` saat transisi ke PAID |
| `src/app/api/webhooks/payment/route.ts` | Diperbarui — memanggil `deductInventoryForOrder` saat notifikasi PAID |
| `src/app/(admin)/layout.tsx` | Diperbarui — menu **Inventori** aktif |
| `src/app/(admin)/admin/inventory/page.tsx` | **Baru** — server component + fallback kosong |
| `src/components/admin/InventoryManager.tsx` | **Baru** — tab Stok (tabel bahan, status berwarna, modal tambah/sesuaikan) & tab Resep/HPP (pilih menu, baris bahan + takaran, HPP hitung vs tersimpan, simpan) |
| `TODO.md` | `7.3` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`7.4 Dashboard Analitik Penjualan & Menu Engineering`**, ubah menjadi `[/]` — ini sub-tugas **terakhir**.
2. **Buat `src/lib/analytics.ts`** (pure + `src/lib/analytics.test.ts`):
   * `summarizeSales(orders)` → `{ revenue, orderCount, averageTicket, itemsSold }` (hanya order berstatus `PAID`-setara; pakai `grandTotal`).
   * `groupRevenueByDay(orders, days, now)` → seri harian `[{ date: "YYYY-MM-DD", revenue, orders }]` (zona `Asia/Jakarta`, isi nol untuk hari tanpa transaksi).
   * `groupPaymentMethods(payments)` → `[{ method, amount, count }]` urut nominal menurun.
   * `getPeakHours(orders)` → 24 bucket `{ hour, orders }`.
   * `classifyMenuEngineering({ quantitySold }, { marginPerUnit, ... }, medians)` → `"STAR" | "PLOWHORSE" | "PUZZLE" | "DOG"` (kuadran popularitas × margin; sediakan `computeMedians(rows)`).
   * Uji: ringkasan kosong, seri harian (termasuk hari nol), mix pembayaran, peak hours, keempat kuadran & batas median.
3. **Service `src/lib/services/analytics.ts`**: `getDashboardData({ days = 7 })` → order non-CANCELLED dalam rentang (`createdAt`/`confirmedAt`), `payments` PAID, `orderItems` + `menuItem.costPrice`; hitung KPI, seri harian, mix metode, peak hours, dan tabel menu engineering (nama, qty, omzet, margin/unit, kuadran).
4. **Endpoint** (`TODO(RBAC)`): `GET /api/admin/analytics?days=7` (Zod `coerce.number().int().min(1).max(90)`).
5. **UI**: aktifkan menu **Dashboard** di `src/app/(admin)/layout.tsx`; buat `src/app/(admin)/admin/dashboard/page.tsx` (server, fallback kosong) + `src/components/admin/DashboardView.tsx`:
   * KPI cards: omzet, jumlah pesanan, rata-rata/transaksi, item terjual.
   * Grafik batang harian & peak hours memakai `div` ber-`height` (tanpa library chart), label `tabular-nums`, tooltip via `title`.
   * Mix metode pembayaran (bar horizontal + persentase).
   * Tabel/kuadran Menu Engineering (Star/Plowhorse/Puzzle/Dog) dengan warna berbeda dan penjelasan singkat.
   * Pemilih rentang 7/30/90 hari yang memicu `fetch` ulang.
6. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`; probe `/admin/dashboard` → 200, `GET /api/admin/analytics?days=0` → 422, `days=7` tanpa DB → 500 rapi. Gunakan port baru (cek `Get-NetTCPConnection`).
7. Tandai `[x]`, perbarui `HANDOVER.md` (semua sub-tugas selesai — tulis ringkasan akhir, sisa risiko, dan langkah produksi: `prisma migrate deploy`, seed, env Midtrans, RBAC staf), `git commit` (`feat(admin): add sales analytics dashboard with menu engineering`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Deduksi stok** terjadi sekali saat transisi ke PAID (cashier-confirm & webhook). Jangan panggil lagi di tempat lain agar stok tidak dobel.
* **Resep**: `PUT` mengganti seluruh baris (delete + createMany) lalu `MenuItem.costPrice` dihitung dari `quantity × costPerUnit`.
* **QR interim**: memakai `api.qrserver.com`; generator lokal belum ada (catat TODO).
* **Port bentrok**: cek `Get-NetTCPConnection -LocalPort <port>` sebelum `next start`; bila semua route 404, request mengenai proses lain di IPv4. Pakai port baru (terakhir: 3214).
* **Belum ada sesi staf/RBAC**: semua endpoint admin/POS/KDS/Runner masih terbuka (`TODO(RBAC)`).
* **PENTING — jangan menulis file non-ASCII memakai PowerShell `Set-Content`/`Add-Content`** (mojibake & BOM). Gunakan `write`/`edit`.
* **Lint JSX**: apostrof di teks JSX wajib `&apos;`.
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
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Next.js 15.5.28 + TS strict + Tailwind 3.4.19 + tema ganda. Commit `5011a02`.
* **[Sesi #1 — 2026-11-03 · 1.2 Schema Area/Meja/Sesi]**: `prisma/schema.prisma` + `.env`. Commit `2dcd2b8`.
* **[Sesi #1 — 2026-11-03 · 1.3 Schema Katalog Menu & Resep]**: 3 enum + 6 model katalog. Commit `cb77c24`.
* **[Sesi #1 — 2026-11-03 · 1.4 Schema Order/Payment/Shift/Call Waiter]**: 16 model + migrasi init. Commit `359f265`.
* **[Sesi #1 — 2026-11-03 · 1.5 Seeder]**: `pin.ts`, `seed-data.ts`, `seed.ts`. Commit `8481e23`.
* **[Sesi #1 — 2026-11-03 · 1.6 Pricing Engine]**: `pricing.ts` + 24 test. Commit `6bf645d`.
* **[Sesi #1 — 2026-11-03 · 2.1 Sesi QR Meja]**: `db.ts`, `env.ts`, `security/token.ts`, `api/errors.ts`. Commit `f5ce4e3`.
* **[Sesi #1 — 2026-11-03 · 2.2 Katalog Menu Publik]**: `menu.ts` + 13 test. Commit `2c7e45e`.
* **[Sesi #1 — 2026-11-03 · 2.3 Call Waiter]**: `waiter-call.ts` + 9 test. Commit `f0913e1`.
* **[Sesi #1 — 2026-11-03 · 3.1 Header Meja]**: UI pelanggan + `CallWaiterSheet`. Commit `3e4faee`.
* **[Sesi #1 — 2026-11-03 · 3.2 Kategori & Pencarian]**: `menu-filter.ts` (+13 test). Commit `91e698f`.
* **[Sesi #1 — 2026-11-03 · 3.3 Kartu Menu]**: `MenuCard`. Commit `d69ee24`.
* **[Sesi #1 — 2026-11-03 · 3.4 Modifier Sheet]**: `modifier-selection.ts` (+21 test). Commit `35ecdb4`.
* **[Sesi #1 — 2026-11-03 · 3.5 Cart Store & Sync]**: `cart.ts` (+13), `useCartStore` (+11), fix SSR `persist`. Commit `6787d5b`.
* **[Sesi #1 — 2026-11-03 · 3.6 Cart Sheet & Upselling]**: `upsell.ts` (+9), `cart-totals.ts` (+6). Commit `6f551dc`.
* **[Sesi #1 — 2026-11-03 · 4.1 API Orders]**: `order-draft.ts` (+18 test). Commit `4a60c78`.
* **[Sesi #1 — 2026-11-03 · 4.2 QRIS]**: `payment/qris.ts` (+16 test). Commit `a213e7e`.
* **[Sesi #1 — 2026-11-03 · 4.3 Transfer Bank]**: `va.ts` (+9), `manual-transfer.ts` (+11). Commit `f1cdf07`.
* **[Sesi #1 — 2026-11-03 · 4.4 Tunai di Kasir]**: `code39.ts` (+12), `pin-attempts.ts` (+7). Commit `a20adae`.
* **[Sesi #1 — 2026-11-03 · 4.5 Webhook]**: `payment/webhook.ts` (+18 test). Commit `b6901ef`.
* **[Sesi #1 — 2026-11-03 · 4.6 Tracker & E-Struk]**: `order-tracking.ts` (+14 test). Commit `02f7877`.
* **[Sesi #1 — 2026-11-03 · 5.1 POS 3-Panel]**: `notification.ts` (+4 test). Commit `165f938`.
* **[Sesi #1 — 2026-11-03 · 5.2 Validasi Bayar]**: `calculateCashChange` (+4 test), API `bill` & `cashier-confirm`. Commit `10b7368`.
* **[Sesi #1 — 2026-11-03 · 5.3 Cash Modal]**: `cash.ts` (+11 test). Commit `7dbc98a`.
* **[Sesi #1 — 2026-11-03 · 5.4 Floor Plan]**: `floor-plan.ts` (+7 test). Commit `2335760`.
* **[Sesi #1 — 2026-11-03 · 5.5 Split/Merge/Move]**: `split-bill.ts` (+13 test). Commit `e08a6f7`.
* **[Sesi #1 — 2026-11-03 · 5.6 Walk-In]**: `services/order-creation.ts`, `/cashier/walkin`. Commit `60d01ba`.
* **[Sesi #1 — 2026-11-03 · 5.7 Supervisor PIN]**: `authorization-token.ts` (+8 test), `SupervisorPinModal`. Commit `916aad4`.
* **[Sesi #1 — 2026-11-03 · 5.8 Shift & Laci Kas]**: `shift.ts` (+9 test), `ShiftWorkspace`. Commit `f1ba2e7`.
* **[Sesi #1 — 2026-11-03 · 5.9 ESC/POS]**: `printer/escpos.ts` (+19 test). Commit `db96455`.
* **[Sesi #1 — 2026-11-03 · 6.1 KDS board]**: `kds.ts` (+14 test). Commit `2a4916e`.
* **[Sesi #1 — 2026-11-03 · 6.2 Bump actions]**: `nextItemStatus` dkk (+14 test). Commit `0070f5e`.
* **[Sesi #1 — 2026-11-03 · 6.3 Runner]**: `runner.ts` (+7 test), `/runner`. Commit `7cee248`.
* **[Sesi #1 — 2026-11-03 · 7.1 Admin Menu]**: `admin-menu.ts` (+14 test), CRUD menu/kategori. Commit `d56f2ae`.
* **[Sesi #1 — 2026-11-03 · 7.2 QR Studio]**: `qr-studio.ts` (+14 test), `/admin/tables`. Commit `ee0091e`.
* **[Sesi #1 — 2026-11-03 · 7.3 Inventori & Resep]**: `inventory.ts` (+15 test), service + 4 endpoint, deduksi stok otomatis saat PAID, `/admin/inventory` + `InventoryManager`. 400 test lulus; probe 200/400/422/500 sesuai kontrak. Commit menyusul.
