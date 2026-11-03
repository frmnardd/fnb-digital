# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 4 — Sistem Pembayaran (QRIS, Transfer/VA, & Tunai di Kasir)` — **Fase 3 SELESAI (6/6)**
* **Sub-Tugas Terakhir yang Selesai**: `3.6 Halaman Keranjang, Upselling, & Rincian Biaya` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `4.1 API Pembuatan Order (POST /api/orders)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**132 test**, 42 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔. Route: `/t/[tableSlug]` (ƒ, 172 kB) + 3 API (ƒ).
* **Verifikasi runtime**: `GET /t/meja-01` → HTTP 200 (fallback "Sistem belum siap", DB belum ada). `CartSummaryBar` + breakdown diverifikasi via SSR fixture (5 item, subtotal `Rp 122.000`, service `6.100`, PB1 `12.810`, total `140.910`).
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 15 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/upsell.ts` | **Baru** — `getUpsellSuggestions` (kecualikan item di keranjang, hanya `isOrderable`, bobot best seller + kategori minuman), `describeLineModifiers`, `DRINK_CATEGORY_SLUGS` |
| `src/lib/upsell.test.ts` | **Baru** — 9 test (eksklusi varian, item habis, prioritas, bobot minuman, limit, deskripsi modifier) |
| `src/lib/cart-totals.ts` | **Baru** — `toPricingItems`, `calculateCartBreakdown` (delegasi ke `calculateOrderTotals`) |
| `src/lib/cart-totals.test.ts` | **Baru** — 6 test (angka rincian, konsistensi dengan `pricing.ts`, keranjang kosong, override tarif, pembulatan) |
| `src/store/useCartStore.ts` | **Diperbarui** — `customerName`, `customerPhone`, `setCustomer()` (parsial), reset data pemesan saat pindah meja, ikut `partialize` |
| `src/store/useCartStore.test.ts` | **Diperbarui** — 2 test data pemesan (total 13) |
| `src/components/customer/FloatingCartBar.tsx` | **Baru** — `CartSummaryBar` presentasional + `FloatingCartBar` (fixed bottom, thumb zone, hanya tampil setelah hydrated & keranjang berisi) |
| `src/components/customer/CartSheet.tsx` | **Baru** — daftar baris (stepper 48px, hapus 44px), upselling, form nama/WhatsApp, rincian Subtotal/Service 5%/PB1 10%/Total, CTA pembayaran (disabled sampai 4.1) |
| `src/app/(customer)/t/[tableSlug]/page.tsx` | **Diperbarui** — render `FloatingCartBar`, `pb-28` pada `main` |
| `TODO.md` | `3.6` ditandai `[x]` (Fase 3 selesai) |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`4.1 API Pembuatan Order`**, ubah menjadi `[/]`.
2. **Buat `src/lib/order-draft.ts`** (pure, teruji di `src/lib/order-draft.test.ts`):
   * Input: `items: Array<{ menuItemId: string; quantity: number; modifierOptionIds: string[]; note?: string }>`, `menuIndex: Map<string, PublicMenuItem>` (atau array menu dari DB), `discount?`, `paymentMethod`.
   * `resolveModifiers(menuItem, optionIds)` → validasi setiap opsi benar-benar milik grup modifier yang menempel pada menu itu, cek `group.isRequired`/`minSelect`/`maxSelect` (pakai `validateSelection`/`selectionToModifiers` dari `src/lib/modifier-selection.ts`), tolak opsi duplikat/asing.
   * `buildOrderDraft({ items, menuIndex, discount, paymentMethod })` → `{ lines, totals }`; hitung `unitPrice`/`lineTotal` lewat `calculateLineTotal` dan total lewat `calculateOrderTotals` dengan `applyUniqueCode = paymentMethod === "MANUAL_TRANSFER"`; **nominal dari klien selalu diabaikan**.
   * Error bertipe: `OrderDraftError` dengan `code`: `EMPTY_CART | MENU_NOT_FOUND | MENU_UNAVAILABLE | MODIFIER_INVALID | QUANTITY_INVALID | INVALID_PAYMENT_METHOD`.
   * Uji: harga server dihitung ulang, modifier wajib hilang → error, opsi dari menu lain → error, kuantitas 0/negatif → error, menu 86'd / di luar jam tayang → error, kode unik hanya untuk `MANUAL_TRANSFER`, diskon persen/fixed benar.
