/**
 * Tipe data antrean POS kasir.
 */

export type PosOrderStatus =
  | "PENDING_PAYMENT"
  | "WAITING_CASHIER_APPROVAL"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export interface PosQueueOrder {
  id: string;
  orderNumber: string;
  status: PosOrderStatus;
  orderType: "DINE_IN" | "TAKEAWAY";
  /** Label meja + area, mis. "07 · Indoor"; null untuk takeaway. */
  tableLabel: string | null;
  total: number;
  itemCount: number;
  /** ISO string waktu pesanan dibuat. */
  createdAt: string;
}

export interface PosBillModifier {
  name: string;
  priceDelta: number;
}

export interface PosBillItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers: PosBillModifier[];
  note: string | null;
  status: string;
  station: string;
}

export interface PosBillPayment {
  id: string;
  method: string;
  status: string;
  amountPaid: number;
  changeAmount: number;
  proofImageUrl: string | null;
  paidAt: string | null;
}

export interface PosBillTotals {
  subtotal: number;
  discountAmount: number;
  serviceCharge: number;
  taxAmount: number;
  uniqueCode: number;
  grandTotal: number;
}

export interface PosBillDetail {
  orderNumber: string;
  status: PosOrderStatus;
  orderType: "DINE_IN" | "TAKEAWAY";
  tableLabel: string | null;
  createdAt: string;
  customerName: string | null;
  totals: PosBillTotals;
  items: PosBillItem[];
  payment: PosBillPayment | null;
}

export type PosTableStatus = "AVAILABLE" | "OCCUPIED" | "NEEDS_CLEANING";

export interface PosFloorSession {
  id: string;
  guestCount: number;
  /** ISO string waktu sesi dibuka. */
  openedAt: string;
}

export interface PosFloorTable {
  id: string;
  tableNumber: string;
  capacity: number;
  status: PosTableStatus;
  positionX: number | null;
  positionY: number | null;
  session: PosFloorSession | null;
  /** Total tagihan berjalan pada sesi aktif (0 bila tidak ada sesi). */
  runningBill: number;
}

export interface PosFloorArea {
  id: string;
  name: string;
  floor: number;
  tables: PosFloorTable[];
}

