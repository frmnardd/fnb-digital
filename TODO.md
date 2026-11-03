# TODO.md — Daftar Tugas Terperinci (Atomic Tasks Checklist)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> 1. Kerjakan tugas secara berurutan dari atas ke bawah.
> 2. Ambil **HANYA SATU** item bertanda `[ ]` pada satu siklus kerja, ubah menjadi `[/]` saat sedang dikerjakan, dan ubah menjadi `[x]` segera setelah selesai dan teruji.
> 3. Jangan melompati fase sebelum fondasi di fase sebelumnya selesai. Setiap selesai satu item, wajib perbarui `HANDOVER.md`.

## Fase 1: Inisialisasi Proyek, Skema Database, & Utilitas Inti
- [x] **1.1 Setup Next.js & Konfigurasi Dasar**: Inisialisasi proyek Next.js (App Router, TypeScript, Tailwind CSS, `shadcn/ui`, Lucide Icons, Zustand) dan atur palet warna CSS variables untuk tema *Customer (Warm Light)* serta *POS/KDS (Slate Dark)* di `globals.css`.
- [x] **1.2 Skema Prisma — Area, Meja, & Sesi Meja**: Buat model `Area`, `Table`, dan `TableSession` di `prisma/schema.prisma` (mendukung QR Slug unik, PIN meja 4-digit, dan status meja).
- [x] **1.3 Skema Prisma — Katalog Menu, Modifiers, & Resep**: Buat model `Category`, `MenuItem`, `ModifierGroup`, `ModifierOption`, `Ingredient`, dan `MenuRecipe` di `prisma/schema.prisma`.
- [x] **1.4 Skema Prisma — Order, Payment, Shift Kasir, & Call Waiter**: Buat model `Order`, `OrderItem`, `Payment`, `CashierShift`, `CashDrawerLog`, dan `WaiterCall` beserta seluruh `enum` statusnya, lalu jalankan migrasi awal.
- [x] **1.5 Database Seeder (`prisma/seed.ts`)**: Buat *script* data awal berisi 2 area (Indoor & Outdoor), 10 meja dengan QR slug, 4 kategori menu, 12 menu FnB lengkap dengan *Modifier Groups* (Level Pedas, Ukuran, Topping, Level Gula), dan akun staf contoh (Admin, Kasir, Dapur).
- [x] **1.6 Modul Kalkulasi Harga (`src/lib/pricing.ts`)**: Buat fungsi murni (*pure function*) beserta *unit test* untuk menghitung subtotal item, harga *modifiers*, diskon/voucher, *service charge* (5%), pajak PB1 (10%), dan generator kode unik 3 digit (untuk transfer manual).

