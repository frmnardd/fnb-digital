/**
 * Tipe data katalog menu yang aman dikirim ke klien.
 *
 * Sengaja tidak memuat `costPrice` (HPP) atau field internal database.
 * Dipakai bersama oleh route `GET /api/menu`, server component pelanggan,
 * dan komponen client (`MenuBrowser`, `MenuCard`).
 */

export type StationKey = "KITCHEN" | "BAR" | "PASTRY";
export type SelectionType = "SINGLE" | "MULTIPLE";

export interface PublicModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface PublicModifierGroup {
  id: string;
  name: string;
  selectionType: SelectionType;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: PublicModifierOption[];
}

export interface PublicMenuItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  station: StationKey;
  isBestSeller: boolean;
  tags: string[];
  prepTimeMinutes: number;
  isAvailable: boolean;
  /** Stok tersedia DAN berada dalam jam tayang. */
  isOrderable: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
  modifierGroups: PublicModifierGroup[];
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  items: PublicMenuItem[];
}

export interface PublicMenuCatalog {
  timezone: string;
  generatedAt: string;
  categories: PublicCategory[];
}
