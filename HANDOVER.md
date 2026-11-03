# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 5 — Halaman Kasir (POS Dashboard)` (8/9 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `5.8 Manajemen Shift Kasir & Laci Kas` ✅
* **Sub-Tugas yang Berikutnya**: `5.9 Modul Cetak Struk Thermal ESC/POS` (penutup Fase 5)
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**303 test**, 100 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `GET /api/pos/shift`, `POST /api/pos/shift/open`, `POST /api/pos/shift/log`, `POST /api/pos/shift/close`, halaman `/cashier/shift` (ƒ).
* **Verifikasi kontrak HTTP**: shift tanpa/`staffEmail` invalid → 422 (format Zod konsisten), valid tanpa DB → 500 rapi; open/log/close body kosong → 422; `/cashier/shift` → **200** ("Shift & Laci Kas", "Email kasir").
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 29 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/shift.ts` | **Baru** — `CASH_DRAWER_TYPES`/label, `summarizeDrawerLogs` (SALE/CASH_IN/CASH_OUT/REFUND, CLOSING_COUNT diabaikan), `computeExpectedCash`, `computeVariance`, `buildShiftSummary` |
| `src/lib/shift.test.ts` | **Baru** — 9 test |
| `src/lib/services/shift.ts` | **Baru** — `getCurrentShift(staffEmail)`: shift OPEN + log + ringkasan + jumlah transaksi tunai |
| `src/app/api/pos/shift/route.ts` | **Baru** — GET ringkasan shift (`staffEmail` query, ZodError dinormalisasi) |
| `src/app/api/pos/shift/open/route.ts` | **Baru** — buka shift + `CashDrawerLog OPENING_FLOAT`; 409 bila masih ada shift terbuka |
| `src/app/api/pos/shift/log/route.ts` | **Baru** — catat `CASH_IN`/`CASH_OUT` (shift harus OPEN) |
| `src/app/api/pos/shift/close/route.ts` | **Baru** — blind count: hitung ekspektasi & variance, tutup shift, catat `CLOSING_COUNT` |
| `src/app/api/orders/[orderNumber]/cashier-confirm/route.ts` | Diperbarui — pembayaran tunai dikaitkan ke shift OPEN (`Payment.shiftId`) + `CashDrawerLog SALE` |
| `src/components/pos/ShiftWorkspace.tsx` | **Baru** — buka shift (modal awal), ringkasan (modal/penjualan/kas masuk-keluar/refund/ekspektasi/transaksi), form mutasi kas, modal tutup shift (blind count), kartu **Z-Report** + `window.print()`, toggle suara |
| `src/app/(pos)/cashier/shift/page.tsx` | **Baru** — render workspace (email default `kasir@fnb.local`) |
| `src/components/pos/PosSidebar.tsx` | Diperbarui — "Shift" aktif menuju `/cashier/shift` |
| `TODO.md` | `5.8` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`5.9 Modul Cetak Struk Thermal (src/lib/printer/escpos.ts)`**, ubah menjadi `[/]`.
2. **Buat `src/lib/printer/escpos.ts`** (pure + `src/lib/printer/escpos.test.ts`):
   * Konstanta perintah ESC/POS: `ESC @` (init), `ESC a n` (align), `ESC ! n` (font/bold), `GS V m` (cut), `ESC d n` (feed).
   * `createEscPosBuilder({ paperWidth: 58 | 80 })` → objek dengan `init()`, `align()`, `bold()`, `text()`, `line()`, `divider()`, `columns(left, right, width)`, `qr()`, `feed()`, `cut()`, `toString()` (string biner) dan `toBytes()` (Uint8Array).
   * `formatReceipt(order, options)` → `string[]` baris struk 32 kolom (58 mm) / 48 kolom (80 mm): header, nomor, meja/tipe, waktu (Asia/Jakarta), item + modifier, subtotal/service/PB1/total, pembayaran, footer.
   * `toEscPos(order, options)` merangkai builder + baris struk + QR (bila ada).
   * Uji: lebar kolom (32/48), potongan teks panjang, `columns` rata kanan, perintah init/align/cut ada di output, format struk memuat total & nomor pesanan, encoding ASCII aman.
3. **Buat endpoint `GET /api/orders/[orderNumber]/receipt/escpos?width=58|80`** (`runtime = "nodejs"`): ambil order + items + payment, kembalikan `text/plain; charset=utf-8` berisi perintah ESC/POS (header `Cache-Control: no-store`). Jangan kirim `costPrice`.
4. **Integrasi UI**: pada `PosBillPanel` setelah pembayaran lunas, tambahkan tombol **Cetak Struk Thermal** (56px) yang membuka `window.open('/api/orders/<no>/receipt/escpos?width=80')` (fallback: `fetch` + tampilkan instruksi); sertakan pemilih 58/80 mm.
5. **Catat batasan**: browser tidak bisa mengirim byte mentah ke printer tanpa WebUSB/WebSerial atau jembatan lokal (mis. QZ Tray). Endpoint menyediakan payload ESC/POS siap pakai untuk agen cetak lokal; jangan mengklaim cetak langsung berhasil.
6. **Verifikasi**: `npm test` (escpos), `typecheck`, `lint`, `build`; probe endpoint orderNumber invalid → 400, tanpa DB → 500 rapi; halaman POS tetap 200.
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke **Fase 6.1: Layar KDS Dapur & Barista**), `git commit` (`feat(printer): add escpos receipt formatting for 58mm and 80mm thermal printers`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Shift**: ekspektasi kas = modal awal + penjualan tunai + kas masuk − kas keluar − refund; `CLOSING_COUNT` tidak dihitung sebagai arus kas. Variance = kas fisik − ekspektasi.
* **Pembayaran tunai** otomatis mengait ke shift OPEN pada `cashier-confirm` (menambah `CashDrawerLog SALE`).
* **Belum ada sesi staf/RBAC**: `staffEmail` dikirim dari body/query & di-prefill `kasir@fnb.local`; semua endpoint ditandai `TODO(RBAC)`.
* **PENTING — jangan menulis file non-ASCII memakai PowerShell `Set-Content`/`Add-Content`** (mojibake & BOM). Gunakan `write`/`edit`.
* **Satu jalur order**: `createOrder()` (`src/lib/services/order-creation.ts`) dipakai `POST /api/orders` & `/api/pos/walk-in`.
* **POS/KDS** `.dark`, target sentuh 56px, `tabular-nums`, `h-dvh overflow-hidden` per panel.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`.
* **BUG SSR ZUSTAND**: `persist` tidak memasang `store.persist` saat storage tidak tersedia → guard.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; biarkan `ZodError` naik ke `handleRouteError` agar format konsisten.
* **Seed**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf PIN 6 digit (`kasir@fnb.local/222222`).
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
* **[Sesi #1 — 2026-11-03 · 5.8 Shift & Laci Kas]**: `shift.ts` (+9 test), service & 4 endpoint shift, `ShiftWorkspace` (buka/tutup, blind count, Z-report), pembayaran tunai terhubung ke shift (`shiftId` + SALE log). 303 test lulus; probe 422/500 & halaman 200. Commit menyusul.
