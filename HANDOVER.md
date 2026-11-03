# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 5 — Halaman Kasir (POS Dashboard)` (2/9 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `5.2 Tab Antrean QR & Validasi Bayar` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `5.3 Kalkulator Pembayaran Tunai & Eksekusi Lunas (CashPaymentModal)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**246 test**, 80 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `GET /api/orders/[orderNumber]/bill`, `POST /api/orders/[orderNumber]/cashier-confirm` (ƒ).
* **Verifikasi kontrak HTTP**: bill orderNumber invalid → 400, valid → 500 rapi; confirm invalid order → 400, `action` asing (`REFUND`) → 422, valid → 500 rapi; `/cashier` tetap **200**.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 23 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/pricing.ts` | **Diperbarui** — `calculateCashChange(amountReceived, total)` (kembalian, `PricingError` bila kurang/bukan Rupiah bulat) |
| `src/lib/pricing.test.ts` | Ditambah 4 test `calculateCashChange` |
| `src/types/pos.ts` | Ditambah `PosBillModifier`, `PosBillItem`, `PosBillPayment`, `PosBillTotals`, `PosBillDetail` |
| `src/app/api/orders/[orderNumber]/bill/route.ts` | **Baru** — detail tagihan POS (item + modifier + catatan, total, payment terakhir termasuk `proofImageUrl`), tanpa `costPrice` |
| `src/app/api/orders/[orderNumber]/cashier-confirm/route.ts` | **Baru** — `MARK_PAID` (tunai: hitung kembalian; transfer manual wajib bukti → 409; idempoten bila sudah PAID) & `REJECT` (payment FAILED + order CANCELLED); `TODO(RBAC)` |
| `src/components/pos/PosBillPanel.tsx` | **Ditulis ulang** — client component: fetch `/bill`, daftar item + modifier + catatan, rincian biaya, badge metode/status, tautan bukti transfer, input uang diterima + pecahan cepat + pratinjau kembalian, tombol **Konfirmasi Lunas** & **Tolak** (konfirmasi 2 langkah), lalu `router.refresh()` |
| `TODO.md` | `5.2` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`5.3 Kalkulator Pembayaran Tunai & Eksekusi Lunas (CashPaymentModal)`**, ubah menjadi `[/]`.
2. **Buat `src/components/ui/modal.tsx`** (client, tanpa dependency baru): modal terpusat memakai `createPortal` + Framer Motion (fade/scale), tutup via backdrop & Esc, `role="dialog" aria-modal`, kunci scroll body, fokus awal. Bedakan dari `bottom-sheet.tsx` (khusus mobile pelanggan).
3. **Buat `src/lib/cash.ts`** (pure + `src/lib/cash.test.ts`):
   * `CASH_DENOMINATIONS = [20000, 50000, 100000]` (plus opsi "Uang Pas").
   * `getCashShortcuts(total)` → daftar nominal unik & terurut yang `>= total` (selalu menyertakan `total` sebagai "Uang Pas"; buang pecahan yang lebih kecil).
   * `parseCashInput(value)` → angka Rupiah dari string (strip non-digit, maks 9 digit) & `formatCashInput`.
   * Uji: total 87.780 → shortcut `[87780, 100000]` (50k & 20k dibuang), total 120.000 → `[120000]`, input non-digit, batas digit.
4. **Buat `src/components/pos/CashPaymentModal.tsx`**:
   * Props `{ open, onOpenChange, orderNumber, total, onPaid }`.
   * Tampilkan total besar (`tabular-nums`), input uang diterima (read-only hasil keypad), **keypad numerik** 3×4 dengan tombol 56px (`1-9`, `00`, `0`, backspace), chip `getCashShortcuts(total)`, dan kembalian reaktif (`calculateCashChange`; tampilkan pesan merah bila kurang).
   * Tombol utama **"Bayar & Lunas"** (min 56px) memanggil `POST /api/orders/[orderNumber]/cashier-confirm { action: "MARK_PAID", amountReceived }`; saat sukses panggil `onPaid(changeAmount)`, tutup modal, dan tampilkan toast/inline "Kembalian Rp …".
   * Tangani 409 (bukti transfer belum ada), 422 (uang kurang), 500 (server) dengan pesan jelas.
5. **Integasikan ke `PosBillPanel`**: ganti input uang diterima inline dengan tombol **"Bayar Tunai"** (56px) yang membuka `CashPaymentModal` untuk metode `CASH`; pertahankan tombol Konfirmasi Lunas untuk metode non-tunai. Setelah `onPaid`, muat ulang bill + `router.refresh()`.
6. **Verifikasi**: `npm test` (cash), `typecheck`, `lint`, `build`; probe `/cashier` 200 dan endpoint confirm tetap 400/422 sesuai kontrak.
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `5.4 InteractiveFloorPlan`), `git commit` (`feat(pos): add cash payment modal with numeric keypad and change calculation`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Autentikasi staf (RBAC) belum ada** — endpoint kasir belum terlindungi; sudah ditandai `TODO(RBAC)`. Jangan menulis klaim keamanan.
* **Status pembayaran**: `MARK_PAID` → payment `PAID` + order `CONFIRMED` (masuk dapur). `REJECT` → payment `FAILED` + order `CANCELLED`. Transfer manual wajib punya `proofImageUrl`.
* **Kembalian** hanya dihitung untuk metode `CASH`; `amountPaid` diisi uang diterima, `changeAmount` selisihnya.
* **POS/KDS** memakai `.dark`, target sentuh 56px, angka `tabular-nums`, `h-dvh overflow-hidden` per panel.
* **Suara notifikasi** via Web Audio (tanpa file), aktif setelah toggle (kebijakan autoplay).
* **E-Struk PDF** memakai `window.print()`; PDF server-side belum diizinkan.
* **Mode demo pembayaran**: QRIS/VA lokal; bukti transfer di `public/uploads/proofs`; webhook tanpa signature hanya bila `PAYMENT_ALLOW_UNSIGNED_WEBHOOK=true`.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`.
* **Harga**: server selalu menghitung ulang (`buildOrderDraft`); urutan subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (khusus `MANUAL_TRANSFER`).
* **BUG SSR ZUSTAND (jangan diulang)**: `persist` tidak memasang `store.persist` saat storage tidak tersedia → guard `const persistApi = useCartStore.persist; if (!persistApi) {...}`.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`.
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
* **[Sesi #1 — 2026-11-03 · 4.3 Transfer Bank]**: `va.ts` (+9), `manual-transfer.ts` (+11), API VA/manual/proof, panel VA & manual. Commit `f1cdf07`.
* **[Sesi #1 — 2026-11-03 · 4.4 Tunai di Kasir]**: `code39.ts` (+12), `pin-attempts.ts` (+7), API PIN meja, `BookingCodeCard`, `CashierPaymentPanel`. Commit `a20adae`.
* **[Sesi #1 — 2026-11-03 · 4.5 Webhook]**: `payment/webhook.ts` (+18 test), route webhook idempoten. Commit `b6901ef`.
* **[Sesi #1 — 2026-11-03 · 4.6 Tracker & E-Struk]**: `order-tracking.ts` (+14 test), API `track`, `OrderTracker`, e-struk 80 mm. Commit `02f7877`.
* **[Sesi #1 — 2026-11-03 · 5.1 POS 3-Panel]**: `notification.ts` (+4 test), `useNotificationSound`, komponen POS, layout dark, `/cashier`. Commit `165f938`.
* **[Sesi #1 — 2026-11-03 · 5.2 Validasi Bayar]**: `calculateCashChange` (+4 test), API `bill` & `cashier-confirm`, `PosBillPanel` interaktif (detail tagihan, bukti transfer, input tunai, konfirmasi/tolak). 246 test lulus; probe 400/422/500 rapi; `/cashier` 200. Commit menyusul.
