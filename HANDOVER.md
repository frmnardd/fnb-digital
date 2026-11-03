# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 4 — Sistem Pembayaran` (3/6 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `4.3 Integrasi Transfer Bank (VA & Transfer Manual)` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `4.4 Alur Pembayaran Tunai di Kasir (Pay at Cashier)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**186 test**, 60 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `/api/orders/[orderNumber]/payment/va`, `.../manual`, `.../proof`; halaman `/pay/[orderNumber]` (hub), `/pay/[orderNumber]/qris`, `.../va`, `.../manual` (semua ƒ).
* **Verifikasi kontrak HTTP** (tanpa DB): VA orderNumber invalid → 400, bank invalid (`CIMB`) → 422 (daftar bank disebut di pesan), VA/manual valid → 500 rapi, proof non-multipart → 400; keempat halaman pembayaran → **HTTP 200**.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 18 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/payment/va.ts` | **Baru** — `BANK_CODES`/`BANK_OPTIONS` (BCA/Mandiri/BNI/BRI), `isValidBank`, `getBankLabel`, `buildVirtualAccount` (12 digit deterministik, prefix per bank) |
| `src/lib/payment/va.test.ts` | **Baru** — 9 test (daftar bank, validasi kode, prefix, determinisme, beda bank/pesanan, nomor tanpa digit) |
| `src/lib/payment/manual-transfer.ts` | **Baru** — `MANUAL_TRANSFER_ACCOUNTS`, `buildTransferInstruction`, `validateProofDescriptor` (MIME JPG/PNG/WEBP/PDF & maks 2 MB), `buildProofFileName` (ekstensi dari MIME, anti path traversal), `buildProofPublicUrl` |
| `src/lib/payment/manual-transfer.test.ts` | **Baru** — 11 test |
| `src/app/api/orders/[orderNumber]/payment/va/route.ts` | **Baru** — POST `{ bank }`, idempoten per bank, simpan `gatewayPayload { bank, vaNumber }`, TTL 15 menit |
| `src/app/api/orders/[orderNumber]/payment/manual/route.ts` | **Baru** — POST instruksi transfer (rekening + nominal termasuk kode unik), TTL 24 jam |
| `src/app/api/orders/[orderNumber]/payment/proof/route.ts` | **Baru** — POST multipart `proof`, validasi metadata, simpan ke `public/uploads/proofs`, update `Payment.proofImageUrl` |
| `src/components/customer/VirtualAccountPanel.tsx` | **Baru** — pemilih bank, nomor VA besar, salin, hitung mundur, polling status |
| `src/components/customer/ManualTransferPanel.tsx` | **Baru** — nominal + kode unik, rekening + salin, upload bukti (validasi & preview), polling status |
| `src/components/customer/CartSheet.tsx` | **Diperbarui** — pemilih metode (QRIS / Transfer VA / Transfer Manual / Bayar di Kasir) sebelum order dibuat + redirect per metode |
| `src/app/(customer)/t/[tableSlug]/pay/[orderNumber]/page.tsx` | **Ditulis ulang** — kini **hub** pemilihan metode (atau kartu "Bayar di Kasir" berisi kode booking bila metode cash) |
| `.../pay/[orderNumber]/qris/page.tsx` | **Baru** — halaman QRIS (dipindah dari hub) |
| `.../pay/[orderNumber]/va/page.tsx`, `.../manual/page.tsx` | **Baru** — halaman VA & transfer manual |
| `TODO.md` | `4.3` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`4.4 Alur Pembayaran Tunai di Kasir (Pay at Cashier)`**, ubah menjadi `[/]`.
2. **Buat `src/lib/barcode/code39.ts`** (pure, tanpa dependency) + `src/lib/barcode/code39.test.ts`:
   * Tabel pola Code 39 (`0-9`, `A-Z`, `-`, `.`, ` `, `$`, `/`, `+`, `%`, start/stop `*`) dengan 9 elemen (bar/space) per karakter.
   * `encodeCode39(text)` → string biner `1/0` (bar/space) siap digambar; `isEncodableCode39(text)`; normalisasi huruf besar.
   * Uji: pola start/stop `*`, panjang keluaran, karakter tak didukung ditolak, huruf kecil dinormalisasi.
3. **Buat `src/components/customer/BookingCodeCard.tsx`** (`"use client"` bila perlu):
   * Kode booking = `orderNumber` ditampilkan besar (`tabular-nums`, `tracking-widest`), tombol **Salin Kode**.
   * **Barcode SVG** dari `encodeCode39(orderNumber)` — render `<rect>` per bar dengan proporsi bar lebar/sempit (mis. 3:1), tinggi 72px, `role="img"` + `aria-label`.
4. **Buat `src/lib/security/pin-attempts.ts`** (in-memory dengan TTL, cukup untuk single-instance) + test:
   * `registerPinAttempt(key)`, `isPinLocked(key)`, `resetPinAttempts(key)` — maks **5 percobaan / 10 menit** per kunci (`orderNumber` + IP/`x-forwarded-for`). Catat batasan multi-instance di komentar.
5. **Buat `POST /api/orders/[orderNumber]/pin`** (`force-dynamic`):
   * Body Zod strict `{ pin: string regex ^\d{4}$ }`.
   * Cari order (`select` id, status, tableSessionId) → harus `WAITING_CASHIER_APPROVAL` (409 bila bukan).
   * Ambil `Table.currentPin` lewat `TableSession.tableId`; bila `pinEnabled` false atau `currentPin` null → 409 "PIN meja tidak diaktifkan".
   * Verifikasi dengan `verifyPin()` dari `src/lib/security/pin.ts`; bila gagal → 401 + `details.remainingAttempts`; bila percobaan habis → 429 + `Retry-After`.
   * Sukses → transaksi: `order.status = CONFIRMED`, `confirmedAt = now`, `tableSession.lastActivityAt = now` (payment tunai tetap `PENDING` sampai kasir menerima uang di 5.2). Jangan set `PAID`.
   * Respons `{ data: { orderNumber, status, next: "WAITING_CASHIER_PAYMENT" } }`.
6. **Buat halaman `.../pay/[orderNumber]/cashier/page.tsx` + `CashierPaymentPanel`** (client):
   * Tampilkan `BookingCodeCard`, nominal, instruksi "Tunjukkan kode ini ke kasir".
   * Bila `pinEnabled`: form 4 kotak PIN (auto-focus, `inputMode="numeric"`), tombol "Konfirmasi PIN", pesan error & sisa percobaan, sukses → status berubah CONFIRMED (tampilkan "Menunggu kasir menerima pembayaran").
   * Polling `payment/status` setiap 5 dtk; bila `PAID` tampilkan sukses. Sediakan tombol "Panggil Pelayan" (reuse `CallWaiterSheet` tidak wajib).
7. **Verifikasi**: `npm test` (code39, pin-attempts), `typecheck`, `lint`, `build`, probe HTTP: body PIN bukan 4 digit → 422, order tidak ada → 404, tanpa DB → 500 rapi; halaman cashier → 200.
8. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `4.5 Webhook Payment Gateway`), `git commit` (`feat(payment): add cash-at-cashier flow with table pin and barcode`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Metode pembayaran dipilih SEBELUM order dibuat** (di `CartSheet`), lalu redirect: QRIS → `/qris`, VA → `/va`, Manual → `/manual`, Cash → hub `/pay/[orderNumber]` (kartu kode booking).
* **Hub tidak membuat order baru** — hanya menampilkan metode & tautan.
* **Bukti transfer** disimpan di `public/uploads/proofs` (folder gitignored). Di platform read-only (Vercel) ganti ke object storage; kontrak respons sama.
* **Nomor VA & QRIS saat ini mode demo** (lokal). Gateway asli butuh `MIDTRANS_SERVER_KEY` / rekening merchant asli.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash` — jangan ke klien/log.
* **`Payment.gatewayRefId` unik**; demo memakai prefix `demo-`/`va-`/`manual-` + timestamp.
* **Harga**: server selalu menghitung ulang (`buildOrderDraft`); Zod strict menolak field harga dari klien.
* **Urutan kalkulasi (WAJIB)**: subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (khusus `MANUAL_TRANSFER`).
* **BUG SSR ZUSTAND (jangan diulang)**: `persist` tidak memasang `store.persist` saat storage tidak tersedia → guard `const persistApi = useCartStore.persist; if (!persistApi) {...}`.
* **Sinkronisasi keranjang**: lintas tab/origin sama (`BroadcastChannel`); multi-device butuh Supabase Realtime.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; urutan validasi env → slug/param → body → DB.
* **Seed**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234` (hash HMAC); staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`.
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
* **[Sesi #1 — 2026-11-03 · 4.2 QRIS]**: `payment/qris.ts` (+16 test), adapter Midtrans, API qris & status, `PaymentQrisPanel`, halaman bayar, CTA keranjang. Commit `a213e7e`.
* **[Sesi #1 — 2026-11-03 · 4.3 Transfer Bank]**: `va.ts` (+9 test), `manual-transfer.ts` (+11 test), API VA/manual/proof (upload 2 MB), panel VA & manual, hub pemilihan metode + pemilih metode di keranjang. 186 test lulus; probe HTTP & 4 halaman pembayaran 200. Commit menyusul.
