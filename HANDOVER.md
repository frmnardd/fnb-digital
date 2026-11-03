# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 4 — Sistem Pembayaran` (2/6 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `4.2 Integrasi Pembayaran QRIS Dinamis & Tombol Unduh QR` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `4.3 Integrasi Pembayaran Transfer Bank (Virtual Account & Transfer Manual Kode Unik)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**166 test**, 53 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route aktif**: `/api/menu`, `/api/orders`, `/api/orders/[orderNumber]/payment/qris`, `/api/orders/[orderNumber]/payment/status`, `/api/tables/[qrSlug]/session`, `/api/tables/[qrSlug]/call-waiter`, `/t/[tableSlug]`, `/t/[tableSlug]/pay/[orderNumber]` (semua ƒ).
* **Verifikasi kontrak HTTP** (tanpa DB): `POST qris` orderNumber invalid → 400, `GET status` invalid → 400, keduanya valid → 500 berformat benar; halaman bayar → **HTTP 200** (fallback "Sistem belum siap").
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 17 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/payment/types.ts` | **Baru** — `QrisInstruction`, `PaymentConfigError`, `PaymentGatewayError` |
| `src/lib/payment/qris.ts` | **Baru** — EMVCo TLV (`encodeTlv`/`parseTlv`), `crc16Ccitt` (CCITT-FALSE, vector `29B1`), `buildStaticQris`, `buildDynamicQris` (tag 54 nominal, tag 01 = 12, ref label 62/05, CRC 63), `validateQrisPayload`, `createDemoStaticPayload` |
| `src/lib/payment/qris.test.ts` | **Baru** — 16 test (CRC vector, TLV round-trip, payload valid, nominal & reference, regenerate, tombol error, tidak memutasi input) |
| `src/lib/payment/midtrans.ts` | **Baru** — `createQrisCharge()` via `fetch` (sandbox/production, Basic auth, timeout 15 dtk, ekstraksi `qr_string`/`actions[generate-qr-code]`) |
| `src/app/api/orders/[orderNumber]/payment/qris/route.ts` | **Baru** — idempoten (pakai `Payment` PENDING yang belum kedaluwarsa), mode `gateway` atau `demo` (fallback `PaymentConfigError`), simpan `gatewayPayload { qrString, qrUrl, mode }`, TTL 15 menit |
| `src/app/api/orders/[orderNumber]/payment/status/route.ts` | **Baru** — status order + payment terakhir untuk polling |
| `src/components/customer/PaymentQrisPanel.tsx` | **Baru** — ambil QR dari API, hitung mundur, polling 5 dtk, tombol Simpan (fetch→blob→download) & Salin, fallback `<textarea>` payload, badge "QR kedaluwarsa" + Buat ulang, catatan mode demo |
| `src/app/(customer)/t/[tableSlug]/pay/[orderNumber]/page.tsx` | **Baru** — server component ringkasan order + `PaymentQrisPanel`, fallback 200 saat DB belum siap |
| `src/components/customer/CartSheet.tsx` | **Diperbarui** — `tableSlug` prop, `handleCheckout()` (POST `/api/orders` dengan `modifierOptionIds` hasil split `groupId:optionId`, nama/WA opsional), lalu `clear()` + `router.push` ke halaman bayar |
| `src/components/customer/FloatingCartBar.tsx` | Diperbarui — meneruskan `tableSlug` ke `CartSheet` |
| `src/lib/env.ts`, `.env.example` | Ditambah `MIDTRANS_SERVER_KEY`, `MIDTRANS_IS_PRODUCTION`, `QRIS_STATIC_PAYLOAD` (opsional) |
| `TODO.md` | `4.2` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`4.3 Integrasi Pembayaran Transfer Bank (Virtual Account & Transfer Manual Kode Unik)`**, ubah menjadi `[/]`.
2. **Pemilihan metode pembayaran harus terjadi SEBELUM order dibuat** (karena `Payment.method` disimpan saat create):
   * Tambahkan selector metode di `CartSheet` (radio list ≥ 48px): `QRIS_DYNAMIC`, `VIRTUAL_ACCOUNT`, `MANUAL_TRANSFER`, `CASH` (Bayar di Kasir). Simpan pilihan sebagai state lokal sheet (default QRIS) lalu kirim ke `POST /api/orders`.
   * Setelah sukses, arahkan sesuai metode: QRIS → `/t/[slug]/pay/[orderNumber]/qris`, VA → `.../va`, MANUAL_TRANSFER → `.../manual`, CASH → (4.4) `.../cashier`.
   * **Pindahkan** halaman QRIS: buat `pay/[orderNumber]/qris/page.tsx` berisi `PaymentQrisPanel` (pindahkan dari `pay/[orderNumber]/page.tsx`), dan jadikan `pay/[orderNumber]/page.tsx` sebagai **hub pemilihan metode** (menampilkan ringkasan order + 3–4 tombol metode; jangan membuat order baru di hub).
3. **Virtual Account** (`src/lib/payment/va.ts` + test):
   * `BANK_OPTIONS` (BCA, Mandiri, BNI, BRI) dengan kode & label.
   * `buildVirtualAccount({ bank, orderNumber, amount })` → nomor VA demo deterministik (mis. `8808` + 10 digit dari hash orderNumber) + `expiresAt`; validator `isValidBank(bank)`.
   * Route `POST /api/orders/[orderNumber]/payment/va` (body Zod `{ bank }`): validasi order `PENDING_PAYMENT`, idempoten terhadap `Payment` VA PENDING yang valid, simpan `gatewayPayload { bank, vaNumber }`, respons `{ bank, vaNumber, amount, expiresAt, mode }`.
   * Halaman `pay/[orderNumber]/va/page.tsx` + client: daftar bank, tampilkan nomor VA besar (`tabular-nums`), tombol **Salin VA** (clipboard + fallback), hitung mundur, polling status.
4. **Transfer Manual** (`src/lib/payment/manual-transfer.ts` + test):
   * `MANUAL_TRANSFER` memakai `order.grandTotal` yang SUDAH memuat `uniqueCode` 3 digit (dihitung di 4.1) — jangan menghitung ulang.
   * `formatTransferInstruction({ bankAccounts, amount, uniqueCode, orderNumber })` + `validateProofDescriptor({ fileName, size, mimeType })` (maks 2 MB, `image/jpeg|png|webp|application/pdf`).
   * Route `POST /api/orders/[orderNumber]/payment/manual` (info rekening + nominal + instruksi) dan `POST /api/orders/[orderNumber]/payment/proof` (**multipart** `request.formData()`): validasi file, simpan ke `public/uploads/proofs/<orderNumber>-<timestamp>.<ext>` (buat folder bila belum ada; `/public/uploads` sudah di-`.gitignore`), update `Payment.proofImageUrl` + tetap `PENDING` (validasi manual oleh kasir di 5.2), respons `{ proofImageUrl }`.
   * Halaman `pay/[orderNumber]/manual/page.tsx` + client: nominal + kode unik, daftar rekening (copy), form upload bukti (preview, progress), status "menunggu verifikasi kasir", polling status.
5. **Verifikasi**: `npm test` (va/manual helper), `typecheck`, `lint`, `build`, probe HTTP (body `bank` invalid → 422, orderNumber invalid → 400, tanpa DB → 500 rapi; upload tanpa file → 422).
6. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `4.4 Alur Pembayaran Tunai di Kasir`), `git commit` (`feat(payment): add virtual account and manual transfer flows`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **QRIS mode demo**: tanpa `MIDTRANS_SERVER_KEY`, payload dibuat lokal (`buildDynamicQris`) dari `QRIS_STATIC_PAYLOAD` / `createDemoStaticPayload()`. Pembayaran nyata belum teruji — jangan klaim lunas otomatis (itu tugas webhook 4.5).
* **Gambar QR**: encoder QR lokal BELUM diizinkan (butuh izin package `qrcode`). Sementara memakai `api.qrserver.com` + fallback teks. Ada `TODO(4.2)` di `PaymentQrisPanel`.
* **Download QR**: `fetch → blob → <a download>`; bila CORS gagal tampilkan instruksi tekan-lama.
* **`Payment.gatewayRefId` unik** — mode demo memakai `demo-<orderNumber>-<timestamp>`.
* **Harga**: server selalu menghitung ulang (`buildOrderDraft`) dan Zod strict menolak field `price` dari klien.
* **Urutan kalkulasi (WAJIB)**: subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (khusus `MANUAL_TRANSFER`).
* **BUG SSR ZUSTAND (jangan diulang)**: `persist` tidak memasang `store.persist` saat storage tidak tersedia → guard `const persistApi = useCartStore.persist; if (!persistApi) {...}`.
* **Sinkronisasi keranjang**: lintas tab/origin sama (`BroadcastChannel`); multi-device butuh Supabase Realtime.
* **Rahasia**: `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`, `MIDTRANS_SERVER_KEY` — jangan ke klien/log.
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
* **[Sesi #1 — 2026-11-03 · 4.2 QRIS]**: `payment/qris.ts` (+16 test, EMVCo CRC), adapter Midtrans, API qris & status, `PaymentQrisPanel` + halaman bayar, CTA keranjang → order → halaman bayar. 166 test lulus; probe HTTP & halaman bayar 200. Commit menyusul.
