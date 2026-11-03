# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 5 — Halaman Kasir (POS Dashboard)` (1/9 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `5.1 Layout Utama POS 3-Panel & Notifikasi Suara` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `5.2 Tab Antrean QR & Validasi Bayar Tunai/Bukti Transfer`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**242 test**, 79 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `/cashier` (ƒ) dengan route group `(pos)` bertema `.dark`.
* **Verifikasi runtime**: `GET /cashier` → **HTTP 200**; HTML memuat "Antrean Pesanan", "Pilih pesanan", "Shift belum dibuka", "Belum ada pesanan masuk", kelas `dark`.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 22 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/audio/notification.ts` | **Baru** — nada notifikasi via Web Audio (`new-order`, `waiter-call`), `unlockAudioContext()`, `playNotificationTone()` (graceful `false` tanpa browser), `resetNotificationAudio()` |
| `src/lib/audio/notification.test.ts` | **Baru** — 4 test perilaku aman di Node (tanpa AudioContext) |
| `src/hooks/useNotificationSound.ts` | **Baru** — preferensi suara di `localStorage` (`fnb-pos-sound-enabled`), `enable`/`disable`/`play` |
| `src/types/pos.ts` | **Baru** — `PosQueueOrder`, `PosOrderStatus` |
| `src/components/pos/PosSidebar.tsx` | **Baru** — 5 ikon nav 76px; item belum tersedia dinonaktifkan + label "Soon" pada `title` |
| `src/components/pos/PosTopbar.tsx` | **Baru** — nama kasir, status shift, jam WIB (render setelah mount, anti hydration mismatch), toggle suara 56px |
| `src/components/pos/PosQueueCard.tsx` | **Baru** — nomor, meja/tipe, badge status berwarna, jam masuk, jumlah item, total `tabular-nums` |
| `src/components/pos/PosQueueList.tsx` | **Baru** — daftar + empty state "Belum ada pesanan masuk" |
| `src/components/pos/PosBillPanel.tsx` | **Baru** — ringkasan pesanan terpilih / empty state "Pilih pesanan" |
| `src/components/pos/CashierWorkspace.tsx` | **Baru** — komposisi 3 panel (sidebar | antrean | detail 380px), state pemilihan |
| `src/app/(pos)/layout.tsx` | **Baru** — `dark h-dvh overflow-hidden` (Slate Dark) |
| `src/app/(pos)/cashier/page.tsx` | **Baru** — server component memuat antrean (`PENDING_PAYMENT`/`WAITING_CASHIER_APPROVAL`/`CONFIRMED`, maks 50), fallback `[]` saat DB gagal |
| `TODO.md` | `5.1` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`5.2 Tab Antrean QR & Validasi Bayar Tunai/Bukti Transfer`**, ubah menjadi `[/]`.
2. **Tambahkan helper harga** di `src/lib/pricing.ts` + test: `calculateCashChange(amountReceived, total)` → kembalian (≥0) dan `PricingError` bila `amountReceived < total` atau bukan bilangan bulat.
3. **Buat `GET /api/orders/[orderNumber]/bill`** (atau `GET /api/pos/orders/[orderNumber]`): detail pesanan untuk panel kanan — order (nomor, status, tipe, meja, totals), items (nama, qty, unitPrice, modifier JSON, catatan, status), dan payment terakhir (method, status, `proofImageUrl`, `amountPaid`, `changeAmount`). Jangan kirim `costPrice`.
4. **Buat `POST /api/orders/[orderNumber]/cashier-confirm`**:
   * Body Zod strict: `{ action: "MARK_PAID" | "REJECT", amountReceived?: number, note?: string }`.
   * `MARK_PAID`: ambil `Payment` PENDING terakhir; bila metode `CASH` dan `amountReceived` dikirim → hitung `changeAmount` via `calculateCashChange` (422 bila kurang); set `payment.status = PAID`, `paidAt`; `order.status = CONFIRMED` + `confirmedAt` (bila masih `PENDING_PAYMENT`/`WAITING_CASHIER_APPROVAL`); bump `tableSession.lastActivityAt`. Untuk `MANUAL_TRANSFER` wajib ada `proofImageUrl` (409 bila belum upload).
   * `REJECT`: set `payment.status = FAILED`; `order.status = CANCELLED` + `cancelledAt`.
   * Idempoten: bila payment sudah `PAID` → 200 `{ duplicate: true }`.
   * **Belum ada autentikasi staf** di proyek ini: beri komentar `// TODO(RBAC): lindungi endpoint ini setelah modul auth staf dibuat` dan catat di HANDOVER. Jangan mengklaim endpoint aman.
