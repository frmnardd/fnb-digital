# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 4 — Sistem Pembayaran` (1/6 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `4.1 API Pembuatan Order` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `4.2 Integrasi Pembayaran QRIS Dinamis & Tombol Unduh QR`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**150 test**, 47 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔. Route baru: `/api/orders` (ƒ).
* **Verifikasi kontrak HTTP `/api/orders`** (tanpa DB): body kosong → 422, `items: []` → 422, `paymentMethod` tak dikenal → 422, `quantity: 0` → 422, `DINE_IN` tanpa `tableSlug` → 422, field harga dari klien (`price`) → **ditolak 422 "Unrecognized key(s)"**, payload valid → 500 berformat benar (DB belum ada).
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 16 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/order-draft.ts` | **Baru** — `PAYMENT_METHODS` (tuple `as const`), `PaymentMethodKey`, `OrderDraftError` (`EMPTY_CART`/`MENU_NOT_FOUND`/`MENU_UNAVAILABLE`/`MODIFIER_INVALID`/`QUANTITY_INVALID`/`INVALID_PAYMENT_METHOD`), `resolveModifiers()` (opsi harus milik grup menu + aturan SINGLE/maxSelect), `buildOrderDraft()` (hitung ulang harga, diskon, kode unik hanya `MANUAL_TRANSFER`) |
| `src/lib/order-draft.test.ts` | **Baru** — 18 test (recompute, harga klien diabaikan, multi-baris, diskon, kode unik, seluruh jalur error, `resolveModifiers`) |
| `src/lib/menu-mapper.ts` | Diperbarui — ekspor `MenuItemRow` & `toPublicMenuItem()` (dipakai route order) |
| `src/app/api/orders/route.ts` | **Baru** — Zod strict (tolak field asing/harga klien), ambil katalog DB, `buildOrderDraft`, transaksi `order` + `OrderItem` (snapshot nama/stasiun/modifier) + `Payment` (PENDING, provider, `expiresAt` 15 menit untuk pembayaran online), update `lastActivityAt` sesi, `orderNumber` `ORD-####` dengan retry `P2002` maks 5×, status awal `CASH`/`EDC_CARD` → `WAITING_CASHIER_APPROVAL`, lainnya `PENDING_PAYMENT` |
| `TODO.md` | `4.1` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`4.2 Integrasi Pembayaran QRIS Dinamis & Tombol Unduh QR`**, ubah menjadi `[/]`.
2. **Buat modul pembayaran `src/lib/payment/`** (tanpa dependency baru):
   * `types.ts`: `QrisPayload { qrString: string; expiresAt: Date; providerRef?: string }`, `PaymentConfigError`.
   * `qris.ts`: generator **EMVCo QRIS dinamis** murni — `crc16Ccitt(payload)` (poligon `0x1021`, init `0xFFFF`), `buildDynamicQris({ staticPayload, amount, merchantRef })` → ganti tag `54` (transaction amount) & `62` (additional data) pada payload statis, hitung ulang tag `63` (CRC). **Unit test wajib**: vector CRC yang diketahui (`"123456789"` → `0x31C3`), payload hasil punya tag 54 & 63 valid, panjang & format TLV benar.
   * `midtrans.ts`: adapter `createQrisTransaction(order)` memakai `MIDTRANS_SERVER_KEY` + `fetch` ke `https://api.midtrans.com/v2/charge` (sandbox: `api.sandbox.midtrans.com`); bila kunci kosong → lempar `PaymentConfigError` sehingga route memakai **mode demo** (`buildDynamicQris` dengan `QRIS_STATIC_PAYLOAD` dari env atau payload contoh).
   * Tambahkan `QRIS_STATIC_PAYLOAD` & `MIDTRANS_IS_PRODUCTION` ke `.env.example` + `src/lib/env.ts` (opsional, jangan wajib).
