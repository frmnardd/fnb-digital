# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 6 — KDS & Runner` (1/3 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `6.1 Layar KDS Dapur & Barista` ✅
* **Sub-Tugas yang Berikutnya**: `6.2 SLA Aging Timer & Bump Action`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**336 test**, 111 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `/kds/[station]` (ƒ), `GET /api/kds/orders` (ƒ).
* **Verifikasi runtime**: `/kds/kitchen` & `/kds/bar` → **200** (header "Kitchen Display System", "Dapur", empty state "Tidak ada tiket", chip "terlambat"); `/kds/gudang` → **404**; API `station=GUDANG` → 422, `station=BAR` tanpa DB → 500 rapi.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 31 dari 31 sub-tugas Fase 1–6.1 selesai (TODO total 31 item; cek `TODO.md` untuk sisa fase 6–7).

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/kds.ts` | **Baru** — `KDS_STATION_SLUGS`/`parseStationSlug`, `KDS_STATION_LABELS`, `KDS_SLA_MINUTES` (10), `getTicketAgeState` (FRESH/WARNING/OVERDUE + agingMinutes, aman clock-skew), `groupItemsByOrder`, `getKdsSummary` |
| `src/lib/kds.test.ts` | **Baru** — 14 test |
| `src/lib/services/kds.ts` | **Baru** — `getKdsBoard(station)`: item `QUEUED/COOKING` pada order aktif + meja, dikelompokkan jadi tiket |
| `src/app/api/kds/orders/route.ts` | **Baru** — `GET` tiket aktif per stasiun (Zod enum) |
| `src/app/(kds)/layout.tsx` | **Baru** — `dark h-dvh overflow-hidden` |
| `src/app/(kds)/kds/[station]/page.tsx` | **Baru** — validasi slug (`notFound()`), muat board, fallback `[]` |
| `src/components/kds/KdsBoard.tsx` | **Baru** — grid tiket, polling 5 dtk, ringkasan (tiket/item/terlambat), tombol refresh 56px, empty state, jam render-setelah-mount |
| `src/components/kds/TicketCard.tsx` | **Baru** — nomor pesanan, meja, item + modifier + catatan (highlight), badge umur (hijau/kuning/merah `animate-blink-danger`), tombol bump disabled "Bump (6.2)" |
| `TODO.md` | `6.1` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`6.2 SLA Aging Timer & Bump Action`**, ubah menjadi `[/]`.
2. **Tambahkan helper murni di `src/lib/kds.ts` + test**:
   * `nextItemStatus(current: "QUEUED" | "COOKING" | "READY", action: "START_COOKING" | "MARK_READY" | "REVERT")` → status berikutnya (invalid → `null`/lempar error).
   * `isTicketReady(items)` → semua item `READY` (VOIDED diabaikan).
   * `getTicketAgingLabel(minutes)` → "0 mnt" / "1 j 05 mnt" (bila perlu).
3. **Buat endpoint bump** (`TODO(RBAC)`):
   * `POST /api/kds/items/[itemId]/bump` body `{ action: "START_COOKING" | "MARK_READY" | "REVERT" }` → update `OrderItem.status` + timestamp (`cookingAt`, `readyAt`); tolak bila item sudah `SERVED/VOIDED`.
   * `POST /api/kds/orders/[orderId]/bump` body `{ action: "BUMP_TICKET" | "MARK_READY" }` → perbarui semua item aktif tiket sekaligus.
   * Setelah bump: bila **semua item order `READY`** → `Order.status = READY` (+ `readyAt` tidak ada di schema order; gunakan `OrderItem.readyAt`). Jangan mengubah pembayaran.
   * Respons ringkas `{ orderNumber, status, itemStatus }`.
4. **UI**: aktifkan tombol per item (**Mulai** → `COOKING`, **Siap** → `READY`) dan tombol **Bump Tiket** di `TicketCard`; `KdsBoard` mengirim aksi lalu memuat ulang board (optimistic update boleh, tetapi wajib refetch). Tambah konfirmasi singkat bila tiket overdue.
5. **Timer**: pastikan badge umur diperbarui minimal tiap 30 detik (sudah ada `CLOCK_TICK_MS`), dan berkedip untuk `OVERDUE` (class `animate-blink-danger` sudah ada di Tailwind config).
6. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`; probe: bump item id invalid → 400, body invalid → 422, item tanpa DB → 500 rapi; `/kds/kitchen` tetap 200.
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `6.3 Tampilan Mobile Pelayan / Runner`), `git commit` (`feat(kds): add sla aging timer and item bump actions`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **KDS hanya menampilkan order `CONFIRMED`/`PREPARING`/`READY`** dengan item `QUEUED`/`COOKING`; stasiun difilter dari `OrderItem.station`.
* **Aging**: hijau < 5 mnt, kuning 5–10 mnt, merah > 10 mnt (`animate-blink-danger`). Dihitung dari `OrderItem.queuedAt` (bukan waktu order dibuat).
* **Belum ada sesi staf/RBAC**: endpoint KDS masih terbuka (`TODO(RBAC)`); jangan menulis klaim keamanan.
* **PENTING — jangan menulis file non-ASCII memakai PowerShell `Set-Content`/`Add-Content`** (mojibake & BOM). Gunakan `write`/`edit`.
* **Satu jalur order**: `createOrder()` (`src/lib/services/order-creation.ts`) dipakai `POST /api/orders` & `/api/pos/walk-in`.
* **ESC/POS**: payload `text/plain` untuk printer thermal; browser butuh jembatan (QZ Tray/WebUSB).
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
* **[Sesi #1 — 2026-11-03 · 6.1 KDS board]**: `kds.ts` (+14 test, stasiun + aging + grouping), service & API `/api/kds/orders`, layout `(kds)` dark, halaman `/kds/[station]`, `KdsBoard` (polling 5 dtk) + `TicketCard` (badge aging, tombol bump disabled). 336 test lulus; probe 200/404/422/500 sesuai kontrak. Commit menyusul.
