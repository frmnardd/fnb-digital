# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 5 — Halaman Kasir (POS Dashboard)` (4/9 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `5.4 Peta Meja Interaktif` ✅
* **Sub-Tugas yang Berikutnya**: `5.5 Split Bill, Gabung Tagihan, & Pindah Meja`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**264 test**, 86 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Verifikasi runtime**: `/cashier/floor` → **HTTP 200** (empty state "Belum ada meja" karena DB belum ada); `/cashier` → 200 dan sidebar kini memuat tautan `/cashier/floor`; `GET /api/pos/tables` tanpa DB → 500 rapi.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 25 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/floor-plan.ts` | **Baru** — `TABLE_STATUS_META` (label + kelas warna per status), `formatSeatedDuration` ("12 mnt"/"1 j 05 mnt", aman clock-skew), `getFloorPlanSummary` |
| `src/lib/floor-plan.test.ts` | **Baru** — 7 test (meta lengkap, 0/59/60/65 menit, pembulatan, negatif, ringkasan) |
| `src/types/pos.ts` | Ditambah `PosTableStatus`, `PosFloorSession`, `PosFloorTable`, `PosFloorArea` |
| `src/lib/services/pos-tables.ts` | **Baru** — `getPosFloorPlan()`: area + meja + sesi aktif + **total bill berjalan** (sum `grandTotal` order non-CANCELLED) |
| `src/app/api/pos/tables/route.ts` | **Baru** — `GET` denah meja (tanpa `currentPin`) |
| `src/components/pos/PosSidebar.tsx` | Diperbarui — item ber-`href` memakai `Link` (`/cashier`, `/cashier/floor`), sisanya tombol disabled; `aria-current` untuk aktif |
| `src/components/pos/InteractiveFloorPlan.tsx` | **Baru** — tab area, ringkasan status, grid meja (status berwarna, kapasitas, bill berjalan), panel detail (tamu/durasi/bill), tombol "Pindah Meja"/"Gabung Tagihan" (Soon), polling 10 dtk + jam 30 dtk |
| `src/components/pos/FloorWorkspace.tsx` | **Baru** — sidebar + topbar (suara) + denah |
| `src/app/(pos)/cashier/floor/page.tsx` | **Baru** — server component + fallback `[]` |
| `TODO.md` | `5.4` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`5.5 Split Bill, Gabung Tagihan, & Pindah Meja`**, ubah menjadi `[/]`.
2. **Buat `src/lib/split-bill.ts`** (pure + `src/lib/split-bill.test.ts`):
   * `splitItemsBySelection(items, selectedIds)` → `{ moved, remaining }` (validasi: semua id harus ada, keduanya tidak boleh kosong).
   * `recalculateTotalsFromItems(items, options?)` → `{ subtotal, serviceCharge, taxAmount, grandTotal }` memakai `calculateOrderTotals` (buang `discount`/`uniqueCode` saat split; `uniqueCode` 0).
   * `splitEqually(total, parts)` → array nominal sama + sisa dibagikan ke part pertama (Rupiah bulat).
   * Uji: pemisahan item, validasi id asing, total setelah split, pembagian rata (sisa 1 rupiah), input tidak valid.
3. **Buat 3 endpoint** (semua `TODO(RBAC)` + validasi Zod strict):
   * `POST /api/orders/[orderNumber]/split`: body `{ itemIds: string[] }` → pindahkan `OrderItem` terpilih ke order baru (`orderNumber` baru via pola 4.1, status sama dengan order asal, `tableSessionId` sama), lalu **hitung ulang** total kedua order dari item masing-masing (pakai `recalculateTotalsFromItems`), simpan. Tolak bila order bukan `CONFIRMED`/`PENDING_PAYMENT` atau item tidak milik order.
   * `POST /api/sessions/[sessionId]/move-table`: body `{ targetTableNumber: string }` → pastikan sesi aktif & meja target `AVAILABLE`/`isActive`; pindahkan `TableSession.tableId`, set meja asal `NEEDS_CLEANING`, meja target `OCCUPIED`; tolak bila target = meja asal atau target tidak tersedia.
   * `POST /api/sessions/[sessionId]/merge`: body `{ sourceSessionId: string }` → pindahkan seluruh `Order` dari sesi sumber ke sesi target, tutup sesi sumber (`CLOSED`, `closedAt`), set meja sumber `NEEDS_CLEANING`; tolak sumber = target atau sesi sumber tidak aktif.
4. **UI**:
   * `InteractiveFloorPlan`: aktifkan tombol **Pindah Meja** (modal pilih meja target dari area yang sama/berbeda, hanya meja `AVAILABLE`) dan **Gabung Tagihan** (modal pilih sesi aktif lain) — panggil endpoint, tampilkan loading/error, lalu muat ulang denah.
   * `PosBillPanel`: tambahkan tombol **Split Bill** yang membuka `SplitBillModal` (centang item, tampilkan total bagian terpilih vs sisa, konfirmasi → endpoint split → reload bill + `router.refresh()`).
   * Gunakan `Modal` yang sudah ada (`src/components/ui/modal.tsx`), tombol 56px, `tabular-nums`.
5. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`; probe: split/move/merge dengan orderNumber/sessionId invalid → 400, body invalid → 422, tanpa DB → 500 rapi; `/cashier/floor` & `/cashier` tetap 200.
6. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `5.6 Modul Kasir Input Manual / Walk-In`), `git commit` (`feat(pos): add split bill, merge sessions, and move table flows`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Autentikasi staf (RBAC) belum ada** — endpoint kasir belum terlindungi (`TODO(RBAC)`); jangan menulis klaim keamanan.
* **Bill berjalan** = total `grandTotal` order non-CANCELLED dalam sesi aktif; jangan memotong stok di sini (7.3).
* **Total order** selalu dihitung ulang server-side (`src/lib/pricing.ts`); setelah split, service/PB1 dihitung dari subtotal bagian masing-masing.
* **POS/KDS** memakai `.dark`, target sentuh 56px, `tabular-nums`, `h-dvh overflow-hidden` per panel.
* **Pembayaran tunai** via `CashPaymentModal` → `POST /cashier-confirm`; kembalian `calculateCashChange`.
* **Suara notifikasi** via Web Audio, aktif setelah toggle.
* **E-Struk PDF** memakai `window.print()`; PDF server-side belum diizinkan.
* **Mode demo pembayaran**: QRIS/VA lokal; bukti transfer `public/uploads/proofs`; webhook tanpa signature hanya bila `PAYMENT_ALLOW_UNSIGNED_WEBHOOK=true`.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`.
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
* **[Sesi #1 — 2026-11-03 · 5.3 Cash Modal]**: `cash.ts` (+11 test), `ui/modal.tsx`, `CashPaymentModal`, integrasi bill panel. Commit `7dbc98a`.
* **[Sesi #1 — 2026-11-03 · 5.4 Floor Plan]**: `floor-plan.ts` (+7 test), service & API `/api/pos/tables`, `InteractiveFloorPlan`, `FloorWorkspace`, halaman `/cashier/floor`, sidebar dengan `Link` aktif. 264 test lulus; floor 200 & link sidebar terverifikasi. Commit menyusul.
