# FnB Digital

Sistem operasional restoran berbasis web: **QR table ordering**, **POS kasir**, **KDS dapur/bar**, **aplikasi pelayan**, dan **back-office** dalam satu aplikasi Next.js.

## Fitur per peran

| Peran | Halaman | Isi |
| --- | --- | --- |
| Pelanggan | `/t/[tableSlug]` | Menu + modifier, keranjang, upsell, call waiter, bayar QRIS/VA/transfer/tunai, pelacak pesanan, e-struk |
| Kasir | `/cashier`, `/cashier/floor`, `/cashier/walkin`, `/cashier/shift` | Antrean pesanan, tagihan, bayar tunai, split bill, pindah/gabung meja, walk-in, buka/tutup shift + Z-Report, struk ESC/POS |
| Dapur/Bar | `/kds/kitchen`, `/kds/bar`, `/kds/pastry` | Tiket per stasiun, timer SLA berwarna, bump per item/tiket |
| Pelayan | `/runner` | Makanan siap antar, panggilan meja, meja perlu dibersihkan |
| Admin | `/admin/dashboard`, `/admin/menu`, `/admin/tables`, `/admin/inventory` | Analitik + menu engineering, CRUD menu & 86'd, studio QR meja, stok bahan + resep (HPP) |

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript strict
- Tailwind CSS 3.4 (tema terang pelanggan, gelap POS/KDS)
- Prisma 6 + PostgreSQL (Supabase/Neon/VPS)
- Zod, Zustand, Framer Motion, Lucide
- `node:test` + `tsx` untuk unit test

## Mulai cepat (lokal)

```bash
npm install
cp .env.example .env      # isi DATABASE_URL, DIRECT_URL, SESSION_SECRET
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Buka `http://localhost:3000/t/meja-01`.

### Akun contoh hasil seed

| Peran | Email | PIN |
| --- | --- | --- |
| Admin | `admin@fnb.local` | `111111` |
| Kasir | `kasir@fnb.local` | `222222` |
| Dapur | `dapur@fnb.local` | `333333` |
| Waiter | `waiter@fnb.local` | `444444` |

PIN meja `meja-01` s/d `meja-03`: `1234`. **Ganti PIN ini sebelum produksi.**

## Perintah

```bash
npm run dev          # server pengembangan
npm run build        # build produksi
npm start            # jalankan hasil build
npm test             # unit test (node:test)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint

npm run db:deploy    # prisma migrate deploy (produksi)
npm run db:migrate   # prisma migrate dev (lokal)
npm run db:seed      # isi data contoh
npm run db:seed:dry  # validasi data seed tanpa menulis
```

## Deployment produksi (VPS Ubuntu + Supabase)

Target yang diuji: Ubuntu 24.04, 2 vCPU / 2 GB RAM, Nginx + PM2, database Supabase (Singapore).

### 1. Siapkan VPS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx certbot python3-certbot-nginx postgresql-client
sudo npm i -g pm2

# Swap 1 GB (membantu saat `next build` di RAM 2 GB)
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. Ambil kode & konfigurasi

```bash
sudo mkdir -p /var/www && sudo chown -R "$USER":"$USER" /var/www
git clone https://github.com/frmnardd/fnb-digital.git /var/www/fnb
cd /var/www/fnb
cp .env.example .env && nano .env
nano ecosystem.config.cjs    # sesuaikan `cwd` bila folder berbeda
```

Isi `.env` (lihat tabel variabel di bawah). `DATABASE_URL` memakai **transaction pooler** Supabase (port 6543, `pgbouncer=true`), `DIRECT_URL` memakai **session pooler** (port 5432) untuk migrasi.

### 3. Deploy pertama

```bash
bash scripts/deploy.sh
```

Script tersebut menjalankan: `git pull` → `npm ci` → `prisma generate` + `migrate deploy` → `build` → `pm2 startOrReload` → health check `/` dan `/api/menu`.

### 4. Nginx + HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/fnbtech
sudo ln -s /etc/nginx/sites-available/fnbtech /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d fnbtech.biz.id -d www.fnbtech.biz.id

sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Port `3000` tidak dibuka ke publik; hanya diakses Nginx lewat `127.0.0.1`.

### 5. Update aplikasi

```bash
cd /var/www/fnb && bash scripts/deploy.sh
```

### 6. Backup harian

```bash
sudo crontab -e
# 0 2 * * * /var/www/fnb/scripts/backup-db.sh >> /var/log/fnb-backup.log 2>&1
```

Backup disimpan di `/var/www/fnb/backups` (rotasi 7 hari). Salin juga ke storage lain.

## Variabel lingkungan

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | ya | Pooler transaksi Supabase/Neon (port 6543, `pgbouncer=true`) |
| `DIRECT_URL` | ya | Koneksi untuk migrasi (session pooler port 5432) |
| `SESSION_SECRET` | ya | 32+ karakter acak; dipakai menandatangani sesi meja & hash PIN |
| `NEXT_PUBLIC_APP_URL` | disarankan | Domain publik untuk QR & tautan struk |
| `RESTAURANT_TIMEZONE` | tidak | Default `Asia/Jakarta` |
| `PAYMENT_PROVIDER` | tidak | `midtrans` / `xendit` / `manual` |
| `MIDTRANS_SERVER_KEY` | tidak | Tanpa ini QRIS berjalan mode demo |
| `MIDTRANS_IS_PRODUCTION` | tidak | `false` untuk sandbox |
| `PAYMENT_ALLOW_UNSIGNED_WEBHOOK` | tidak | **Wajib `false`** di server publik |

Webhook Midtrans: `https://<domain>/api/webhooks/payment`.

## Keamanan & batasan saat ini

- **Belum ada autentikasi staf (RBAC).** Endpoint POS/KDS/Runner/Admin masih terbuka dan ditandai `TODO(RBAC)`. Jangan diekspos publik sebelum modul login staf selesai.
- Gambar QR meja masih memakai layanan `api.qrserver.com` (interim).
- Struk ESC/POS menghasilkan payload mentah; cetak langsung butuh jembatan lokal (QZ Tray/WebUSB).
- `imageUrl` menu masih berupa input teks (belum ada unggah berkas).
- Rate-limit PIN bersifat in-memory (hilang saat restart, tidak cocok untuk multi-instance).

## Struktur folder

```text
src/
  app/
    (customer)/t/[tableSlug]/    # menu, checkout, pembayaran, tracker
    (pos)/cashier/               # antrean, floor plan, walk-in, shift
    (kds)/kds/[station]/         # tiket dapur & bar
    (staff)/runner/              # aplikasi pelayan
    (admin)/admin/               # back-office
    api/                         # route handlers
  components/{ui,customer,pos,kds,admin,runner}
  lib/{pricing,payment,printer,services,security}
  store/                         # Zustand
  types/                         # tipe global
prisma/                          # schema, migrasi, seeder
deploy/                          # konfigurasi Nginx
scripts/                         # deploy.sh, backup-db.sh
```

## Lisensi

Proyek internal. Hak cipta pemilik repositori.
