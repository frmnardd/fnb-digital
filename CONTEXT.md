# CONTEXT.md — Sumber Kebenaran Arsitektur & Spesifikasi Proyek (Single Source of Truth)

> **INSTRUKSI WAJIB UNTUK AI AGENT:**
> File ini adalah memori permanen proyek **Sistem Website FnB (QR Table Ordering, POS Kasir, KDS Dapur, & Back-Office)**. Jangan pernah mengubah arsitektur inti, skema database utama, atau standar desain di bawah ini tanpa persetujuan eksplisit pengguna. Sebelum menulis kode apa pun, pastikan Anda membaca `CONTEXT.md`, `TODO.md`, dan `HANDOVER.md`.

## 1. Visi & Tujuan Utama Proyek
Membangun aplikasi web terintegrasi untuk bisnis Food & Beverage (Restoran/Kafe) yang mencakup 5 peran ekosistem:
1. **Customer Web App (`/(customer)/table/[tableCode]`)**: Pemesanan mandiri berbasis scan QR meja (tanpa instal aplikasi/tanpa wajib login), *group ordering* satu meja secara *real-time*, pembayaran via **Dynamic QRIS**, **Transfer/Virtual Account (VA)**, serta **Tunai di Kasir (*Pay at Cashier*)**, ditambah *live order tracker* dan tombol *Call Waiter*.
2. **Cashier POS Dashboard (`/(pos)/cashier`)**: Layar kasir *split-view* untuk validasi pembayaran tunai/transfer manual, kasir *walk-in*, denah meja interaktif (*floor plan*), *open bill / master bill*, *split bill*, pindah/gabung meja, cetak struk thermal ESC/POS, serta manajemen *shift* & laci kas (*cash drawer*).
3. **Kitchen & Bar Display System (`/(kds)/station/[stationType]`)**: Layar antrean pesanan otomatis terpisah untuk stasiun Dapur (Makanan) dan Bar (Minuman), dilengkapi *SLA aging timer* (Hijau/Kuning/Merah) dan *bump status* per item.
4. **Waiter / Runner View (`/(staff)/runner`)**: Tampilan *mobile* pelayan untuk menerima notifikasi makanan siap antar dari KDS, merespons panggilan meja (*Call Waiter*), dan mengubah status kebersihan meja.
5. **Admin / Owner Back-Office (`/(admin)/dashboard`)**: Manajemen katalog menu & *modifiers*, resep & pemotongan stok bahan baku otomatis (*Bill of Materials / HPP*), generator QR meja siap cetak, pengaturan pajak PB1 & *service charge*, serta laporan analitik *Menu Engineering*.

## 2. Tech Stack & Lingkungan Pengembangan
* **Framework Utama**: Next.js 14/15 (App Router) dengan TypeScript (`strict: true`).
* **Styling & UI Components**: Tailwind CSS + `shadcn/ui` + Lucide Icons + Framer Motion (untuk transisi *bottom sheet* dan *micro-interactions*).
* **State Management**:
  * Client State (Keranjang Lokal & UI Kasir): `Zustand` (dengan persistensi `localStorage` / `IndexedDB` untuk ketahanan *offline* di kasir).
  * Server State & Caching: `@tanstack/react-query` atau Server Actions Next.js.
* **Database & ORM**: PostgreSQL (Supabase / Neon / Lokal) dengan **Prisma ORM**.
* **Real-time Engine**: Supabase Realtime (Postgres Changes + Broadcast) atau Socket.io untuk sinkronisasi instan:
  * Keranjang bersama satu meja (*Group Ordering*)
  * Notifikasi pesanan masuk ke POS Kasir & KDS Dapur
  * Perubahan status pesanan di layar pelanggan
  * Panggilan pelayan (*Call Waiter*)
* **Payment Gateway**: Integrasi **Midtrans** / **Xendit** (mendukung Dynamic QRIS & Virtual Account BCA/Mandiri/BNI/BRI dengan *Webhook Signature Verification*), ditambah dukungan **Transfer Manual (Kode Unik 3 Digit + Upload Bukti)** dan **Bayar Tunai di Kasir**.
* **Autentikasi & Keamanan**:
  * Pelanggan: Tanpa login paksa; menggunakan `TableSessionToken` (JWT/Signed Cookie yang terikat pada sesi meja aktif) + opsi PIN Meja 4-Digit / *Approval* Kasir untuk metode bayar tunai (*anti-prank order*).
  * Staf (Kasir, Dapur, Pelayan, Admin): Autentikasi berbasis Role (RBAC) + **PIN Otorisasi Supervisor 6-Digit** untuk tindakan sensitif (*Void*, *Refund*, *Diskon Manual*).