3. **Buat `POST src/app/api/orders/route.ts`** (`force-dynamic`, `runtime = "nodejs"`):
   * Zod schema (strict): `{ tableSlug?: string, orderType: "DINE_IN" | "TAKEAWAY", items: array(min 1) of { menuItemId: string, quantity: int 1..20, modifierOptionIds: string[] (default []), note?: string max 160 }, paymentMethod: enum, customerName?: string max 60, customerPhone?: string max 20 }` — tidak menerima harga dari klien.
   * Ambil menu dari DB (`menuItem.findMany` dengan `where: { id: { in } }` + `select` publik **dan** `costPrice` TIDAK dipakai), bangun `menuIndex`, panggil `buildOrderDraft()`.
   * Bila `orderType === "DINE_IN"`: wajib `tableSlug`, cari `Table` + `TableSession` berstatus `ACTIVE|BILL_REQUESTED` yang cocok dengan cookie `fnb_table_session` (pakai `verifySessionToken`) → `tableSessionId`. Bila sesi tidak ada → `ApiError("CONFLICT", ...)`. Untuk `TAKEAWAY`, `tableSessionId = null`.
   * Status awal: `paymentMethod === "CASH"` → `WAITING_CASHIER_APPROVAL`, selain itu `PENDING_PAYMENT` (CONTEXT §4).
   * Simpan dalam satu `db.$transaction`: `order.create` (+ `items: { create: [...] }`), `payment.create` (`status: PENDING`, `amountPaid: totals.grandTotal`, `method`, `provider` sesuai metode, `expiresAt` +15 menit untuk QRIS/VA), dan `tableSession.update` (`lastActivityAt: now`). **Jangan** memotong stok bahan (itu 7.3).
   * `orderNumber`: format `ORD-####`. Buat helper `generateOrderNumber(tx)` dengan `count()`+1 lalu **retry maksimal 5×** saat kena `P2002` pada `orderNumber` (atau gunakan `Date.now()` suffix acak bila tetap gagal).
   * Respons `201 { data: { order: { id, orderNumber, status, orderType, totals, items }, payment: { id, method, status, amount, expiresAt } } }`.
4. **Verifikasi tanpa DB**: `npm test`, `typecheck`, `lint`, `build`, lalu probe HTTP (`npx next start -p <port>`): body kosong → 400/422, `items: []` → 422, `paymentMethod` tak dikenal → 422, `quantity: 0` → 422, tanpa DB → 500 berformat `{ error: { code, message } }`. Hapus file/port sementara setelah selesai.
5. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `4.2 Integrasi Pembayaran QRIS Dinamis`), `git commit` (`feat(api): add order creation endpoint with server-side price recomputation`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **JANGAN percaya harga dari klien**: body order hanya berisi id menu/opsi, kuantitas, dan catatan. Semua nominal dihitung di server dari `MenuItem.basePrice` + `ModifierOption.priceDelta`.
* **Urutan kalkulasi (WAJIB)**: subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (khusus `MANUAL_TRANSFER`). Gunakan `src/lib/pricing.ts`; `calculateCartBreakdown`/`calculateSelectionTotal` hanyalah pembungkus.
* **BUG SSR ZUSTAND (jangan diulang)**: middleware `persist` tidak memasang `store.persist` bila storage tidak tersedia (SSR) → selalu guard `const persistApi = useCartStore.persist; if (!persistApi) { ... }` (contoh: `useCartHydrated`).
* **Hydration**: `skipHydration: true` + rehidrasi manual; jangan membaca localStorage saat render.
* **Sinkronisasi keranjang**: hanya lintas tab/origin yang sama (`BroadcastChannel`). Multi-device butuh Supabase Realtime (belum ada kredensial) — jangan klaim lebih.
* **Keranjang belum terhubung ke API**: CTA pembayaran di `CartSheet` masih `disabled`; sambungkan pada 4.1/4.2.
* **Rahasia**: `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`, stok bahan — jangan pernah ke klien.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; urutan validasi env → slug/query → body → DB.
* **Seed**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`.
* **Migrasi init jangan diedit**; bila DB tersedia: `npx prisma migrate deploy && npm run db:seed`.
* **Sandbox**: `npm install` pakai `--ignore-scripts`; cache npm `./.npm-cache`; `next/font/google` tidak dipakai.
* **Tema**: `:root` Customer Warm Light (`#FAF8F5`, primary `#D9381E`), `.dark` POS/KDS Slate Dark; target sentuh pelanggan ≥ 48px (stepper keranjang 48px, tombol hapus 44px), POS/KDS 56px; angka wajib `tabular-nums`.
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
* **[Sesi #1 — 2026-11-03 · 3.2 Kategori & Pencarian]**: tipe & select menu bersama, service katalog, `menu-filter.ts` (+13 test), `CategoryTabs`, `MenuBrowser`. Commit `91e698f`.
* **[Sesi #1 — 2026-11-03 · 3.3 Kartu Menu]**: `getOrderabilityLabel/Text`, `MenuCard` final. Commit `d69ee24`.
* **[Sesi #1 — 2026-11-03 · 3.4 Modifier Sheet]**: `modifier-selection.ts` (+21 test), `ModifierSheet`. Commit `35ecdb4`.
* **[Sesi #1 — 2026-11-03 · 3.5 Cart Store & Sync]**: `cart.ts` (+13), `useCartStore` (+11), `cart-sync`, fix bug SSR `persist`. Commit `6787d5b`.
* **[Sesi #1 — 2026-11-03 · 3.6 Cart Sheet & Upselling]**: `upsell.ts` (+9 test), `cart-totals.ts` (+6 test, delegasi `calculateOrderTotals`), data pemesan di store (+2 test), `FloatingCartBar` + `CartSheet`. Fase 3 tuntas; 132 test lulus. Commit menyusul.
