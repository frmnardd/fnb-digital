# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 5 — Halaman Kasir (POS Dashboard)` (3/9 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `5.3 Kalkulator Pembayaran Tunai (CashPaymentModal)` ✅
* **Sub-Tugas yang Berikutnya**: `5.4 Peta Meja Interaktif (InteractiveFloorPlan)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**257 test**, 83 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Verifikasi runtime**: `/cashier` → **HTTP 200** (panel "Antrean Pesanan", "Pilih pesanan" tampil; tombol "Bayar Tunai" baru muncul setelah ada pesanan terpilih dari DB).
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 24 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/cash.ts` | **Baru** — `CASH_DENOMINATIONS` (20k/50k/100k), `getCashShortcuts(total)` (uang pas + pecahan ≥ total, unik & terurut), `parseCashInput`/`formatCashInput` (maks 9 digit) |
| `src/lib/cash.test.ts` | **Baru** — 11 test (shortcut, dedup, total tidak valid, parsing, pembatasan digit, format) |
| `src/components/ui/modal.tsx` | **Baru** — modal terpusat via `createPortal` + Framer Motion, Esc/backdrop, kunci scroll, tombol tutup 56px (pelengkap `bottom-sheet` mobile) |
| `src/components/pos/CashPaymentModal.tsx` | **Baru** — total besar, input uang diterima, keypad numerik 56px (`1–9`, `00`, `0`, hapus), chip `getCashShortcuts`, kembalian reaktif, tombol "Bayar & Lunas" memanggil `cashier-confirm` lalu `onPaid(change)` |
| `src/components/pos/PosBillPanel.tsx` | Diperbarui — metode CASH kini memakai tombol **Bayar Tunai** → `CashPaymentModal`; non-tunai tetap "Konfirmasi Lunas" (transfer manual wajib bukti); inline cash input dihapus |
| `TODO.md` | `5.3` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`5.4 Peta Meja Interaktif (InteractiveFloorPlan)`**, ubah menjadi `[/]`.
2. **Buat `src/lib/floor-plan.ts`** (pure + `src/lib/floor-plan.test.ts`):
   * `TABLE_STATUS_META` untuk `AVAILABLE`/`OCCUPIED`/`NEEDS_CLEANING` (label, kelas warna Tailwind, deskripsi).
   * `formatSeatedDuration(openedAt: Date, now: Date)` → "12 mnt", "1 j 05 mnt" (dibulatkan ke bawah, aman untuk durasi negatif → "0 mnt").
   * `getFloorPlanSummary(tables)` → `{ available, occupied, cleaning }`.
   * Uji: meta status, format durasi (0/59/60/65 menit), ringkasan hitungan.
3. **Buat `GET /api/pos/tables`** (`force-dynamic`): kembalikan `areas` + `tables` dengan `status`, `capacity`, `positionX/Y`, dan untuk meja `OCCUPIED`/`BILL_REQUESTED`: sesi aktif (`openedAt`, `guestCount`) dan **total bill berjalan** (`sum grandTotal` order di sesi tersebut yang status belum `CANCELLED`). Gunakan `select` eksplisit; jangan kirim `currentPin`/data internal.
4. **Buat `src/components/pos/InteractiveFloorPlan.tsx`** (client):
   * Tab area (lantai) + grid meja (`grid-cols-3 sm:grid-cols-4 lg:grid-cols-6`), setiap kartu ≥ 88px, `tabular-nums`, warna status (OCCUPIED primary, AVAILABLE secondary, NEEDS_CLEANING warning) + ikon `Users`.
   * Klik meja → panel info (di bawah/kanan): nomor, area, kapasitas, status, durasi duduk (diperbarui tiap 30 dtk), total bill, dan tombol non-aktif untuk aksi 5.5 ("Pindah Meja", "Gabung") dengan label "Soon".
   * Polling ringan `GET /api/pos/tables` tiap 10 dtk; hentikan saat tab tidak aktif (`document.visibilityState`) bila mudah.
5. **Tambahkan halaman `src/app/(pos)/cashier/floor/page.tsx`** (server: muat data via helper yang sama dengan API, fallback `[]` + empty state), dan **aktifkan** item "Meja" pada `PosSidebar` (`available: true`, tautan `/cashier/floor`) — klik harus menavigasi (`usePathname` untuk menandai aktif, atau kirim prop `active` dari masing-masing halaman).
6. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`, probe `GET /cashier/floor` → **200** dan `GET /api/pos/tables` tanpa DB → 500 rapi.
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `5.5 Split Bill, Gabung Tagihan, & Pindah Meja`), `git commit` (`feat(pos): add interactive floor plan with live table status`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Autentikasi staf (RBAC) belum ada** — endpoint kasir belum terlindungi (`TODO(RBAC)`); jangan menulis klaim keamanan.
* **Pembayaran tunai**: dihitung & dieksekusi lewat `CashPaymentModal` → `POST /cashier-confirm` (`amountReceived`), kembalian dari `calculateCashChange`.
* **Perhitungan uang**: `src/lib/cash.ts` (shortcut & parsing) + `src/lib/pricing.ts` (`calculateCashChange`, `formatRupiah`). Jangan menulis ulang.
* **POS/KDS** memakai `.dark`, target sentuh 56px, angka `tabular-nums`, `h-dvh overflow-hidden` per panel.
* **Suara notifikasi** via Web Audio (tanpa file), aktif setelah toggle.
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
* **[Sesi #1 — 2026-11-03 · 4.2 QRIS]**: `payment/qris.ts` (+16 test), adapter Midtrans, API qris & status. Commit `a213e7e`.
* **[Sesi #1 — 2026-11-03 · 4.3 Transfer Bank]**: `va.ts` (+9), `manual-transfer.ts` (+11), API VA/manual/proof. Commit `f1cdf07`.
* **[Sesi #1 — 2026-11-03 · 4.4 Tunai di Kasir]**: `code39.ts` (+12), `pin-attempts.ts` (+7), API PIN meja, `CashierPaymentPanel`. Commit `a20adae`.
* **[Sesi #1 — 2026-11-03 · 4.5 Webhook]**: `payment/webhook.ts` (+18 test), route webhook idempoten. Commit `b6901ef`.
* **[Sesi #1 — 2026-11-03 · 4.6 Tracker & E-Struk]**: `order-tracking.ts` (+14 test), API `track`, `OrderTracker`, e-struk 80 mm. Commit `02f7877`.
* **[Sesi #1 — 2026-11-03 · 5.1 POS 3-Panel]**: `notification.ts` (+4 test), komponen POS, layout dark, `/cashier`. Commit `165f938`.
* **[Sesi #1 — 2026-11-03 · 5.2 Validasi Bayar]**: `calculateCashChange` (+4 test), API `bill` & `cashier-confirm`, `PosBillPanel` interaktif. Commit `10b7368`.
* **[Sesi #1 — 2026-11-03 · 5.3 Cash Modal]**: `cash.ts` (+11 test), `ui/modal.tsx`, `CashPaymentModal` (keypad 56px, chip pecahan, kembalian reaktif), integrasi ke `PosBillPanel`. 257 test lulus; `/cashier` 200. Commit menyusul.
