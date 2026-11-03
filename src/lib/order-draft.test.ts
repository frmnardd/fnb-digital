import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicMenuItem, PublicModifierGroup } from "@/types/menu";

import {
  buildOrderDraft,
  OrderDraftError,
  resolveModifiers,
  type OrderDraftItemInput,
  type PaymentMethodKey,
} from "./order-draft";
import type { PublicModifierGroup as Group } from "@/types/menu";

function makeMenuItem(
  overrides: Partial<PublicMenuItem> & { id: string; name: string },
): PublicMenuItem {
  return {
    slug: overrides.id,
    description: null,
    imageUrl: null,
    basePrice: 38000,
    station: "KITCHEN",
    isBestSeller: false,
    tags: [],
    prepTimeMinutes: 10,
    isAvailable: true,
    isOrderable: true,
    availableFrom: null,
    availableUntil: null,
    modifierGroups: [],
    ...overrides,
  };
}

const spiceGroup: Group = {
  id: "grp-spice",
  name: "Level Pedas",
  selectionType: "SINGLE",
  isRequired: true,
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: "opt-none", name: "Tidak Pedas", priceDelta: 0, isDefault: true },
    { id: "opt-pedas", name: "Pedas", priceDelta: 0, isDefault: false },
  ],
};

const toppingGroup: Group = {
  id: "grp-topping",
  name: "Extra Topping",
  selectionType: "MULTIPLE",
  isRequired: false,
  minSelect: 0,
  maxSelect: 2,
  options: [
    { id: "opt-telur", name: "Extra Telur", priceDelta: 5000, isDefault: false },
    { id: "opt-keju", name: "Keju", priceDelta: 7000, isDefault: false },
    { id: "opt-ayam", name: "Extra Ayam", priceDelta: 10000, isDefault: false },
  ],
};

const otherGroup: Group = {
  id: "grp-ukuran",
  name: "Ukuran",
  selectionType: "SINGLE",
  isRequired: false,
  minSelect: 0,
  maxSelect: 1,
  options: [{ id: "opt-large", name: "Large", priceDelta: 8000, isDefault: false }],
};

const nasi = makeMenuItem({
  id: "menu-nasi",
  name: "Nasi Goreng",
  basePrice: 38000,
  modifierGroups: [spiceGroup, toppingGroup],
});

const kopi = makeMenuItem({
  id: "menu-kopi",
  name: "Kopi Susu",
  basePrice: 24000,
  station: "BAR",
  modifierGroups: [otherGroup],
});

const habis = makeMenuItem({
  id: "menu-habis",
  name: "Menu Habis",
  isAvailable: false,
  isOrderable: false,
});

const menuIndex = new Map<string, PublicMenuItem>([
  [nasi.id, nasi],
  [kopi.id, kopi],
  [habis.id, habis],
]);

function item(overrides: Partial<OrderDraftItemInput> = {}): OrderDraftItemInput {
  return {
    menuItemId: "menu-nasi",
    quantity: 1,
    modifierOptionIds: ["opt-none"],
    ...overrides,
  };
}

function draft(items: OrderDraftItemInput[], paymentMethod: PaymentMethodKey = "QRIS_DYNAMIC") {
  return buildOrderDraft({ items, menuIndex, paymentMethod });
}

function expectError(fn: () => unknown, code: string): OrderDraftError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof OrderDraftError, "error harus OrderDraftError");
    assert.equal(error.code, code);
    return error;
  }

  assert.fail(`seharusnya melempar OrderDraftError ${code}`);
}

describe("buildOrderDraft — perhitungan harga", () => {
  it("menghitung ulang harga dari data menu & modifier", () => {
    const result = draft([item({ quantity: 2, modifierOptionIds: ["opt-none", "opt-telur"] })]);

    assert.equal(result.lines[0]?.unitPrice, 43000);
    assert.equal(result.lines[0]?.lineTotal, 86000);
    assert.equal(result.totals.subtotal, 86000);
    assert.equal(result.totals.serviceCharge, 4300);
    assert.equal(result.totals.taxAmount, 9030);
    assert.equal(result.totals.grandTotal, 99330);
  });

  it("mengabaikan harga kiriman klien (hanya basePrice database yang dipakai)", () => {
    // Input tidak memiliki field harga sama sekali; total murni dari basePrice menu.
    const result = draft([item({ menuItemId: "menu-kopi", quantity: 3, modifierOptionIds: [] })]);
    assert.equal(result.totals.subtotal, 24000 * 3);
  });

  it("menjumlahkan beberapa baris berbeda", () => {
    const result = draft([
      item({ quantity: 1 }),
      item({ menuItemId: "menu-kopi", quantity: 2, modifierOptionIds: ["opt-large"] }),
    ]);

    assert.equal(result.lines.length, 2);
    assert.equal(result.totals.subtotal, 38000 + (24000 + 8000) * 2);
  });

  it("menerapkan diskon sebelum service charge & PB1", () => {
    const result = buildOrderDraft({
      items: [item({ quantity: 2, modifierOptionIds: ["opt-none"] })],
      menuIndex,
      paymentMethod: "QRIS_DYNAMIC",
      discount: { type: "PERCENT", value: 10 },
    });

    assert.equal(result.totals.subtotal, 76000);
    assert.equal(result.totals.discountAmount, 7600);
    assert.equal(result.totals.serviceCharge, 3420);
    assert.equal(result.totals.taxAmount, 7182);
  });
});