## 3. Struktur Folder Proyek (Monorepo / Modular App Router)
```text
src/
├── app/
│   ├── (customer)/          # Modul Pelanggan (Mobile-First PWA)
│   │   └── t/[tableSlug]/   # Halaman Menu, Cart, Checkout, & Tracker per Meja
│   ├── (pos)/               # Modul Kasir (Tablet/Desktop High-Contrast)
│   │   └── cashier/         # Antrean QR, Floor Plan, POS Walk-in, Shift Management
│   ├── (kds)/               # Modul Dapur & Bar (Landscape Tablet/Monitor)
│   │   └── kds/[station]/   # Tiket Pesanan Dapur & Barista + SLA Timer
│   ├── (staff)/             # Modul Pelayan / Runner (Mobile View)
│   │   └── runner/          # Pengantaran Makanan & Respons Call Waiter
│   ├── (admin)/             # Modul Back-Office Owner
│   │   └── admin/           # Menu, Modifiers, QR Studio, Inventory, Analytics
│   └── api/                 # Route Handlers (Webhooks Payment, Print, Realtime)
├── components/
│   ├── ui/                  # Komponen dasar shadcn/ui
│   ├── customer/            # MenuCard, ModifierSheet, FloatingCart, OrderTracker
│   ├── pos/                 # OrderQueueCard, TableMapGrid, SplitBillModal, CashCalculator
│   ├── kds/                 # TicketCard, AgingTimerBadge
│   └── admin/               # QRGeneratorCard, MenuEngineeringChart
├── lib/
│   ├── db.ts                # Prisma Client Singleton
│   ├── realtime.ts          # Konfigurasi WebSocket / Supabase Realtime
│   ├── pricing.ts           # Kalkulasi Subtotal, Modifiers, Service Charge, PB1, Kode Unik
│   ├── payment/             # Adapter QRIS, VA, Manual Transfer, & Webhook Validator
│   └── printer/             # Generator perintah ESC/POS untuk Printer Thermal 58mm/80mm
├── store/                   # Zustand Stores (useCartStore, usePosStore, useKdsStore)
└── types/                   # Definisi TypeScript Global
```

