# HANDOVER.md — Log Estafet Antar AI Agent (Session State Log)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah jembatan ingatan (*relay baton*) antar sesi/agen.
> - **Saat memulai sesi**: baca bagian **Status Terkini** dan **Instruksi Spesifik untuk Agent Berikutnya**, lalu kerjakan tanpa bertanya ulang hal yang sudah ada di `CONTEXT.md`.
> - **Saat menyelesaikan satu sub-tugas**: timpa bagian Status Terkini, tambahkan catatan di Riwayat Log Estafet, lalu commit + push.
> - Fase 1–7 (37 sub-tugas) **selesai**. Saat ini masuk **Fase 8: Kesiapan Produksi**.

## 1. Status Proyek Terkini (Current State)
* **Fase Aktif**: `Fase 8 — Kesiapan Produksi` (1/4 selesai)
* **Sub-Tugas Terakhir**: `8.1 Artefak Deploy VPS + Supabase` ✅
* **Sub-Tugas Berikutnya**: `8.2 Autentikasi Staf & RBAC` ← **blocker keamanan terakhir**
* **Kondisi Build**: **HIJAU** — `npm test` (**411 test**, 138 suite) ✔, `typecheck` ✔, `lint` ✔, `build` ✔.
* **Database produksi**: **Supabase Singapore** (`aws-0-ap-southeast-1.pooler.supabase.com`). Migrasi `20261103000000_init` **sudah diterapkan**, seed **sudah dijalankan** (2 area, 10 meja, 4 kategori, 12 menu, 4 modifier group, 13 opsi, 4 staf).
* **Uji E2E nyata (lulus)**: buka sesi `meja-01` → pesan 2 porsi `ORD-0001` (Rp103.950) → konfirmasi tunai kasir → tiket KDS muncul → bump `COOKING`/`READY` (order `READY`) → runner `SERVED` → buka/tutup shift (variance terhitung) → analitik omzet Rp103.950 → toggle 86'd berhasil.
* **Progress**: 38 dari 41 sub-tugas.

## 2. File yang Baru Saja Diedit (8.1)
| File | Status |
| --- | --- |
| `ecosystem.config.cjs` | **Baru** — PM2: app `fnb-digital`, `next start -p 3000`, `instances: 1`, `max_memory_restart 768M`, log ke `logs/`, `TZ=Asia/Jakarta` |
| `deploy/nginx.conf` | **Baru** — reverse proxy `fnbtech.biz.id` + `www`, `client_max_body_size 10m`, gzip, header keamanan, cache `/_next/static` |
| `scripts/deploy.sh` | **Baru** — `git pull` → `npm ci` → `prisma generate` + `migrate deploy` → `build` → `pm2 startOrReload` → health check `/` & `/api/menu` |
| `scripts/backup-db.sh` | **Baru** — `pg_dump` via `DIRECT_URL`, rotasi 7 hari, siap untuk cron 02:00 |
| `package.json` | Ditambah script `db:deploy` (`prisma migrate deploy`) |
| `.gitattributes` | **Baru** — paksa LF untuk `*.sh`, `*.cjs`, `*.conf` |
| `.gitignore` | Ditambah `/logs` dan `/backups` |
| `.env.example` | **Ditulis ulang** — bebas mojibake, hanya variabel yang benar-benar dipakai, contoh Supabase pooler |
| `README.md` | **Ditulis ulang** — fitur per peran, mulai cepat, perintah, deployment VPS+Supabase, tabel env, batasan keamanan |
| `TODO.md` | Fase 8 ditambahkan; `8.1` ditandai `[x]` |
| `HANDOVER.md` | Diperbarui (dokumen ini) |

## 3. Instruksi Spesifik untuk Agent Berikutnya (Next: 8.2 RBAC)
1. Ubah `8.2` menjadi `[/]`.
2. **Pilih pendekatan**: *stateless signed cookie* (disarankan) — tidak perlu migrasi/tabel sesi baru, cukup HMAC. Payload: `{ sub: staffId, role, exp }`, TTL 12 jam, alg HMAC-SHA256.
   * Implementasi di `src/lib/auth/session.ts` memakai **Web Crypto** (`crypto.subtle`), bukan `node:crypto`, agar bisa dipakai di middleware (edge) **dan** route handler.
   * Fungsi: `signStaffSession(payload)`, `verifyStaffSession(token)`, `getStaffSession()` (dari cookie, `next/headers`), `requireStaffPage(roles?)` → `redirect("/login?next=…")`, `requireStaffApi(roles?)` → `ApiError 401/403`.
   * Nama cookie: `fnb_staff_session` (httpOnly, `secure` di produksi, `sameSite=lax`, `path=/`).
3. **Endpoint auth**:
   * `POST /api/auth/staff/login` body `{ email, pin }` → cari `Staff` aktif, verifikasi `pinHash` (`verifyPin`), rate limit `pin-attempts` (kunci `staff-login:<email>:<ip>`), set cookie, respons `{ staff: { id, name, role } }`.
   * `POST /api/auth/staff/logout` → hapus cookie.
4. **Middleware** `src/middleware.ts`: lindungi `/cashier/*`, `/kds/*`, `/runner/*`, `/admin/*` (redirect ke `/login?next=…`) dan `/api/pos/*`, `/api/kds/*`, `/api/runner/*`, `/api/admin/*` (401 JSON). Verifikasi signature di middleware; jangan hanya cek keberadaan cookie.
5. **UI login** `src/app/(auth)/login/page.tsx` + `LoginForm` (email + PIN 6 digit, `autocomplete`, pesan sisa percobaan). Tampilkan daftar staf seed hanya di `NODE_ENV !== "production"`.
6. **Hapus identitas dari body/query** (breaking change yang disengaja):
   * `SupervisorPinModal` → jangan kirim `staffEmail`, ambil dari sesi di server.
   * `ShiftWorkspace` → hapus input email kasir; `GET /api/pos/shift` tanpa query, ambil staf dari sesi.
   * `POST /api/pos/shift/open` & `POST /api/pos/supervisor-authorize` → staf dari sesi, bukan body.
   * Perbarui semua `TODO(RBAC)` setelah endpoint terlindungi.
