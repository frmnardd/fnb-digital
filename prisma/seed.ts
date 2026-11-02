/**
 * Seeder database FnB Digital.
 *
 * Cara pakai:
 *   npm run db:seed                 # Prisma CLI memuat .env lalu menjalankan file ini
 *   npx tsx prisma/seed.ts          # jalankan langsung
 *   npx tsx prisma/seed.ts --dry-run  # validasi + ringkasan TANPA koneksi database
 *
 * Sifat: IDEMPOTEN — aman dijalankan berulang. Semua entitas di-upsert memakai
 * kunci alami (slug / qrSlug / email / nama grup), sehingga data tidak berganda.
 */

import { loadEnvFile } from "node:process";

import { hashPin } from "../src/lib/security/pin";

import {
  SEED_AREAS,
  SEED_CATEGORIES,
  SEED_MENUS,
  SEED_MODIFIER_GROUPS,
  SEED_STAFF,
  SEED_TABLES,
  validateSeedData,
  type SeedValidationResult,
} from "./seed-data";

// Muat .env bila ada (dijalankan langsung via tsx, di luar Prisma CLI).
try {
  loadEnvFile();
} catch {
  // .env opsional — variabel bisa datang dari environment shell / Prisma CLI.
}

function printReport(result: SeedValidationResult, dryRun: boolean): void {
  const { counts } = result;

  console.log("┌──────────────────────────────────────────────┐");
  console.log("│  FnB Digital — Ringkasan Data Seed            │");
  console.log("├──────────────────────────────────────────────┤");
  console.log(`│  Area            : ${String(counts.areas).padEnd(26)}│`);
  console.log(`│  Meja            : ${String(counts.tables).padEnd(26)}│`);
  console.log(`│  Kategori        : ${String(counts.categories).padEnd(26)}│`);
  console.log(`│  Menu            : ${String(counts.menus).padEnd(26)}│`);
  console.log(`│  Modifier group  : ${String(counts.modifierGroups).padEnd(26)}│`);
  console.log(`│  Modifier option : ${String(counts.modifierOptions).padEnd(26)}│`);
  console.log(`│  Staf            : ${String(counts.staff).padEnd(26)}│`);
  console.log("└──────────────────────────────────────────────┘");

  if (result.ok) {
    console.log("✅ Validasi data seed: LULUS");
  } else {
    console.error("❌ Validasi data seed: GAGAL");
    for (const error of result.errors) {
      console.error(`   - ${error}`);
    }
  }

  if (dryRun) {
    console.log("\n[dry-run] Tidak ada koneksi database yang dibuka. Selesai.");
  }
}