## 4. Inti Skema Database (Prisma Schema Blueprint)
Setiap AI Agent yang menulis query atau migrasi wajib mematuhi relasi entitas utama berikut:
* **`Area` & `Table`**: Menyimpan data lantai/area, nomor meja (`tableNumber`), `qrSlug` unik, status meja (`AVAILABLE`, `OCCUPIED`, `NEEDS_CLEANING`), dan `currentPin` (PIN 4 digit opsional untuk keamanan bayar di kasir).
* **`TableSession`**: Mengikat kunjungan pelanggan di satu meja (`ACTIVE`, `BILL_REQUESTED`, `CLOSED`). Mendukung *Open Bill* (banyak `Order` di dalam satu `TableSession`).
* **`Category` & `MenuItem`**: Menyimpan nama menu, deskripsi, foto WebP, `basePrice`, `costPrice` (HPP), `station` (`KITCHEN`, `BAR`, `PASTRY`), status ketersediaan (`isAvailable` / 86'd), dan jadwal tayang.
* **`ModifierGroup` & `ModifierOption`**: Mengatur opsi wajib/opsional (misal: *Level Pedas*, *Ukuran*, *Extra Topping*) beserta harga tambahannya (`priceDelta`).
* **`Order` & `OrderItem`**:
  * `Order`: Terhubung ke `TableSession`, memiliki `orderNumber` (`#ORD-1024`), `orderType` (`DINE_IN`, `TAKEAWAY`), `status` (`PENDING_PAYMENT`, `WAITING_CASHIER_APPROVAL`, `CONFIRMED`, `PREPARING`, `READY`, `SERVED`, `COMPLETED`, `CANCELLED`), serta rincian harga (`subtotal`, `discountAmount`, `serviceCharge`, `taxAmount`, `uniqueCode`, `grandTotal`).
  * `OrderItem`: Menyimpan kuantitas, `unitPrice`, `selectedModifiers` (JSON/Relasi), `notes`, dan status per item di KDS (`QUEUED`, `COOKING`, `READY`, `SERVED`, `VOIDED`).
* **`Payment`**: Menyimpan metode pembayaran (`QRIS_DYNAMIC`, `VIRTUAL_ACCOUNT`, `MANUAL_TRANSFER`, `CASH`, `EDC_CARD`), `gatewayRefId`, `proofImageUrl` (untuk transfer manual), `amountPaid`, `changeAmount` (kembalian tunai), dan status (`PENDING`, `PAID`, `FAILED`, `REFUNDED`).
* **`CashierShift` & `CashDrawerLog`**: Mencatat jam buka/tutup kasir, modal awal (`startingCash`), perhitungan kas fisik akhir (`actualEndingCash`), ekspektasi sistem (`expectedCash`), dan selisih (`variance`).
* **`WaiterCall`**: Mencatat panggilan dari meja (`WATER_TISSUE`, `CLEAN_TABLE`, `ASK_MENU`, `REQUEST_BILL`) dengan status (`PENDING`, `ACKNOWLEDGED`, `RESOLVED`).
* **`Ingredient` & `MenuRecipe`**: Mencatat stok bahan baku (`currentStock`, `unit`, `minThreshold`) dan takaran pemotongan otomatis per porsi menu.

## 5. Standar Desain Modern & Ergonomi UI/UX
1. **Palet Warna Kontekstual**:
   * **Customer Web App**: Tema terang hangat (*Warm Alabaster* `#FAF8F5`, kartu `#FFFFFF`, aksen utama *Terracotta Red* `#D9381E` atau *Burnt Orange* `#EA580C`) agar foto makanan menggugah selera.
   * **POS Kasir & KDS Dapur**: Tema gelap kontras tinggi (*Slate* `#0F172A` / `#1E293B`) untuk penggunaan layar 12 jam nonstop. Warna status tegas: Hijau (`#10B981` — Lunas/Siap), Kuning (`#F59E0B` — Menunggu Konfirmasi/Warning SLA), Merah (`#EF4444` — Overdue/Void).
2. **Tipografi & Keterbacaan Angka**:
   * Gunakan font **Plus Jakarta Sans** atau **Inter**.
   * Wajib terapkan class `tabular-nums` (`font-variant-numeric: tabular-nums`) pada seluruh tampilan harga, kuantitas, kalkulator kasir, dan *timer* KDS.
3. **Standar Layar Sentuh (Touch Target)**:
   * Halaman Pelanggan: Navigasi utama dan *Floating Cart Bar* berada di **Thumb Zone** (bawah layar), tinggi tombol minimal `48px`.
   * Halaman POS Kasir & KDS: Tombol interaktif minimal berukuran `56px × 56px` agar mudah ditekan cepat tanpa salah sentuh.

## 6. Aturan Penulisan Kode & Protokol Estafet AI Agent (SOP Wajib)
1. **Atomic Tasks Only**: Kerjakan **hanya 1 sub-tugas kecil** dari `TODO.md` dalam satu waktu. Jangan pernah merombak banyak modul sekaligus agar kode tidak terputus di tengah baris saat terkena *rate limit* (Error 429).
2. **Type Safety & Validasi**: Gunakan **Zod** untuk memvalidasi setiap *input payload* API dan *env variables*. Dilarang menggunakan tipe `any`.
3. **Kalkulasi Harga di Server**: Seluruh perhitungan subtotal, *modifiers*, pajak PB1, dan *service charge* wajib divalidasi ulang di sisi *server* (`src/lib/pricing.ts`), jangan pernah mempercayai nominal harga mentah yang dikirim dari *browser* pelanggan.
4. **Kewajiban Update Memori Bersama**: Setiap kali selesai mengerjakan 1 item di `TODO.md`, Agent **WAJIB**:
   * Memastikan kode bebas dari error kompilasi (`tsc --noEmit` / `next build`).
   * Mengubah tanda `[ ]` menjadi `[x]` pada sub-tugas terkait di `TODO.md`.
   * Memperbarui `HANDOVER.md` dengan status terkini, daftar file yang baru saja diubah, dan instruksi spesifik untuk langkah berikutnya.
   * Melakukan `git commit` dengan pesan yang jelas (misal: `feat(customer): implement modifier bottom sheet and dynamic price calculation`).
