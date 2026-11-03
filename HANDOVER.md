# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 4 — Sistem Pembayaran` (5/6 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `4.5 Webhook Payment Gateway` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `4.6 Live Order Tracker & E-Struk PDF` (penutup Fase 4)
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**224 test**, 73 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `/api/webhooks/payment` (ƒ).
* **Verifikasi kontrak HTTP webhook**: body non-JSON → 400, tanpa `signature_key` → 422, signature salah/kunci kosong → 401; dengan `PAYMENT_ALLOW_UNSIGNED_WEBHOOK=true` payload valid lolos gerbang signature lalu → 500 rapi (DB belum ada).
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 20 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/payment/webhook.ts` | **Baru** — `midtransNotificationSchema` (passthrough), `computeMidtransSignature` (SHA-512), `verifyMidtransSignature` (constant-time), `mapTransactionToPaymentStatus`, `extractOrderNumber` |
| `src/lib/payment/webhook.test.ts` | **Baru** — 18 test (signature valid/tamper/non-hex, seluruh pemetaan status, refund, ekstraksi order id, skema notifikasi) |
| `src/lib/payment/midtrans.ts` | Diperbarui — mengembalikan `gatewayOrderId` (`<orderNumber>-<timestamp>`) yang dipakai saat charge |
| `src/app/api/orders/[orderNumber]/payment/qris/route.ts` | Diperbarui — menyimpan `gatewayOrderId` di `gatewayPayload` untuk pencocokan webhook |
| `src/app/api/webhooks/payment/route.ts` | **Baru** — body mentah → JSON → Zod, verifikasi signature, gerbang `PAYMENT_ALLOW_UNSIGNED_WEBHOOK` (demo), idempoten (`duplicate`), PAID → `Payment.PAID` + `Order.CONFIRMED` + bump sesi, FAILED/EXPIRED/REFUNDED → update payment saja |
| `src/lib/env.ts`, `.env.example` | Tambah `PAYMENT_ALLOW_UNSIGNED_WEBHOOK` |
| `TODO.md` | `4.5` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`4.6 Live Order Tracker & E-Struk PDF`**, ubah menjadi `[/]`.
2. **Buat `src/lib/order-tracking.ts`** (pure + `src/lib/order-tracking.test.ts`):
   * `TRACKER_STEPS` = `[{ key: "RECEIVED", label: "Diterima" }, { key: "COOKING", label: "Dimasak" }, { key: "READY", label: "Siap Diantar" }, { key: "SERVED", label: "Selesai" }]`.
   * `mapOrderStatusToStep(status)` — `PENDING_PAYMENT`/`WAITING_CASHIER_APPROVAL` → `RECEIVED` (dengan flag `waitingPayment`), `CONFIRMED`/`PREPARING` → `COOKING`, `READY` → `READY`, `SERVED`/`COMPLETED` → `SERVED`, `CANCELLED` → `CANCELLED`.
   * `getTrackerState({ status, itemStatuses })` → `{ currentStep, steps: [{ key, label, state: "done"|"current"|"todo" }], isCancelled, progressPercent }` — turunkan juga kemajuan item (`QUEUED/COOKING/READY/SERVED/VOIDED`).
   * Uji: semua status order, status item campuran, cancelled, progress 0–100.
3. **Buat `GET /api/orders/[orderNumber]/track`** (pola sama dengan `payment/status`): kembalikan `{ orderNumber, status, orderType, grandTotal, paymentStatus, confirmedAt, completedAt, items: [{ name, quantity, status, station }], tracker }` (pakai `getTrackerState`). Jangan kirim `costPrice`/data internal.
4. **Buat halaman tracker `src/app/(customer)/t/[tableSlug]/order/[orderNumber]/page.tsx`** (server) + `src/components/customer/OrderTracker.tsx` (client):
   * Stepper vertikal 4 langkah dengan ikon (`CheckCircle2`, `ChefHat`, `BellRing`, `UtensilsCrossed`), state done/current/todo dari `getTrackerState`, garis penghubung, warna status (done = success, current = primary + animasi pulse halus, todo = muted).
   * Polling `GET /api/orders/[orderNumber]/track` setiap 5 dtk; hentikan saat `COMPLETED`/`CANCELLED`.
   * Tampilkan metode & status pembayaran, total `tabular-nums`, daftar item + status per item (chip kecil).
   * Tombol **"Lihat / Unduh Struk"** → halaman struk.
5. **Buat E-Struk `src/app/(customer)/t/[tableSlug]/order/[orderNumber]/receipt/page.tsx`** (server):
   * Tampilkan struk bergaya kertas 80 mm: nama restoran, nomor pesanan, meja/tipe, tanggal & jam (zona `Asia/Jakarta` via `Intl`), daftar item + modifier + catatan, subtotal, service 5%, PB1 10%, kode unik (bila ada), total, metode & status pembayaran, footer "Terima kasih".
   * **Unduh PDF tanpa dependency baru**: buat client component kecil `PrintReceiptButton` yang memanggil `window.print()`; sediakan CSS `@media print` (sembunyikan tombol, latar putih, lebar 80 mm). Catat di HANDOVER bahwa PDF server-side (`pdf-lib`) butuh persetujuan dependency.
6. **Sambungkan navigasi**: pada `PaymentQrisPanel`, `VirtualAccountPanel`, `ManualTransferPanel`, `CashierPaymentPanel` — setelah lunas, arahkan juga ke halaman tracker (`/t/[slug]/order/[orderNumber]`). Tambahkan tombol "Lacak Pesanan" di hub pembayaran.
7. **Verifikasi**: `npm test` (tracker), `typecheck`, `lint`, `build`, probe HTTP (`/api/orders/BAD!!/track` → 400, valid tanpa DB → 500 rapi; halaman tracker & struk → 200 fallback). Render-check SSR tracker dengan fixture bila memungkinkan (hapus file sementara sebelum commit).
8. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke **Fase 5.1: Layout Utama POS 3-Panel**), `git commit` (`feat(customer): add live order tracker and printable e-receipt`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Webhook** selalu balas 200 untuk notifikasi sah (agar gateway tidak retry berlebihan); 400 payload invalid, 401 signature salah. Idempoten terhadap notifikasi berulang.
* **`order_id` gateway** berformat `<orderNumber>-<timestamp>` (disimpan sebagai `gatewayPayload.gatewayOrderId`); `extractOrderNumber()` menanganinya.
* **Mode demo** (tanpa `MIDTRANS_SERVER_KEY`): QRIS/VA lokal; webhook hanya boleh tanpa signature bila `PAYMENT_ALLOW_UNSIGNED_WEBHOOK=true` (JANGAN di produksi).
* **PIN meja**: 4 digit hashed; pin benar → order `CONFIRMED` (payment tetap `PENDING`).
* **Metode pembayaran dipilih sebelum order dibuat**; hub `/pay/[orderNumber]` hanya menampilkan tautan.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash` — jangan ke klien/log.
* **Harga**: server selalu menghitung ulang (`buildOrderDraft`); Zod strict menolak field harga dari klien.
* **Urutan kalkulasi (WAJIB)**: subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (khusus `MANUAL_TRANSFER`).
* **BUG SSR ZUSTAND (jangan diulang)**: `persist` tidak memasang `store.persist` saat storage tidak tersedia → guard `const persistApi = useCartStore.persist; if (!persistApi) {...}`.
* **Sinkronisasi keranjang**: lintas tab/origin sama (`BroadcastChannel`); multi-device butuh Supabase Realtime.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; urutan validasi env → slug/param → body → DB.
* **Seed**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`.
* **Migrasi init jangan diedit**; bila DB tersedia: `npx prisma migrate deploy && npm run db:seed`.
* **Sandbox**: `npm install` pakai `--ignore-scripts`; cache npm `./.npm-cache`; `next/font/google` tidak dipakai.
* **Tema**: `:root` Customer Warm Light (`#FAF8F5`, primary `#D9381E`), `.dark` POS/KDS Slate Dark; target sentuh pelanggan ≥ 48px, POS/KDS 56px; angka wajib `tabular-nums`.
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
* **[Sesi #1 — 2026-11-03 · 4.2 QRIS]**: `payment/qris.ts` (+16 test), adapter Midtrans, API qris & status, `PaymentQrisPanel`, halaman bayar. Commit `a213e7e`.
* **[Sesi #1 — 2026-11-03 · 4.3 Transfer Bank]**: `va.ts` (+9), `manual-transfer.ts` (+11), API VA/manual/proof, panel VA & manual, hub metode. Commit `f1cdf07`.
* **[Sesi #1 — 2026-11-03 · 4.4 Tunai di Kasir]**: `code39.ts` (+12), `pin-attempts.ts` (+7), API PIN meja, `BookingCodeCard` (barcode SVG), `CashierPaymentPanel`, halaman cashier. Commit `a20adae`.
* **[Sesi #1 — 2026-11-03 · 4.5 Webhook]**: `payment/webhook.ts` (+18 test, SHA-512 signature constant-time, pemetaan status, ekstraksi order id), `gatewayOrderId` disimpan, route webhook idempoten + gerbang demo. 224 test lulus; probe 400/422/401/500 rapi. Commit menyusul.
