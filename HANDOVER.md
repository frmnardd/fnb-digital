# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 5 — Halaman Kasir (POS Dashboard)` (7/9 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `5.7 Otorisasi PIN Supervisor` ✅
* **Sub-Tugas yang Berikutnya**: `5.8 Manajemen Shift Kasir & Laci Kas`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**298 test**, 99 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `POST /api/pos/supervisor-authorize` (ƒ).
* **Verifikasi kontrak HTTP**: body kosong → 422, PIN 4 digit → 422 ("PIN supervisor harus 6 digit"), email invalid → 422, `action` asing → 422 (daftar aksi disebut), payload valid → 500 rapi (DB belum ada); `/cashier` tetap **200**.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 28 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/security/authorization-token.ts` | **Baru** — `SUPERVISOR_ACTIONS` (VOID_ITEM/REFUND/MANUAL_DISCOUNT), `createAuthorizationToken` (HMAC-SHA256 + base64url, payload `sub/act/tid/iat/exp`), `verifyAuthorizationToken` (constant-time, cek kedaluwarsa), TTL 5 menit |
| `src/lib/security/authorization-token.test.ts` | **Baru** — 8 test (payload, semua aksi, expired, signature palsu, payload diubah, token rusak) |
| `src/lib/security/supervisor-pin.ts` | **Baru** — `isValidSupervisorPin` (6 digit), `verifySupervisorPin` (reuse `verifyPin` HMAC) |
| `src/lib/security/supervisor-pin.test.ts` | **Baru** — 4 test |
| `src/app/api/pos/supervisor-authorize/route.ts` | **Baru** — Zod strict, rate limit `pin-attempts` (kunci `supervisor:email:ip`), role `ADMIN`/`CASHIER`, respons token + `expiresAt`; tidak membocorkan `pinHash`; `TODO(RBAC)` |
| `src/components/pos/SupervisorPinModal.tsx` | **Baru** — email staf + 6 kotak PIN (auto-focus/backspace), pesan sisa percobaan, `onAuthorized(token)` |
| `src/components/pos/PosBillPanel.tsx` | Diperbarui — tombol **Void Item** & **Diskon Manual** (saat pembayaran belum lunas) membuka modal otorisasi; sukses menampilkan notice token 5 menit |
| `TODO.md` | `5.7` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`5.8 Manajemen Shift Kasir & Laci Kas (ShiftManagement)`**, ubah menjadi `[/]`.
2. **Buat `src/lib/shift.ts`** (pure + `src/lib/shift.test.ts`):
   * `computeShiftSummary({ startingCash, cashIn, cashOut })` → `{ expectedCash }` (modal awal + kas masuk − kas keluar).
   * `computeVariance(actualEndingCash, expectedCash)` → selisih (boleh negatif).
   * `CASH_DRAWER_TYPES` untuk label UI (`OPENING_FLOAT`, `CASH_IN`, `CASH_OUT`, `SALE`, `REFUND`, `CLOSING_COUNT`, `ADJUSTMENT`).
   * `summarizeDrawerLogs(logs)` → total masuk/keluar per tipe.
   * Uji: ringkasan, variance positif/negatif/nol, log kosong, agregasi tipe.
3. **Endpoint** (`TODO(RBAC)`):
   * `GET /api/pos/shift`: shift `OPEN` terakhir untuk kasir (parameter `staffEmail`) + ringkasan (`startingCash`, total `CASH_IN`/`CASH_OUT` dari `CashDrawerLog`, `expectedCash`) + jumlah transaksi tunai `PAID`.
   * `POST /api/pos/shift/open`: body `{ staffEmail, startingCash }` → tolak bila sudah ada shift OPEN (409); buat `CashierShift` + `CashDrawerLog { type: OPENING_FLOAT }`.
   * `POST /api/pos/shift/log`: body `{ shiftId, type: "CASH_IN"|"CASH_OUT", amount, reason? }` → validasi shift OPEN.
   * `POST /api/pos/shift/close`: body `{ shiftId, actualEndingCash, notes? }` → hitung `expectedCash` & `variance`, set `CLOSED`+`closedAt`, catat `CLOSING_COUNT`.
4. **Kaitkan pembayaran tunai ke shift**: pada `POST /api/orders/[orderNumber]/cashier-confirm` (aksi `MARK_PAID`), bila ada `CashierShift` berstatus `OPEN` → isi `Payment.shiftId` dan tambahkan `CashDrawerLog { type: "SALE", amount: grandTotal, orderId }`.
5. **UI `/cashier/shift`** (aktifkan item "Shift" di `PosSidebar`):
   * Bila belum ada shift: form **Buka Shift** (input modal awal Rupiah, tombol 56px).
   * Bila ada shift: kartu ringkasan (modal awal, kas masuk, kas keluar, ekspektasi, transaksi tunai), form kas masuk/keluar, dan tombol **Tutup Shift** → modal *blind count* (`actualEndingCash`) menampilkan selisih + tombol **Cetak Z-Report** (`window.print()` dengan area cetak).
   * Semua nominal `tabular-nums`.
6. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`; probe `/cashier/shift` 200, endpoint body invalid → 422, tanpa DB → 500 rapi.
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `5.9 Modul Cetak Struk Thermal ESC/POS`), `git commit` (`feat(pos): add cashier shift and cash drawer management`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Token otorisasi supervisor** bertanda tangan HMAC (`SESSION_SECRET`), berlaku 5 menit, berisi `act` + `tid`; endpoint aksi wajib memverifikasinya via `verifyAuthorizationToken`.
* **PIN staf** 6 digit hashed HMAC (seed: `kasir@fnb.local/222222`, `admin@fnb.local/111111`). Rate limit 5 percobaan/10 menit per (email+IP), in-memory.
* **Belum ada sesi staf/RBAC**: `staffEmail` masih dikirim dari body; sudah ditandai `TODO(RBAC)`.
* **PENTING — jangan menulis file non-ASCII memakai PowerShell `Set-Content`/`Add-Content`** (menyebabkan mojibake & BOM). Gunakan `write`/`edit`.
* **Satu jalur order**: `createOrder()` (`src/lib/services/order-creation.ts`) dipakai `POST /api/orders` & `/api/pos/walk-in`.
* **POS/KDS** `.dark`, target sentuh 56px, `tabular-nums`, `h-dvh overflow-hidden` per panel.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`.
* **BUG SSR ZUSTAND**: `persist` tidak memasang `store.persist` saat storage tidak tersedia → guard.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`.
* **Seed**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`.
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
* **[Sesi #1 — 2026-11-03 · 5.7 Supervisor PIN]**: `authorization-token.ts` (+8 test), `supervisor-pin.ts` (+4 test), API `supervisor-authorize` (rate limit + role), `SupervisorPinModal`, tombol Void/Diskon di bill panel. 298 test lulus; probe 422 & 500 rapi. Commit menyusul.
