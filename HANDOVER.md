# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) antar sesi/agen.
> - **Saat memulai sesi**: baca **Status Terkini** + **Instruksi Spesifik untuk Agent Berikutnya**.
> - **Saat menyelesaikan satu sub-tugas**: timpa Status Terkini, tambahkan Riwayat Log, commit + push.
> - Fase 1–7 selesai (37 sub-tugas). **Fase 8 (kesiapan produksi)**: 8.1 & 8.2 selesai.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 8 — Kesiapan Produksi` (2/4 selesai)
* **Sub-Tugas Terakhir**: `8.2 Autentikasi Staf & RBAC` ✅
* **Sub-Tugas Berikutnya**: `8.3 Seed Bahan Baku & Resep Contoh` (lalu `8.4 Higiene Produksi`)
* **Build**: **HIJAU** — `npm test` (**422 test**, 141 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔ (middleware 35 kB).
* **Database**: Supabase Singapore, sudah dimigrasi + seed. **Ada data uji**: `ORD-0001` (SERVED) dan **satu shift OPEN untuk kasir** (modal Rp150.000) hasil pengujian RBAC → bereskan di 8.4.
* **Status deploy**: aplikasi sudah live di VPS (PM2 + Nginx + HTTPS `fnbtech.biz.id`) **dengan Nginx Basic Auth sementara**. Setelah redeploy RBAC, Basic Auth itu **harus dilepas** agar pelanggan bisa memesan.
* **Progress**: 39 dari 41 sub-tugas.

## 2. Hasil Uji RBAC (matriks, sudah diverifikasi runtime)
| Skenario | Hasil |
| --- | --- |
| `GET /cashier` tanpa sesi | **307** → `/login?next=%2Fcashier` |
| `GET /api/admin/menu` tanpa sesi | **401** JSON |
| `GET /login` | **200** (publik) |
| Login PIN salah | **401** + `details.remainingAttempts` |
| Login kasir benar | **200** + cookie `fnb_staff_session` (HttpOnly, SameSite=lax, Secure, 12 jam) |
| Kasir: `/cashier`, `/api/pos/shift` | **200** |
| Kasir: `/admin/menu`, `/api/admin/menu` | **307** → `/cashier?error=forbidden`, **403** |
| Kasir: `/kds/kitchen` | **307** → `/login?error=forbidden` (peran tidak cocok) |
| Admin: `/admin/menu`, `/api/admin/menu`, `/cashier` | **200** |
| Dapur: `/kds/kitchen` / `/cashier` | **200** / **307** |
| `POST /api/pos/shift/open` (kasir, sesi) | **201** (staf diambil dari sesi) |
| `POST /api/pos/supervisor-authorize` (kasir, sesi) | **200** + token 191 char |
| `POST /api/auth/staff/logout` | **200** (cookie dihapus) |

## 3. File yang Baru Saja Diedit (8.2)
| File | Status |
| --- | --- |
| `src/lib/auth/session.ts` | **Baru** — token sesi stateless HMAC-SHA256 via **Web Crypto** (edge-safe): `signStaffSession`, `verifyStaffSession` (constant-time, cek exp), `hasStaffRole`, `STAFF_ROLES`, `STAFF_SESSION_COOKIE`, TTL 12 jam |
| `src/lib/auth/session.test.ts` | **Baru** — 11 test (sign/verify, expired, signature palsu, secret lain, payload diubah, token rusak, role) |
| `src/lib/auth/staff.ts` | **Baru** — `setStaffSessionCookie` (httpOnly/secure/sameSite), `clearStaffSessionCookie`, `getStaffSession`, `requireStaffPage` (redirect), `requireStaffApi` (ApiError 401/403) |
| `src/middleware.ts` | **Baru** — proteksi `/cashier`, `/kds`, `/runner`, `/admin` + `/api/pos`, `/api/kds`, `/api/runner`, `/api/admin`; admin-only; verifikasi signature (bukan cek cookie saja) |
| `src/app/api/auth/staff/login/route.ts` | **Baru** — email + PIN 6 digit, rate limit 5×/10 menit (`staff-login:<email>:<ip>`), pesan seragam anti-enumerasi |
| `src/app/api/auth/staff/logout/route.ts` | **Baru** — `POST` (JSON) & `GET` (redirect ke `/login`) |
| `src/app/(auth)/login/page.tsx` | **Baru** — halaman login; sudah login → redirect ke `next` |
| `src/components/auth/LoginForm.tsx` | **Baru** — email + PIN, pesan sisa percobaan, hint akun seed hanya di dev |
| `src/app/(pos)/layout.tsx`, `(kds)/layout.tsx`, `(staff)/layout.tsx`, `(admin)/layout.tsx` | Diperbarui — `requireStaffPage` dengan peran: POS `ADMIN/CASHIER`, KDS `ADMIN/KITCHEN`, Runner `ADMIN/WAITER`, Admin `ADMIN` |
| `src/app/api/pos/shift/route.ts`, `shift/open/route.ts` | Diperbarui — staf dari sesi (`requireStaffApi`), `staffEmail` dihapus; `open` menolak shift ganda (409) |
| `src/lib/services/shift.ts` | `getCurrentShift(staffId)` (sebelumnya email) |
| `src/app/api/pos/supervisor-authorize/route.ts` | Diperbarui — staf dari sesi, body `{ pin, action, targetId? }`, PIN diverifikasi ke `pinHash` staf yang login |
| `src/app/api/orders/[orderNumber]/bill`, `split`, `cashier-confirm`, `receipt/escpos` | Diperbarui — `requireStaffApi(["ADMIN","CASHIER"])` |
| `src/components/pos/ShiftWorkspace.tsx` | Input email kasir dihapus; fetch `/api/pos/shift` tanpa query |
| `src/components/pos/SupervisorPinModal.tsx` | Input email dihapus; hanya PIN 6 digit |
| `src/components/pos/PosSidebar.tsx` | Tombol **Keluar** (GET logout → `/login`) |
| `README.md` | Bagian keamanan diperbarui (RBAC aktif, sisa batasan) |
| `TODO.md` | `8.2` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 4. Instruksi Spesifik untuk Agent Berikutnya (8.3 → 8.4)
1. **8.3 Seed Bahan Baku & Resep**: tambahkan ke `prisma/seed-data.ts` + `prisma/seed.ts` (idempoten):
   * ±8 `Ingredient` (contoh: Beras GRAM, Ayam GRAM, Telur PIECE, Minyak GRAM, Bawang GRAM, Cabai GRAM, Teh PACK, Gula GRAM) dengan `currentStock`, `minThreshold`, `costPerUnit` realistis.
   * `MenuRecipe` untuk 4–6 menu (mis. Nasi Goreng 120 g beras + 100 g ayam + 1 telur + 15 g minyak), sehingga `MenuItem.costPrice` bisa dihitung.
   * Setelah seed, jalankan `npm run db:seed` lalu cek `/api/admin/inventory` (bahan > 0) dan `/admin/dashboard` (margin/unit terisi).
2. **8.4 Higiene Produksi**:
   * Tutup shift kasir yang masih OPEN (`POST /api/pos/shift/close` dengan `actualEndingCash` wajar) atau hapus lewat Prisma.
   * Bersihkan data uji: hapus `Order`/`Payment`/`OrderItem`/`CashierShift`/`CashDrawerLog`/`TableSession` hasil uji (sisakan master: area, meja, kategori, menu, staf, modifier).
   * **Rotasi kredensial** yang pernah terekspos di chat: reset password Supabase (Ctrl+K → "reset database password"), perbarui `.env` lokal + VPS, buat `SESSION_SECRET` baru di VPS (`openssl rand -base64 48`), lalu `bash scripts/deploy.sh`.
   * Ganti PIN staf seed (`111111`/`222222`/`333333`/`444444`).
3. **Langkah deploy setelah 8.2 (manual, di VPS)**:
   * `bash scripts/deploy.sh`
   * Hapus 2 baris `auth_basic*` dari `/etc/nginx/sites-available/fnbtech` → `nginx -t && systemctl reload nginx` (kalau dibiarkan, pelanggan tidak bisa scan QR).
   * Uji: `https://fnbtech.biz.id/login` (staf) dan `https://fnbtech.biz.id/t/meja-01` (pelanggan tanpa login).
