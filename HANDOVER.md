# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 3 — Antarmuka Halaman Pelanggan (Mobile-First)` (2/6 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `3.2 Navigasi Kategori Sticky & Pencarian Instan` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `3.3 Katalog Kartu Menu (MenuCard)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**67 test**, 21 suite) ✔, `typecheck` ✔, `lint` (0 warning) ✔, `build` ✔. Route: `/t/[tableSlug]` (ƒ, 165 kB) + 3 API (ƒ).
* **Verifikasi UI dengan data (tanpa DB)**: komponen dirender via `renderToStaticMarkup` + fixture → header (meja/area/badge sesi/switcher/pelayan) & MenuBrowser (input search, chip filter, tab kategori, section, harga `Rp 38.000`, badge "Habis", hitungan "3 menu tersedia") semuanya LOLOS. Skrip sementara sudah dihapus.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 11 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/types/menu.ts` | **Baru** — tipe publik `PublicMenuItem`/`PublicModifierGroup`/`PublicCategory`/`PublicMenuCatalog` (tanpa `costPrice`) |
| `src/lib/menu-select.ts` | **Baru** — `select` Prisma bersama (`modifierOptionSelect`, `modifierGroupSelect`, `menuItemSelect`, `categorySelect`) + tipe `CategoryWithItems` |
| `src/lib/menu-mapper.ts` | **Baru** — `toPublicCategory()` (hitung `isOrderable` server-side) |
| `src/lib/services/customer-menu.ts` | **Baru** — `getCustomerMenuCatalog({ categorySlug? })` dipakai server component **dan** route API |
| `src/app/api/menu/route.ts` | **Diperbarui** — memakai service (payload identik), tetap validasi `?category` |
| `src/lib/menu-filter.ts` | **Baru** — `DIETARY_FILTERS`, `filterMenuItems`, `filterCategories`, `countMatchingItems` |
| `src/lib/menu-filter.test.ts` | **Baru** — 13 test (pencarian nama/deskripsi/kosong/tanpa hasil, filter Best Seller/Pedas/Baru, kombinasi AND, kategori kosong dibuang, tanpa mutasi, hitungan) |
| `src/lib/constants.ts` | **Baru** — `CUSTOMER_HEADER_OFFSET_PX = 125` (offset sticky tabs) |
| `src/components/customer/CategoryTabs.tsx` | **Baru** — tab sticky (`top` = offset header), `IntersectionObserver`, smooth scroll, `aria-current` |
| `src/components/customer/MenuCard.tsx` | **Baru** — kartu ringkas: thumbnail 96px, badge Habis (grayscale), Best Seller, tag Pedas/Baru, harga `formatRupiah`, estimasi menit |
| `src/components/customer/MenuBrowser.tsx` | **Baru** — search instan + clear, chip filter multi-pilih, CategoryTabs, hitungan hasil, empty state + reset, section `id="kategori-<slug>"` dengan `scroll-mt` |
| `src/app/(customer)/t/[tableSlug]/page.tsx` | **Diperbarui** — memuat katalog menu (dengan `try/catch`) dan merender `MenuBrowser`; fallback "Menu belum tersedia" |
| `TODO.md` | `3.2` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`3.3 Katalog Kartu Menu (MenuCard)`**, ubah menjadi `[/]`.
2. **Buat helper label ketersediaan** di `src/lib/menu.ts` (pure + test di `src/lib/menu.test.ts`):
   * `getOrderabilityLabel(item: { isAvailable: boolean; isOrderable: boolean }): "TERSEDIA" | "HABIS" | "DI_LUAR_JAM"` (habis diprioritaskan; `isOrderable=false` + stok ada → `DI_LUAR_JAM`).
   * `getOrderabilityText(label)` → teks UI Indonesia ("Habis", "Di luar jam tayang", "Tersedia").
3. **Perbarui `src/components/customer/MenuCard.tsx`**:
   * Thumbnail **rasio 1:1** (`aspect-square`), ukuran tetap ± `w-[104px]`; `object-cover`; `loading="lazy"`; grayscale + overlay "Habis" bila `!isAvailable`. Boleh tetap `<img>` (host foto belum tentu terdaftar di `next.config.ts`; pertahankan komentar `eslint-disable-next-line`).
   * Ribbon "Best Seller", chip tag (`PEDAS`, `BARU`), estimasi waktu saji.
   * Harga memakai `formatRupiah` + class `tabular-nums`.
   * **Badge kuantitas keranjang** di pojok thumbnail (lingkaran primary) bila `quantityInCart > 0`.
   * Tombol tambah 48×48 (`size="icon"`, ikon `Plus`) di kanan bawah kartu, `aria-label={`Tambah ${item.name} ke keranjang`}`; disabled + label "Habis"/"Tutup" saat `!isOrderable`.
   * Props: `{ item: PublicMenuItem; quantityInCart?: number; onAdd?: (item: PublicMenuItem) => void }`.
4. **`MenuBrowser`**: tambahkan state sementara `quantities: Record<string, number>` (increment pada `onAdd`) dan teruskan `quantityInCart`. **Beri komentar jelas** bahwa state ini SEMENTARA dan akan diganti Zustand cart store pada sub-tugas 3.5 — jangan membuat store sekarang.
5. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`. Untuk memastikan markup kartu benar, pola yang sudah terbukti: render `MenuCard`/`MenuBrowser` via `renderToStaticMarkup` dengan fixture **di skrip sementara** (ingat: butuh `tsconfig` sementara dengan `"jsx": "react-jsx"` dan **hapus file sementara sebelum commit**).
6. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `3.4 Bottom Sheet Kustomisasi Menu (ModifierSheet)`), `git commit` (`feat(customer): polish menu card with availability states and cart badge`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Katalog menu satu jalur**: `getCustomerMenuCatalog()` dipakai server component & `GET /api/menu`; `select` Prisma terpusat di `menu-select.ts`. Jangan menduplikasi query.
* **Sticky offset**: `CUSTOMER_HEADER_OFFSET_PX = 125` (hitung dari kelas header). Bila `CustomerHeader` berubah tinggi, perbarui konstanta ini; section memakai `scroll-mt-[190px]` (header + tabs).
* **Filter**: `MenuBrowser` memfilter di client (instan, tanpa request). Aturan: pencarian di `name`+`description` (case-insensitive), filter dietary **AND**, kategori kosong dibuang.
* **Rahasia**: `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`, stok bahan — jangan pernah ke klien.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; urutan validasi env → slug/query → body → DB.
* **Jangan menambah dependency baru** (Radix/Vitest/toast). Tersedia: framer-motion, lucide-react, cva, clsx, tailwind-merge, zustand (**belum dipakai**).
* **State**: `orderMode` masih `useState` di `CustomerHeader`; keranjang belum ada — akan dibuat di 3.5 (Zustand + persist).
* **Pricing**: `src/lib/pricing.ts` (`formatRupiah`, `calculateOrderTotals`) — jangan menulis ulang rumus.
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
* **[Sesi #1 — 2026-11-03 · 3.1 Header Meja]**: Fondasi UI + `CustomerHeader` + `CallWaiterSheet` + `StartSessionButton` + halaman `/t/[tableSlug]`. Commit `3e4faee`.
* **[Sesi #1 — 2026-11-03 · 3.2 Kategori & Pencarian]**: tipe & select menu bersama, service katalog (dipakai API + server component), `menu-filter.ts` (+13 test), `CategoryTabs` sticky + IntersectionObserver, `MenuBrowser` (search/chip/empty state), `MenuCard` awal. Verifikasi render dengan fixture lolos semua assertion. Commit menyusul.
