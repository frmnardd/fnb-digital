# GO-LIVE CHECKLIST — FnB Digital

Runbook singkat untuk membuka `https://fnbtech.biz.id` ke publik.
Jalankan berurutan; setiap langkah punya cara verifikasi sendiri.

---

## 1. Deploy kode terbaru (RBAC + seed inventori)

```bash
cd /var/www/fnb
bash scripts/deploy.sh
```

Verifikasi:

```bash
curl -s -o /dev/null -w "root=%{http_code}\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "login=%{http_code}\n" http://127.0.0.1:3000/login
curl -s -o /dev/null -w "admin_api=%{http_code}\n" http://127.0.0.1:3000/api/admin/menu
```

Harapan: `root=200`, `login=200`, `admin_api=401` (belum login).

## 2. Lepas Nginx Basic Auth

Basic Auth sementara akan memblokir pelanggan, jadi harus dilepas setelah RBAC aktif.

```bash
grep -n 'auth_basic' /etc/nginx/sites-available/fnbtech   # pastikan hanya 2 baris
sed -i '/auth_basic/d' /etc/nginx/sites-available/fnbtech
nginx -t && systemctl reload nginx
```

Verifikasi: `https://fnbtech.biz.id/t/meja-01` terbuka tanpa prompt password,
sedangkan `https://fnbtech.biz.id/admin/menu` diarahkan ke `/login`.

## 3. Rotasi kredensial (WAJIB — password DB pernah terekspos di chat)

1. Supabase → **Ctrl+K** → `reset database password` → catat password baru.
2. Perbarui `.env` **lokal** dan **VPS** (`DATABASE_URL`, `DIRECT_URL`).
3. Buat `SESSION_SECRET` baru **di VPS**:

```bash
cd /var/www/fnb
nano .env      # SESSION_SECRET="$(openssl rand -base64 48)"  ← tempel hasil perintah berikut
openssl rand -base64 48
bash scripts/deploy.sh
```

> Mengganti `SESSION_SECRET` membuat hash PIN lama tidak valid. Lanjut ke langkah 4.

## 4. Ganti PIN staf (jangan pakai PIN bawaan seed)

```bash
cd /var/www/fnb
STAFF_PIN=246810 npx tsx scripts/set-staff-pin.ts --email admin@fnb.local
STAFF_PIN=135790 npx tsx scripts/set-staff-pin.ts --email kasir@fnb.local
STAFF_PIN=864209 npx tsx scripts/set-staff-pin.ts --email dapur@fnb.local
STAFF_PIN=975310 npx tsx scripts/set-staff-pin.ts --email waiter@fnb.local
```

Gunakan PIN berbeda per orang; catat di tempat aman (bukan di repo).
PIN meja (`1234`) juga sebaiknya diganti sebelum operasional nyata.

## 5. Uji terima (lakukan di browser, bukan curl)

| Uji | Harapan |
| --- | --- |
| `/login` → admin + PIN | masuk ke `/cashier` |
| `/admin/menu` sebagai admin | daftar 12 menu tampil |
| `/admin/inventory` | 12 bahan, 6 resep, HPP terisi |
| `/admin/dashboard` | omzet 0, grafik tampil (data uji sudah dibersihkan) |
| `/t/meja-01` (mode incognito) | menu pelanggan tanpa login |
| Pesan 1 menu → bayar tunai | muncul di `/cashier`, lalu tiket di `/kds/kitchen` |
| `/kds/kitchen` sebagai `dapur` | tiket muncul; tombol Mulai/Siap berfungsi |
| `/runner` sebagai `waiter` | item siap antar muncul |

## 6. Operasional

```bash
# backup harian 02:00
crontab -e
0 2 * * * /var/www/fnb/scripts/backup-db.sh >> /var/log/fnb-backup.log 2>&1

# update aplikasi
cd /var/www/fnb && bash scripts/deploy.sh
```

Midtrans (bila QRIS/VA diaktifkan): isi `MIDTRANS_SERVER_KEY` + `MIDTRANS_IS_PRODUCTION`,
lalu set Notification URL `https://fnbtech.biz.id/api/webhooks/payment`.

## 7. Jika ada masalah

| Gejala | Penyebab umum | Solusi |
| --- | --- | --- |
| Login berhasil tapi balik ke `/login` | diakses lewat `http://` (cookie `Secure`) | gunakan `https://` |
| Semua halaman 502 | PM2 mati | `pm2 status`, `pm2 logs fnb-digital --lines 50` |
| `prisma migrate` gagal `P1001` | pooler/region salah | pakai connection string dari Connect → ORM → Prisma |
| Login selalu "PIN salah" | `SESSION_SECRET` berubah tanpa ganti PIN | jalankan ulang langkah 4 |
| Pelanggan kena prompt password | Basic Auth belum dilepas | ulangi langkah 2 |