async function seedDatabase(): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // ---------------------------------------------------------------------
    // 1) Area
    // ---------------------------------------------------------------------
    const areaIdBySlug = new Map<string, string>();
    for (const area of SEED_AREAS) {
      const row = await prisma.area.upsert({
        where: { slug: area.slug },
        update: { name: area.name, floor: area.floor, description: area.description, isActive: true },
        create: { name: area.name, slug: area.slug, floor: area.floor, description: area.description },
      });
      areaIdBySlug.set(area.slug, row.id);
    }

    // ---------------------------------------------------------------------
    // 2) Meja (reset ke AVAILABLE agar lingkungan demo bersih)
    // ---------------------------------------------------------------------
    for (const table of SEED_TABLES) {
      const areaId = areaIdBySlug.get(table.areaSlug);
      if (!areaId) {
        throw new Error(`Area "${table.areaSlug}" tidak ditemukan saat seeding meja ${table.qrSlug}.`);
      }

      const payload = {
        areaId,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        status: "AVAILABLE" as const,
        positionX: table.positionX,
        positionY: table.positionY,
        pinEnabled: table.pinEnabled,
        currentPin: table.pinEnabled && table.pin ? hashPin(table.pin) : null,
        isActive: true,
      };

      await prisma.table.upsert({
        where: { qrSlug: table.qrSlug },
        update: payload,
        create: { qrSlug: table.qrSlug, ...payload },
      });
    }

    // ---------------------------------------------------------------------
    // 3) Kategori
    // ---------------------------------------------------------------------
    const categoryIdBySlug = new Map<string, string>();
    for (const category of SEED_CATEGORIES) {
      const row = await prisma.category.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        },
        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          sortOrder: category.sortOrder,
        },
      });
      categoryIdBySlug.set(category.slug, row.id);
    }

    // ---------------------------------------------------------------------
    // 4) Grup modifier + opsi (opsi di-reset agar konsisten dengan seed-data)
    // ---------------------------------------------------------------------
    const groupIdByName = new Map<string, string>();
    for (const group of SEED_MODIFIER_GROUPS) {
      const base = {
        name: group.name,
        selectionType: group.selectionType,
        isRequired: group.isRequired,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        sortOrder: group.sortOrder,
        isActive: true,
      };

      // `ModifierGroup.name` belum unik di schema -> pakai findFirst untuk idempotensi.
      const existing = await prisma.modifierGroup.findFirst({ where: { name: group.name } });
      const row = existing
        ? await prisma.modifierGroup.update({ where: { id: existing.id }, data: base })
        : await prisma.modifierGroup.create({ data: base });

      groupIdByName.set(group.name, row.id);

      await prisma.modifierOption.deleteMany({ where: { groupId: row.id } });
      await prisma.modifierOption.createMany({
        data: group.options.map((option, index) => ({
          groupId: row.id,
          name: option.name,
          priceDelta: option.priceDelta,
          isDefault: option.isDefault ?? false,
          isAvailable: true,
          sortOrder: index,
        })),
      });
    }

    // ---------------------------------------------------------------------
    // 5) Menu + relasi modifier group
    // ---------------------------------------------------------------------
    for (const menu of SEED_MENUS) {
      const categoryId = categoryIdBySlug.get(menu.categorySlug);
      if (!categoryId) {
        throw new Error(
          `Kategori "${menu.categorySlug}" tidak ditemukan saat seeding menu ${menu.slug}.`,
        );
      }

      const groupConnections = menu.modifierGroups.map((groupName) => {
        const id = groupIdByName.get(groupName);
        if (!id) {
          throw new Error(`Grup modifier "${groupName}" tidak ditemukan untuk menu ${menu.slug}.`);
        }
        return { id };
      });

      const payload = {
        categoryId,
        name: menu.name,
        description: menu.description,
        basePrice: menu.basePrice,
        costPrice: menu.costPrice,
        station: menu.station,
        tags: menu.tags,
        prepTimeMinutes: menu.prepTimeMinutes,
        isBestSeller: menu.isBestSeller,
        isAvailable: true,
        isActive: true,
      };

      await prisma.menuItem.upsert({
        where: { slug: menu.slug },
        update: { ...payload, modifierGroups: { set: groupConnections } },
        create: { slug: menu.slug, ...payload, modifierGroups: { connect: groupConnections } },
      });
    }

    // ---------------------------------------------------------------------
    // 6) Staf (PIN di-hash HMAC-SHA256, bukan plaintext)
    // ---------------------------------------------------------------------
    for (const staff of SEED_STAFF) {
      const payload = {
        name: staff.name,
        role: staff.role,
        pinHash: hashPin(staff.pin),
        isActive: true,
      };

      await prisma.staff.upsert({
        where: { email: staff.email },
        update: payload,
        create: { email: staff.email, ...payload },
      });
    }

    // ---------------------------------------------------------------------
    // 7) Ringkasan hasil dari database
    // ---------------------------------------------------------------------
    const [areas, tables, categories, menus, groups, options, staff] = await Promise.all([
      prisma.area.count(),
      prisma.table.count(),
      prisma.category.count(),
      prisma.menuItem.count(),
      prisma.modifierGroup.count(),
      prisma.modifierOption.count(),
      prisma.staff.count(),
    ]);

    console.log("\n📦 Seeding selesai. Jumlah baris di database:");
    console.log(`   area=${areas} meja=${tables} kategori=${categories} menu=${menus}`);
    console.log(`   modifierGroup=${groups} modifierOption=${options} staf=${staff}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const result = validateSeedData();

  printReport(result, dryRun);

  if (!result.ok) {
    console.error("\nSeed dibatalkan karena data tidak valid.");
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    return;
  }

  await seedDatabase();
}

main().catch((error: unknown) => {
  console.error("\n❌ Seeding gagal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
