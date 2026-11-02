/**
 * Kalkulasi harga server-side (Single Source of Truth).
 *
 * ATURAN EMAS (CONTEXT.md §6.3): nominal harga dari browser TIDAK PERNAH dipercaya.
 * Semua endpoint wajib memanggil modul ini dengan data menu/modifier dari database.
 *
 * Modul ini murni (pure): tanpa I/O, tanpa akses database, sehingga mudah diuji
 * dan aman dipakai baik di server (route handler/action) maupun di client untuk
 * pratinjau tampilan.
 *
 * Urutan kalkulasi (wajib konsisten):
 *   subtotal      = Σ (unitPrice × quantity)
 *   diskon        = PERCENT (dibatasi maxAmount) atau FIXED (dibatasi subtotal)
 *   serviceCharge = 5%  × (subtotal − diskon)
 *   taxAmount     = 10% × (subtotal − diskon + serviceCharge)   [PB1]
 *   grandTotal    = (subtotal − diskon + serviceCharge + taxAmount) + uniqueCode
 *
 * Seluruh nilai adalah Rupiah BULAT (tanpa sen) dan dibulatkan dengan `Math.round`.
 */

export type DiscountType = "PERCENT" | "FIXED";

export interface PricingModifierInput {
  id: string;
  name: string;
  /** Tambahan harga (boleh negatif untuk opsi potongan). Rupiah bulat. */
  priceDelta: number;
}

export interface PricingItemInput {
  menuItemId: string;
  menuName?: string;
  /** Harga dasar dari database (bukan dari browser). Rupiah bulat. */
  basePrice: number;
  quantity: number;
  modifiers?: PricingModifierInput[];
  notes?: string;
}

export interface PricingDiscountInput {
  type: DiscountType;
  /** PERCENT: 0–100 (boleh pecahan). FIXED: Rupiah bulat. */
  value: number;
  /** Batas maksimum potongan untuk tipe PERCENT. */
  maxAmount?: number;
}

export interface PricingLineResult {
  menuItemId: string;
  menuName?: string;
  quantity: number;
  /** basePrice + Σ priceDelta */
  unitPrice: number;
  /** Σ priceDelta untuk satu unit. */
  modifierTotal: number;
  /** unitPrice × quantity */
  lineTotal: number;
}

export interface PricingTotals {
  subtotal: number;
  discountAmount: number;
  serviceCharge: number;
  taxAmount: number;
  uniqueCode: number;
  grandTotal: number;
}

export interface CalculateOrderTotalsInput {
  items: PricingItemInput[];
  discount?: PricingDiscountInput;
  /** true hanya untuk metode transfer manual (kode unik 3 digit). */
  applyUniqueCode?: boolean;
  /** Default 5%. */
  servicePercent?: number;
  /** Default 10% (PB1). */
  taxPercent?: number;
  /** Injector untuk test deterministik; default `generateUniqueCode`. */
  uniqueCodeGenerator?: () => number;
}

export const DEFAULT_SERVICE_PERCENT = 5;
export const DEFAULT_TAX_PERCENT = 10;

/** Error domain untuk input harga yang tidak sah. */
export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

// -----------------------------------------------------------------------------
// Validasi internal
// -----------------------------------------------------------------------------

function assertRupiah(value: number, label: string, options: { allowNegative?: boolean } = {}): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new PricingError(`${label} harus berupa bilangan bulat Rupiah (diterima: ${value}).`);
  }
  if (!options.allowNegative && value < 0) {
    throw new PricingError(`${label} tidak boleh negatif (diterima: ${value}).`);
  }
}

function assertPercent(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new PricingError(`${label} harus di antara 0 dan 100 (diterima: ${value}).`);
  }
}

/** Pembulatan ke Rupiah bulat. Diekspor agar pemakaian seragam. */
export function roundRupiah(value: number): number {
  return Math.round(value);
}

// -----------------------------------------------------------------------------
// Kalkulasi per baris
// -----------------------------------------------------------------------------

/** Menghitung harga satu baris item termasuk seluruh modifier-nya. */
export function calculateLineTotal(item: PricingItemInput): PricingLineResult {
  assertRupiah(item.basePrice, `basePrice (${item.menuItemId})`);

  if (!Number.isInteger(item.quantity) || item.quantity < 1) {
    throw new PricingError(
      `Kuantitas untuk ${item.menuItemId} harus bilangan bulat >= 1 (diterima: ${item.quantity}).`,
    );
  }

  const modifiers = item.modifiers ?? [];
  const modifierTotal = modifiers.reduce((total, modifier) => {
    assertRupiah(modifier.priceDelta, `priceDelta modifier "${modifier.name}"`, {
      allowNegative: true,
    });
    return total + modifier.priceDelta;
  }, 0);

  const unitPrice = item.basePrice + modifierTotal;

  if (unitPrice < 0) {
    throw new PricingError(
      `Harga unit ${item.menuItemId} menjadi negatif (${unitPrice}) setelah modifier.`,
    );
  }

  return {
    menuItemId: item.menuItemId,
    menuName: item.menuName,
    quantity: item.quantity,
    unitPrice,
    modifierTotal,
    lineTotal: unitPrice * item.quantity,
  };
}

