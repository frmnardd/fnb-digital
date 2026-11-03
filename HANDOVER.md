# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 7 — Admin / Back-Office & Analitik` — **Fase 6 SELESAI (3/3)**
* **Sub-Tugas Terakhir yang Selesai**: `6.3 Tampilan Mobile Pelayan / Runner` ✅
* **Sub-Tugas yang Berikutnya**: `7.1 CRUD Menu, Kategori, & Quick Toggle Stok 86'd`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**357 test**, 118 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `/runner`, `GET /api/runner`, `POST /api/runner/items/[itemId]/serve`, `POST /api/runner/calls/[callId]/resolve`, `POST /api/runner/tables/[tableId]/clean` (ƒ).
* **Verifikasi kontrak HTTP**: `/runner` → **200**; `/api/runner` tanpa DB → 500 rapi; serve id invalid → 400, valid → 500; resolve `action` invalid → 422, valid → 500; clean id invalid → 400, valid → 500.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 33 dari 37 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/runner.ts` | **Baru** — `WAITER_CALL_LABELS`/`getWaiterCallLabel`, `groupReadyItemsByOrder`, `sortWaiterCalls` (PENDING dulu), `getRunnerSummary` |
| `src/lib/runner.test.ts` | **Baru** — 7 test |
| `src/lib/services/runner.ts` | **Baru** — `getRunnerData()`: item `READY` (order non-CANCELLED/COMPLETED), panggilan `PENDING/ACKNOWLEDGED`, meja `NEEDS_CLEANING` + ringkasan |
| `src/app/api/runner/route.ts` | **Baru** — `GET` data runner |
| `src/app/api/runner/items/[itemId]/serve/route.ts` | **Baru** — item → `SERVED` + `servedAt`; semua item diantar → order `SERVED` |
| `src/app/api/runner/calls/[callId]/resolve/route.ts` | **Baru** — `ACKNOWLEDGE`/`RESOLVE` (409 bila sudah selesai) |
| `src/app/api/runner/tables/[tableId]/clean/route.ts` | **Baru** — meja → `AVAILABLE` (409 bila masih ada sesi aktif) |
| `src/app/(staff)/layout.tsx` | **Baru** — tema terang mobile |
| `src/app/(staff)/runner/page.tsx` | **Baru** — server component + fallback data kosong |
| `src/components/runner/RunnerBoard.tsx` | **Baru** — 3 tab (Siap Antar / Panggilan / Meja Kotor) dengan badge jumlah, polling 5 dtk, tombol aksi 56px, empty state per tab |
| `TODO.md` | `6.3` ditandai `[x]` (Fase 6 selesai) |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`7.1 CRUD Menu, Kategori, & Quick Toggle Stok 86'd`**, ubah menjadi `[/]`.
2. **Buat `src/lib/admin-menu.ts`** (pure + test):
   * `buildMenuSlug(name)` (lowercase, strip diakritik/simbol, dash, maks 60) & `ensureUniqueSlug(base, existing)`.
   * `validateMenuPricing({ basePrice, costPrice })` → error bila `basePrice <= 0`, `costPrice < 0`, `costPrice >= basePrice`.
   * `validateSchedule(from, until)` → format `HH:mm` atau null.
   * `filterAdminMenuItems(items, { search, categoryId, only86 })`.
   * Uji: slug diakritik/spasi, duplikasi slug, validasi harga, jadwal invalid, filter.
3. **Buat endpoint admin** (`TODO(RBAC)` untuk semua):
   * `GET /api/admin/menu` → kategori + item (termasuk `costPrice` karena ini back-office) + jumlah menu 86'd.
   * `POST /api/admin/categories` & `PATCH/DELETE /api/admin/categories/[id]` (Zod strict; tolak hapus kategori yang masih punya item).
   * `POST /api/admin/menu-items` & `PATCH/DELETE /api/admin/menu-items/[id]` (validasi harga memakai helper; `modifierGroupIds` opsional untuk `set` relasi).
   * `PATCH /api/admin/menu-items/[id]/availability` body `{ isAvailable: boolean }` — quick toggle 86'd, respons ringkas.
4. **UI admin**: `src/app/(admin)/layout.tsx` (tema terang, sidebar 220px: Dashboard, Menu, Meja & QR, Inventori, Analitik — item belum ada dinonaktifkan) + `src/app/(admin)/admin/menu/page.tsx` (server: muat data, fallback kosong).
   * `src/components/admin/MenuManager.tsx` (client): tabel menu (nama, kategori, harga, HPP, stasiun, status 86'd), pencarian instan, filter kategori & "hanya 86'd", **switch ketersediaan** (optimistic + revert saat gagal), tombol Tambah/Ubah/Hapus (Modal), form kategori terpisah.
   * Semua nominal `tabular-nums`, tombol ≥ 44px, modal memakai `src/components/ui/modal.tsx`.
5. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`; probe `/admin/menu` → 200, `GET /api/admin/menu` tanpa DB → 500 rapi, `PATCH availability` id invalid → 400 & body invalid → 422.
6. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `7.2 QR Code Table Studio`), `git commit` (`feat(admin): add menu and category management with 86d toggle`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Runner**: item siap = `OrderItem.status = READY`; "Antar" → `SERVED`; panggilan meja `PENDING` ditangani lebih dulu; meja hanya bisa dibersihkan bila tidak ada sesi aktif.
* **Port bentrok**: sebelum `next start`, cek `Get-NetTCPConnection -LocalPort <port>`; bila semua route 404, request kemungkinan mengenai proses lain di IPv4 (Next hanya bind IPv6). Pakai port baru (terakhir: 3211).
* **Belum ada sesi staf/RBAC**: endpoint POS/KDS/Runner/Admin masih terbuka (`TODO(RBAC)`); jangan menulis klaim keamanan.
* **PENTING — jangan menulis file non-ASCII memakai PowerShell `Set-Content`/`Add-Content`** (mojibake & BOM). Gunakan `write`/`edit`.
* **Satu jalur order**: `createOrder()` (`src/lib/services/order-creation.ts`) dipakai `POST /api/orders` & `/api/pos/walk-in`.
* **Harga**: server selalu menghitung ulang (`buildOrderDraft`); urutan subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (khusus `MANUAL_TRANSFER`).
* **POS/KDS** `.dark`, target sentuh 56px, `tabular-nums`, `h-dvh overflow-hidden` per panel; modul pelanggan/admin bertema terang.
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
* **[Sesi #1 — 2026-11-03 · 6.3 Runner]**: `runner.ts` (+7 test), service & 4 endpoint runner, halaman `/runner` + `RunnerBoard` (3 tab, polling). Fase 6 tuntas; 357 test lulus; probe 200/400/422/500 sesuai kontrak. Commit menyusul.
