# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) saat terjadi pergantian AI Agent, pergantian sesi obrolan, atau setelah terkena *rate limit* (Error 429).
> **Seluruh sub-tugas pada `TODO.md` sudah selesai (37/37).** Dokumen ini kini menjadi catatan status akhir proyek + checklist produksi. Bila ada tugas baru, tambahkan dulu ke `TODO.md`, lalu ikuti pola kerja yang sama.

## 1. Status Proyek Terkini (Current State)
* **Status**: ✅ **SEMUA FASE SELESAI** — Fase 1 s.d. Fase 7 (7.4 tuntas).
* **Sub-Tugas Terakhir yang Selesai**: `7.4 Dashboard Analitik Penjualan & Menu Engineering` ✅
* **Kondisi Build / Kompilasi**: **HIJAU** — `npm test` (**411 test**, 138 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Route baru**: `/admin/dashboard`, `GET /api/admin/analytics?days=7` (ƒ).
* **Verifikasi kontrak HTTP**: `/admin/dashboard` → **200** (KPI "Omzet", "Metode Pembayaran", "Jam Sibuk", "Menu Engineering"); `days=0` → 422 ("must be greater than or equal to 1"), `days=abc` → 422 ("Expected number, received nan"), `days=7` tanpa DB → 500 rapi.
* **Database**: belum pernah dijalankan terhadap PostgreSQL nyata (port 5432 tertutup, Docker tidak tersedia). Semua jalur DB diverifikasi secara statis (Prisma typecheck) + kontrak HTTP (400/422/500).

## 2. Ringkasan Modul yang Sudah Ada
| Area | Isi |
| --- | --- |
| Skema & seed | 16 model Prisma + migrasi init 529 baris; seeder idempoten (2 area, 10 meja, 4 kategori, 12 menu, 4 modifier group, 4 staf) |
| Harga | `src/lib/pricing.ts` — subtotal → diskon → service 5% → PB1 10% → kode unik (manual transfer), 24+ test |
| Pelanggan | `/t/[tableSlug]` (menu, modifier, keranjang, upsell, call waiter), pembayaran QRIS/VA/transfer manual/tunai, tracker, e-struk |
| Kasir | `/cashier` (antrean + bill + cash + split), `/cashier/floor` (denah, pindah meja, gabung tagihan), `/cashier/walkin`, `/cashier/shift` (buka/tutup, blind count, Z-report) |
| KDS | `/kds/kitchen|bar|pastry` — aging timer, bump per item/tiket |
| Runner | `/runner` — siap antar, panggilan meja, meja kotor |
| Admin | `/admin/menu` (CRUD + 86'd), `/admin/tables` (studio QR + cetak batch), `/admin/inventory` (stok + resep + HPP), `/admin/dashboard` (analitik + menu engineering) |
| Operasional | Otorisasi PIN supervisor (token 5 menit), cetak ESC/POS 58/80 mm, webhook Midtrans idempoten, deduksi stok otomatis saat PAID |

## 3. File yang Baru Saja Diedit (7.4)
| File | Status |
| --- | --- |
| `src/lib/analytics.ts` | **Baru** — `summarizeSales`, `groupRevenueByDay` (zona Asia/Jakarta, isi hari nol), `groupPaymentMethods` (+share), `getPeakHours` (24 bucket), `getMedian`, `classifyMenuEngineering` (STAR/PLOWHORSE/PUZZLE/DOG) |
| `src/lib/analytics.test.ts` | **Baru** — 11 test |
| `src/lib/services/analytics.ts` | **Baru** — `getDashboardData({ days })`: KPI, seri harian, mix pembayaran, jam sibuk, matriks menu engineering |
| `src/app/api/admin/analytics/route.ts` | **Baru** — `GET` dengan Zod `coerce.number().int().min(1).max(90)` |
| `src/app/(admin)/layout.tsx` | Diperbarui — menu **Dashboard** aktif |
| `src/app/(admin)/admin/dashboard/page.tsx` | **Baru** — server component + fallback kosong |
| `src/components/admin/DashboardView.tsx` | **Baru** — KPI cards, grafik batang harian, mix pembayaran, jam sibuk, tabel kuadran; pemilih 7/30/90 hari |
| `TODO.md` | `7.4` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 4. Checklist Menuju Produksi (WAJIB dibaca sebelum deploy)
1. **Database**: siapkan PostgreSQL, isi `DATABASE_URL`, jalankan `npx prisma migrate deploy` lalu `npm run db:seed`. Migrasi init **jangan** diedit.
2. **Env**: `SESSION_SECRET` (32+ karakter), `NEXT_PUBLIC_APP_URL` (untuk QR/cetak), `MIDTRANS_SERVER_KEY`/`MIDTRANS_CLIENT_KEY`/`MIDTRANS_IS_PRODUCTION`, kredensial storage bila memakai upload gambar.
3. **RBAC staf (belum ada)**: semua endpoint POS/KDS/Runner/Admin masih terbuka dan bertanda `TODO(RBAC)`. Wajib menambahkan autentikasi staf (cookie sesi httpOnly + middleware per route group) sebelum go-live. Endpoint `supervisor-authorize` juga masih menerima `staffEmail` dari body.
4. **QR code**: masih memakai layanan eksternal `api.qrserver.com` (interim). Untuk operasional offline, ganti dengan generator lokal/aset yang di-host sendiri.
5. **ESC/POS**: endpoint menghasilkan payload mentah; cetak langsung butuh jembatan lokal (QZ Tray/WebUSB/agen cetak).
6. **Uji end-to-end dengan DB nyata**: alur scan QR → pesan → bayar → kasir → KDS → runner → tutup shift → analitik belum pernah dijalankan dengan data sungguhan.
7. **Upload gambar menu**: `imageUrl` masih berupa input teks; belum ada endpoint upload/optimasi WebP.
8. **Observability**: belum ada logging terstruktur/error tracking.

## 5. Catatan Penting / Kendala Teknis (Known Issues & Decisions)
* **Deduksi stok** hanya sekali saat transisi ke PAID (`cashier-confirm` & webhook).
* **Port bentrok**: cek `Get-NetTCPConnection -LocalPort <port>` sebelum `next start`; bila semua route 404, request mengenai proses lain di IPv4 (Next hanya bind IPv6). Pakai port baru (terakhir dipakai: 3215).
* **PENTING — jangan menulis file non-ASCII memakai PowerShell `Set-Content`/`Add-Content`** (mojibake & BOM). Gunakan `write`/`edit`.
* **Lint JSX**: apostrof di teks JSX wajib `&apos;`.
* **Satu jalur order**: `createOrder()` (`src/lib/services/order-creation.ts`) dipakai `POST /api/orders` & `/api/pos/walk-in`.
* **Soft delete menu**: `DELETE /api/admin/menu-items/[id]` menonaktifkan, bukan menghapus.
* **POS/KDS** `.dark`, 56px touch, `tabular-nums`; modul pelanggan/admin bertema terang.
* **Rahasia**: `MIDTRANS_SERVER_KEY`, `costPrice` (jangan kirim ke endpoint publik), `pinHash`, `currentPin`, `sessionTokenHash`.
* **BUG SSR ZUSTAND**: guard `useCartStore.persist` bila storage tidak tersedia.
* **Kontrak API**: sukses `{ data }`, gagal `{ error: { code, message, details? } }`; biarkan `ZodError` naik ke `handleRouteError`.
* **Seed**: `npm run db:seed` / `db:seed:dry`; meja `meja-01..03` PIN `1234`; staf `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`.
* **Sandbox**: `npm install --ignore-scripts`; cache `./.npm-cache`; tanpa `next/font/google`.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya.

## 6. Riwayat Log Estafet (Chronological Relay History)
* **[Sesi #0]**: Perencanaan arsitektur + 3 file memori eksternal.
* **[Sesi #1 — 1.1–1.6]**: Setup Next.js 15.5.28, 16 model Prisma + migrasi init, seeder idempoten, pricing engine. Commit `5011a02` … `6bf645d`.
* **[Sesi #1 — 2.1–2.3]**: Sesi QR meja, katalog menu publik, call waiter. Commit `f5ce4e3`, `2c7e45e`, `f0913e1`.
* **[Sesi #1 — 3.1–3.6]**: UI pelanggan (header, kategori, kartu menu, modifier, cart store + sync, cart sheet + upsell). Commit `3e4faee` … `6f551dc`.
* **[Sesi #1 — 4.1–4.6]**: Order API, QRIS, VA & transfer manual, tunai kasir, webhook, tracker & e-struk. Commit `4a60c78` … `02f7877`.
* **[Sesi #1 — 5.1–5.9]**: POS 3-panel, validasi bayar, cash modal, floor plan, split/merge/move, walk-in, supervisor PIN, shift & laci kas, ESC/POS. Commit `165f938` … `db96455`.
* **[Sesi #1 — 6.1–6.3]**: KDS board + bump, runner mobile. Commit `2a4916e`, `0070f5e`, `7cee248`.
* **[Sesi #1 — 7.1–7.3]**: Admin menu (86'd), QR studio, inventori & resep (deduksi stok otomatis). Commit `d56f2ae`, `ee0091e`, `afacf4a`.
* **[Sesi #1 — 7.4]**: Dashboard analitik & Menu Engineering. 411 test lulus; probe 200/422/500. Commit menyusul — **proyek selesai**.