/** Menghitung subtotal seluruh baris sebelum diskon. */
export function calculateSubtotal(items: PricingItemInput[]): number {
  if (items.length === 0) {
    throw new PricingError("Pesanan harus memiliki minimal satu item.");
  }
  return items.reduce((total, item) => total + calculateLineTotal(item).lineTotal, 0);
}

// -----------------------------------------------------------------------------
// Diskon
// -----------------------------------------------------------------------------

/** Menghitung nominal potongan; hasil selalu 0 ≤ diskon ≤ subtotal. */
export function calculateDiscount(subtotal: number, discount?: PricingDiscountInput): number {
  assertRupiah(subtotal, "Subtotal");

  if (!discount) {
    return 0;
  }

  if (discount.type === "PERCENT") {
    assertPercent(discount.value, "Persentase diskon");

    let raw = (subtotal * discount.value) / 100;

    if (discount.maxAmount !== undefined) {
      assertRupiah(discount.maxAmount, "maxAmount diskon");
      raw = Math.min(raw, discount.maxAmount);
    }

    return Math.min(roundRupiah(raw), subtotal);
  }

  // FIXED
  assertRupiah(discount.value, "Nominal diskon tetap");
  return Math.min(discount.value, subtotal);
}

// -----------------------------------------------------------------------------
// Service charge, PB1, kode unik
// -----------------------------------------------------------------------------

/** Service charge (default 5%) dari subtotal setelah diskon. */
export function calculateServiceCharge(
  netSubtotal: number,
  servicePercent: number = DEFAULT_SERVICE_PERCENT,
): number {
  assertRupiah(netSubtotal, "Net subtotal");
  assertPercent(servicePercent, "Persentase service charge");
  return roundRupiah((netSubtotal * servicePercent) / 100);
}

/** Pajak PB1 (default 10%) dari (net subtotal + service charge). */
export function calculateTax(
  taxableBase: number,
  taxPercent: number = DEFAULT_TAX_PERCENT,
): number {
  assertRupiah(taxableBase, "Dasar pengenaan pajak");
  assertPercent(taxPercent, "Persentase PB1");
  return roundRupiah((taxableBase * taxPercent) / 100);
}

/**
 * Kode unik 3 digit (100–999) untuk Transfer Manual, supaya nominal transfer
 * tidak tertukar dengan pesanan lain. Memakai Web Crypto (tersedia di Node & browser).
 */
export function generateUniqueCode(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return 100 + (buffer[0] % 900);
}

// -----------------------------------------------------------------------------
// Total pesanan
// -----------------------------------------------------------------------------

/** Menghitung seluruh rincian biaya satu pesanan secara konsisten. */
export function calculateOrderTotals(input: CalculateOrderTotalsInput): PricingTotals {
  const servicePercent = input.servicePercent ?? DEFAULT_SERVICE_PERCENT;
  const taxPercent = input.taxPercent ?? DEFAULT_TAX_PERCENT;

  const subtotal = calculateSubtotal(input.items);
  const discountAmount = calculateDiscount(subtotal, input.discount);
  const netSubtotal = subtotal - discountAmount;

  const serviceCharge = calculateServiceCharge(netSubtotal, servicePercent);
  const taxableBase = netSubtotal + serviceCharge;
  const taxAmount = calculateTax(taxableBase, taxPercent);

  const uniqueCode =
    input.applyUniqueCode === true ? (input.uniqueCodeGenerator ?? generateUniqueCode)() : 0;

  if (uniqueCode !== 0 && (!Number.isInteger(uniqueCode) || uniqueCode < 100 || uniqueCode > 999)) {
    throw new PricingError(`Kode unik harus 3 digit (100–999), diterima: ${uniqueCode}.`);
  }

  return {
    subtotal,
    discountAmount,
    serviceCharge,
    taxAmount,
    uniqueCode,
    grandTotal: taxableBase + taxAmount + uniqueCode,
  };
}

// -----------------------------------------------------------------------------
// Format tampilan
// -----------------------------------------------------------------------------

/** Format Rupiah untuk UI, mis. `Rp 38.000` (tanpa desimal). */
export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new PricingError(`Nominal tidak valid untuk diformat: ${amount}.`);
  }

  // Ganti NBSP hasil Intl agar konsisten di test & copy-paste.
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(Math.round(amount))
    .replace(/\u00A0/g, " ");
}