5. **UI**:
   * Perluas `PosBillPanel`: muat `/bill` saat pesanan dipilih (client fetch, state loading/error), tampilkan item + modifier + catatan, badge metode pembayaran, dan `proofImageUrl` sebagai thumbnail yang bisa diklik (buka tab baru) untuk `MANUAL_TRANSFER`.
   * Tombol aksi 56px: **Konfirmasi Lunas** (primary), **Tolak** (destructive + konfirmasi), serta input `amountReceived` untuk metode CASH dengan tombol pecahan cepat (`Uang Pas`, 50.000, 100.000) — kalkulator lengkap dikerjakan di 5.3, jadi cukup input sederhana + teks kembalian.
   * Setelah sukses: `router.refresh()` agar antrean server component ter-update.
6. **Verifikasi**: `npm test` (calculateCashChange), `typecheck`, `lint`, `build`; probe: `/api/orders/BAD!!/bill` → 400, `/api/orders/BAD!!/cashier-confirm` → 400, body `action` invalid → 422, tanpa DB → 500 rapi; `/cashier` tetap 200.
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `5.3 CashPaymentModal`), `git commit` (`feat(pos): add queue item bill detail and cashier confirmation`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Autentikasi staf belum ada** (RBAC direncanakan menyusul). Endpoint kasir saat ini tanpa proteksi — jangan menulis klaim keamanan; tambahkan `TODO(RBAC)`.
* **POS/KDS memakai tema `.dark`** (Slate Dark) dan target sentuh 56px; angka wajib `tabular-nums`.
* **Halaman POS memakai `h-dvh overflow-hidden`** — jangan menambahkan `sticky` pada body; setiap panel scroll sendiri.
* **Suara notifikasi** dibuat via Web Audio (tanpa file .mp3) dan baru aktif setelah pengguna menekan toggle (kebijakan autoplay browser). Preferensi tersimpan di localStorage.
* **E-Struk PDF** memakai dialog cetak browser (`window.print()`); PDF server-side belum diizinkan.
* **Mode demo pembayaran**: QRIS/VA lokal, bukti transfer di `public/uploads/proofs`; webhook tanpa signature hanya bila `PAYMENT_ALLOW_UNSIGNED_WEBHOOK=true`.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash` — jangan ke klien/log.
* **Harga**: server selalu menghitung ulang (`buildOrderDraft`); Zod strict menolak field harga dari klien. Urutan: subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (khusus `MANUAL_TRANSFER`).
* **BUG SSR ZUSTAND (jangan diulang)**: `persist` tidak memasang `store.persist` saat storage tidak tersedia → guard `const persistApi = useCartStore.persist; if (!persistApi) {...}`.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; urutan validasi env → slug/param → body → DB.
* **Seed**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`.
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
* **[Sesi #1 — 2026-11-03 · 4.2 QRIS]**: `payment/qris.ts` (+16 test), adapter Midtrans, API qris & status, `PaymentQrisPanel`. Commit `a213e7e`.
* **[Sesi #1 — 2026-11-03 · 4.3 Transfer Bank]**: `va.ts` (+9), `manual-transfer.ts` (+11), API VA/manual/proof, panel VA & manual, hub metode. Commit `f1cdf07`.
* **[Sesi #1 — 2026-11-03 · 4.4 Tunai di Kasir]**: `code39.ts` (+12), `pin-attempts.ts` (+7), API PIN meja, `BookingCodeCard`, `CashierPaymentPanel`. Commit `a20adae`.
* **[Sesi #1 — 2026-11-03 · 4.5 Webhook]**: `payment/webhook.ts` (+18 test), route webhook idempoten. Commit `b6901ef`.
* **[Sesi #1 — 2026-11-03 · 4.6 Tracker & E-Struk]**: `order-tracking.ts` (+14 test), API `track`, `OrderTracker`, halaman tracker & e-struk 80 mm + `@media print`. Fase 4 tuntas. Commit `02f7877`.
* **[Sesi #1 — 2026-11-03 · 5.1 POS 3-Panel]**: `audio/notification.ts` (+4 test), `useNotificationSound`, `types/pos.ts`, `PosSidebar`/`PosTopbar`/`PosQueueCard`/`PosQueueList`/`PosBillPanel`/`CashierWorkspace`, layout `(pos)` bertema dark, halaman `/cashier` dengan antrean dari DB + fallback. 242 test lulus; `/cashier` HTTP 200 dengan seluruh teks panel. Commit menyusul.