4. Tandai `[x]`, perbarui HANDOVER, commit + push.

## 5. Catatan Penting / Kendala
* **Cookie sesi memakai flag `Secure` di produksi** → login hanya berfungsi lewat **HTTPS**. Jangan uji login via `http://IP:3000`; gunakan domain.
* **Uji lokal `next start` (http)**: cookie `Secure` tidak disimpan browser → gunakan `npm run dev` bila perlu menguji login di lokal, atau kirim cookie manual saat probing.
* **Middleware berjalan di Edge** — jangan menambahkan impor `node:crypto`/Prisma ke `src/lib/auth/session.ts`.
* **Rate limit PIN in-memory** → tetap `instances: 1` di PM2.
* **Endpoint publik yang disengaja**: `POST /api/orders`, `/api/orders/[n]/payment/*`, `/api/orders/[n]/track`, `/api/orders/[n]/pin`, `/api/tables/*`, `/api/menu`, `/api/webhooks/payment`.
* **Endpoint staf**: `/api/pos/*`, `/api/kds/*`, `/api/runner/*`, `/api/admin/*`, plus `bill`, `split`, `cashier-confirm`, `receipt/escpos`.
* **Shift `OPEN` menggantung** dari uji RBAC (kasir, Rp150.000) → wajib dibereskan di 8.4.
* **Jangan menulis file non-ASCII lewat PowerShell `Set-Content`** (mojibake). Gunakan `write`/`edit`.
* **Port bentrok**: cek `Get-NetTCPConnection -LocalPort <port>` sebelum `next start` (terakhir: 3217).
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — sinkronkan setiap sesi.

