# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 5 — Halaman Kasir (POS Dashboard)` (5/9 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `5.5 Split Bill, Gabung Tagihan, & Pindah Meja` ✅
* **Sub-Tugas yang Berikutnya**: `5.6 Modul Kasir Input Manual (Walk-In / Takeaway POS)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**277 test**, 90 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `POST /api/orders/[orderNumber]/split`, `POST /api/sessions/[sessionId]/move-table`, `POST /api/sessions/[sessionId]/merge` (ƒ).
* **Verifikasi kontrak HTTP**: split order invalid → 400, body kosong → 422, valid → 500 rapi; move session invalid → 400, target kosong → 422, valid → 500; merge sesi sama → **409** (validasi sebelum DB), valid → 500; `/cashier` & `/cashier/floor` → **200**.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 26 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/order-number.ts` | **Baru** — `generateOrderNumber(tx, attempt)`, `isUniqueViolation`, `ORDER_NUMBER_MAX_ATTEMPTS` (diekstrak dari route orders) |
| `src/app/api/orders/route.ts` | Diperbarui — memakai helper nomor pesanan bersama (fungsi lokal dihapus) |
| `src/lib/split-bill.ts` | **Baru** — `splitItemsBySelection` (validasi item asing/duplikat/semua dipilih), `recalculateTotalsFromItems` (service 5% + PB1 10% via `calculateOrderTotals`), `splitEqually` (sisa ke bagian pertama), `SplitBillError` |
| `src/lib/split-bill.test.ts` | **Baru** — 13 test |
| `src/app/api/orders/[orderNumber]/split/route.ts` | **Baru** — pindahkan `OrderItem` ke order baru (nomor `ORD-####` + retry), buat `Payment` PENDING untuk order baru (metode mengikuti order asal), hitung ulang total kedua order; tolak order lunas/1 item/status final |
| `src/app/api/sessions/[sessionId]/move-table/route.ts` | **Baru** — pindah sesi ke meja `AVAILABLE` lain, meja asal `NEEDS_CLEANING`, target `OCCUPIED` |
| `src/app/api/sessions/[sessionId]/merge/route.ts` | **Baru** — pindahkan seluruh order sesi sumber ke target, tutup sesi sumber, meja sumber `NEEDS_CLEANING` |
| `src/types/pos.ts` | `PosBillItem` ditambah `id` |
| `src/app/api/orders/[orderNumber]/bill/route.ts` | Mengirim `id` item (dibutuhkan split) |
| `src/components/pos/SplitBillModal.tsx` | **Baru** — pilih item (checkbox 56px), total bagian terpilih, validasi min 1 & bukan semua, panggil endpoint split |
| `src/components/pos/PosBillPanel.tsx` | Diperbarui — tombol **Split Bill** (bila >1 item & belum lunas) + modal |
| `src/components/pos/InteractiveFloorPlan.tsx` | Diperbarui — tombol **Pindah Meja** & **Gabung Tagihan** aktif dengan modal pilihan; `refreshAreas()` dipakai ulang; error/loading ditangani |
| `TODO.md` | `5.5` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`5.6 Modul Kasir Input Manual (Walk-In / Takeaway POS)`**, ubah menjadi `[/]`.
2. **Buat `src/lib/walkin.ts`** (pure + `src/lib/walkin.test.ts`):
   * `buildWalkInDraft(lines, options)` memakai `calculateOrderTotals` (tanpa `uniqueCode` kecuali transfer manual).
   * `validateWalkInCart(lines)` → error jika kosong/kuantitas tidak valid.
   * `generateWalkInLabel()` (mis. `WI-<timestamp36>`) bila perlu penanda pelanggan.
   * Uji: total, baris kosong, kuantitas tidak valid.
