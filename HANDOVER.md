# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 7 — Admin / Back-Office & Analitik` (1/4 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `7.1 CRUD Menu, Kategori, & Quick Toggle 86'd` ✅
* **Sub-Tugas yang Berikutnya**: `7.2 QR Code Table Studio (Generator & Print Batch)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**371 test**, 122 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `/admin/menu`, `GET /api/admin/menu`, `POST /api/admin/categories`, `PATCH/DELETE /api/admin/categories/[id]`, `POST /api/admin/menu-items`, `PATCH/DELETE /api/admin/menu-items/[id]`, `PATCH /api/admin/menu-items/[id]/availability` (ƒ).
* **Verifikasi kontrak HTTP**: `/admin/menu` → **200** ("Manajemen Menu", "Tambah Menu", "Hanya 86'd", "Back-office"); `GET /api/admin/menu` tanpa DB → 500 rapi; availability id invalid → 400, body kosong → 422, valid → 500; create menu harga 0 → 422 ("Harga jual harus bilangan bulat Rupiah lebih dari 0."); create kategori kosong → 422.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 34 dari 37 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/admin-menu.ts` | **Baru** — `slugify`, `buildMenuSlug` (sufiks unik), `validateMenuPricing` (HPP < harga jual), `validateSchedule` (HH:mm berpasangan), `filterAdminMenuItems` |
| `src/lib/admin-menu.test.ts` | **Baru** — 14 test |
| `src/lib/services/admin-menu.ts` | **Baru** — `getAdminMenuData()`: kategori (+jumlah item), menu lengkap dengan `costPrice` & `modifierGroupIds`, grup modifier aktif, statistik |
| `src/app/api/admin/menu/route.ts` | **Baru** — `GET` data back-office |
| `src/app/api/admin/categories/route.ts` | **Baru** — `POST` kategori (+slug unik) |
| `src/app/api/admin/categories/[id]/route.ts` | **Baru** — `PATCH` (nama/urutan/aktif) & `DELETE` (409 bila masih ada menu) |
| `src/app/api/admin/menu-items/route.ts` | **Baru** — `POST` menu; validasi harga & jadwal, slug unik, relasi modifier |
| `src/app/api/admin/menu-items/[id]/route.ts` | **Baru** — `PATCH` parsial (validasi harga dengan nilai lama) & `DELETE` = soft delete (`isActive=false`, `isAvailable=false`) |
| `src/app/api/admin/menu-items/[id]/availability/route.ts` | **Baru** — `PATCH { isAvailable }` sakelar 86'd (409 bila menu nonaktif) |
| `src/app/(admin)/layout.tsx` | **Baru** — sidebar back-office (Menu aktif; Dashboard/Meja/Inventori/Analitik dinonaktifkan), responsif |
| `src/app/(admin)/admin/menu/page.tsx` | **Baru** — server component + fallback kosong |
| `src/components/admin/MenuManager.tsx` | **Baru** — tabel menu (harga/HPP/stasiun), pencarian, filter kategori & "Hanya 86'd", switch ketersediaan optimistic, modal tambah/ubah menu, modal tambah kategori |
| `TODO.md` | `7.1` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`7.2 QR Code Table Studio (Generator & Print Batch)`**, ubah menjadi `[/]`.
2. **Buat `src/lib/qr-studio.ts`** (pure + test):
   * `buildOrderUrl(baseUrl, qrSlug)` → `https://<host>/t/<slug>` (strip trailing slash).
   * `groupTablesByArea(tables)` → `[{ areaId, areaName, tables }]` urut nama area & nomor meja.
   * `chunkTablesForPrint(tables, perPage = 4)` → halaman kartu QR.
   * `getPrintSheetCount(tables, perPage)`.
   * Uji: URL dengan/ tanpa slash, grouping, chunking (kosong, pas, sisa), jumlah halaman.
3. **Buat `src/lib/services/table-studio.ts`**: `getTableStudioData()` → area + meja (`tableNumber`, `qrSlug`, `capacity`, `status`, `isActive`) + jumlah sesi aktif, urut stabil.
4. **Endpoint** (`TODO(RBAC)`): `GET /api/admin/tables` → `{ areas, tables, stats }`; `PATCH /api/admin/tables/[id]` body `{ isActive?, capacity? }` untuk menonaktifkan meja.
5. **UI**: aktifkan menu **Meja & QR** di `src/app/(admin)/layout.tsx`; buat `src/app/(admin)/admin/tables/page.tsx` (server, fallback kosong) + `src/components/admin/TableQrStudio.tsx` (client):
   * Filter area, kartu meja dengan QR (`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=<encoded url>` — **interim, tandai `TODO(7.3)` untuk generator lokal**), tombol **Salin Link** (`navigator.clipboard`), **Cetak** per meja, dan **Cetak Semua** (grid 2×2 per halaman, `window.print()` + CSS `print:` / `.print-hidden`).
   * Tampilkan status meja (AVAILABLE/OCCUPIED/NEEDS_CLEANING/RESERVED) dan tombol nonaktifkan meja (konfirmasi).
6. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`; probe `/admin/tables` → 200, `GET /api/admin/tables` tanpa DB → 500 rapi, `PATCH` id invalid → 400 & body invalid → 422. Gunakan port baru (cek `Get-NetTCPConnection`).
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `7.3 Inventori & Resep (BOM) - Pengurangan Stok Otomatis`), `git commit` (`feat(admin): add qr table studio with batch printing`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Soft delete menu**: `DELETE /api/admin/menu-items/[id]` hanya menonaktifkan (`isActive=false`) agar riwayat pesanan tetap valid.
* **Validasi harga**: HPP harus `<` harga jual, keduanya bilangan bulat Rupiah.
* **Port bentrok**: sebelum `next start`, cek `Get-NetTCPConnection -LocalPort <port>`; bila semua route 404, request mengenai proses lain di IPv4 (Next hanya bind IPv6). Pakai port baru (terakhir: 3212).
* **Belum ada sesi staf/RBAC**: endpoint admin masih terbuka (`TODO(RBAC)`); jangan menulis klaim keamanan.
* **PENTING — jangan menulis file non-ASCII memakai PowerShell `Set-Content`/`Add-Content`** (mojibake & BOM). Gunakan `write`/`edit`.
* **Lint JSX**: apostrof di teks JSX wajib `&apos;` (aturan `react/no-unescaped-entities`).
* **Satu jalur order**: `createOrder()` (`src/lib/services/order-creation.ts`) dipakai `POST /api/orders` & `/api/pos/walk-in`.
* **QR interim**: masih memakai `api.qrserver.com` (tanpa dependensi baru); QR encoder lokal belum ada.
* **POS/KDS** `.dark`, target sentuh 56px, `tabular-nums`; modul pelanggan/admin bertema terang.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice` (jangan kirim ke endpoint publik), `pinHash`, `currentPin`, `sessionTokenHash`.
* **BUG SSR ZUSTAND**: `persist` tidak memasang `store.persist` saat storage tidak tersedia → guard.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; biarkan `ZodError` naik ke `handleRouteError`.
* **Seed**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf `kasir@fnb.local/222222`.
* **Migrasi init jangan diedit**; bila DB tersedia: `npx prisma migrate deploy && npm run db:seed`.
* **Sandbox**: `npm install` pakai `--ignore-scripts`; cache npm `./.npm-cache`; `next/font/google` tidak dipakai.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya setiap sesi.

