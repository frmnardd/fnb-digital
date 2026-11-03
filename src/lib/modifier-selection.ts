import { calculateLineTotal, type PricingModifierInput } from "@/lib/pricing";
import type { PublicModifierGroup } from "@/types/menu";

/**
 * Logika pemilihan modifier (Level Pedas, Ukuran, Topping, Level Gula).
 *
 * Murni & tanpa React supaya mudah diuji: sheet hanya menampilkan state dan
 * memanggil fungsi-fungsi di sini.
 *
 * Bentuk state: `{ [groupId]: optionId[] }`. Grup SINGLE menyimpan maksimal satu
 * opsi; grup MULTIPLE menyimpan banyak opsi (dibatasi `maxSelect`).
 */

export type ModifierSelection = Record<string, string[]>;

export interface SelectionError {
  groupId: string;
  message: string;
}

export interface SelectionValidation {
  valid: boolean;
  errors: SelectionError[];
}

/** Memilih opsi awal: default dari database, atau opsi pertama untuk grup wajib. */
export function createInitialSelection(
  groups: readonly PublicModifierGroup[],
): ModifierSelection {
  const selection: ModifierSelection = {};

  for (const group of groups) {
    if (group.selectionType === "SINGLE") {
      const defaultOption = group.options.find((option) => option.isDefault);
      const fallback = group.isRequired ? group.options[0] : undefined;
      const chosen = defaultOption ?? fallback;

      selection[group.id] = chosen ? [chosen.id] : [];
      continue;
    }

    selection[group.id] = group.options
      .filter((option) => option.isDefault)
      .slice(0, group.maxSelect)
      .map((option) => option.id);
  }

  return selection;
}

/**
 * Mengubah pilihan saat sebuah opsi diklik.
 *
 * - SINGLE: mengganti opsi aktif; klik opsi yang sedang aktif akan mengosongkan
 *   grup kecuali grup tersebut wajib.
 * - MULTIPLE: toggle; penambahan diabaikan bila `maxSelect` sudah tercapai.
 */
export function toggleOption(
  selection: ModifierSelection,
  group: PublicModifierGroup,
  optionId: string,
): ModifierSelection {
  const current = selection[group.id] ?? [];
  const isSelected = current.includes(optionId);

  if (group.selectionType === "SINGLE") {
    if (isSelected) {
      return group.isRequired ? selection : { ...selection, [group.id]: [] };
    }

    return { ...selection, [group.id]: [optionId] };
  }

  if (isSelected) {
    return { ...selection, [group.id]: current.filter((id) => id !== optionId) };
  }

  if (current.length >= group.maxSelect) {
    return selection;
  }

  return { ...selection, [group.id]: [...current, optionId] };
}

/** Opsi non-aktif saat batas `maxSelect` grup MULTIPLE sudah tercapai. */
export function isOptionDisabled(
  group: PublicModifierGroup,
  selection: ModifierSelection,
  optionId: string,
): boolean {
  if (group.selectionType !== "MULTIPLE") {
    return false;
  }

  const current = selection[group.id] ?? [];

  if (current.includes(optionId)) {
    return false;
  }

  return current.length >= group.maxSelect;
}

/** Memeriksa kelengkapan & batas pilihan sebelum item masuk keranjang. */
export function validateSelection(
  groups: readonly PublicModifierGroup[],
  selection: ModifierSelection,
): SelectionValidation {
  const errors: SelectionError[] = [];

  for (const group of groups) {
    const selected = selection[group.id] ?? [];
    const validCount = selected.filter((optionId) =>
      group.options.some((option) => option.id === optionId),
    ).length;

    if (group.isRequired && validCount === 0) {
      errors.push({ groupId: group.id, message: `"${group.name}" wajib dipilih.` });
      continue;
    }

    if (validCount > 0 && validCount < group.minSelect) {
      errors.push({
        groupId: group.id,
        message: `"${group.name}" minimal ${group.minSelect} pilihan.`,
      });
    }

    if (validCount > group.maxSelect) {
      errors.push({
        groupId: group.id,
        message: `"${group.name}" maksimal ${group.maxSelect} pilihan.`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Menyiapkan input untuk mesin harga (`src/lib/pricing.ts`).
 * Urutan modifier mengikuti urutan grup di database agar struk konsisten.
 */
export function selectionToModifiers(
  groups: readonly PublicModifierGroup[],
  selection: ModifierSelection,
): PricingModifierInput[] {
  const modifiers: PricingModifierInput[] = [];

  for (const group of groups) {
    const selectedIds = selection[group.id] ?? [];

    for (const optionId of selectedIds) {
      const option = group.options.find((candidate) => candidate.id === optionId);

      if (!option) {
        continue;
      }

      modifiers.push({
        id: `${group.id}:${option.id}`,
        name: option.name,
        priceDelta: option.priceDelta,
      });
    }
  }

  return modifiers;
}

export interface SelectionTotal {
  unitPrice: number;
  total: number;
  modifiers: PricingModifierInput[];
}

/** Harga reaktif untuk pratinjau di bottom sheet. */
export function calculateSelectionTotal(
  basePrice: number,
  groups: readonly PublicModifierGroup[],
  selection: ModifierSelection,
  quantity: number = 1,
): SelectionTotal {
  const modifiers = selectionToModifiers(groups, selection);
  const line = calculateLineTotal({
    menuItemId: "preview",
    basePrice,
    quantity,
    modifiers,
  });

  return { unitPrice: line.unitPrice, total: line.lineTotal, modifiers };
}
