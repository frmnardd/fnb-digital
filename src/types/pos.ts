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
