import type { CartLine } from "@/lib/cart";

/**
 * Kanal sinkronisasi keranjang antar tab/perangkat pada origin yang sama.
 *
 * Implementasi saat ini memakai `BroadcastChannel` (tanpa dependency baru).
 * Sinkronisasi lintas perangkat sungguhan memerlukan Supabase Realtime /
 * WebSocket — antarmuka `CartSyncChannel` disiapkan agar implementasi tersebut
 * bisa ditambahkan tanpa mengubah komponen.
 */

export interface CartSyncChannel {
  publish: (lines: CartLine[]) => void;
  subscribe: (handler: (lines: CartLine[]) => void) => () => void;
  close: () => void;
}

const CHANNEL_PREFIX = "fnb-cart:";

interface CartSyncMessage {
  type: "cart:update";
  lines: CartLine[];
}

export function isCartSyncSupported(): boolean {
  return typeof window !== "undefined" && typeof window.BroadcastChannel === "function";
}

/**
 * Membuat kanal sinkronisasi untuk satu meja.
 * Mengembalikan `null` bila browser tidak mendukung atau sedang di server.
 */
export function createBroadcastCartSync(tableSlug: string): CartSyncChannel | null {
  if (!isCartSyncSupported()) {
    return null;
  }

  const channel = new BroadcastChannel(`${CHANNEL_PREFIX}${tableSlug}`);
  let isClosed = false;

  return {
    publish(lines) {
      if (isClosed) {
        return;
      }

      const message: CartSyncMessage = { type: "cart:update", lines };
      channel.postMessage(message);
    },

    subscribe(handler) {
      const listener = (event: MessageEvent<unknown>) => {
        const data = event.data as Partial<CartSyncMessage> | null;

        if (data?.type === "cart:update" && Array.isArray(data.lines)) {
          handler(data.lines);
        }
      };

      channel.addEventListener("message", listener);

      return () => channel.removeEventListener("message", listener);
    },

    close() {
      isClosed = true;
      channel.close();
    },
  };
}
