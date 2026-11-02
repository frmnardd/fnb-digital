# FnB Digital

Sistem website FnB terintegrasi: **QR Table Ordering**, **POS Kasir**, **KDS Dapur/Bar**, **Runner Pelayan**, dan **Back-Office Owner**.

Spesifikasi arsitektur, skema database, dan standar desain ada di [`CONTEXT.md`](./CONTEXT.md).
Progres pekerjaan dan status estafet ada di [`TODO.md`](./TODO.md) dan [`HANDOVER.md`](./HANDOVER.md).

## Stack

| Lapisan | Teknologi |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript `strict` |
| UI | Tailwind CSS 3.4, shadcn/ui, Lucide Icons, Framer Motion |
| State | Zustand (client) + Server Actions / React Query (server state) |
| Database | PostgreSQL + Prisma ORM |
| Validasi | Zod |
| Realtime | Supabase Realtime / Socket.io |

## Menjalankan

```bash
npm install            # gunakan --ignore-scripts bila sandbox memblokir lifecycle script
cp .env.example .env   # isi DATABASE_URL & SESSION_SECRET
npm run dev            # http://localhost:3000
```

Perintah lain:

```bash
npm run typecheck      # tsc --noEmit
npm run test           # unit test (node:test + tsx)
npm run build          # build produksi
npm run lint           # ESLint (flat config)
npm run db:generate    # prisma generate
npm run db:migrate     # prisma migrate dev
npm run db:seed        # isi data contoh
```

## Tema warna

Dua tema didefinisikan sebagai CSS variables di [`src/app/globals.css`](./src/app/globals.css):

- `:root` — **Customer Warm Light**: background `#FAF8F5`, card `#FFFFFF`, primary Terracotta `#D9381E`, accent Burnt Orange `#EA580C`.
- `.dark` — **POS/KDS Slate Dark**: background `#0F172A`, card `#1E293B`, primary Emerald `#10B981`, warning `#F59E0B`, danger `#EF4444`.

Modul POS/KDS cukup membungkus layout dengan `className="dark"` untuk mendapat tema gelap.

## Struktur folder

```text
src/
├── app/
│   ├── (customer)/t/[tableSlug]/   # menu, cart, checkout, tracker
│   ├── (pos)/cashier/              # antrean QR, floor plan, shift
│   ├── (kds)/kds/[station]/        # tiket dapur & barista
│   ├── (staff)/runner/             # aplikasi pelayan
│   ├── (admin)/admin/              # back-office
│   └── api/                        # route handlers
├── components/{ui,customer,pos,kds,admin}
├── lib/{db,realtime,pricing,payment,printer}
├── store/                          # Zustand stores
└── types/                          # tipe global
```
