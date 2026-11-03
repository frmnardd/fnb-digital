/**
 * Pemetaan status pesanan ke tahapan pelacakan pelanggan.
 *
 * Tahapan: Diterima → Dimasak → Siap Diantar → Selesai.
 * Fungsi murni & teruji; dipakai server (API track) dan client (stepper).
 */

export type TrackerStepKey = "RECEIVED" | "COOKING" | "READY" | "SERVED";

export type OrderStatusKey =
  | "PENDING_PAYMENT"
  | "WAITING_CASHIER_APPROVAL"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export type ItemStatusKey = "QUEUED" | "COOKING" | "READY" | "SERVED" | "VOIDED";

export type StepState = "done" | "current" | "todo";

export const TRACKER_STEPS: ReadonlyArray<{
  key: TrackerStepKey;
  label: string;
  description: string;
}> = [
  { key: "RECEIVED", label: "Diterima", description: "Pesanan masuk ke sistem" },
  { key: "COOKING", label: "Dimasak", description: "Sedang disiapkan dapur/bar" },
  { key: "READY", label: "Siap Diantar", description: "Siap diantar ke meja" },
  { key: "SERVED", label: "Selesai", description: "Pesanan sudah diantar" },
];

export interface TrackerStep {
  key: TrackerStepKey;
  label: string;
  description: string;
  state: StepState;
}

export interface TrackerState {
  currentStep: TrackerStepKey | null;
  steps: TrackerStep[];
  isCancelled: boolean;
  isWaitingPayment: boolean;
  progressPercent: number;
}

/** Tahapan berdasarkan status order (tanpa mempertimbangkan status item). */
export function mapOrderStatusToStep(status: OrderStatusKey): TrackerStepKey | null {
  switch (status) {
    case "PENDING_PAYMENT":
    case "WAITING_CASHIER_APPROVAL":
    case "CONFIRMED":
      return "RECEIVED";
    case "PREPARING":
      return "COOKING";
    case "READY":
      return "READY";
    case "SERVED":
    case "COMPLETED":
      return "SERVED";
    case "CANCELLED":
      return null;
    default:
      return "RECEIVED";
  }
}

function deriveStepFromItems(itemStatuses: readonly ItemStatusKey[]): TrackerStepKey {
  const active = itemStatuses.filter((status) => status !== "VOIDED");

  if (active.length === 0) {
    return "RECEIVED";
  }

  if (active.every((status) => status === "SERVED")) {
    return "SERVED";
  }

  if (active.every((status) => status === "READY" || status === "SERVED")) {
    return "READY";
  }

  if (active.some((status) => status === "COOKING" || status === "READY" || status === "SERVED")) {
    return "COOKING";
  }

  return "RECEIVED";
}

function stepIndex(step: TrackerStepKey): number {
  const index = TRACKER_STEPS.findIndex((candidate) => candidate.key === step);
  return index === -1 ? 0 : index;
}

/**
 * Menggabungkan status order + status item menjadi satu state stepper.
 * Status order yang lebih maju selalu menang; status item hanya mendorong maju.
 */
export function getTrackerState({
  status,
  itemStatuses,
}: {
  status: OrderStatusKey;
  itemStatuses: readonly ItemStatusKey[];
}): TrackerState {
  if (status === "CANCELLED") {
    return {
      currentStep: null,
      steps: TRACKER_STEPS.map((step) => ({ ...step, state: "todo" })),
      isCancelled: true,
      isWaitingPayment: false,
      progressPercent: 0,
    };
  }

  const isWaitingPayment =
    status === "PENDING_PAYMENT" || status === "WAITING_CASHIER_APPROVAL";

  const orderStep = mapOrderStatusToStep(status) ?? "RECEIVED";
  const itemStep = deriveStepFromItems(itemStatuses);
  const currentStep = stepIndex(itemStep) > stepIndex(orderStep) ? itemStep : orderStep;

  const isCompleted = status === "COMPLETED";
  const currentIndex = isCompleted ? TRACKER_STEPS.length - 1 : stepIndex(currentStep);

  const steps: TrackerStep[] = TRACKER_STEPS.map((step, index) => ({
    ...step,
    state:
      isCompleted || index < currentIndex
        ? "done"
        : index === currentIndex
          ? "current"
          : "todo",
  }));

  const progressPercent = Math.round((currentIndex / (TRACKER_STEPS.length - 1)) * 100);

  return {
    currentStep,
    steps,
    isCancelled: false,
    isWaitingPayment,
    progressPercent,
  };
}

// -----------------------------------------------------------------------------
// Payload API / halaman pelacakan
// -----------------------------------------------------------------------------

export interface OrderTrackItem {
  name: string;
  quantity: number;
  status: ItemStatusKey;
  station: string;
}

export interface OrderTrackPayload {
  orderNumber: string;
  status: OrderStatusKey;
  orderType: "DINE_IN" | "TAKEAWAY";
  grandTotal: number;
  paymentStatus: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  items: OrderTrackItem[];
  tracker: TrackerState;
}

/** Menyusun payload pelacakan (dipakai route API & server component). */
export function buildOrderTrackPayload(input: {
  orderNumber: string;
  status: OrderStatusKey;
  orderType: "DINE_IN" | "TAKEAWAY";
  grandTotal: number;
  paymentStatus: string | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  items: OrderTrackItem[];
}): OrderTrackPayload {
  return {
    orderNumber: input.orderNumber,
    status: input.status,
    orderType: input.orderType,
    grandTotal: input.grandTotal,
    paymentStatus: input.paymentStatus,
    confirmedAt: input.confirmedAt?.toISOString() ?? null,
    completedAt: input.completedAt?.toISOString() ?? null,
    items: input.items,
    tracker: getTrackerState({
      status: input.status,
      itemStatuses: input.items.map((item) => item.status),
    }),
  };
}