7. **Test** `src/lib/auth/session.test.ts`: sign/verify, expired, signature salah, payload diubah, role tidak cocok.
8. **Verifikasi**: `typecheck`, `lint`, `test`, `build`; probe: `/cashier` tanpa cookie → 307/302 ke `/login`, login salah → 401 dengan `remainingAttempts`, login benar → cookie ter-set lalu `/cashier` 200, `GET /api/admin/menu` tanpa cookie → 401.
9. Tandai `[x]`, perbarui HANDOVER (arahkan ke 8.3), commit `feat(auth): add staff login and role based access control`, push.

## 4. Langkah Deploy yang Sudah Terverifikasi
1. Supabase: `DATABASE_URL` = transaction pooler 6543 (`pgbouncer=true`), `DIRECT_URL` = session pooler 5432.
2. VPS: `bash scripts/deploy.sh` (butuh `.env` terisi + `ecosystem.config.cjs` disesuaikan bila folder bukan `/var/www/fnb`).
3. Nginx: `cp deploy/nginx.conf /etc/nginx/sites-available/fnbtech` → symlink → `nginx -t` → `certbot --nginx -d fnbtech.biz.id -d www.fnbtech.biz.id`.
4. Update berikutnya: `bash scripts/deploy.sh`.
5. Backup: cron `0 2 * * * /var/www/fnb/scripts/backup-db.sh`.
6. Webhook Midtrans: `https://fnbtech.biz.id/api/webhooks/payment`.

## 5. Catatan Penting / Kendala
* ⚠️ **Kredensial pernah terekspos di chat** (password DB Supabase & `SESSION_SECRET`). **Wajib rotasi** sebelum go-live: Ctrl+K → "reset database password", lalu perbarui `.env` lokal + VPS dan buat `SESSION_SECRET` baru (`openssl rand -base64 48`).
* ⚠️ **Data uji tersisa di Supabase**: `ORD-0001` (SERVED) + 1 shift tertutup (variance Rp103.950 karena shift dibuka setelah pembayaran). Bersihkan pada 8.4.
* **Tanpa autentikasi staf**, jangan ekspos domain publik. Ini alasan 8.2 dikerjakan sebelum deploy terbuka.
* **Skrip bash belum diuji di VPS** (tidak ada bash/WSL di mesin pengembangan); LF sudah dipaksa lewat `.gitattributes`, sintaks diperiksa manual. Uji `bash scripts/deploy.sh` saat deploy pertama.
* **`npm ci` membutuhkan devDependencies** (build & seeder memakai `tsx`, `typescript`) — jangan pakai `--omit=dev` di server.
* **Rate limit PIN in-memory** → tetap `instances: 1` sampai pindah ke Redis/DB.
* **Bahan baku & resep masih kosong** (8.3) sehingga menu engineering memakai margin dari harga jual saja.
* **Jangan menulis file non-ASCII via PowerShell `Set-Content`/`Add-Content`** (penyebab mojibake di README/`.env.example` lama). Gunakan `write`/`edit`.
* **Lint JSX**: apostrof wajib `&apos;`.
* **Port bentrok**: cek `Get-NetTCPConnection -LocalPort <port>` sebelum `next start` (terakhir dipakai 3216).
* **Seed**: `npm run db:seed`; akun `admin@fnb.local/111111`, `kasir@fnb.local/222222`, `dapur@fnb.local/333333`, `waiter@fnb.local/444444`; meja `meja-01..03` PIN `1234` — **ganti sebelum produksi**.
* **Memory files** ada di root repo **dan** `C:\Users\Firman Ardiansyah\Downloads\` — perbarui keduanya.

## 6. Riwayat Log Estafet (ringkas)
* **[Sesi #1] 1.1–1.6**: scaffold Next.js 15.5.28, 16 model Prisma + migrasi init, seeder idempoten, pricing engine. Commit `5011a02`…`6bf645d`.
* **[Sesi #1] 2.1–2.3**: sesi QR meja, katalog menu, call waiter. `f5ce4e3`, `2c7e45e`, `f0913e1`.
* **[Sesi #1] 3.1–3.6**: UI pelanggan + keranjang + upsell. `3e4faee`…`6f551dc`.
* **[Sesi #1] 4.1–4.6**: order API, QRIS, VA/manual transfer, tunai, webhook, tracker & e-struk. `4a60c78`…`02f7877`.
* **[Sesi #1] 5.1–5.9**: POS, bill, split/merge/move, walk-in, supervisor PIN, shift, ESC/POS. `165f938`…`db96455`.
* **[Sesi #1] 6.1–6.3**: KDS + bump, runner. `2a4916e`, `0070f5e`, `7cee248`.
* **[Sesi #1] 7.1–7.4**: admin menu, QR studio, inventori/HPP, analitik. `d56f2ae`, `ee0091e`, `afacf4a`, `8d7720d`.
* **[Sesi #1] Deploy prep**: Supabase Singapore dimigrasi + seed + E2E nyata lulus; artefak deploy (PM2/Nginx/skrip/backup) ditambahkan; README & `.env.example` ditulis ulang. Commit menyusul.
