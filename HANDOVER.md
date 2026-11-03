# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 6 — KDS & Runner` (2/3 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `6.2 SLA Aging Timer & Bump Action` ✅
* **Sub-Tugas yang Berikutnya**: `6.3 Tampilan Mobile Pelayan / Runner (/(staff)/runner)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**350 test**, 112 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `POST /api/kds/items/[itemId]/bump`, `POST /api/kds/orders/[orderId]/bump` (ƒ).
* **Verifikasi kontrak HTTP**: item id invalid → 400, action invalid → 422, valid tanpa DB → 500 rapi; order id invalid → 400, valid → 500; `/kds/kitchen` → **200**.
* **Catatan lingkungan**: port `3126` ternyata ditempati proses lain di IPv4 (server Next hanya bind IPv6) sehingga semua request 404. **Selalu cek `Get-NetTCPConnection -LocalPort <port>` atau pakai port baru** (pengujian ulang sukses di `3210`).
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 32 dari 37 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/kds.ts` | Ditambah `KDS_ITEM_ACTIONS`, `nextItemStatus` (QUEUED↔COOKING→READY, REVERT), `isTicketReady` (abaikan VOIDED), `getTicketAgingLabel` |
| `src/lib/kds-bump.test.ts` | **Baru** — 14 test (transisi status, kesiapan tiket, label durasi) |
| `src/app/api/kds/items/[itemId]/bump/route.ts` | **Baru** — bump per item; timestamp `cookingAt`/`readyAt`; bila semua item READY → `Order.status = READY`; 409 untuk item SERVED/VOIDED atau aksi tidak valid |
| `src/app/api/kds/orders/[orderId]/bump/route.ts` | **Baru** — `BUMP_TICKET` (semua QUEUED/COOKING → READY) & `MARK_READY` (hanya COOKING); update status order bila semua siap |
| `src/components/kds/TicketCard.tsx` | **Ditulis ulang** — tombol **Mulai** (QUEUED), **Siap** (COOKING), **Revert** (COOKING), **Bump Tiket**; semua 56px; status busy per item/tiket |
| `src/components/kds/KdsBoard.tsx` | Diperbarui — `sendBump()` (POST + refetch), `busyKey`, pesan error di footer, meneruskan handler ke `TicketCard` |
| `TODO.md` | `6.2` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`6.3 Tampilan Mobile Pelayan / Runner (/(staff)/runner)`**, ubah menjadi `[/]`.
2. **Buat `src/lib/runner.ts`** (pure + test):
   * `groupReadyItemsByOrder(items)` → tiket `READY` yang belum `SERVED` (per order, urut waktu siap).
   * `sortWaiterCalls(calls)` → belum direspons (`PENDING`) lebih dulu, lalu `ACKNOWLEDGED`, urut `createdAt` asc; sediakan `getWaiterCallLabel(type)` (AIR/TISU, BERSIHKAN MEJA, TANYA MENU, MINTA BILL).
   * `getRunnerSummary({ readyItems, calls, dirtyTables })`.
   * Uji: grouping, pengurutan, label, ringkasan kosong.
3. **Buat `GET /api/runner`**: kembalikan `{ generatedAt, readyTickets, waiterCalls, dirtyTables }` dengan `select` eksplisit (tanpa `costPrice`/PIN). `readyTickets`: item `READY` pada order `READY`/`SERVED`-belum; `waiterCalls`: status `PENDING`/`ACKNOWLEDGED`; `dirtyTables`: meja `NEEDS_CLEANING` (+ area).
4. **Buat endpoint aksi** (`TODO(RBAC)`):
   * `POST /api/runner/items/[itemId]/serve` → `OrderItem.status = SERVED`, `servedAt`; bila semua item order `SERVED` → `Order.status = SERVED`.
   * `POST /api/runner/calls/[callId]/resolve` body `{ action: "ACKNOWLEDGE" | "RESOLVE" }` → `ACKNOWLEDGED`/`RESOLVED` + timestamp; 409 bila sudah `RESOLVED`.
   * `POST /api/runner/tables/[tableId]/clean` → `Table.status = AVAILABLE` (409 bila masih ada sesi aktif).
5. **UI**: `src/app/(staff)/layout.tsx` (tema terang pelanggan, mobile-first) + `src/app/(staff)/runner/page.tsx` (server: muat data, fallback kosong) + `src/components/runner/RunnerBoard.tsx` (client):
   * Tiga seksi/tab: **Siap Antar** (item per pesanan + tombol "Antar" 56px), **Panggilan Meja** (jenis panggilan, meja, waktu, tombol "Tangani"/"Selesai"), **Meja Kotor** (tombol "Sudah Bersih").
   * Polling 5 dtk + `document.visibilityState` guard; badge jumlah per tab; empty state per seksi; `tabular-nums` untuk waktu.
6. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`; probe `/runner` → 200, `/api/runner` tanpa DB → 500 rapi, endpoint aksi id invalid → 400 & body invalid → 422. Gunakan port baru (cek `Get-NetTCPConnection`).
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke **Fase 7.1: CRUD Menu & Toggle 86'd**), `git commit` (`feat(runner): add mobile waiter view with ready items and table calls`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Bump action**: item KDS hanya `QUEUED`/`COOKING` (item `READY` sudah keluar dari board); `isTicketReady` menentukan order menjadi `READY`.
* **Port bentrok**: sebelum `next start`, cek port; bila 404 untuk semua route, hampir pasti request mengenai proses lain di IPv4 (server Next hanya bind IPv6). Pakai port baru.
* **Belum ada sesi staf/RBAC**: endpoint KDS/Runner masih terbuka (`TODO(RBAC)`); jangan menulis klaim keamanan.
* **PENTING — jangan menulis file non-ASCII memakai PowerShell `Set-Content`/`Add-Content`** (mojibake & BOM). Gunakan `write`/`edit`.
* **Satu jalur order**: `createOrder()` (`src/lib/services/order-creation.ts`) dipakai `POST /api/orders` & `/api/pos/walk-in`.
* **POS/KDS** `.dark`, target sentuh 56px, `tabular-nums`, `h-dvh overflow-hidden` per panel.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`.
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
* **[Sesi #1 — 2026-11-03 · 6.1 KDS board]**: `kds.ts` (+14 test), service & API `/api/kds/orders`, layout `(kds)`, `/kds/[station]`, `KdsBoard` + `TicketCard`. Commit `2a4916e`.
* **[Sesi #1 — 2026-11-03 · 6.2 Bump actions]**: `nextItemStatus`/`isTicketReady`/`getTicketAgingLabel` (+14 test), 2 endpoint bump (item & tiket), tombol Mulai/Siap/Revert/Bump aktif. 350 test lulus; probe 400/422/500 & KDS 200 (setelah ganti port karena bentrok). Commit menyusul.