## Fase 2: Modul Keamanan Sesi QR Meja & API Pelanggan
- [x] **2.1 Validasi QR Meja & Sesi (`GET/POST /api/tables/[qrSlug]/session`)**: Buat endpoint untuk memvalidasi scan QR meja, membuka atau bergabung ke `TableSession` aktif, serta menerbitkan token sesi meja.
- [x] **2.2 API Katalog Menu Publik (`GET /api/menu`)**: Buat endpoint cepat untuk mengambil daftar kategori, menu aktif, status stok (*86'd*), dan grup *modifier* yang relevan berdasarkan jam operasional.
- [x] **2.3 API Call Waiter (`POST /api/tables/[qrSlug]/call-waiter`)**: Buat endpoint panggilan pelayan dari meja (*Minta Air/Tisu*, *Bersihkan Meja*, *Tanya Menu*, *Minta Bill*) dengan *rate-limit* anti-spam (maksimal 1 panggilan per 2 menit per meja).

## Fase 3: Antarmuka Halaman Pelanggan (Customer Web App — Mobile-First)
- [x] **3.1 Header Meja & Quick Action Bar**: Buat komponen `CustomerHeader` yang menampilkan identitas restoran, nomor meja aktif, *switcher Dine-In / Takeaway*, dan modal tombol *Panggil Pelayan*.
- [x] **3.2 Navigasi Kategori Sticky & Pencarian Instan**: Buat komponen `CategoryTabs` yang menempel saat di-*scroll*, bilah pencarian menu *real-time*, dan filter *dietary* (*Best Seller*, *Pedas*, *Baru*).
- [x] **3.3 Katalog Kartu Menu (`MenuCard`)**: Buat komponen kartu menu dengan gambar rasio 1:1, *badge* stok habis (*grayscale* jika *Out of Stock*), dan indikator jumlah item yang sudah masuk keranjang.
- [x] **3.4 Bottom Sheet Kustomisasi Menu (`ModifierSheet`)**: Buat *slide-up drawer* untuk memilih opsi *Radio* (wajib), *Checkbox* (add-on opsional), catatan khusus per item, dan kalkulasi total harga item secara reaktif.
- [x] **3.5 Store Keranjang & Sinkronisasi Group Order (`useCartStore`)**: Implementasikan Zustand store untuk keranjang pelanggan dengan sinkronisasi *real-time* satu meja (sehingga beberapa orang di meja yang sama melihat isi keranjang gabungan).
- [x] **3.6 Halaman Keranjang, Upselling, & Rincian Biaya**: Buat tampilan *drawer/page* keranjang yang menampilkan daftar pesanan, *widget cross-selling* rekomendasi camilan/minuman, input nama pelanggan & WhatsApp opsional, serta rincian transparan (Subtotal, *Service Charge*, PB1, Total).

## Fase 4: Sistem Pembayaran (QRIS, Transfer/VA, & Tunai di Kasir)
- [x] **4.1 API Pembuatan Order (`POST /api/orders`)**: Buat endpoint yang memvalidasi stok menu, menghitung ulang harga di *server*, menyimpan `Order` & `OrderItem`, dan menentukan alur berdasarkan metode bayar yang dipilih.
- [x] **4.2 Integrasi Pembayaran QRIS Dinamis & Tombol Unduh QR**: Buat modul generator *Dynamic QRIS* beserta tampilan halaman tunggu pembayaran yang memiliki *countdown timer*, tombol **Simpan Gambar QRIS ke Galeri**, dan pendengar status otomatis (*webhook listener*).
- [x] **4.3 Integrasi Pembayaran Transfer Bank (Virtual Account & Transfer Manual Kode Unik)**: Buat tampilan pemilihan Bank VA (dengan tombol *Copy VA*) serta opsi *fallback* Transfer Rekening Manual yang menampilkan nominal + 3 digit kode unik dan form *Upload Bukti Transfer*.
- [x] **4.4 Alur Pembayaran Tunai di Kasir (`Pay at Cashier`)**: Buat halaman instruksi bayar di kasir yang menampilkan **Kode Booking & Barcode Pesanan**, opsi input PIN Meja 4-Digit (jika diaktifkan), dan meneruskan status `WAITING_CASHIER_APPROVAL` ke layar kasir.
- [x] **4.5 Webhook Payment Gateway (`POST /api/webhooks/payment`)**: Buat endpoint penerima *callback* pembayaran lunas yang memverifikasi *signature*, mengubah status `Payment` menjadi `PAID`, meneruskan pesanan otomatis ke layar KDS Dapur/Bar, dan memperbarui layar pelanggan.
- [x] **4.6 Halaman Live Order Tracker & E-Struk PDF**: Buat halaman pelacakan progres pesanan *real-time* (`Diterima` ➔ `Dimasak` ➔ `Siap Diantar` ➔ `Selesai`) beserta tombol unduh struk digital.

## Fase 5: Halaman Kasir (POS Dashboard — Tablet/Desktop)
- [x] **5.1 Layout Utama POS 3-Panel & Notifikasi Suara**: Bangun kerangka halaman `/(pos)/cashier` dengan *Sidebar Navigasi*, *Panel Tengah*, *Panel Detail Tagihan Kanan*, serta sistem peringatan audio (*sound alert*) untuk pesanan baru dan panggilan meja.
- [ ] **5.2 Tab Antrean Pesanan QR & Validasi Bayar Tunai/Bukti Transfer**: Buat tampilan antrean pesanan masuk untuk memverifikasi pembayaran *Pay at Cashier* atau mengecek foto bukti transfer manual dalam 1 klik.
- [ ] **5.3 Kalkulator Pembayaran Tunai & Eksekusi Lunas (`CashPaymentModal`)**: Buat modal pembayaran kasir dengan tombol pecahan uang cepat (`Uang Pas`, `Rp 50.000`, `Rp 100.000`), kalkulasi kembalian otomatis, dan pemicu cetak struk.
- [ ] **5.4 Peta Meja Interaktif (`InteractiveFloorPlan`)**: Buat tampilan grid meja per lantai dengan indikator warna status meja, durasi duduk pelanggan, dan total tagihan berjalan (*Open Bill*).
- [ ] **5.5 Fitur Split Bill, Gabung Tagihan, & Pindah Meja**: Buat antarmuka untuk memisahkan tagihan (*Split by Item* atau *Split Equally*) serta memindahkan sesi pesanan ke nomor meja lain.
- [ ] **5.6 Modul Kasir Input Manual (`Walk-In / Takeaway POS`)**: Buat katalog menu cepat di layar kasir bagi pelanggan yang langsung memesan di depan meja kasir tanpa scan QR.
- [ ] **5.7 Otorisasi PIN Supervisor (Void / Refund / Diskon Manual)**: Buat komponen modal input PIN 6-Digit Manajer sebelum kasir diizinkan membatalkan item yang sudah masuk dapur atau memberikan potongan harga khusus.
- [ ] **5.8 Manajemen Shift Kasir & Laci Kas (`ShiftManagement`)**: Buat fitur buka *shift* (input modal kas awal), catat kas masuk/keluar, dan tutup *shift* (*blind cash count* + cetak laporan Z-Report).
- [ ] **5.9 Modul Cetak Struk Thermal (`src/lib/printer/escpos.ts`)**: Buat *formatter* struk ukuran 58mm & 80mm yang mendukung pencetakan langsung dari *browser* kasir.

## Fase 6: Kitchen Display System (KDS) & Aplikasi Pelayan (Runner)
- [ ] **6.1 Layar KDS Dapur & Barista (`/(kds)/kds/[station]`)**: Buat tampilan tiket pesanan berorientasi *landscape* yang otomatis memfilter item berdasarkan stasiun (`KITCHEN` vs `BAR`).
- [ ] **6.2 SLA Aging Timer & Bump Action**: Tambahkan penghitung waktu mundur/maju pada setiap kartu KDS (berubah warna Hijau ➔ Kuning ➔ Merah berkedip jika lewat batas waktu) dan interaksi sentuh untuk menandai item `COOKING` ➔ `READY`.
- [ ] **6.3 Tampilan Mobile Pelayan / Runner (`/(staff)/runner`)**: Buat halaman ringan untuk staf pelayan yang menampilkan daftar makanan yang siap diambil di dapur, daftar panggilan meja (*Call Waiter*), dan tombol ubah status meja selesai dibersihkan.

## Fase 7: Halaman Admin / Back-Office & Analitik
- [ ] **7.1 CRUD Menu, Kategori, & Quick Toggle Stok 86'd**: Buat halaman pengelolaan menu lengkap dengan fitur *upload* gambar, pengaturan *Modifier Groups*, dan sakelar cepat untuk mematikan menu yang habis.
- [ ] **7.2 QR Code Table Studio (`/(admin)/admin/tables`)**: Buat halaman manajemen meja yang otomatis meng-generate desain kartu QR meja siap cetak (PDF/PNG) beserta tombol *Force Reset Session*.
- [ ] **7.3 Manajemen Stok Bahan Baku & Resep (`Inventory & HPP`)**: Buat halaman pencatatan stok bahan baku, pengaturan resep per menu, dan log pengurangan stok otomatis saat pesanan selesai.
- [ ] **7.4 Dashboard Analitik Penjualan & Menu Engineering**: Buat ringkasan omzet harian/bulanan, rincian metode pembayaran (QRIS vs VA vs Tunai), grafik jam sibuk (*peak hours*), dan matriks kuadran *Menu Engineering*.
