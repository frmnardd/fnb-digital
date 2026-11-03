import {
  calculateLineTotal,
  calculateOrderTotals,
  type PricingDiscountInput,
  type PricingModifierInput,
  type PricingTotals,
} from "@/lib/pricing";
import { selectionToModifiers, validateSelection, type ModifierSelection } from "@/lib/modifier-selection";
import type { PublicMenuItem, StationKey } from "@/types/menu";

/**
 * Penyusun draft pesanan di sisi server.
 *
 * Fungsi murni ini adalah SATU-SATUNYA jalur yang boleh menentukan harga order:
 * menerima id menu + id opsi modifier dari klien, lalu menghitung ulang seluruh
 * nominal dari data katalog di database (CONTEXT §6.3).
 */

export const PAYMENT_METHODS = [
  "QRIS_DYNAMIC",
  "VIRTUAL_ACCOUNT",
  "MANUAL_TRANSFER",
  "CASH",
  "EDC_CARD",
] as const;

export type PaymentMethodKey = (typeof PAYMENT_METHODS)[number];

export const MAX_ITEM_QUANTITY = 20;

export interface OrderDraftItemInput {
  menuItemId: string;
  quantity: number;
  modifierOptionIds: string[];
  note?: string;
}

export interface OrderDraftInput {
  items: readonly OrderDraftItemInput[];
  /** Peta id menu → menu publik (beserta modifier groups) dari database. */
  menuIndex: ReadonlyMap<string, PublicMenuItem>;
  paymentMethod: PaymentMethodKey;
  discount?: PricingDiscountInput;
  /** Injector untuk test deterministik. */
  uniqueCodeGenerator?: () => number;
}

export interface OrderDraftLine {
  menuItemId: string;
  menuName: string;
  station: StationKey;
  basePrice: number;
  quantity: number;
  unitPrice: number;
  modifierTotal: number;
  lineTotal: number;
  modifiers: PricingModifierInput[];
  note: string;
}

export interface OrderDraft {
  lines: OrderDraftLine[];
  totals: PricingTotals;
}

export type OrderDraftErrorCode =
  | "EMPTY_CART"
  | "MENU_NOT_FOUND"
  | "MENU_UNAVAILABLE"
  | "MODIFIER_INVALID"
  | "QUANTITY_INVALID"
  | "INVALID_PAYMENT_METHOD";

export class OrderDraftError extends Error {
  readonly code: OrderDraftErrorCode;
  readonly details?: unknown;

  constructor(code: OrderDraftErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "OrderDraftError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Memvalidasi opsi modifier yang dipilih klien terhadap grup yang benar-benar
 * menempel pada menu tersebut, lalu mengembalikan snapshot modifier berharga.
 */
export function resolveModifiers(
  menuItem: PublicMenuItem,
  optionIds: readonly string[],
): PricingModifierInput[] {
  const uniqueOptionIds = new Set(optionIds);

  if (uniqueOptionIds.size !== optionIds.length) {
    throw new OrderDraftError(
      "MODIFIER_INVALID",
      `Opsi modifier duplikat pada menu "${menuItem.name}".`,
    );
  }

  const selection: ModifierSelection = {};

  for (const optionId of optionIds) {
    const group = menuItem.modifierGroups.find((candidate) =>
      candidate.options.some((option) => option.id === optionId),
    );

    if (!group) {
      throw new OrderDraftError(
        "MODIFIER_INVALID",
        `Opsi modifier tidak valid untuk menu "${menuItem.name}".`,
        { menuItemId: menuItem.id, optionId },
      );
    }

    const current = selection[group.id] ?? [];

    if (group.selectionType === "SINGLE" && current.length >= 1) {
      throw new OrderDraftError(
        "MODIFIER_INVALID",
        `Grup "${group.name}" hanya boleh dipilih satu opsi.`,
        { menuItemId: menuItem.id, groupId: group.id },
      );
    }

    selection[group.id] = [...current, optionId];
  }

  const validation = validateSelection(menuItem.modifierGroups, selection);

  if (!validation.valid) {
    throw new OrderDraftError(
      "MODIFIER_INVALID",
      validation.errors[0]?.message ?? "Pilihan modifier tidak lengkap.",
      { menuItemId: menuItem.id, errors: validation.errors },
    );
  }

  return selectionToModifiers(menuItem.modifierGroups, selection);
}

/** Membangun line + total pesanan yang sudah divalidasi sepenuhnya di server. */
export function buildOrderDraft(input: OrderDraftInput): OrderDraft {
  if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
    throw new OrderDraftError("INVALID_PAYMENT_METHOD", "Metode pembayaran tidak dikenal.");
  }

  if (input.items.length === 0) {
    throw new OrderDraftError("EMPTY_CART", "Pesanan harus memiliki minimal satu item.");
  }

  const lines: OrderDraftLine[] = [];

  for (const item of input.items) {
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > MAX_ITEM_QUANTITY
    ) {
      throw new OrderDraftError(
        "QUANTITY_INVALID",
        `Kuantitas harus bilangan bulat 1–${MAX_ITEM_QUANTITY}.`,
        { menuItemId: item.menuItemId, quantity: item.quantity },
      );
    }

    const menuItem = input.menuIndex.get(item.menuItemId);

    if (!menuItem) {
      throw new OrderDraftError("MENU_NOT_FOUND", "Menu tidak ditemukan atau sudah tidak aktif.", {
        menuItemId: item.menuItemId,
      });
    }

    if (!menuItem.isOrderable) {
      throw new OrderDraftError(
        "MENU_UNAVAILABLE",
        `Menu "${menuItem.name}" sedang tidak tersedia.`,
        { menuItemId: menuItem.id, isAvailable: menuItem.isAvailable },
      );
    }

    const modifiers = resolveModifiers(menuItem, item.modifierOptionIds);
    const line = calculateLineTotal({
      menuItemId: menuItem.id,
      menuName: menuItem.name,
      basePrice: menuItem.basePrice,
      quantity: item.quantity,
      modifiers,
      notes: item.note,
    });

    lines.push({
      menuItemId: menuItem.id,
      menuName: menuItem.name,
      station: menuItem.station,
      basePrice: menuItem.basePrice,
      quantity: item.quantity,
      unitPrice: line.unitPrice,
      modifierTotal: line.modifierTotal,
      lineTotal: line.lineTotal,
      modifiers,
      note: item.note?.trim() ?? "",
    });
  }

  const totals = calculateOrderTotals({
    items: lines.map((line) => ({
      menuItemId: line.menuItemId,
      menuName: line.menuName,
      basePrice: line.basePrice,
      quantity: line.quantity,
      modifiers: line.modifiers,
      notes: line.note,
    })),
    ...(input.discount === undefined ? {} : { discount: input.discount }),
    // Kode unik hanya relevan untuk transfer manual (rekonsiliasi bank).
    applyUniqueCode: input.paymentMethod === "MANUAL_TRANSFER",
    ...(input.uniqueCodeGenerator === undefined
      ? {}
      : { uniqueCodeGenerator: input.uniqueCodeGenerator }),
  });

  return { lines, totals };
}
