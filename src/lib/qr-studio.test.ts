import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOrderUrl,
  chunkTablesForPrint,
  getPrintSheetCount,
  groupTablesByArea,
  type StudioTableLike,
} from "./qr-studio";

const tables: StudioTableLike[] = [
  { id: "1", tableNumber: "10", qrSlug: "meja-10", areaId: "a1", areaName: "Indoor" },
  { id: "2", tableNumber: "02", qrSlug: "meja-02", areaId: "a1", areaName: "Indoor" },
  { id: "3", tableNumber: "01", qrSlug: "meja-01", areaId: "a2", areaName: "Outdoor" },
  { id: "4", tableNumber: "03", qrSlug: "meja-03", areaId: "a1", areaName: "Indoor" },
];

describe("buildOrderUrl", () => {
  it("menggabungkan base URL dan slug", () => {
    assert.equal(buildOrderUrl("https://fnb.example.com", "meja-01"), "https://fnb.example.com/t/meja-01");
  });

  it("menghapus trailing slash ganda", () => {
    assert.equal(buildOrderUrl("https://fnb.example.com///", "meja-02"), "https://fnb.example.com/t/meja-02");
  });

  it("mendukung host dengan port", () => {
    assert.equal(buildOrderUrl("http://localhost:3000", "meja-07"), "http://localhost:3000/t/meja-07");
  });
});

describe("groupTablesByArea", () => {
  it("mengelompokkan dan mengurutkan area berdasarkan nama", () => {
    const groups = groupTablesByArea(tables);
    assert.deepEqual(
      groups.map((group) => group.areaName),
      ["Indoor", "Outdoor"],
    );
  });

  it("mengurutkan nomor meja secara numerik", () => {
    const indoor = groupTablesByArea(tables).find((group) => group.areaId === "a1");
    assert.deepEqual(
      indoor?.tables.map((table) => table.tableNumber),
      ["02", "03", "10"],
    );
  });

  it("mengembalikan daftar kosong untuk input kosong", () => {
    assert.deepEqual(groupTablesByArea([]), []);
  });
});

describe("chunkTablesForPrint", () => {
  it("membagi menjadi halaman berisi 4 kartu", () => {
    const pages = chunkTablesForPrint(tables, 4);
    assert.equal(pages.length, 1);
    assert.equal(pages[0]?.length, 4);
  });

  it("menangani sisa kartu", () => {
    const pages = chunkTablesForPrint(tables, 3);
    assert.equal(pages.length, 2);
    assert.equal(pages[1]?.length, 1);
  });

  it("mengembalikan array kosong untuk tabel kosong", () => {
    assert.deepEqual(chunkTablesForPrint([], 4), []);
  });

  it("memaksa minimal 1 kartu per halaman", () => {
    assert.equal(chunkTablesForPrint(tables, 0).length, 4);
  });
});

describe("getPrintSheetCount", () => {
  it("menghitung jumlah lembar cetak", () => {
    assert.equal(getPrintSheetCount(tables, 4), 1);
    assert.equal(getPrintSheetCount(tables, 2), 2);
    assert.equal(getPrintSheetCount([], 4), 0);
  });
});
