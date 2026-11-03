# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> - **Saat Memulai Sesi**: Baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya** di bawah ini, lalu langsung kerjakan tanpa bertanya ulang hal yang sudah tertulis di `CONTEXT.md`.
> - **Saat Menyelesaikan Satu Sub-Tugas**: Timpa bagian **Status Terkini** dengan kondisi terbaru dan tambahkan catatan singkat di **Riwayat Log Estafet**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 3 — Antarmuka Halaman Pelanggan (Mobile-First)` (4/6 selesai)
* **Sub-Tugas Terakhir yang Selesai**: `3.4 Bottom Sheet Kustomisasi Menu (ModifierSheet)` ✅
* **Sub-Tugas yang Sedang Berjalan / Berikutnya**: `3.5 Store Keranjang & Sinkronisasi Group Order (useCartStore)`
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**91 test**, 28 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔. Route: `/t/[tableSlug]` (ƒ, 167 kB) + 3 API (ƒ).
* **Database**: belum tersedia (PostgreSQL 5432 tertutup, Docker tidak ada). `ModifierSheet` belum bisa diuji visual (butuh portal + interaksi browser) — logikanya ditutup unit test.
* **Progress**: 13 dari 31 sub-tugas selesai.

## 2. File yang Sedang / Baru Saja Diedit
| File | Status |
| --- | --- |
| `src/lib/modifier-selection.ts` | **Baru** — `ModifierSelection`, `createInitialSelection` (default / opsi pertama untuk SINGLE wajib), `toggleOption` (SINGLE replace & clear, MULTIPLE toggle + batas `maxSelect`), `isOptionDisabled`, `validateSelection` (required/min/max + opsi asing), `selectionToModifiers`, `calculateSelectionTotal` (memakai `calculateLineTotal`) |
| `src/lib/modifier-selection.test.ts` | **Baru** — 21 test (defaults, replace/clear, batas MULTIPLE, validasi, konversi modifier, total reaktif, kuantitas, delta negatif) |
| `src/components/customer/ModifierSheet.tsx` | **Baru** — `BottomSheet` + grup SINGLE (`role="radiogroup"`/`radio`) & MULTIPLE (`checkbox`), label harga `+Rp …`/`Gratis`/`-Rp …`, stepper kuantitas 48×48 (maks 20), catatan 160 char, error per grup setelah submit, footer sticky total `tabular-nums` + tombol konfirmasi |
| `src/components/customer/MenuBrowser.tsx` | **Diperbarui** — state `customizingItem`, `handleAddToCart()` membuka sheet bila ada modifier (selain itu langsung +1), `handleConfirmCustomization()` menambah `payload.quantity`, render `ModifierSheet` |
| `TODO.md` | `3.4` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next Actionable Step)
1. Ambil **`3.5 Store Keranjang & Sinkronisasi Group Order`**, ubah menjadi `[/]`.
2. **Buat `src/lib/cart.ts`** (pure + `src/lib/cart.test.ts`):
   * `interface CartLine { id: string; menuItemId: string; name: string; imageUrl: string | null; station: StationKey; basePrice: number; unitPrice: number; quantity: number; modifiers: PricingModifierInput[]; note: string }`.
   * `buildCartLineId(menuItemId, modifiers, note)` — gabungan `menuItemId` + id modifier terurut + catatan yang dinormalisasi (trim/lowercase), sehingga baris identik menyatu dan baris berbeda tetap terpisah.
   * `mergeCartLines(lines, incoming)` — jumlahkan `quantity` bila `id` sama.
   * `updateLineQuantity(lines, id, quantity)` — hapus baris bila quantity ≤ 0.
   * `summarizeCart(lines)` → `{ totalQuantity, subtotal }` (subtotal = Σ `unitPrice × quantity`, Rupiah bulat).
   * Uji: id stabil & berbeda untuk modifier berbeda, merge identik, hapus saat 0, subtotal, catatan memengaruhi id.
3. **Buat `src/store/useCartStore.ts`** (Zustand + `persist`, TANPA dependency baru):
   * State: `tableSlug: string | null`, `sessionId: string | null`, `orderType: "DINE_IN" | "TAKEAWAY"`, `lines: CartLine[]`.
   * Actions: `setContext({ tableSlug, sessionId })` (bila `tableSlug` berbeda → kosongkan keranjang), `setOrderType`, `addLine(line)`, `setQuantity(id, quantity)`, `removeLine(id)`, `clear()`, `applyRemoteLines(lines)`.
   * Selector helper (fungsi terpisah, bukan di dalam store): `selectTotalQuantity(state)`, `selectQuantityByItem(state, menuItemId)`.
   * `persist` dengan `name: "fnb-cart"`, `version: 1`, `storage: createJSONStorage(() => localStorage)`, `partialize` hanya `{ tableSlug, sessionId, orderType, lines }`.
   * **Hindari hydration mismatch**: jangan membaca store saat render pertama di server; gunakan hook `useCartHydrated()` (`useEffect` + `useCartStore.persist.hasHydrated()`/`onFinishHydration`) dan tampilkan UI keranjang hanya setelah hydrated.
4. **Sinkronisasi group order** — buat `src/lib/cart-sync.ts`:
   * `interface CartSyncChannel { publish(lines: CartLine[]): void; subscribe(handler): () => void; close(): void }`.
   * Implementasi `createBroadcastCartSync(tableSlug)` memakai `BroadcastChannel("fnb-cart:<tableSlug>")` (tersedia di browser modern) + guard `typeof window === "undefined"` / feature-detect; ini menyinkronkan lintas tab/perangkat pada origin yang sama.
   * Di `MenuBrowser`/`FloatingCart` (3.6) gunakan channel ini untuk memanggil `applyRemoteLines` saat menerima pesan, dan `publish` setiap kali `lines` berubah (debounce ≤ 150 ms).
   * **Dokumentasikan batasan** di HANDOVER: sinkronisasi lintas perangkat sungguhan menunggu Supabase Realtime (butuh kredensial) — jangan mengklaim sudah real-time multi-device.
5. **Integrasikan `MenuBrowser`** dengan store (hapus state sementara `cartQuantities`): `quantityInCart` dari `selectQuantityByItem`, `handleAddToCart` memakai `buildCartLineId` + `addLine` (modifier & catatan dari `ModifierSheet`), `orderType` dibaca dari store. Kirim `tableSlug` + `sessionId` sebagai props dari page → `setContext` pada `useEffect`.
6. **Verifikasi**: `npm test` (cart), `typecheck`, `lint`, `build`. Render-check SSR dengan fixture untuk `MenuBrowser` tetap boleh dipakai (hapus file sementara sebelum commit).
7. Tandai `[x]`, perbarui `HANDOVER.md` (arahkan ke `3.6 Halaman Keranjang, Upselling, & Rincian Biaya`), `git commit` (`feat(customer): add persistent cart store with group-order sync`), push.

## 4. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Modifier**: `createInitialSelection` memilih default; grup SINGLE wajib tanpa default otomatis memilih opsi pertama (mencegah form invalid sejak awal). `toggleOption` tidak pernah mengosongkan grup SINGLE wajib.
* **Harga**: `calculateSelectionTotal`/`selectionToModifiers` hanya pembungkus `calculateLineTotal` di `src/lib/pricing.ts` — jangan menduplikasi rumus.
* **State keranjang**: masih `useState` di `MenuBrowser` (SEMENTARA) → wajib diganti store Zustand di 3.5; hapus komentar "sementara" setelahnya.
* **Bottom sheet** (`src/components/ui/bottom-sheet.tsx`) tidak merender children saat tertutup → state form otomatis segar setiap dibuka.
* **Sticky offset**: `CUSTOMER_HEADER_OFFSET_PX = 125`; section menu `scroll-mt-[190px]`.
* **Rahasia**: `costPrice`, `pinHash`, `currentPin`, `sessionTokenHash`, stok bahan — jangan pernah ke klien.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`.
* **Seed**: `npm run db:seed` / `npm run db:seed:dry`. Meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`. Grup modifier: Level Pedas (wajib, SINGLE), Ukuran (wajib, SINGLE), Extra Topping (MULTIPLE maks 3), Level Gula (wajib, SINGLE).
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
* **[Sesi #1 — 2026-11-03 · 3.3 Kartu Menu]**: `getOrderabilityLabel/Text`, `MenuCard` final, state keranjang sementara. Commit `d69ee24`.
* **[Sesi #1 — 2026-11-03 · 3.4 Modifier Sheet]**: `modifier-selection.ts` (+21 test, total 91), `ModifierSheet` (radio/checkbox, stepper, catatan, validasi, harga reaktif) dan integrasi `MenuBrowser`. `typecheck`/`lint`/`build` hijau. Commit menyusul.