describe("buildOrderDraft — kode unik", () => {
  it("hanya menambahkan kode unik untuk MANUAL_TRANSFER", () => {
    const withCode = buildOrderDraft({
      items: [item()],
      menuIndex,
      paymentMethod: "MANUAL_TRANSFER",
      uniqueCodeGenerator: () => 321,
    });
    assert.equal(withCode.totals.uniqueCode, 321);

    const cash = draft([item()], "CASH");
    assert.equal(cash.totals.uniqueCode, 0);

    const qris = draft([item()], "QRIS_DYNAMIC");
    assert.equal(qris.totals.uniqueCode, 0);
  });
});

describe("buildOrderDraft — validasi", () => {
  it("menolak keranjang kosong", () => {
    expectError(() => draft([]), "EMPTY_CART");
  });

  it("menolak kuantitas tidak valid", () => {
    expectError(() => draft([item({ quantity: 0 })]), "QUANTITY_INVALID");
    expectError(() => draft([item({ quantity: 1.5 })]), "QUANTITY_INVALID");
    expectError(() => draft([item({ quantity: 21 })]), "QUANTITY_INVALID");
  });

  it("menolak menu yang tidak ada", () => {
    expectError(() => draft([item({ menuItemId: "menu-asing" })]), "MENU_NOT_FOUND");
  });

  it("menolak menu yang tidak tersedia", () => {
    expectError(() => draft([item({ menuItemId: "menu-habis" })]), "MENU_UNAVAILABLE");
  });

  it("menolak metode pembayaran tidak dikenal", () => {
    expectError(
      () =>
        buildOrderDraft({
          items: [item()],
          menuIndex,
          paymentMethod: "BITCOIN" as PaymentMethodKey,
        }),
      "INVALID_PAYMENT_METHOD",
    );
  });

  it("menolak opsi modifier dari menu lain", () => {
    expectError(
      () => draft([item({ modifierOptionIds: ["opt-none", "opt-large"] })]),
      "MODIFIER_INVALID",
    );
  });

  it("menolak opsi modifier duplikat", () => {
    expectError(
      () => draft([item({ modifierOptionIds: ["opt-none", "opt-telur", "opt-telur"] })]),
      "MODIFIER_INVALID",
    );
  });

  it("menolak bila grup wajib belum dipilih", () => {
    const error = expectError(
      () => draft([item({ modifierOptionIds: ["opt-telur"] })]),
      "MODIFIER_INVALID",
    );
    assert.match(error.message, /wajib dipilih/i);
  });

  it("menolak bila melebihi maxSelect", () => {
    expectError(
      () =>
        draft([
          item({ modifierOptionIds: ["opt-none", "opt-telur", "opt-keju", "opt-ayam"] }),
        ]),
      "MODIFIER_INVALID",
    );
  });

  it("menolak dua opsi pada grup SINGLE", () => {
    expectError(
      () => draft([item({ modifierOptionIds: ["opt-none", "opt-pedas"] })]),
      "MODIFIER_INVALID",
    );
  });
});

describe("resolveModifiers", () => {
  it("mengembalikan snapshot modifier berharga", () => {
    const modifiers = resolveModifiers(nasi, ["opt-none", "opt-telur"]);

    assert.deepEqual(
      modifiers.map((modifier) => modifier.name),
      ["Tidak Pedas", "Extra Telur"],
    );
    assert.equal(modifiers[1]?.priceDelta, 5000);
  });

  it("menerima grup opsional yang kosong", () => {
    assert.deepEqual(resolveModifiers(kopi, []), []);
  });
});

describe("tipe grup modifier", () => {
  it("fixture memakai tipe yang benar", () => {
    const groups: PublicModifierGroup[] = [spiceGroup, toppingGroup, otherGroup];
    assert.equal(groups.length, 3);
  });
});
