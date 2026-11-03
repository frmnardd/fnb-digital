import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMenuSlug,
  filterAdminMenuItems,
  slugify,
  validateMenuPricing,
  validateSchedule,
} from "./admin-menu";

describe("slugify", () => {
  it("membuat slug ramah URL dari nama berdiakritik", () => {
    assert.equal(slugify("Nasi Goreng Kampung"), "nasi-goreng-kampung");
    assert.equal(slugify("Crème Brûlée"), "creme-brulee");
    assert.equal(slugify("  Es Teh   Manis!! "), "es-teh-manis");
  });

  it("membatasi panjang slug", () => {
    assert.ok(slugify("a".repeat(120)).length <= 60);
  });
});

describe("buildMenuSlug", () => {
  it("mengembalikan slug dasar bila belum dipakai", () => {
    assert.equal(buildMenuSlug("Kopi Susu"), "kopi-susu");
  });

  it("menambahkan sufiks angka saat bentrok", () => {
    assert.equal(buildMenuSlug("Kopi Susu", ["kopi-susu"]), "kopi-susu-2");
    assert.equal(buildMenuSlug("Kopi Susu", ["kopi-susu", "kopi-susu-2"]), "kopi-susu-3");
  });

  it("memakai fallback untuk nama kosong", () => {
    assert.equal(buildMenuSlug("!!!"), "menu");
  });
});

describe("validateMenuPricing", () => {
  it("menerima harga jual positif dengan HPP lebih kecil", () => {
    assert.deepEqual(validateMenuPricing({ basePrice: 38000, costPrice: 14500 }), {
      valid: true,
    });
  });

  it("menolak harga jual nol/negatif/pecahan", () => {
    assert.equal(validateMenuPricing({ basePrice: 0, costPrice: 0 }).valid, false);
    assert.equal(validateMenuPricing({ basePrice: -1, costPrice: 0 }).valid, false);
    assert.equal(validateMenuPricing({ basePrice: 1000.5, costPrice: 0 }).valid, false);
  });

  it("menolak HPP negatif atau >= harga jual", () => {
    assert.equal(validateMenuPricing({ basePrice: 10000, costPrice: -1 }).valid, false);
    assert.equal(validateMenuPricing({ basePrice: 10000, costPrice: 10000 }).valid, false);
    assert.equal(validateMenuPricing({ basePrice: 10000, costPrice: 12000 }).valid, false);
  });
});

describe("validateSchedule", () => {
  it("mengizinkan jadwal kosong", () => {
    assert.deepEqual(validateSchedule(null, null), { valid: true });
    assert.deepEqual(validateSchedule("", ""), { valid: true });
  });

  it("menerima format HH:mm yang valid", () => {
    assert.equal(validateSchedule("10:00", "22:00").valid, true);
    assert.equal(validateSchedule("22:00", "02:00").valid, true);
  });

  it("menolak format salah", () => {
    assert.equal(validateSchedule("9:00", "22:00").valid, false);
    assert.equal(validateSchedule("10:00", "25:00").valid, false);
  });

  it("menolak hanya salah satu jam diisi", () => {
    assert.equal(validateSchedule("10:00", "").valid, false);
    assert.equal(validateSchedule("", "22:00").valid, false);
  });
});

describe("filterAdminMenuItems", () => {
  const items = [
    { id: "1", name: "Nasi Goreng", categoryId: "c1", slug: "nasi-goreng", isAvailable: true },
    { id: "2", name: "Es Teh", categoryId: "c2", slug: "es-teh", isAvailable: false },
    { id: "3", name: "Kopi Susu", categoryId: "c2", slug: "kopi-susu", isAvailable: true },
  ];

  it("mengembalikan semua item tanpa filter", () => {
    assert.equal(filterAdminMenuItems(items).length, 3);
  });

  it("memfilter berdasarkan pencarian nama/slug", () => {
    assert.deepEqual(
      filterAdminMenuItems(items, { search: "kopi" }).map((item) => item.id),
      ["3"],
    );
    assert.deepEqual(
      filterAdminMenuItems(items, { search: "teh" }).map((item) => item.id),
      ["2"],
    );
  });

  it("memfilter berdasarkan kategori", () => {
    assert.deepEqual(
      filterAdminMenuItems(items, { categoryId: "c2" }).map((item) => item.id),
      ["2", "3"],
    );
  });

  it("memfilter hanya menu 86'd", () => {
    assert.deepEqual(
      filterAdminMenuItems(items, { only86: true }).map((item) => item.id),
      ["2"],
    );
  });

  it("menggabungkan filter", () => {
    assert.deepEqual(
      filterAdminMenuItems(items, { search: "teh", only86: true }).map((item) => item.id),
      ["2"],
    );
  });
});
