import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicModifierGroup } from "../types/menu";

import {
  calculateSelectionTotal,
  createInitialSelection,
  isOptionDisabled,
  selectionToModifiers,
  toggleOption,
  validateSelection,
  type ModifierSelection,
} from "./modifier-selection";

const spiceGroup: PublicModifierGroup = {
  id: "grp-pedas",
  name: "Level Pedas",
  selectionType: "SINGLE",
  isRequired: true,
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: "opt-tidak", name: "Tidak Pedas", priceDelta: 0, isDefault: true },
    { id: "opt-sedang", name: "Sedang", priceDelta: 0, isDefault: false },
    { id: "opt-pedas", name: "Pedas", priceDelta: 0, isDefault: false },
  ],
};

const sizeGroup: PublicModifierGroup = {
  id: "grp-ukuran",
  name: "Ukuran",
  selectionType: "SINGLE",
  isRequired: true,
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: "opt-reguler", name: "Reguler", priceDelta: 0, isDefault: false },
    { id: "opt-large", name: "Large", priceDelta: 8000, isDefault: false },
  ],
};

const toppingGroup: PublicModifierGroup = {
  id: "grp-topping",
  name: "Extra Topping",
  selectionType: "MULTIPLE",
  isRequired: false,
  minSelect: 0,
  maxSelect: 2,
  options: [
    { id: "opt-telur", name: "Extra Telur", priceDelta: 5000, isDefault: false },
    { id: "opt-keju", name: "Keju Mozzarella", priceDelta: 7000, isDefault: false },
    { id: "opt-ayam", name: "Extra Ayam", priceDelta: 10000, isDefault: false },
    { id: "opt-diskon", name: "Promo Topping", priceDelta: -2000, isDefault: false },
  ],
};

const groups = [spiceGroup, sizeGroup, toppingGroup];

describe("createInitialSelection", () => {
  it("memilih opsi default pada grup SINGLE", () => {
    const selection = createInitialSelection([spiceGroup]);
    assert.deepEqual(selection[spiceGroup.id], ["opt-tidak"]);
  });

  it("memilih opsi pertama pada grup SINGLE wajib tanpa default", () => {
    const selection = createInitialSelection([sizeGroup]);
    assert.deepEqual(selection[sizeGroup.id], ["opt-reguler"]);
  });

  it("membiarkan grup SINGLE opsional tanpa default kosong", () => {
    const optionalGroup: PublicModifierGroup = { ...sizeGroup, id: "grp-opsional", isRequired: false };
    const selection = createInitialSelection([optionalGroup]);
    assert.deepEqual(selection["grp-opsional"], []);
  });

  it("membiarkan grup MULTIPLE kosong bila tidak ada default", () => {
    const selection = createInitialSelection([toppingGroup]);
    assert.deepEqual(selection[toppingGroup.id], []);
  });

  it("mengambil default MULTIPLE sebatas maxSelect", () => {
    const defaultedGroup: PublicModifierGroup = {
      ...toppingGroup,
      options: toppingGroup.options.map((option) => ({ ...option, isDefault: true })),
    };
    const selection = createInitialSelection([defaultedGroup]);
    assert.equal(selection[defaultedGroup.id]?.length, 2);
  });
});

describe("toggleOption", () => {
  it("mengganti pilihan pada grup SINGLE", () => {
    const initial = createInitialSelection([spiceGroup]);
    const next = toggleOption(initial, spiceGroup, "opt-pedas");
    assert.deepEqual(next[spiceGroup.id], ["opt-pedas"]);
  });

  it("tidak mengosongkan grup SINGLE yang wajib", () => {
    const initial = createInitialSelection([spiceGroup]);
    const next = toggleOption(initial, spiceGroup, "opt-tidak");
    assert.deepEqual(next[spiceGroup.id], ["opt-tidak"]);
  });

  it("mengosongkan grup SINGLE opsional saat opsi aktif diklik ulang", () => {
    const optionalGroup: PublicModifierGroup = { ...sizeGroup, id: "grp-opsional", isRequired: false };
    const selection: ModifierSelection = { "grp-opsional": ["opt-large"] };
    const next = toggleOption(selection, optionalGroup, "opt-large");
    assert.deepEqual(next["grp-opsional"], []);
  });

  it("menambah dan menghapus opsi pada grup MULTIPLE", () => {
    const initial: ModifierSelection = { [toppingGroup.id]: [] };
    const added = toggleOption(initial, toppingGroup, "opt-telur");
    assert.deepEqual(added[toppingGroup.id], ["opt-telur"]);

    const removed = toggleOption(added, toppingGroup, "opt-telur");
    assert.deepEqual(removed[toppingGroup.id], []);
  });

  it("mengabaikan penambahan saat maxSelect tercapai", () => {
    const selection: ModifierSelection = { [toppingGroup.id]: ["opt-telur", "opt-keju"] };
    const next = toggleOption(selection, toppingGroup, "opt-ayam");
    assert.deepEqual(next[toppingGroup.id], ["opt-telur", "opt-keju"]);
  });

  it("tidak memutasi selection asal", () => {
    const selection: ModifierSelection = { [toppingGroup.id]: ["opt-telur"] };
    toggleOption(selection, toppingGroup, "opt-keju");
    assert.deepEqual(selection[toppingGroup.id], ["opt-telur"]);
  });
});

