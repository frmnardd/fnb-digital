# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 3 — Antarmuka Halaman Pelanggan (Mobile-First)` (5/6 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `3.5 Store Keranjang & Sinkronisasi Group Order` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `3.6 Halaman Keranjang, Upselling, & Rincian Biaya`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**115 test**, 37 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔. Route: `/t/[tableSlug]` (ƒ, 169 kB) + 3 API (ƒ).
* **Verifikasi runtime**: `GET /t/meja-01` → HTTP 200 (fallback "Sistem belum siap" karena DB belum ada). Render SSR `CustomerHeader` + `MenuBrowser` (dengan store Zustand) lolos setelah perbaikan bug hydration di bawah.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 14 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/cart.ts` | **Baru** — `CartLine`, `buildCartLineId` (menu + modifier terurut + catatan ternormalisasi), `mergeCartLines`, `updateLineQuantity` (≤0 menghapus), `summarizeCart`, `findQuantityByItem`, `normalizeCartNote` |
| `src/lib/cart.test.ts` | **Baru** — 13 test (ID stabil/unik, merge, update/remove, ringkasan, hitung per item) |
| `src/store/useCartStore.ts` | **Baru** — Zustand + `persist` (`fnb-cart`, v1, `skipHydration`, `partialize`), aksi `setContext` (meja berbeda → kosongkan), `setOrderType`, `addLine`, `setQuantity`, `removeLine`, `clear`, `applyRemoteLines`; selector `selectTotalQuantity`, `selectSubtotal`, `selectQuantityByItem` |
| `src/store/useCartStore.test.ts` | **Baru** — 11 test (konteks meja, merge, hapus, remote, order type, selector) |
| `src/lib/cart-sync.ts` | **Baru** — `CartSyncChannel`, `createBroadcastCartSync(tableSlug)` (BroadcastChannel `fnb-cart:<slug>`), feature-detect |
| `src/hooks/useCartHydrated.ts` | **Baru** — rehidrasi manual + **guard `store.persist` undefined saat SSR** |
| `src/hooks/useCartSync.ts` | **Baru** — publish debounce 150 ms, terapkan remote tanpa memantulkan balik (anti-loop) |
| `src/components/customer/MenuBrowser.tsx` | **Diperbarui** — state `cartQuantities` dihapus, memakai store (`addLine` + `buildCartLineId`), `setContext` meja/sesi, badge kuantitas dari `findQuantityByItem` setelah hydrated |
| `src/components/customer/CustomerHeader.tsx` | **Diperbarui** — `orderType` dipindah ke store (Dine In/Takeaway), tipe `OrderType` dari store |
| `src/app/(customer)/t/[tableSlug]/page.tsx` | **Diperbarui** — meneruskan `tableSlug` & `sessionId` ke `MenuBrowser` |
| `TODO.md` | `3.5` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`3.6 Halaman Keranjang, Upselling, & Rincian Biaya`**, ubah menjadi `[/]`.
2. **Buat `src/lib/upsell.ts`** (pure + `src/lib/upsell.test.ts`):
   * `getUpsellSuggestions(categories, lines, { limit = 3 })` — rekomendasikan item yang **belum ada** di keranjang, prioritaskan `isBestSeller`, lalu kategori `minuman-segar`/`kopi-teh` (cross-selling), hanya item `isOrderable`, maksimal `limit`.
   * `describeLineModifiers(line)` — gabungan nama modifier + catatan untuk ditampilkan ("Pedas · Extra Telur · tanpa bawang").
   * Uji: mengecualikan item yang sudah ada, prioritas best seller, hanya item orderable, batas `limit`, deskripsi modifier.
3. **Buat `src/lib/cart-totals.ts`** (pure + test): `calculateCartBreakdown(lines, { servicePercent = 5, taxPercent = 10 })` → `{ subtotal, serviceCharge, taxAmount, grandTotal, totalQuantity }` **memakai `calculateOrderTotals()` dari `src/lib/pricing.ts`** (bangun `PricingItemInput[]` dari `CartLine`: `basePrice` = harga dasar menu, `modifiers` = modifier baris, `quantity`). Jangan menulis ulang rumus; sertakan test agar angka identik dengan `pricing.ts`.
4. **Tambahkan ke `useCartStore`**: `customerName: string`, `customerPhone: string`, `setCustomer({ name, phone })` (+ masuk `partialize`). Validasi ringan di form, bukan di store.
5. **Buat `src/components/customer/FloatingCartBar.tsx`** (`"use client"`, thumb zone):
   * Hanya tampil bila `useCartHydrated()` **dan** `lines.length > 0`; `sticky bottom-0` dengan `safe-area-pb`, tombol ≥ 48px, total kuantitas + subtotal `tabular-nums`, membuka `CartSheet`.
   * Pisahkan komponen presentasional `CartSummaryBar({ totalQuantity, subtotal, onOpen })` agar bisa diverifikasi lewat `renderToStaticMarkup` tanpa hydration.
6. **Buat `src/components/customer/CartSheet.tsx`** (`BottomSheet`):
   * Daftar baris: nama, `describeLineModifiers`, harga satuan & subtotal baris, stepper −/+ (48px) via `setQuantity`, tombol hapus (`removeLine`), empty state + tombol "Lihat menu" yang menutup sheet.
   * Widget **upselling**: kartu kecil dari `getUpsellSuggestions` dengan tombol tambah (pakai `buildCartLineId` + `addLine`; bila item punya modifier, buka `ModifierSheet` — koordinasikan dengan `MenuBrowser`/props agar tidak duplikasi logika).
   * Form nama & WhatsApp opsional (input `type="tel"`, maxLength, helper text) → `setCustomer`.
   * Rincian biaya transparan: Subtotal, Service Charge 5%, PB1 10%, Total — semua `tabular-nums`, plus catatan "Kode unik ditambahkan untuk transfer manual".
   * Tombol utama "Lanjut ke Pembayaran" (belum berfungsi — arahkan ke langkah 4.1; disabled + tooltip "Segera hadir" bila alur belum ada).
7. **Integrasikan** `FloatingCartBar` + `CartSheet` di halaman `/t/[tableSlug]` (render setelah `MenuBrowser`, kirim props yang diperlukan).
8. **Verifikasi**: `npm test` (upsell & breakdown), `typecheck`, `lint`, `build`, lalu render-check SSR untuk `CartSummaryBar`/`CartSheet` bagian statis dengan fixture (file sementara **wajib dihapus sebelum commit**).
9. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke **Fase 4.1: `POST /api/orders`**), `git commit` (`feat(customer): add cart sheet with upselling and transparent cost breakdown`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **BUG YANG SUDAH DIPERBAIKI (jangan diulang)**: saat SSR, `zustand/middleware persist` **tidak memasang `store.persist`** bila storage tidak tersedia (lihat `if (!storage) return config(...)`). Akses `useCartStore.persist` tanpa guard menyebabkan `Cannot read properties of undefined`. Gunakan `const persistApi = useCartStore.persist; if (!persistApi) { ... }` seperti di `useCartHydrated`.
* **Hydration mismatch**: `persist` memakai `skipHydration: true`; rehidrasi manual via `useCartHydrated()` (render server & client pertama = keranjang kosong). Jangan membaca localStorage saat render.
* **Sinkronisasi keranjang saat ini lintas tab/perangkat pada origin yang sama** (`BroadcastChannel`). Sinkronisasi lintas perangkat berbeda **belum** ada — butuh Supabase Realtime (kredensial belum tersedia). Jangan mengklaim real-time multi-device.
* **Urutan kalkulasi (WAJIB)**: subtotal → diskon → service 5% → PB1 10% → `uniqueCode` (khusus `MANUAL_TRANSFER`). Semua lewat `src/lib/pricing.ts`.
* **Modifier**: `createInitialSelection` memilih default; grup SINGLE wajib tanpa default memilih opsi pertama. `toggleOption` tak pernah mengosongkan grup SINGLE wajib.
* **Sticky**: `CUSTOMER_HEADER_OFFSET_PX = 125`; section menu `scroll-mt-[190px]`.
* **Rahasia**: `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`, stok bahan — jangan pernah ke klien.
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
* **[Sesi #1 — 2026-11-03 · 3.2 Kategori & Pencarian]**: tipe & select menu bersama, service katalog, `menu-filter.ts` (+13 test), `CategoryTabs`, `MenuBrowser`. Commit `91e698f`.
* **[Sesi #1 — 2026-11-03 · 3.3 Kartu Menu]**: `getOrderabilityLabel/Text`, `MenuCard` final. Commit `d69ee24`.
* **[Sesi #1 — 2026-11-03 · 3.4 Modifier Sheet]**: `modifier-selection.ts` (+21 test), `ModifierSheet`, integrasi. Commit `35ecdb4`.
* **[Sesi #1 — 2026-11-03 · 3.5 Cart Store & Sync]**: `cart.ts` (+13 test), `useCartStore` (+11 test, persist + skipHydration), `cart-sync.ts` + `useCartSync` (BroadcastChannel), `useCartHydrated` (guard SSR), integrasi `MenuBrowser`/`CustomerHeader`/page. Menemukan & memperbaiki bug SSR `store.persist` undefined. Total 115 test. Commit menyusul.
