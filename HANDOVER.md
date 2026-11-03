# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 5 — Halaman Kasir (POS Dashboard)` (6/9 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `5.6 Modul Kasir Input Manual (Walk-In / Takeaway)` ✅
* **Sub-Tugas yang Berikutnya**: `5.7 Otorisasi PIN Supervisor (Void / Refund / Diskon Manual)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**285 test**, 94 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `POST /api/pos/walk-in`, halaman `/cashier/walkin` (ƒ).
* **Verifikasi kontrak HTTP**: walk-in body kosong/`items: []`/metode asing → 422, payload valid → 500 rapi (DB belum ada); `/cashier/walkin` → **200** ("Keranjang", "Simpan & Bayar", empty state katalog); `/cashier` memuat tautan `/cashier/walkin`; `POST /api/orders` (setelah refactor) tetap 422/500 sesuai kontrak.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 27 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/services/order-creation.ts` | **Baru** — ekstraksi logika pembuatan order dari route: muat katalog, `buildOrderDraft`, transaksi (sesi meja untuk DINE_IN, `Payment` PENDING, `expiresAt` 15 mnt), retry nomor pesanan; `providerFor`, `isOnlinePayment` |
| `src/app/api/orders/route.ts` | **Ditulis ulang** — schema Zod tetap, delegasi ke `createOrder()`; payload respons sama seperti sebelumnya |
| `src/app/api/pos/walk-in/route.ts` | **Baru** — pesanan walk-in/takeaway memakai `createOrder()` (harga dihitung server), `TODO(RBAC)` |
| `src/lib/walkin.ts` | **Baru** — `validateWalkInCart`, `calculateWalkInTotals` (pakai `CartLine` + `calculateOrderTotals`), `generateWalkInReference` |
| `src/lib/walkin.test.ts` | **Baru** — 8 test |
| `src/components/pos/WalkInWorkspace.tsx` | **Baru** — sidebar + topbar, tab kategori, grid menu (disabled bila tidak orderable), keranjang POS (stepper 44px, hapus), pemilih pembayaran (Tunai/QRIS), nama pelanggan opsional, rincian Subtotal/Service/PB1/Total, tombol **Simpan & Bayar** → `POST /api/pos/walk-in`, modal modifier memakai `ModifierSheet` |
| `src/app/(pos)/cashier/walkin/page.tsx` | **Baru** — server component memuat katalog (`getCustomerMenuCatalog`), fallback `[]` |
| `src/components/pos/PosSidebar.tsx` | Diperbarui — "Walk-in" aktif menuju `/cashier/walkin` |
| `TODO.md` | `5.6` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`5.7 Otorisasi PIN Supervisor (Void / Refund / Diskon Manual)`**, ubah menjadi `[/]`.
2. **Buat `src/lib/security/supervisor-pin.ts`** (pure + test):
   * `hashSupervisorPin(pin)` / `verifySupervisorPin(pin, hash)` — reuse HMAC-SHA256 dari `src/lib/security/pin.ts` (jangan duplikasi logika).
   * `validatePinFormat(pin)` → 6 digit.
   * Reuse `src/lib/security/pin-attempts.ts` (5 percobaan/10 menit) dengan prefiks kunci `supervisor:<email>:<ip>`.
3. **Buat endpoint `POST /api/pos/supervisor-authorize`** (`TODO(RBAC)`):
   * Body Zod strict: `{ staffEmail: string.email, pin: string.regex(/^\d{6}$/), action: "VOID_ITEM" | "REFUND" | "MANUAL_DISCOUNT", targetId?: string }`.
   * Cari `Staff` aktif dengan `email` & `role` (`ADMIN`/`CASHIER`) → verifikasi `pinHash` (`Staff.pinHash`, HMAC).
   * Gagal → 401 + `details.remainingAttempts`; melewati batas → 429 + `Retry-After` (pakai `registerPinAttempt`).
   * Sukses → kembalikan `{ authorized: true, staff: { id, name, role }, action, expiresAt }` dengan **token otorisasi sekali pakai** (mis. HMAC atas `staffId + action + targetId + timestamp`, berlaku 5 menit) — simpan mekanisme verifikasi di `src/lib/security/authorization-token.ts` + test.
   * **Jangan** mengembalikan `pinHash`.
4. **Buat `src/components/pos/SupervisorPinModal.tsx`** (gunakan `Modal`): input 6 digit (kotak auto-focus) + pilih staff (dropdown dari props/daftar contoh), tombol otorisasi, pesan sisa percobaan, callback `onAuthorized(token)`.
5. **Integrasi**:
   * `PosBillPanel`: tombol **Void Item** (per item) & **Diskon Manual** membuka `SupervisorPinModal`; setelah token didapat, kirim ke endpoint aksi (belum ada → tampilkan `notice` "Otorisasi berhasil; aksi akan tersedia di 5.9"). Jangan membuat endpoint void/diskon baru di tugas ini.
   * `CashDrawer`/refund menyusul di 5.8/5.9.
6. **Verifikasi**: `npm test` (supervisor pin & token), `typecheck`, `lint`, `build`; probe `POST /api/pos/supervisor-authorize`: body kosong → 422, PIN 4 digit → 422, email invalid → 422, tanpa DB → 500 rapi.
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `5.8 Manajemen Shift Kasir & Laci Kas`), `git commit` (`feat(pos): add supervisor pin authorization for sensitive cashier actions`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Satu jalur pembuatan order**: `createOrder()` di `src/lib/services/order-creation.ts` dipakai `POST /api/orders` **dan** `POST /api/pos/walk-in`. Jangan menduplikasi logika harga/transaksi.
* **Walk-in UI saat ini hanya TAKEAWAY** (API sudah mendukung DINE_IN + `tableSlug`); tambahkan pemilih meja bila diperlukan nanti.
* **Autentikasi staf (RBAC) belum ada** — semua endpoint kasir bertanda `TODO(RBAC)`.
* **PENTING — jangan menulis file berisi karakter non-ASCII memakai PowerShell `Set-Content`/`Add-Content`**: menyebabkan mojibake & BOM. Gunakan tool `write`/`edit`.
* **Split bill**: order baru mendapat `Payment` PENDING; diskon/`uniqueCode` di-reset; order lunas tidak boleh di-split.
* **Pindah meja** memakai `targetTableId` (nomor meja unik hanya per area).
* **Bill berjalan** = total `grandTotal` order non-CANCELLED dalam sesi aktif.
* **POS/KDS** memakai `.dark`, target sentuh 56px (beberapa stepper 44px), `tabular-nums`, `h-dvh overflow-hidden` per panel.
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
* **[Sesi #1 — 2026-11-03 · 5.5 Split/Merge/Move]**: `order-number.ts`, `split-bill.ts` (+13 test), API split/move/merge, `SplitBillModal`. Commit `e08a6f7`.
* **[Sesi #1 — 2026-11-03 · 5.6 Walk-In]**: `services/order-creation.ts` (ekstraksi), route orders disederhanakan, API & halaman walk-in, `walkin.ts` (+8 test), `WalkInWorkspace`, sidebar aktif. 285 test lulus; probe 422/500 & halaman 200. Commit menyusul.