3. **Buat endpoint** `POST /api/pos/walk-in` (`TODO(RBAC)`):
   * Body Zod strict: `{ orderType: "TAKEAWAY" | "DINE_IN", items: [{ menuItemId, quantity, modifierOptionIds[], note? }], paymentMethod, customerName?, customerPhone?, tableSlug? }`.
   * **Reuse `buildOrderDraft`** (`src/lib/order-draft.ts`) untuk validasi menu/modifier & hitung harga — jangan menulis rumus baru.
   * `tableSessionId = null` untuk TAKEAWAY; untuk DINE_IN wajib `tableSlug` dengan sesi aktif (pola 4.1).
   * Status awal sama dengan 4.1 (`CASH`/`EDC_CARD` → `WAITING_CASHIER_APPROVAL`, lainnya `PENDING_PAYMENT`), simpan order + payment, `orderNumber` via `generateOrderNumber` + retry.
4. **UI walk-in** di `/cashier/walkin` (aktifkan item "Walk-in" di `PosSidebar`):
   * Panel kiri: katalog menu (reuse `src/lib/services/customer-menu.ts` → `getCustomerMenuCatalog()`, tampilkan grid tombol menu 56px + harga).
   * Panel tengah/kanan: keranjang POS (state lokal, bukan keranjang pelanggan), stepper qty, tombol hapus, pilih modifier minimal (bila menu punya modifier wajib, buka `ModifierSheet`-style modal atau pilih default + peringatan).
   * Footer: total (subtotal + service + PB1 dari `calculateOrderTotals`), tombol **Simpan & Bayar** → `POST /api/pos/walk-in` → buka `CashPaymentModal`/redirect ke `/cashier` dengan pesanan terpilih.
5. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`; probe `/cashier/walkin` → 200, `POST /api/pos/walk-in` body invalid → 422, tanpa DB → 500 rapi.
6. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `5.7 Otorisasi PIN Supervisor`), `git commit` (`feat(pos): add walk-in ordering module`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Split bill**: order baru mendapat `Payment` PENDING (metode mengikuti payment terakhir order asal). Diskon & kode unik di-reset (0) karena total dihitung ulang per bagian. Order lunas tidak boleh di-split.
* **Pindah meja** memakai `targetTableId` (bukan nomor meja) karena `tableNumber` unik hanya per area (`@@unique([areaId, tableNumber])`).
* **Gabung tagihan**: `POST /api/sessions/[sessionId]/merge` dengan `sessionId` = meja tujuan, `sourceSessionId` = meja yang digabung.
* **PENTING — jangan menulis file berisi karakter non-ASCII memakai PowerShell `Set-Content`/`Add-Content`**: pernah menyebabkan mojibake (`—`, `…`, `·` rusak) dan BOM. Gunakan tool `write`/`edit`, atau perbaiki dengan round-trip Windows-1252 → UTF-8.
* **Autentikasi staf (RBAC) belum ada** — semua endpoint kasir bertanda `TODO(RBAC)`.
* **Bill berjalan** = total `grandTotal` order non-CANCELLED dalam sesi aktif.
* **POS/KDS** memakai `.dark`, target sentuh 56px, `tabular-nums`, `h-dvh overflow-hidden` per panel.
* **Pembayaran tunai** via `CashPaymentModal` → `POST /cashier-confirm`; kembalian `calculateCashChange`.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`.
* **BUG SSR ZUSTAND**: `persist` tidak memasang `store.persist` saat storage tidak tersedia → guard.
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
* **[Sesi #1 — 2026-11-03 · 5.3 Cash Modal]**: `cash.ts` (+11 test), `ui/modal.tsx`, `CashPaymentModal`. Commit `7dbc98a`.
* **[Sesi #1 — 2026-11-03 · 5.4 Floor Plan]**: `floor-plan.ts` (+7 test), service & API `/api/pos/tables`, `InteractiveFloorPlan`, `/cashier/floor`. Commit `2335760`.
* **[Sesi #1 — 2026-11-03 · 5.5 Split/Merge/Move]**: `order-number.ts` (ekstraksi), `split-bill.ts` (+13 test), API split/move-table/merge, `SplitBillModal`, tombol Pindah/Gabung aktif. 277 test lulus; probe 400/409/422/500 & kedua halaman POS 200. Commit menyusul.