describe("isOptionDisabled", () => {
  it("menonaktifkan opsi baru saat batas tercapai, tetapi opsi terpilih tetap aktif", () => {
    const selection: ModifierSelection = { [toppingGroup.id]: ["opt-telur", "opt-keju"] };
    assert.equal(isOptionDisabled(toppingGroup, selection, "opt-ayam"), true);
    assert.equal(isOptionDisabled(toppingGroup, selection, "opt-telur"), false);
  });

  it("tidak pernah menonaktifkan opsi pada grup SINGLE", () => {
    const selection: ModifierSelection = { [sizeGroup.id]: ["opt-large"] };
    assert.equal(isOptionDisabled(sizeGroup, selection, "opt-reguler"), false);
  });
});

describe("validateSelection", () => {
  it("lulus bila seluruh grup wajib terisi", () => {
    const selection = createInitialSelection(groups);
    assert.deepEqual(validateSelection(groups, selection), { valid: true, errors: [] });
  });

  it("menolak grup wajib yang kosong", () => {
    const selection: ModifierSelection = { [spiceGroup.id]: [] };
    const result = validateSelection([spiceGroup], selection);

    assert.equal(result.valid, false);
    assert.equal(result.errors[0]?.groupId, spiceGroup.id);
    assert.match(result.errors[0]?.message ?? "", /wajib dipilih/);
  });

  it("menolak jumlah pilihan di atas maxSelect", () => {
    const selection: ModifierSelection = {
      [toppingGroup.id]: ["opt-telur", "opt-keju", "opt-ayam"],
    };
    const result = validateSelection([toppingGroup], selection);

    assert.equal(result.valid, false);
    assert.match(result.errors[0]?.message ?? "", /maksimal 2/);
  });

  it("menghiraukan opsi yang tidak dikenal", () => {
    const selection: ModifierSelection = { [spiceGroup.id]: ["opt-asing"] };
    const result = validateSelection([spiceGroup], selection);
    assert.equal(result.valid, false);
  });
});

describe("selectionToModifiers", () => {
  it("menghasilkan modifier sesuai urutan grup", () => {
    const selection: ModifierSelection = {
      [spiceGroup.id]: ["opt-pedas"],
      [sizeGroup.id]: ["opt-large"],
      [toppingGroup.id]: ["opt-telur", "opt-keju"],
    };

    const modifiers = selectionToModifiers(groups, selection);

    assert.deepEqual(
      modifiers.map((modifier) => modifier.id),
      ["grp-pedas:opt-pedas", "grp-ukuran:opt-large", "grp-topping:opt-telur", "grp-topping:opt-keju"],
    );
    assert.equal(modifiers[1]?.priceDelta, 8000);
  });
});

describe("calculateSelectionTotal", () => {
  it("menjumlahkan harga dasar dengan seluruh modifier", () => {
    const selection: ModifierSelection = {
      [spiceGroup.id]: ["opt-pedas"],
      [sizeGroup.id]: ["opt-large"],
      [toppingGroup.id]: ["opt-telur"],
    };

    const totals = calculateSelectionTotal(24000, groups, selection, 1);
    assert.equal(totals.unitPrice, 24000 + 8000 + 5000);
    assert.equal(totals.total, 37000);
  });

  it("mengalikan dengan kuantitas", () => {
    const selection: ModifierSelection = { [sizeGroup.id]: ["opt-large"] };
    const totals = calculateSelectionTotal(24000, [sizeGroup], selection, 3);
    assert.equal(totals.unitPrice, 32000);
    assert.equal(totals.total, 96000);
  });

  it("mendukung modifier bernilai negatif", () => {
    const selection: ModifierSelection = {
      [sizeGroup.id]: ["opt-reguler"],
      [toppingGroup.id]: ["opt-diskon"],
    };
    const totals = calculateSelectionTotal(20000, [sizeGroup, toppingGroup], selection, 1);
    assert.equal(totals.unitPrice, 18000);
    assert.equal(totals.total, 18000);
  });
});
