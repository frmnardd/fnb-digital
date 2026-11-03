/**
 * Data contoh (seed) untuk FnB Digital — MURNI DATA, tanpa koneksi database.
 *
 * Dipisahkan dari `prisma/seed.ts` agar bisa diaudit / diuji tanpa PostgreSQL
 * (lihat `validateSeedData()` dan flag `--dry-run` pada seeder).
 */

export type StationKey = "KITCHEN" | "BAR" | "PASTRY";
export type SelectionKey = "SINGLE" | "MULTIPLE";
export type StaffRoleKey = "ADMIN" | "CASHIER" | "KITCHEN" | "WAITER";

export interface SeedArea {
  name: string;
  slug: string;
  floor: number;
  description: string;
}

export interface SeedTable {
  areaSlug: string;
  tableNumber: string;
  qrSlug: string;
  capacity: number;
  positionX: number;
  positionY: number;
  pinEnabled: boolean;
  /** Hanya dipakai bila `pinEnabled`; di-hash sebelum masuk database. */
  pin?: string;
}

export interface SeedCategory {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

export interface SeedModifierOption {
  name: string;
  priceDelta: number;
  isDefault?: boolean;
}

export interface SeedModifierGroup {
  name: string;
  selectionType: SelectionKey;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: SeedModifierOption[];
}

export interface SeedMenuItem {
  slug: string;
  name: string;
  categorySlug: string;
  description: string;
  basePrice: number;
  costPrice: number;
  station: StationKey;
  tags: string[];
  prepTimeMinutes: number;
  isBestSeller: boolean;
  /** Nama grup modifier yang ditempelkan ke menu ini. */
  modifierGroups: string[];
}

export interface SeedStaff {
  name: string;
  email: string;
  role: StaffRoleKey;
  /** PIN otorisasi (6 digit) — di-hash sebelum masuk database. */
  pin: string;
}

// -----------------------------------------------------------------------------
// AREA — 2 zona
// -----------------------------------------------------------------------------

export const SEED_AREAS: SeedArea[] = [
  {
    name: "Indoor",
    slug: "indoor",
    floor: 1,
    description: "Area ber-AC di dalam restoran, dekat display pastry.",
  },
  {
    name: "Outdoor",
    slug: "outdoor",
    floor: 2,
    description: "Teras terbuka dengan pemandangan taman.",
  },
];

// -----------------------------------------------------------------------------
// MEJA — 10 meja (5 Indoor, 5 Outdoor) dengan QR slug unik
// -----------------------------------------------------------------------------

export const SEED_TABLES: SeedTable[] = [
  // Indoor (lantai 1)
  { areaSlug: "indoor", tableNumber: "01", qrSlug: "meja-01", capacity: 2, positionX: 0, positionY: 0, pinEnabled: true, pin: "1234" },
  { areaSlug: "indoor", tableNumber: "02", qrSlug: "meja-02", capacity: 4, positionX: 1, positionY: 0, pinEnabled: true, pin: "1234" },
  { areaSlug: "indoor", tableNumber: "03", qrSlug: "meja-03", capacity: 4, positionX: 2, positionY: 0, pinEnabled: true, pin: "1234" },
  { areaSlug: "indoor", tableNumber: "04", qrSlug: "meja-04", capacity: 6, positionX: 0, positionY: 1, pinEnabled: false },
  { areaSlug: "indoor", tableNumber: "05", qrSlug: "meja-05", capacity: 2, positionX: 1, positionY: 1, pinEnabled: false },
  // Outdoor (lantai 2)
  { areaSlug: "outdoor", tableNumber: "06", qrSlug: "meja-06", capacity: 4, positionX: 0, positionY: 0, pinEnabled: false },
  { areaSlug: "outdoor", tableNumber: "07", qrSlug: "meja-07", capacity: 4, positionX: 1, positionY: 0, pinEnabled: false },
  { areaSlug: "outdoor", tableNumber: "08", qrSlug: "meja-08", capacity: 6, positionX: 2, positionY: 0, pinEnabled: false },
  { areaSlug: "outdoor", tableNumber: "09", qrSlug: "meja-09", capacity: 2, positionX: 0, positionY: 1, pinEnabled: false },
  { areaSlug: "outdoor", tableNumber: "10", qrSlug: "meja-10", capacity: 8, positionX: 1, positionY: 1, pinEnabled: false },
];

// -----------------------------------------------------------------------------
// KATEGORI — 4 kategori
// -----------------------------------------------------------------------------

export const SEED_CATEGORIES: SeedCategory[] = [
  { name: "Makanan Utama", slug: "makanan-utama", description: "Hidangan utama porsi kenyang.", sortOrder: 0 },
  { name: "Camilan", slug: "camilan", description: "Gorengan dan makanan ringan pendamping.", sortOrder: 1 },
  { name: "Kopi & Teh", slug: "kopi-teh", description: "Kopi manual brew, espresso based, dan teh.", sortOrder: 2 },
  { name: "Minuman Segar", slug: "minuman-segar", description: "Es teh, lemon tea, dan jus buah segar.", sortOrder: 3 },
];

// -----------------------------------------------------------------------------
// MODIFIER GROUP — 4 grup (Level Pedas, Ukuran, Extra Topping, Level Gula)
// -----------------------------------------------------------------------------

export const SEED_MODIFIER_GROUPS: SeedModifierGroup[] = [
  {
    name: "Level Pedas",
    selectionType: "SINGLE",
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 0,
    options: [
      { name: "Tidak Pedas", priceDelta: 0, isDefault: true },
      { name: "Sedang", priceDelta: 0 },
      { name: "Pedas", priceDelta: 0 },
      { name: "Extra Pedas", priceDelta: 0 },
    ],
  },
  {
    name: "Ukuran",
    selectionType: "SINGLE",
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 1,
    options: [
      { name: "Reguler", priceDelta: 0, isDefault: true },
      { name: "Large", priceDelta: 8000 },
    ],
  },
  {
    name: "Extra Topping",
    selectionType: "MULTIPLE",
    isRequired: false,
    minSelect: 0,
    maxSelect: 3,
    sortOrder: 2,
    options: [
      { name: "Extra Telur", priceDelta: 5000 },
      { name: "Keju Mozzarella", priceDelta: 7000 },
      { name: "Extra Ayam", priceDelta: 10000 },
    ],
  },
  {
    name: "Level Gula",
    selectionType: "SINGLE",
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 3,
    options: [
      { name: "Tanpa Gula", priceDelta: 0 },
      { name: "Less Sugar", priceDelta: 0, isDefault: true },
      { name: "Normal", priceDelta: 0 },
      { name: "Extra Manis", priceDelta: 0 },
    ],
  },
];

// -----------------------------------------------------------------------------
// MENU — 12 item (4 makanan utama, 2 camilan, 3 kopi/teh, 3 minuman segar)
// -----------------------------------------------------------------------------

export const SEED_MENUS: SeedMenuItem[] = [
  {
    slug: "nasi-goreng-kampung",
    name: "Nasi Goreng Kampung",
    categorySlug: "makanan-utama",
    description: "Nasi goreng kampung dengan telur mata sapi, kecap manis, dan kerupuk.",
    basePrice: 38000,
    costPrice: 14500,
    station: "KITCHEN",
    tags: ["BEST_SELLER"],
    prepTimeMinutes: 12,
    isBestSeller: true,
    modifierGroups: ["Level Pedas", "Extra Topping"],
  },
  {
    slug: "mie-ayam-bakso",
    name: "Mie Ayam Bakso",
    categorySlug: "makanan-utama",
    description: "Mie kuning kenyal, ayam kecap, bakso sapi, dan kuah kaldu gurih.",
    basePrice: 35000,
    costPrice: 13000,
    station: "KITCHEN",
    tags: ["BEST_SELLER"],
    prepTimeMinutes: 10,
    isBestSeller: true,
    modifierGroups: ["Level Pedas", "Extra Topping"],
  },
  {
    slug: "ayam-geprek-sambal-ijo",
    name: "Ayam Geprek Sambal Ijo",
    categorySlug: "makanan-utama",
    description: "Ayam crispy digeprek dengan sambal ijo, nasi hangat, dan lalapan.",
    basePrice: 32000,
    costPrice: 11500,
    station: "KITCHEN",
    tags: ["PEDAS", "BEST_SELLER"],
    prepTimeMinutes: 15,
    isBestSeller: true,
    modifierGroups: ["Level Pedas", "Extra Topping"],
  },
  {
    slug: "sate-ayam-madura",
    name: "Sate Ayam Madura",
    categorySlug: "makanan-utama",
    description: "10 tusuk sate ayam dengan bumbu kacang kental, lontong, dan acar.",
    basePrice: 45000,
    costPrice: 17000,
    station: "KITCHEN",
    tags: [],
    prepTimeMinutes: 20,
    isBestSeller: false,
    modifierGroups: ["Extra Topping"],
  },
  {
    slug: "kentang-goreng",
    name: "Kentang Goreng",
    categorySlug: "camilan",
    description: "Kentang goreng renyah dengan taburan garam laut dan saus tomat.",
    basePrice: 22000,
    costPrice: 7000,
    station: "KITCHEN",
    tags: ["BEST_SELLER"],
    prepTimeMinutes: 8,
    isBestSeller: true,
    modifierGroups: ["Extra Topping"],
  },
  {
    slug: "pisang-goreng-keju",
    name: "Pisang Goreng Keju",
    categorySlug: "camilan",
    description: "Pisang goreng hangat dengan keju parut, susu kental manis, dan madu.",
    basePrice: 25000,
    costPrice: 8500,
    station: "KITCHEN",
    tags: ["BARU"],
    prepTimeMinutes: 10,
    isBestSeller: false,
    modifierGroups: ["Extra Topping"],
  },
  {
    slug: "kopi-susu-gula-aren",
    name: "Kopi Susu Gula Aren",
    categorySlug: "kopi-teh",
    description: "Espresso double shot, susu segar, dan gula aren cair khas Nusantara.",
    basePrice: 24000,
    costPrice: 8000,
    station: "BAR",
    tags: ["BEST_SELLER"],
    prepTimeMinutes: 5,
    isBestSeller: true,
    modifierGroups: ["Ukuran", "Level Gula"],
  },
  {
    slug: "americano",
    name: "Americano",
    categorySlug: "kopi-teh",
    description: "Espresso dengan air panas, disajikan dingin maupun panas.",
    basePrice: 20000,
    costPrice: 6000,
    station: "BAR",
    tags: [],
    prepTimeMinutes: 4,
    isBestSeller: false,
    modifierGroups: ["Ukuran", "Level Gula"],
  },
  {
    slug: "cappuccino",
    name: "Cappuccino",
    categorySlug: "kopi-teh",
    description: "Espresso dengan steamed milk dan foam tebal, taburan bubuk kayu manis.",
    basePrice: 28000,
    costPrice: 9000,
    station: "BAR",
    tags: [],
    prepTimeMinutes: 5,
    isBestSeller: false,
    modifierGroups: ["Ukuran", "Level Gula"],
  },
  {
    slug: "es-teh-manis",
    name: "Es Teh Manis",
    categorySlug: "minuman-segar",
    description: "Teh tubruk klasik dengan es batu, manisnya bisa diatur.",
    basePrice: 12000,
    costPrice: 3000,
    station: "BAR",
    tags: ["BEST_SELLER"],
    prepTimeMinutes: 3,
    isBestSeller: true,
    modifierGroups: ["Ukuran", "Level Gula"],
  },
  {
    slug: "lemon-tea-segar",
    name: "Lemon Tea Segar",
    categorySlug: "minuman-segar",
    description: "Teh hitam dingin dengan perasan lemon asli dan irisan mint.",
    basePrice: 18000,
    costPrice: 5500,
    station: "BAR",
    tags: ["BARU"],
    prepTimeMinutes: 4,
    isBestSeller: false,
    modifierGroups: ["Ukuran", "Level Gula"],
  },
  {
    slug: "jus-alpukat",
    name: "Jus Alpukat",
    categorySlug: "minuman-segar",
    description: "Alpukat mentega, susu, dan gula aren, disajikan dengan topping cokelat.",
    basePrice: 26000,
    costPrice: 11000,
    station: "BAR",
    tags: [],
    prepTimeMinutes: 6,
    isBestSeller: false,
    modifierGroups: ["Ukuran", "Level Gula"],
  },
];

// -----------------------------------------------------------------------------
// STAF — akun contoh (PIN 6 digit, di-hash saat seeding)
// -----------------------------------------------------------------------------

export const SEED_STAFF: SeedStaff[] = [
  { name: "Admin Owner", email: "admin@fnb.local", role: "ADMIN", pin: "111111" },
  { name: "Kasir Utama", email: "kasir@fnb.local", role: "CASHIER", pin: "222222" },
  { name: "Chef Dapur", email: "dapur@fnb.local", role: "KITCHEN", pin: "333333" },
  { name: "Pelayan Runner", email: "waiter@fnb.local", role: "WAITER", pin: "444444" },
];

// -----------------------------------------------------------------------------
// BAHAN BAKU & RESEP (BOM) — untuk HPP dan menu engineering
// -----------------------------------------------------------------------------

export type IngredientUnitKey = "GRAM" | "ML" | "PIECE" | "PACK" | "SLICE";

export interface SeedIngredient {
  name: string;
  /** SKU dipakai sebagai kunci natural (unik) saat upsert. */
  sku: string;
  unit: IngredientUnitKey;
  currentStock: number;
  minThreshold: number;
  costPerUnit: number;
}

export interface SeedRecipeLine {
  ingredientSku: string;
  /** Takaran per 1 porsi, dalam satuan bahan. */
  quantity: number;
}

export interface SeedRecipe {
  menuSlug: string;
  lines: SeedRecipeLine[];
}

export const SEED_INGREDIENTS: SeedIngredient[] = [
  { name: "Beras", sku: "BHN-BERAS", unit: "GRAM", currentStock: 25000, minThreshold: 5000, costPerUnit: 14 },
  { name: "Ayam Fillet", sku: "BHN-AYAM", unit: "GRAM", currentStock: 12000, minThreshold: 3000, costPerUnit: 42 },
  { name: "Telur Ayam", sku: "BHN-TELUR", unit: "PIECE", currentStock: 180, minThreshold: 40, costPerUnit: 2400 },
  { name: "Minyak Goreng", sku: "BHN-MINYAK", unit: "GRAM", currentStock: 8000, minThreshold: 2000, costPerUnit: 17 },
  { name: "Bawang Merah", sku: "BHN-BAWANG", unit: "GRAM", currentStock: 3000, minThreshold: 800, costPerUnit: 35 },
  { name: "Cabai Rawit", sku: "BHN-CABAI", unit: "GRAM", currentStock: 1500, minThreshold: 400, costPerUnit: 55 },
  { name: "Mie Telur", sku: "BHN-MIE", unit: "GRAM", currentStock: 6000, minThreshold: 1500, costPerUnit: 22 },
  { name: "Bakso Sapi", sku: "BHN-BAKSO", unit: "PIECE", currentStock: 150, minThreshold: 40, costPerUnit: 1200 },
  { name: "Kentang", sku: "BHN-KENTANG", unit: "GRAM", currentStock: 9000, minThreshold: 2500, costPerUnit: 19 },
  { name: "Biji Kopi", sku: "BHN-KOPI", unit: "GRAM", currentStock: 2500, minThreshold: 600, costPerUnit: 180 },
  { name: "Susu UHT", sku: "BHN-SUSU", unit: "ML", currentStock: 8000, minThreshold: 2000, costPerUnit: 18 },
  { name: "Gula Aren", sku: "BHN-GULA-AREN", unit: "GRAM", currentStock: 2000, minThreshold: 500, costPerUnit: 45 },
];

export const SEED_RECIPES: SeedRecipe[] = [
  {
    menuSlug: "nasi-goreng-kampung",
    lines: [
      { ingredientSku: "BHN-BERAS", quantity: 120 },
      { ingredientSku: "BHN-TELUR", quantity: 1 },
      { ingredientSku: "BHN-AYAM", quantity: 60 },
      { ingredientSku: "BHN-MINYAK", quantity: 15 },
      { ingredientSku: "BHN-BAWANG", quantity: 20 },
      { ingredientSku: "BHN-CABAI", quantity: 10 },
    ],
  },
  {
    menuSlug: "mie-ayam-bakso",
    lines: [
      { ingredientSku: "BHN-MIE", quantity: 100 },
      { ingredientSku: "BHN-AYAM", quantity: 70 },
      { ingredientSku: "BHN-BAKSO", quantity: 3 },
      { ingredientSku: "BHN-MINYAK", quantity: 10 },
      { ingredientSku: "BHN-BAWANG", quantity: 15 },
    ],
  },
  {
    menuSlug: "ayam-geprek-sambal-ijo",
    lines: [
      { ingredientSku: "BHN-AYAM", quantity: 150 },
      { ingredientSku: "BHN-BERAS", quantity: 120 },
      { ingredientSku: "BHN-CABAI", quantity: 25 },
      { ingredientSku: "BHN-BAWANG", quantity: 20 },
      { ingredientSku: "BHN-MINYAK", quantity: 25 },
    ],
  },
  {
    menuSlug: "sate-ayam-madura",
    lines: [
      { ingredientSku: "BHN-AYAM", quantity: 120 },
      { ingredientSku: "BHN-BERAS", quantity: 100 },
      { ingredientSku: "BHN-BAWANG", quantity: 15 },
      { ingredientSku: "BHN-GULA-AREN", quantity: 12 },
    ],
  },
  {
    menuSlug: "kentang-goreng",
    lines: [
      { ingredientSku: "BHN-KENTANG", quantity: 180 },
      { ingredientSku: "BHN-MINYAK", quantity: 30 },
    ],
  },
  {
    menuSlug: "kopi-susu-gula-aren",
    lines: [
      { ingredientSku: "BHN-KOPI", quantity: 18 },
      { ingredientSku: "BHN-SUSU", quantity: 150 },
      { ingredientSku: "BHN-GULA-AREN", quantity: 20 },
    ],
  },
];

// -----------------------------------------------------------------------------
// VALIDASI DATA (murni, tanpa database)
// -----------------------------------------------------------------------------

export interface SeedValidationResult {
  ok: boolean;
  errors: string[];
  counts: {
    areas: number;
    tables: number;
    categories: number;
    menus: number;
    modifierGroups: number;
    modifierOptions: number;
    staff: number;
    ingredients: number;
    recipes: number;
    recipeLines: number;
  };
}

const PIN_PATTERN = /^\d{4,8}$/;

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

/**
 * Memeriksa integritas data seed: jumlah minimum, keunikan kunci alami,
 * referensi antar-entitas, serta kewajaran harga & PIN.
 */
export function validateSeedData(): SeedValidationResult {
  const errors: string[] = [];

  // --- Keunikan kunci alami ---
  for (const [label, values] of [
    ["area slug", SEED_AREAS.map((a) => a.slug)],
    ["table qrSlug", SEED_TABLES.map((t) => t.qrSlug)],
    ["category slug", SEED_CATEGORIES.map((c) => c.slug)],
    ["menu slug", SEED_MENUS.map((m) => m.slug)],
    ["modifier group name", SEED_MODIFIER_GROUPS.map((g) => g.name)],
    ["staff email", SEED_STAFF.map((s) => s.email)],
  ] as const) {
    const dupes = findDuplicates(values);
    if (dupes.length > 0) {
      errors.push(`Duplikasi ${label}: ${dupes.join(", ")}`);
    }
  }

  // --- Jumlah minimum sesuai spesifikasi sub-tugas 1.5 ---
  const expectations: Array<[string, number, number]> = [
    ["area", SEED_AREAS.length, 2],
    ["meja", SEED_TABLES.length, 10],
    ["kategori", SEED_CATEGORIES.length, 4],
    ["menu", SEED_MENUS.length, 12],
    ["modifier group", SEED_MODIFIER_GROUPS.length, 4],
  ];
  for (const [label, actual, minimum] of expectations) {
    if (actual < minimum) {
      errors.push(`Jumlah ${label} kurang: ${actual} (minimum ${minimum}).`);
    }
  }

  // --- Referensi area & kategori ---
  const areaSlugs = new Set(SEED_AREAS.map((a) => a.slug));
  const categorySlugs = new Set(SEED_CATEGORIES.map((c) => c.slug));
  const groupNames = new Set(SEED_MODIFIER_GROUPS.map((g) => g.name));
  const menuSlugs = new Set(SEED_MENUS.map((m) => m.slug));

  for (const table of SEED_TABLES) {
    if (!areaSlugs.has(table.areaSlug)) {
      errors.push(`Meja ${table.qrSlug} merujuk area tidak dikenal: ${table.areaSlug}.`);
    }
    if (table.capacity <= 0) {
      errors.push(`Meja ${table.qrSlug} memiliki kapasitas tidak valid (${table.capacity}).`);
    }
    if (table.pinEnabled && (!table.pin || !PIN_PATTERN.test(table.pin))) {
      errors.push(`Meja ${table.qrSlug} mengaktifkan PIN tetapi PIN tidak valid (4-8 digit).`);
    }
  }

  for (const menu of SEED_MENUS) {
    if (!categorySlugs.has(menu.categorySlug)) {
      errors.push(`Menu ${menu.slug} merujuk kategori tidak dikenal: ${menu.categorySlug}.`);
    }
    if (menu.basePrice <= 0) {
      errors.push(`Menu ${menu.slug} memiliki basePrice tidak valid (${menu.basePrice}).`);
    }
    if (menu.costPrice < 0 || menu.costPrice >= menu.basePrice) {
      errors.push(
        `Menu ${menu.slug} memiliki costPrice (${menu.costPrice}) yang tidak wajar terhadap basePrice (${menu.basePrice}).`,
      );
    }
    for (const groupName of menu.modifierGroups) {
      if (!groupNames.has(groupName)) {
        errors.push(`Menu ${menu.slug} merujuk modifier group tidak dikenal: ${groupName}.`);
      }
    }
    if (new Set(menu.modifierGroups).size !== menu.modifierGroups.length) {
      errors.push(`Menu ${menu.slug} memiliki modifier group duplikat.`);
    }
  }

  // --- Aturan modifier group ---
  for (const group of SEED_MODIFIER_GROUPS) {
    const optionNames = group.options.map((o) => o.name);
    const dupes = findDuplicates(optionNames);
    if (dupes.length > 0) {
      errors.push(`Grup "${group.name}" memiliki opsi duplikat: ${dupes.join(", ")}.`);
    }
    if (group.options.length === 0) {
      errors.push(`Grup "${group.name}" tidak memiliki opsi.`);
    }
    if (group.minSelect > group.maxSelect) {
      errors.push(`Grup "${group.name}" memiliki minSelect > maxSelect.`);
    }
    if (group.selectionType === "SINGLE" && group.maxSelect !== 1) {
      errors.push(`Grup SINGLE "${group.name}" harus memiliki maxSelect = 1.`);
    }
    if (group.isRequired && group.minSelect < 1) {
      errors.push(`Grup wajib "${group.name}" harus memiliki minSelect >= 1.`);
    }
    if (group.selectionType === "MULTIPLE" && group.maxSelect > group.options.length) {
      errors.push(`Grup "${group.name}" memiliki maxSelect melebihi jumlah opsi.`);
    }
    const defaults = group.options.filter((o) => o.isDefault).length;
    if (defaults > 1) {
      errors.push(`Grup "${group.name}" memiliki lebih dari satu opsi default.`);
    }
  }

  // --- Staf ---
  for (const staff of SEED_STAFF) {
    if (!PIN_PATTERN.test(staff.pin)) {
      errors.push(`Staf ${staff.email} memiliki PIN tidak valid (4-8 digit).`);
    }
    if (!staff.email.includes("@")) {
      errors.push(`Staf "${staff.name}" memiliki email tidak valid: ${staff.email}.`);
    }
  }

  // --- Bahan baku & resep ---
  const ingredientSkus = new Set(SEED_INGREDIENTS.map((ingredient) => ingredient.sku));
  const duplicateSkus = findDuplicates(SEED_INGREDIENTS.map((ingredient) => ingredient.sku));

  if (duplicateSkus.length > 0) {
    errors.push(`SKU bahan duplikat: ${duplicateSkus.join(", ")}.`);
  }

  for (const ingredient of SEED_INGREDIENTS) {
    if (ingredient.currentStock < 0 || ingredient.minThreshold < 0) {
      errors.push(`Bahan ${ingredient.sku} memiliki stok/ambang negatif.`);
    }
    if (ingredient.costPerUnit < 0) {
      errors.push(`Bahan ${ingredient.sku} memiliki biaya satuan negatif.`);
    }
  }

  const duplicateRecipes = findDuplicates(SEED_RECIPES.map((recipe) => recipe.menuSlug));

  if (duplicateRecipes.length > 0) {
    errors.push(`Resep ganda untuk menu: ${duplicateRecipes.join(", ")}.`);
  }

  for (const recipe of SEED_RECIPES) {
    if (!menuSlugs.has(recipe.menuSlug)) {
      errors.push(`Resep merujuk menu tidak dikenal: ${recipe.menuSlug}.`);
    }
    if (recipe.lines.length === 0) {
      errors.push(`Resep ${recipe.menuSlug} tidak memiliki bahan.`);
    }

    const duplicateIngredients = findDuplicates(
      recipe.lines.map((line) => line.ingredientSku),
    );

    if (duplicateIngredients.length > 0) {
      errors.push(
        `Resep ${recipe.menuSlug} memuat bahan ganda: ${duplicateIngredients.join(", ")}.`,
      );
    }

    for (const line of recipe.lines) {
      if (!ingredientSkus.has(line.ingredientSku)) {
        errors.push(`Resep ${recipe.menuSlug} merujuk bahan tidak dikenal: ${line.ingredientSku}.`);
      }
      if (line.quantity <= 0) {
        errors.push(`Resep ${recipe.menuSlug} memiliki takaran tidak valid untuk ${line.ingredientSku}.`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      areas: SEED_AREAS.length,
      tables: SEED_TABLES.length,
      categories: SEED_CATEGORIES.length,
      menus: SEED_MENUS.length,
      modifierGroups: SEED_MODIFIER_GROUPS.length,
      modifierOptions: SEED_MODIFIER_GROUPS.reduce((total, group) => total + group.options.length, 0),
      staff: SEED_STAFF.length,
      ingredients: SEED_INGREDIENTS.length,
      recipes: SEED_RECIPES.length,
      recipeLines: SEED_RECIPES.reduce((total, recipe) => total + recipe.lines.length, 0),
    },
  };
}
