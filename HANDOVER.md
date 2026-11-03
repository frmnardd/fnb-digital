# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 5 — Halaman Kasir (POS Dashboard)` — **Fase 4 SELESAI (6/6)**
* **Sub-Tugas Terakhir yang Selesai**: `4.6 Live Order Tracker & E-Struk` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `5.1 Layout Utama POS 3-Panel & Notifikasi Suara`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**238 test**, 78 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `/api/orders/[orderNumber]/track`, halaman `/t/[tableSlug]/order/[orderNumber]` & `.../receipt` (ƒ).
* **Verifikasi kontrak HTTP**: `track` orderNumber invalid → 400, valid → 500 rapi (DB belum ada); halaman tracker & struk → **HTTP 200** (fallback ramah).
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 21 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/order-tracking.ts` | **Baru** — `TRACKER_STEPS` (Diterima/Dimasak/Siap Diantar/Selesai), `mapOrderStatusToStep`, `getTrackerState` (gabung status order + item, `progressPercent`, `isWaitingPayment`, `isCancelled`), `buildOrderTrackPayload` |
| `src/lib/order-tracking.test.ts` | **Baru** — 14 test (semua status order, dorongan status item, VOIDED, progress 0/33/67/100, cancelled) |
| `src/app/api/orders/[orderNumber]/track/route.ts` | **Baru** — payload status + item + tracker |
| `src/components/customer/OrderTracker.tsx` | **Baru** — stepper vertikal 4 langkah (ikon per tahap, state done/current/todo, progress bar), polling 5 dtk berhenti saat selesai/cancel, daftar item + chip status, ringkasan pembayaran |
| `src/app/(customer)/t/[tableSlug]/order/[orderNumber]/page.tsx` | **Baru** — halaman tracker (server + client), fallback 200 |
| `src/app/(customer)/t/[tableSlug]/order/[orderNumber]/receipt/page.tsx` | **Baru** — e-struk 80 mm: identitas, meja/tipe/waktu, item + modifier + catatan, subtotal/diskon/service/PB1/kode unik/total, metode & status bayar, footer |
| `src/components/customer/PrintReceiptButton.tsx` | **Baru** — `window.print()` (Cetak / Simpan PDF) |
| `src/app/globals.css` | Ditambah blok `@media print` (`.print-hidden`, `.receipt-paper` 80 mm) |
| `PaymentQrisPanel`, `VirtualAccountPanel`, `ManualTransferPanel`, `CashierPaymentPanel` | Diperbarui — tombol **Lacak Pesanan** setelah lunas (`tableSlug` diteruskan dari halaman) |
| `.../pay/[orderNumber]/page.tsx` | Diperbarui — tautan "Lacak Pesanan" |
| `TODO.md` | `4.6` ditandai `[x]` (Fase 4 selesai) |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`5.1 Layout Utama POS 3-Panel & Notifikasi Suara`**, ubah menjadi `[/]`.
2. **Buat route group POS**:
   * `src/app/(pos)/layout.tsx` — bungkus dengan `<div className="dark h-dvh overflow-hidden bg-background text-foreground">` (tema Slate Dark, CONTEXT §5.1) **tanpa** `max-w-md`; jangan `sticky` body-scroll — panel masing-masing yang scroll.
   * `src/app/(pos)/cashier/page.tsx` — kerangka **3 panel** dengan grid: sidebar ikon 72–80px, panel tengah `flex-1`, panel detail kanan `w-[380px]` (di layar < lg boleh jadi drawer/stack).
   * Semua teks harga `tabular-nums`; tombol minimal **56×56** (`min-h-touch min-w-touch` yang sudah ada di Tailwind config).
3. **Komponen baru di `src/components/pos/`**:
   * `PosSidebar.tsx` — ikon `LayoutList` (Antrean), `LayoutGrid` (Meja/Floor Plan), `PlusSquare` (Walk-in), `Wallet` (Shift), `BarChart3` (Laporan) + indikator aktif; item non-aktif diberi badge "Soon" bila halamannya belum ada.
   * `PosTopbar.tsx` — nama kasir (sementara "Kasir"), jam berjalan (client, `tabular-nums`), status shift, dan toggle **suara notifikasi** (tersimpan di `localStorage`).
   * `PosQueueList.tsx` + `PosQueueCard.tsx` — daftar antrean kosong (empty state) dengan placeholder skeleton; kartu: nomor pesanan, meja/tipe, total, waktu masuk, badge status (`WAITING_CASHIER_APPROVAL` kuning, `PENDING_PAYMENT` abu, `CONFIRMED` hijau).
   * `PosBillPanel.tsx` — panel kanan: ringkasan pesanan terpilih / empty state "Pilih pesanan".
4. **Notifikasi suara tanpa file audio**: buat `src/lib/audio/notification.ts` (pure-ish) dengan `playNotificationTone(kind: "new-order" | "waiter-call")` memakai `AudioContext` + `OscillatorNode` (dua nada singkat, envelope gain), guard `typeof window`, dan `unlockAudioContext()`; kemudian hook `src/hooks/useNotificationSound.ts` (toggle + persist `localStorage`, panggil `unlockAudioContext()` pada interaksi pertama). Jangan pakai file .mp3.
5. **Data sementara**: halaman cashier cukup menampilkan empty state (DB belum ada) — jangan mengarang data palsu di UI produksi. Bila perlu demo, gunakan komponen presentasional yang menerima props array kosong.
6. **Verifikasi**: `typecheck`, `lint`, `build`, probe `GET /cashier` → **HTTP 200** (fallback, bukan 500), dan cek HTML mengandung teks panel ("Antrean", "Pilih pesanan", "Shift").
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `5.2 Tab Antrean QR & Validasi Bayar`), `git commit` (`feat(pos): add three-panel cashier layout with notification sound`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **E-Struk PDF**: memakai dialog cetak browser (`window.print()` → "Save as PDF"). PDF server-side (`pdf-lib`) belum diizinkan (butuh persetujuan dependency).
* **QRIS/VA/bukti transfer mode demo** (tanpa kredensial gateway). Webhook hanya boleh tanpa signature bila `PAYMENT_ALLOW_UNSIGNED_WEBHOOK=true` (jangan di produksi).
* **`order_id` gateway** = `<orderNumber>-<timestamp>` (disimpan di `gatewayPayload.gatewayOrderId`); `extractOrderNumber()` menanganinya.
* **PIN meja** 4 digit hashed; benar → order `CONFIRMED` (payment tetap `PENDING`).
* **Status order**: `CASH`/`EDC_CARD` → `WAITING_CASHIER_APPROVAL`; metode online → `PENDING_PAYMENT`; PAID → `CONFIRMED`.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash` — jangan ke klien/log.
* **Harga**: server selalu menghitung ulang (`buildOrderDraft`); Zod strict menolak field harga dari klien. Urutan: subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (khusus `MANUAL_TRANSFER`).
* **BUG SSR ZUSTAND (jangan diulang)**: `persist` tidak memasang `store.persist` saat storage tidak tersedia → guard `const persistApi = useCartStore.persist; if (!persistApi) {...}`.
* **Sinkronisasi keranjang**: lintas tab/origin sama (`BroadcastChannel`); multi-device butuh Supabase Realtime.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`.
* **Seed**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`.
* **Migrasi init jangan diedit**; bila DB tersedia: `npx prisma migrate deploy && npm run db:seed`.
* **Sandbox**: `npm install` pakai `--ignore-scripts`; cache npm `./.npm-cache`; `next/font/google` tidak dipakai.
* **Tema**: `:root` Customer Warm Light, `.dark` POS/KDS Slate Dark; target sentuh pelanggan ≥ 48px, POS/KDS 56px; angka wajib `tabular-nums`.
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
* **[Sesi #1 — 2026-11-03 · 4.4 Tunai di Kasir]**: `code39.ts` (+12), `pin-attempts.ts` (+7), API PIN meja, `BookingCodeCard`, `CashierPaymentPanel`, halaman cashier. Commit `a20adae`.
* **[Sesi #1 — 2026-11-03 · 4.5 Webhook]**: `payment/webhook.ts` (+18 test), route webhook idempoten. Commit `b6901ef`.
* **[Sesi #1 — 2026-11-03 · 4.6 Tracker & E-Struk]**: `order-tracking.ts` (+14 test), API `track`, `OrderTracker` (stepper + polling), halaman tracker & e-struk 80 mm + `@media print`, tautan "Lacak Pesanan" di 4 panel pembayaran. 238 test lulus; probe 400/500 rapi & kedua halaman 200. Fase 4 tuntas. Commit menyusul.