## 5. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0 — Inisialisasi Arsitektur]**: Perencanaan sistem FnB menyeluruh + 3 file memori eksternal. Siap dieksekusi di `1.1`.
* **[Sesi #1 — 2026-11-03 · 1.1 Setup Next.js]**: Scaffold Next.js 15.5.28 + TS strict + Tailwind 3.4.19 + token tema ganda. Commit `5011a02`.
* **[Sesi #1 — 2026-11-03 · 1.2 Schema Area/Meja/Sesi]**: `prisma/schema.prisma` + `.env`. Commit `2dcd2b8`.
* **[Sesi #1 — 2026-11-03 · 1.3 Schema Katalog Menu & Resep]**: 3 enum + 6 model katalog. Commit `cb77c24`.
* **[Sesi #1 — 2026-11-03 · 1.4 Schema Order/Payment/Shift/Call Waiter]**: 16 model + migrasi init SQL. Commit `359f265`.
* **[Sesi #1 — 2026-11-03 · 1.5 Seeder]**: `pin.ts`, `seed-data.ts`, `seed.ts` + `db:seed:dry`. Commit `8481e23`.
* **[Sesi #1 — 2026-11-03 · 1.6 Pricing Engine]**: `pricing.ts` + 24 test. Fase 1 tuntas. Commit `6bf645d`.
* **[Sesi #1 — 2026-11-03 · 2.1 Sesi QR Meja]**: `db.ts`, `env.ts`, `security/token.ts`, `api/errors.ts`, route session. Commit `f5ce4e3`.
* **[Sesi #1 — 2026-11-03 · 2.2 Katalog Menu Publik]**: `menu.ts` + 13 test, route `GET /api/menu`. Commit `2c7e45e`.
* **[Sesi #1 — 2026-11-03 · 2.3 Call Waiter]**: `waiter-call.ts` + 9 test, `api/request.ts`, route call-waiter. Fase 2 tuntas. Commit `f0913e1`.
* **[Sesi #1 — 2026-11-03 · 3.1 Header Meja]**: Fondasi UI + `CustomerHeader` + `CallWaiterSheet` + page `/t/[tableSlug]`. Commit `3e4faee`.
* **[Sesi #1 — 2026-11-03 · 3.2 Kategori & Pencarian]**: tipe & select menu bersama, `menu-filter.ts` (+13 test), `CategoryTabs`, `MenuBrowser`. Commit `91e698f`.
* **[Sesi #1 — 2026-11-03 · 3.3 Kartu Menu]**: `getOrderabilityLabel/Text`, `MenuCard` final. Commit `d69ee24`.
* **[Sesi #1 — 2026-11-03 · 3.4 Modifier Sheet]**: `modifier-selection.ts` (+21 test), `ModifierSheet`. Commit `35ecdb4`.
* **[Sesi #1 — 2026-11-03 · 3.5 Cart Store & Sync]**: `cart.ts` (+13), `useCartStore` (+11), `cart-sync`, fix bug SSR `persist`. Commit `6787d5b`.
* **[Sesi #1 — 2026-11-03 · 3.6 Cart Sheet & Upselling]**: `upsell.ts` (+9), `cart-totals.ts` (+6), `FloatingCartBar` + `CartSheet`. Fase 3 tuntas. Commit `6f551dc`.
* **[Sesi #1 — 2026-11-03 · 4.1 API Orders]**: `order-draft.ts` (+18 test) + `POST /api/orders`. Commit `4a60c78`.
* **[Sesi #1 — 2026-11-03 · 4.2 QRIS]**: `payment/qris.ts` (+16 test), adapter Midtrans, API qris & status. Commit `a213e7e`.
* **[Sesi #1 — 2026-11-03 · 4.3 Transfer Bank]**: `va.ts` (+9), `manual-transfer.ts` (+11), API VA/manual/proof. Commit `f1cdf07`.
* **[Sesi #1 — 2026-11-03 · 4.4 Tunai di Kasir]**: `code39.ts` (+12), `pin-attempts.ts` (+7), API PIN meja, `CashierPaymentPanel`. Commit `a20adae`.
* **[Sesi #1 — 2026-11-03 · 4.5 Webhook]**: `payment/webhook.ts` (+18 test), route webhook idempoten. Commit `b6901ef`.
* **[Sesi #1 — 2026-11-03 · 4.6 Tracker & E-Struk]**: `order-tracking.ts` (+14 test), API `track`, `OrderTracker`, e-struk 80 mm. Commit `02f7877`.
* **[Sesi #1 — 2026-11-03 · 5.1 POS 3-Panel]**: `notification.ts` (+4 test), komponen POS, layout dark, `/cashier`. Commit `165f938`.
* **[Sesi #1 — 2026-11-03 · 5.2 Validasi Bayar]**: `calculateCashChange` (+4 test), API `bill` & `cashier-confirm`, `PosBillPanel` interaktif. Commit `10b7368`.
* **[Sesi #1 — 2026-11-03 · 5.3 Cash Modal]**: `cash.ts` (+11 test), `ui/modal.tsx`, `CashPaymentModal`. Commit `7dbc98a`.
* **[Sesi #1 — 2026-11-03 · 5.4 Floor Plan]**: `floor-plan.ts` (+7 test), service & API `/api/pos/tables`, `InteractiveFloorPlan`, `/cashier/floor`. Commit `2335760`.
* **[Sesi #1 — 2026-11-03 · 5.5 Split/Merge/Move]**: `order-number.ts`, `split-bill.ts` (+13 test), API split/move/merge, `SplitBillModal`. Commit `e08a6f7`.
* **[Sesi #1 — 2026-11-03 · 5.6 Walk-In]**: `services/order-creation.ts`, API & halaman walk-in, `walkin.ts` (+8 test), `WalkInWorkspace`. Commit `60d01ba`.
* **[Sesi #1 — 2026-11-03 · 5.7 Supervisor PIN]**: `authorization-token.ts` (+8 test), `supervisor-pin.ts` (+4 test), API `supervisor-authorize`, `SupervisorPinModal`. Commit `916aad4`.
* **[Sesi #1 — 2026-11-03 · 5.8 Shift & Laci Kas]**: `shift.ts` (+9 test), 4 endpoint shift, `ShiftWorkspace`, tautan pembayaran tunai ke shift. Commit `f1ba2e7`.
* **[Sesi #1 — 2026-11-03 · 5.9 ESC/POS]**: `printer/escpos.ts` (+19 test), endpoint payload ESC/POS, tombol cetak 58/80 mm. Commit `db96455`.
* **[Sesi #1 — 2026-11-03 · 6.1 KDS board]**: `kds.ts` (+14 test), service & API, `/kds/[station]`, `KdsBoard` + `TicketCard`. Commit `2a4916e`.
* **[Sesi #1 — 2026-11-03 · 6.2 Bump actions]**: `nextItemStatus`/`isTicketReady`/`getTicketAgingLabel` (+14 test), 2 endpoint bump, tombol Mulai/Siap/Revert/Bump. Commit `0070f5e`.
* **[Sesi #1 — 2026-11-03 · 6.3 Runner]**: `runner.ts` (+7 test), service & 4 endpoint runner, `/runner` + `RunnerBoard`. Commit `7cee248`.
* **[Sesi #1 — 2026-11-03 · 7.1 Admin Menu]**: `admin-menu.ts` (+14 test), service + 6 endpoint admin, layout `(admin)`, `/admin/menu` + `MenuManager` (toggle 86'd optimistic, form menu/kategori). 371 test lulus; probe 400/422/500 & halaman 200. Commit menyusul.
