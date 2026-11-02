# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 3 — Antarmuka Halaman Pelanggan (Mobile-First)` (1/6 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `3.1 Header Meja & Quick Action Bar` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `3.2 Navigasi Kategori Sticky & Pencarian Instan`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (54 test) ✔, `typecheck` ✔, `lint` ✔, `build` ✔. Route: `/t/[tableSlug]` (ƒ, 162 kB First Load JS), 3 API (ƒ).
* **Smoke test 3.1**: `GET /t/meja-01` → **HTTP 200** menampilkan empty state "Sistem belum siap" (karena DB belum ada); `GET /t/BAD%20SLUG` → HTTP 200 "Meja tidak ditemukan". Tidak ada 500.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 10 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/components/ui/button.tsx` | **Baru** — `Button` + `buttonVariants` (cva): varian default/secondary/outline/ghost/destructive/success, size sm/default(48px)/lg(56px)/icon |
| `src/components/ui/bottom-sheet.tsx` | **Baru** — bottom sheet tanpa Radix: `createPortal` + Framer Motion, backdrop/Esc/X, kunci scroll body, `role="dialog"` |
| `src/lib/services/customer-table.ts` | **Baru** — `getCustomerTableContext(qrSlug, sessionToken)` → meja + sesi aktif + `isOwner` (verifikasi cookie) |
| `src/app/(customer)/layout.tsx` | **Baru** — tema terang, `min-h-dvh bg-background` |
| `src/app/(customer)/t/[tableSlug]/page.tsx` | **Baru** — server component: header + kartu sesi/CTA mulai sesi + placeholder katalog; fallback "Meja tidak ditemukan" (slug invalid) vs "Sistem belum siap" (DB error), keduanya HTTP 200 |
| `src/components/customer/CustomerHeader.tsx` | **Baru** — identitas restoran, nomor meja + area, badge status sesi, switcher Dine In/Takeaway (≥48px), tombol Panggil Pelayan |
| `src/components/customer/CallWaiterSheet.tsx` | **Baru** — 4 aksi panggilan + catatan 160 char, POST ke call-waiter, tangani 201/409/429 (hitung mundur `retryAfterSeconds` + tombol disabled) |
| `src/components/customer/StartSessionButton.tsx` | **Baru** — POST `/api/tables/[slug]/session` lalu `router.refresh()` |
| `src/lib/security/token.ts` | Tambah konstanta `TABLE_SESSION_COOKIE = "fnb_table_session"` |
| `TODO.md` | `3.1` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`3.2 Navigasi Kategori Sticky & Pencarian Instan`**, ubah menjadi `[/]`.
2. **Buat `src/lib/services/customer-menu.ts`** (server): `getCustomerMenuCatalog()` mengembalikan bentuk yang sama dengan `GET /api/menu` (kategori → item aktif → modifier groups), **tanpa `costPrice`**, plus `isOrderable` dihitung via `isMenuItemOrderable()` dari `src/lib/menu.ts`. Gunakan `select` eksplisit seperti route `/api/menu` (boleh ekstrak konstanta `select` bersama ke `src/lib/menu-select.ts` agar tidak duplikat).
3. **Buat `src/lib/menu-filter.ts`** (pure + unit test `src/lib/menu-filter.test.ts`):
   * `type DietaryFilter = "BEST_SELLER" | "PEDAS" | "BARU"`.
   * `filterMenuItems(items, { search, dietaryFilters })` — pencarian case-insensitive pada `name`/`description`, filter dietary berbasis `isBestSeller` dan `tags` (`PEDAS`, `BARU`), mengembalikan item yang cocok.
   * `filterCategories(categories, ...)` — pertahankan hanya kategori yang masih punya item setelah filter; sediakan `countMatchingItems`.
   * Uji: pencarian sebagian nama, deskripsi, tanpa hasil, kombinasi filter, kategori kosong tersembunyi.
4. **Buat `src/components/customer/MenuBrowser.tsx`** (`"use client"`) yang menerima `categories` dari server component:
   * Bilah pencarian instan (input `type="search"`, ikon `Search`, tombol clear `X`, `aria-label`), state `search` + `dietaryFilters: Set<DietaryFilter>` via `useState`, hasil di-`useMemo` memakai `filterMenuItems`.
   * Chip filter *Best Seller* / *Pedas* / *Baru* (target ≥ 40px, `aria-pressed`), dapat multi-pilih.
   * `CategoryTabs` sticky di bawah header: `top-[…]` harus disesuaikan dengan tinggi header (ukur dulu; header `CustomerHeader` ± 120px → gunakan konstanta `CUSTOMER_HEADER_OFFSET` di `src/lib/constants.ts` dan dokumentasikan). Tab horizontal scroll (`overflow-x-auto no-scrollbar`), state aktif memakai `IntersectionObserver` pada `<section id="kategori-<slug>">`, klik tab → `scrollIntoView({ behavior: "smooth", block: "start" })`.
   * Empty state bila filter tidak menemukan menu ("Menu tidak ditemukan").
   * Render daftar item sederhana dulu (nama, harga via `formatRupiah`, badge `isAvailable`/`isOrderable`); kartu menu penuh dibuat di 3.3 — pisahkan komponen `MenuCard` agar mudah diganti.
5. **Integrasikan ke `src/app/(customer)/t/[tableSlug]/page.tsx`**: ganti placeholder "Katalog menu akan tampil..." dengan `<MenuBrowser categories={...} />`; muat data menu dalam `try/catch` yang sama (bila DB gagal, tetap tampilkan fallback yang sudah ada). Jangan memanggil HTTP ke `/api/menu` dari server component.
6. **Verifikasi**: `npm test` (test filter baru), `typecheck`, `lint`, `build`, lalu smoke test `npx next start -p <port>` + `GET /t/meja-01` (tanpa DB harus tetap 200).
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `3.3 Katalog Kartu Menu (MenuCard)`), `git commit` (`feat(customer): add sticky category tabs, instant search, and dietary filters`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Sticky header**: `CustomerHeader` sudah `sticky top-0 z-30`; elemen sticky berikutnya harus memakai offset tinggi header agar tidak tertutup. Ukur dan simpan sebagai konstanta bersama.
* **Data menu**: server component memuat langsung dari DB (bukan fetch HTTP internal). Respons API `/api/menu` dan service harus konsisten (idealnya berbagi konstanta `select`).
* **Rahasia**: `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`, stok bahan — jangan pernah ke klien.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; urutan validasi env → slug/query → body → DB.
* **Rate limit call waiter**: 2 menit per meja, disimpan di DB; 429 menyertakan `Retry-After` + `details.retryAfterSeconds`.
* **Pricing**: `src/lib/pricing.ts` (`formatRupiah`, `calculateOrderTotals`) — jangan menulis ulang rumus.
* **Jangan menambah dependency baru** (Radix/Vitest/toast) tanpa persetujuan. Sudah tersedia: framer-motion, lucide-react, cva, clsx, tailwind-merge, zustand (belum dipakai).
* **State**: `orderMode` di `CustomerHeader` masih `useState` lokal — akan dipindah ke Zustand store pada 3.5 (keranjang & sinkronisasi group order).
* **Seeder**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`.
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
* **[Sesi #1 — 2026-11-03 · 3.1 Header Meja]**: Fondasi UI (`button`, `bottom-sheet`), service `customer-table`, layout & halaman `/t/[tableSlug]`, `CustomerHeader` (switcher mode + badge sesi), `CallWaiterSheet` (states 201/409/429 + hitung mundur), `StartSessionButton`. Smoke test: slug valid tanpa DB → 200 "Sistem belum siap"; slug invalid → 200 "Meja tidak ditemukan". Commit menyusul.
