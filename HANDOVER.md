# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 4 — Sistem Pembayaran` (4/6 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `4.4 Alur Pembayaran Tunai di Kasir` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `4.5 Webhook Payment Gateway`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**206 test**, 68 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `/api/orders/[orderNumber]/pin`, halaman `/pay/[orderNumber]/cashier` (ƒ).
* **Verifikasi kontrak HTTP** (tanpa DB): PIN orderNumber invalid → 400, PIN 2 digit/huruf → 422, PIN valid → 500 rapi; halaman cashier → **HTTP 200**. SSR `BookingCodeCard` → SVG barcode **52 rect (51 bar)** + label aria + tombol salin.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 19 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/barcode/code39.ts` | **Baru** — tabel pola Code 39 lengkap, `normalizeCode39`, `isEncodableCode39`, `encodeCode39` (modul biner, wide=3/narrow=1, gap 1 modul, start/stop `*`), `toBars`, `Code39Error` |
| `src/lib/barcode/code39.test.ts` | **Baru** — 12 test (validitas pola, panjang modul 10×15+9, start/stop, normalisasi huruf, error, run-length bar) |
| `src/lib/security/pin-attempts.ts` | **Baru** — pembatas 5 percobaan / 10 menit per kunci (in-memory + TTL), `isPinLocked`, `registerPinAttempt`, `resetPinAttempts`, `clearAllPinAttempts` |
| `src/lib/security/pin-attempts.test.ts` | **Baru** — 7 test (penurunan sisa, lock, expiry jendela, isolasi per kunci, reset) |
| `src/app/api/orders/[orderNumber]/pin/route.ts` | **Baru** — verifikasi PIN meja (`verifyPin`), pembatasan per (pesanan+IP), sukses → `Order.status = CONFIRMED` + `confirmedAt` (payment tetap `PENDING`), error 401/409/429 + `Retry-After` |
| `src/components/customer/BookingCodeCard.tsx` | **Baru** — kode booking besar `tracking-[0.2em]`, barcode **SVG** dari `encodeCode39`, tombol salin |
| `src/components/customer/CashierPaymentPanel.tsx` | **Baru** — kode booking + nominal, form PIN 4 kotak (auto-focus, backspace), pesan sisa percobaan, status confirmed/paid, polling 5 dtk |
| `src/app/(customer)/t/[tableSlug]/pay/[orderNumber]/cashier/page.tsx` | **Baru** — halaman bayar di kasir (server component + panel), membaca `table.pinEnabled` |
| `src/app/(customer)/t/[tableSlug]/pay/[orderNumber]/page.tsx` | Diperbarui — kartu "Bayar di Kasir" kini menaut ke halaman cashier |
| `TODO.md` | `4.4` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`4.5 Webhook Payment Gateway`**, ubah menjadi `[/]`.
2. **Buat `src/lib/payment/webhook.ts`** (pure + test):
   * `verifyMidtransSignature({ orderId, statusCode, grossAmount, signatureKey, serverKey })` → `crypto.createHash("sha512").update(`${orderId}${statusCode}${grossAmount}${serverKey}`).digest("hex")` dibandingkan **constant-time** (`timingSafeEqual`).
   * `parseMidtransNotification(payload)` dengan Zod strict: `transaction_status`, `fraud_status?`, `order_id`, `status_code`, `gross_amount`, `signature_key`, `payment_type?`, `transaction_id?`, `transaction_time?`.
   * `mapTransactionToPaymentStatus({ transactionStatus, fraudStatus })` → `PAID | PENDING | FAILED | EXPIRED` (settlement/capture+accept → PAID; pending → PENDING; deny/cancel → FAILED; expire → EXPIRED; capture+challenge → PENDING).
   * `extractOrderNumber(orderId)` — format gateway `"<orderNumber>-<timestamp>"`, contoh `ORD-0001-1700000000000` → `ORD-0001` (regex `^([A-Za-z0-9-]+?)-(\d{10,})$`).
   * Uji: signature valid/invalid, semua pemetaan status, ekstraksi order number (termasuk order number yang mengandung tanda hubung).
3. **Sesuaikan adapter `midtrans.ts`**: kembalikan juga `gatewayOrderId` (`transaction_details.order_id`) dan simpan di `gatewayPayload` saat membuat Payment di route QRIS (`{ qrString, qrUrl, mode, gatewayOrderId }`) agar webhook bisa mencocokkan transaksi tanpa mengandalkan parsing.
4. **Buat `POST /api/webhooks/payment`** (`runtime = "nodejs"`, **jangan** pakai `force-dynamic` berlebihan; cukup default):
   * Baca **raw body** (`await request.text()`) lalu `JSON.parse`; jangan mengandalkan `request.json()` bila butuh byte asli.
   * Verifikasi signature dengan `MIDTRANS_SERVER_KEY`. Bila kunci kosong: hanya boleh lolos jika `PAYMENT_ALLOW_UNSIGNED_WEBHOOK === "true"` (mode demo) — selain itu `401`. Tambahkan env baru di `.env.example` + `env.ts`.
   * **Idempoten**: cari `Payment` lewat `gatewayRefId`/`gatewayPayload.gatewayOrderId` (atau `orderNumber` hasil ekstraksi). Bila `payment.status` sudah `PAID`, balas `200 { received: true, duplicate: true }` tanpa menulis ulang.
   * Status `PAID` → transaksi: `payment.update({ status: "PAID", paidAt: now })`, `order.update({ status: "CONFIRMED", confirmedAt: now })` (hanya bila order masih `PENDING_PAYMENT`), `tableSession.lastActivityAt = now`. Status `EXPIRED/FAILED` → update payment saja (order tetap `PENDING_PAYMENT` agar pelanggan bisa memilih metode lain).
   * Respons selalu `200` untuk notifikasi valid (gateway akan retry bila non-2xx), `400` untuk payload invalid, `401` untuk signature salah.
5. **Penerusan ke KDS**: cukup lewat status `CONFIRMED` (KDS 6.1 akan query order `CONFIRMED/PREPARING`). **Jangan** membuat broadcast realtime di tugas ini; catat sebagai pekerjaan Fase 6.
6. **Verifikasi**: `npm test` (webhook helper), `typecheck`, `lint`, `build`, probe: body bukan JSON → 400, signature salah → 401, valid tanpa DB → 500 rapi.
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `4.6 Live Order Tracker & E-Struk`), `git commit` (`feat(payment): add signed payment webhook with idempotent status sync`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **PIN meja**: 4 digit, disimpan sebagai HMAC di `Table.currentPin`; hanya berlaku bila `pinEnabled = true`. PIN benar → order `CONFIRMED` (bukan `PAID`); kasir masih harus menerima uang.
* **Pembatasan PIN in-memory** (5 percobaan/10 menit). Multi-instance/serverless belum berbagi hitungan — catat batasannya.
* **Barcode Code 39** untuk kode booking (SVG lokal, tanpa dependency). Nomor pesanan `ORD-####` semuanya encodable.
* **Metode pembayaran dipilih sebelum order dibuat** (di `CartSheet`); hub `/pay/[orderNumber]` hanya menampilkan pilihan & tautan.
* **Mode demo**: QRIS/VA lokal, bukti transfer disimpan di `public/uploads/proofs` (gitignored; ganti ke object storage untuk produksi).
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
* **[Sesi #1 — 2026-11-03 · 4.4 Tunai di Kasir]**: `code39.ts` (+12 test), `pin-attempts.ts` (+7 test), API PIN meja, `BookingCodeCard` (barcode SVG), `CashierPaymentPanel`, halaman cashier, tautan dari hub. 206 test lulus; PIN 422/400 & halaman 200 terverifikasi; SSR barcode 51 bar. Commit menyusul.