## 6. Riwayat Log Estafet (ringkas)
* **[Sesi #1] 1.1–1.6**: scaffold Next.js 15.5.28, 16 model Prisma + migrasi init, seeder, pricing engine. `5011a02`…`6bf645d`.
* **[Sesi #1] 2.1–2.3**: sesi QR meja, katalog menu, call waiter. `f5ce4e3`, `2c7e45e`, `f0913e1`.
* **[Sesi #1] 3.1–3.6**: UI pelanggan + keranjang + upsell. `3e4faee`…`6f551dc`.
* **[Sesi #1] 4.1–4.6**: order API, QRIS, VA/transfer, tunai, webhook, tracker & e-struk. `4a60c78`…`02f7877`.
* **[Sesi #1] 5.1–5.9**: POS, bill, split/merge/move, walk-in, supervisor PIN, shift, ESC/POS. `165f938`…`db96455`.
* **[Sesi #1] 6.1–6.3**: KDS + bump, runner. `2a4916e`, `0070f5e`, `7cee248`.
* **[Sesi #1] 7.1–7.4**: admin menu, QR studio, inventori/HPP, analitik. `d56f2ae`, `ee0091e`, `afacf4a`, `8d7720d`.
* **[Sesi #1] Deploy**: Supabase dimigrasi + seed + E2E nyata; artefak deploy (PM2/Nginx/skrip/backup). `d9ebc5c`.
* **[Sesi #1] 8.2 RBAC**: sesi HMAC Web Crypto, login PIN, middleware + proteksi layout/API, `staffEmail` dihapus. Matriks uji runtime lulus. Commit menyusul.
