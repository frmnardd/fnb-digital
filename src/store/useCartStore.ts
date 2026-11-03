import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  findQuantityByItem,
  mergeCartLines,
  summarizeCart,
  updateLineQuantity,
  type CartLine,
} from "@/lib/cart";

/**
 * Zustand store keranjang pelanggan (dipersistensikan ke localStorage).
 *
 * Catatan hydration: `skipHydration: true` + `useCartHydrated()` dipakai agar
 * render server & render pertama client identik (mencegah hydration mismatch),
 * baru setelah itu isi keranjang dimuat dari localStorage.
 */

export type OrderType = "DINE_IN" | "TAKEAWAY";

export interface CartContext {
  tableSlug: string;
  sessionId: string | null;
}

export interface CartState {
  tableSlug: string | null;
  sessionId: string | null;
  orderType: OrderType;
  lines: CartLine[];

  /** Menyimpan konteks meja; bila meja berbeda, keranjang dikosongkan. */
  setContext: (context: CartContext) => void;
  setOrderType: (orderType: OrderType) => void;
  addLine: (line: CartLine) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeLine: (id: string) => void;
  clear: () => void;
  /** Dipakai sinkronisasi group order (mengganti isi dari sumber lain). */
  applyRemoteLines: (lines: CartLine[]) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      tableSlug: null,
      sessionId: null,
      orderType: "DINE_IN",
      lines: [],

      setContext: ({ tableSlug, sessionId }) =>
        set((state) => {
          if (state.tableSlug !== tableSlug) {
            return { tableSlug, sessionId, lines: [] };
          }

          return state.sessionId === sessionId ? state : { sessionId };
        }),

      setOrderType: (orderType) => set({ orderType }),

      addLine: (line) => set((state) => ({ lines: mergeCartLines(state.lines, line) })),

      setQuantity: (id, quantity) =>
        set((state) => ({ lines: updateLineQuantity(state.lines, id, quantity) })),

      removeLine: (id) =>
        set((state) => ({ lines: state.lines.filter((line) => line.id !== id) })),

      clear: () => set({ lines: [] }),

      applyRemoteLines: (lines) => set({ lines }),
    }),
    {
      name: "fnb-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        tableSlug: state.tableSlug,
        sessionId: state.sessionId,
        orderType: state.orderType,
        lines: state.lines,
      }),
    },
  ),
);

// -----------------------------------------------------------------------------
// Selector (fungsi biasa agar bisa dipakai di dalam `.map()` tanpa hook)
// -----------------------------------------------------------------------------

export function selectTotalQuantity(state: CartState): number {
  return summarizeCart(state.lines).totalQuantity;
}

export function selectSubtotal(state: CartState): number {
  return summarizeCart(state.lines).subtotal;
}

export function selectQuantityByItem(state: CartState, menuItemId: string): number {
  return findQuantityByItem(state.lines, menuItemId);
}