3. **Buat `POST /api/orders/[orderNumber]/payment/qris`** (`force-dynamic`): cari order via `orderNumber` (select `id, status, grandTotal, uniqueCode`), tolak bila status bukan `PENDING_PAYMENT` (409), ambil/generate `Payment` metode `QRIS_DYNAMIC` (idempoten: pakai `Payment` PENDING terakhir bila belum kedaluwarsa), panggil adapter, simpan `gatewayRefId`/`gatewayPayload`, respons `{ data: { orderNumber, amount, qrString, expiresAt, mode: "gateway" | "demo" } }`. **Jangan** log `MIDTRANS_SERVER_KEY`/payload sensitif.
4. **Buat halaman tunggu pembayaran `src/app/(customer)/t/[tableSlug]/pay/[orderNumber]/page.tsx`** (server component + client countdown):
   * Tampilkan nomor pesanan, total (`tabular-nums`), **countdown** sampai `expiresAt` (client component, `setInterval`, berhenti di 0 lalu tampilkan tombol "Buat ulang QR"), tombol **"Simpan QRIS"** dan "Salin kode QR".
   * **Render QR**: BELUM boleh menambah package QR tanpa izin pengguna. Gunakan **sementara** `<img src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=<encodeURIComponent(qrString)>">` (beri komentar `TODO(4.2): ganti ke encoder lokal setelah izin package qrcode`), plus `<textarea readOnly>` berisi `qrString` sebagai fallback. Tombol simpan memakai `fetch(qrUrl) → blob → <a download>` dengan penanganan CORS gagal (tampilkan pesan "tekan lama pada gambar untuk menyimpan").
   * Polling status ringan: `GET /api/orders/[orderNumber]/payment/status` (buat sekalian) yang mengembalikan `{ status, paidAt }`; halaman berhenti polling setelah `PAID`.
5. **Sambungkan CTA**: `CartSheet` "Lanjut ke Pembayaran" — setelah 4.1 ada, aktifkan: kirim `POST /api/orders` (body dari `useCartStore`: `orderType`, `tableSlug`, `items[{menuItemId,quantity,modifierOptionIds,note}]`, `paymentMethod`), lalu `router.push` ke halaman pembayaran sesuai metode (QRIS dulu). `modifierOptionIds` diambil dari `line.modifiers[].id` (format `groupId:optionId` → ambil bagian `optionId`).
6. **Verifikasi**: `npm test` (CRC & payload), `typecheck`, `lint`, `build`, probe HTTP (order tidak ada → 404, body tanpa `orderNumber` → 400, tanpa DB → 500 rapi).
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `4.3 Transfer Bank: VA & Transfer Manual Kode Unik`), `git commit` (`feat(payment): add dynamic qris generation and payment waiting page`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **QRIS tanpa kredensial**: mode `demo` memakai payload statis + generator EMVCo lokal. Jangan pernah mengklaim pembayaran nyata sudah teruji; webhook asli baru di 4.5.
* **Package QR**: `qrcode` / `react-qr-code` BELUM diizinkan. Minta izin pengguna bila ingin render QR lokal (image service sementara di atas sudah cukup untuk MVP).
* **JANGAN percaya harga klien**: `POST /api/orders` sudah menolak field asing (strict Zod) dan menghitung ulang dengan `buildOrderDraft()`. Pertahankan pola ini di endpoint pembayaran (hanya butuh `orderNumber`).
* **Status order**: `CASH`/`EDC_CARD` → `WAITING_CASHIER_APPROVAL`; `QRIS_DYNAMIC`/`VIRTUAL_ACCOUNT`/`MANUAL_TRANSFER` → `PENDING_PAYMENT`.
* **Order number**: `ORD-0001` berurutan dari `count()+1` dengan retry `P2002` (5×). Bila nanti volume tinggi, pertimbangkan sequence PostgreSQL (butuh migrasi).
* **Urutan kalkulasi (WAJIB)**: subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (khusus `MANUAL_TRANSFER`), semuanya di `src/lib/pricing.ts`.
* **BUG SSR ZUSTAND (jangan diulang)**: `persist` tidak memasang `store.persist` saat storage tidak tersedia → guard `const persistApi = useCartStore.persist; if (!persistApi) {...}`.
* **Sinkronisasi keranjang**: hanya lintas tab/origin sama (`BroadcastChannel`); multi-device butuh Supabase Realtime.
* **Rahasia**: `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`, `MIDTRANS_SERVER_KEY` — jangan pernah ke klien/log.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; urutan validasi env → slug/query → body → DB.
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
* **[Sesi #1 — 2026-11-03 · 3.6 Cart Sheet & Upselling]**: `upsell.ts` (+9), `cart-totals.ts` (+6), data pemesan di store (+2), `FloatingCartBar` + `CartSheet`. Fase 3 tuntas. Commit `6f551dc`.
* **[Sesi #1 — 2026-11-03 · 4.1 API Orders]**: `order-draft.ts` (+18 test) + `POST /api/orders` (recompute server, transaksi order+payment, orderNumber retry, status awal sesuai metode). 150 test lulus; kontrak HTTP divalidasi (menolak field `price` dari klien). Commit menyusul.
