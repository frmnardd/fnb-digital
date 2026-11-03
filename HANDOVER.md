# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 3 — Antarmuka Halaman Pelanggan (Mobile-First)` (3/6 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `3.3 Katalog Kartu Menu (MenuCard)` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `3.4 Bottom Sheet Kustomisasi Menu (ModifierSheet)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**70 test**, 22 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔. Route: `/t/[tableSlug]` (ƒ, 165 kB) + 3 API (ƒ).
* **Verifikasi UI dengan data (tanpa DB)**: `MenuCard` dirender via `renderToStaticMarkup` + fixture → `aspect-square`, `aria-label` tombol tambah, badge kuantitas (`2 di keranjang`), harga `Rp 38.000`, `tabular-nums`, tag Pedas/Baru, Best Seller, label "Habis" (tanpa tombol tambah), label "Di luar jam tayang" — semua LOLOS. Skrip sementara sudah dihapus.
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada).
* **Progress**: 12 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/menu.ts` | **Diperbarui** — tambah `OrderabilityLabel`, `getOrderabilityLabel()` (HABIS diprioritaskan), `getOrderabilityText()` |
| `src/lib/menu.test.ts` | **Diperbarui** — 3 test baru untuk label ketersediaan (total 70 test) |
| `src/components/customer/MenuCard.tsx` | **Diperbarui** — thumbnail `aspect-square w-[104px]`, grayscale + overlay "Habis", badge kuantitas keranjang, ribbon Best Seller, chip tag, harga `tabular-nums`, tombol tambah bulat 48×48 (`Plus`) / label status saat tidak bisa dipesan |
| `src/components/customer/MenuBrowser.tsx` | **Diperbarui** — state sementara `cartQuantities` + `handleAddToCart()` (ditandai jelas: akan diganti Zustand di 3.5), meneruskan `quantityInCart` & `onAdd` |
| `TODO.md` | `3.3` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`3.4 Bottom Sheet Kustomisasi Menu (ModifierSheet)`**, ubah menjadi `[/]`.
2. **Buat `src/lib/modifier-selection.ts`** (pure, tanpa React) + `src/lib/modifier-selection.test.ts`:
   * `type ModifierSelection = Record<string, string[]>` (key = `groupId`, value = daftar `optionId`).
   * `createInitialSelection(groups)` — pilih opsi `isDefault`; untuk grup **SINGLE wajib** yang belum punya default, preselect opsi pertama (agar pelanggan tidak melihat form invalid sejak awal). Grup MULTIPLE default kosong.
   * `toggleOption(selection, group, optionId)` — SINGLE: ganti isi grup (klik opsi terpilih lagi = kosongkan bila grup tidak wajib); MULTIPLE: toggle, **abaikan** bila sudah mencapai `maxSelect` (kembalikan selection lama).
   * `isOptionDisabled(group, selection, optionId)` — untuk menonaktifkan opsi saat `maxSelect` tercapai.
   * `validateSelection(groups, selection)` → `{ valid: boolean; errors: Array<{ groupId: string; message: string }> }` (cek `isRequired`, `minSelect`, `maxSelect`, opsi tidak tersedia).
   * `selectionToModifiers(groups, selection)` → `PricingModifierInput[]` (`id: `${groupId}:${optionId}``, `name`, `priceDelta`) siap dipakai `src/lib/pricing.ts`.
   * `calculateSelectionTotal(basePrice, groups, selection, quantity)` → `{ unitPrice, total }` memakai `calculateLineTotal()` dari `src/lib/pricing.ts` (JANGAN menulis ulang rumus).
   * Uji minimal: defaults, SINGLE replace/clear, MULTIPLE toggle & batas `maxSelect`, required gagal/lulus, `minSelect` gagal, total dengan `priceDelta` positif/negatif, kuantitas > 1, dan `selectionToModifiers` menghasilkan harga sesuai.
3. **Buat `src/components/customer/ModifierSheet.tsx`** (`"use client"`, memakai `BottomSheet` yang sudah ada):
   * Props: `{ item: PublicMenuItem | null; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: (payload: { item: PublicMenuItem; quantity: number; modifiers: PricingModifierInput[]; note: string; unitPrice: number; total: number }) => void }`.
   * Saat `open` berganti untuk item baru → reset state (`createInitialSelection`), kuantitas 1, catatan kosong.
   * Grup **SINGLE** → tombol radio-like (satu baris per opsi, tinggi ≥ 44px, `role="radiogroup"` + `aria-checked`); grup **MULTIPLE** → baris checkbox (`aria-checked`), tampilkan label `+Rp 8.000` (pakai `formatRupiah`) atau "Gratis"; opsi melewati `maxSelect` dinonaktifkan.
   * Kuantitas: tombol − / + 48×48 (`Minus`/`Plus`), tampilkan angka `tabular-nums`, min 1, max 20.
   * Catatan khusus `textarea` max 160 + penghitung karakter.
   * Jika ada grup wajib belum dipilih → tampilkan pesan error per grup + tombol "Tambah ke Keranjang" disabled.
   * Footer sticky di dalam sheet: total harga (`tabular-nums`, dihitung reaktif dengan `calculateSelectionTotal`) + tombol konfirmasi 48px.
4. **`MenuBrowser`**: klik `+` pada `MenuCard` → bila `item.modifierGroups.length > 0` buka `ModifierSheet`, selain itu langsung tambah kuantitas. `onConfirm` menambah `quantity` ke state sementara `cartQuantities` (masih sementara sampai 3.5) dan menutup sheet.
5. **Verifikasi**: `npm test`, `typecheck`, `lint`, `build`. `ModifierSheet` tidak bisa diverifikasi lewat SSR (butuh portal + efek), jadi andalkan unit test modul seleksi + build; jangan mengklaim uji visual tanpa bukti.
6. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `3.5 Store Keranjang & Sinkronisasi Group Order (useCartStore)`), `git commit` (`feat(customer): add modifier bottom sheet with reactive pricing`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Harga**: selalu lewat `src/lib/pricing.ts` (`calculateLineTotal`, `calculateOrderTotals`, `formatRupiah`). `selectionToModifiers()` hanya menyiapkan input, bukan menghitung sendiri.
* **State keranjang masih sementara** di `MenuBrowser` (`cartQuantities`) — akan diganti `useCartStore` (Zustand + persist) pada 3.5. Jangan menambah logika diskon/pajak di komponen.
* **Bottom sheet** sudah tersedia di `src/components/ui/bottom-sheet.tsx` (portal + Framer Motion + Esc + kunci scroll). Tidak ada Radix — jangan menambah dependency.
* **Sticky offset**: `CUSTOMER_HEADER_OFFSET_PX = 125`; section menu memakai `scroll-mt-[190px]`.
* **Rahasia**: `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`, stok bahan — jangan pernah ke klien.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`.
* **Seed**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`. Grup modifier seed: Level Pedas (SINGLE wajib), Ukuran (SINGLE wajib), Extra Topping (MULTIPLE maks 3), Level Gula (SINGLE wajib).
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
* **[Sesi #1 — 2026-11-03 · 3.2 Kategori & Pencarian]**: tipe & select menu bersama, service katalog, `menu-filter.ts` (+13 test), `CategoryTabs`, `MenuBrowser`, `MenuCard` awal. Commit `91e698f`.
* **[Sesi #1 — 2026-11-03 · 3.3 Kartu Menu]**: `getOrderabilityLabel/Text` (+3 test), `MenuCard` final (gambar 1:1, badge habis/kuantitas, tombol tambah 48px), integrasi state sementara di `MenuBrowser`. Verifikasi SSR fixture lolos 11 assertion. Commit menyusul.
