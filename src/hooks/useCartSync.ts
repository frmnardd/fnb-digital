"use client";

import { useEffect, useRef } from "react";

import { createBroadcastCartSync, type CartSyncChannel } from "@/lib/cart-sync";
import { useCartHydrated } from "@/hooks/useCartHydrated";
import { useCartStore } from "@/store/useCartStore";

const PUBLISH_DEBOUNCE_MS = 150;

/**
 * Sinkronisasi keranjang satu meja antar tab/perangkat pada origin yang sama.
 *
 * Alur: setiap perubahan `lines` dipublikasikan (debounce 150 ms) ke
 * `BroadcastChannel`; perubahan dari kanal lain diterapkan lewat
 * `applyRemoteLines` tanpa memantulkan balik (mencegah loop).
 */
export function useCartSync(tableSlug: string | null): void {
  const lines = useCartStore((state) => state.lines);
  const applyRemoteLines = useCartStore((state) => state.applyRemoteLines);
  const hydrated = useCartHydrated();

  const channelRef = useRef<CartSyncChannel | null>(null);
  const skipNextPublishRef = useRef(false);

  useEffect(() => {
    if (!tableSlug || !hydrated) {
      return;
    }

    const channel = createBroadcastCartSync(tableSlug);

    if (!channel) {
      return;
    }

    channelRef.current = channel;

    const unsubscribe = channel.subscribe((remoteLines) => {
      skipNextPublishRef.current = true;
      applyRemoteLines(remoteLines);
    });

    return () => {
      unsubscribe();
      channel.close();
      channelRef.current = null;
    };
  }, [tableSlug, hydrated, applyRemoteLines]);

  useEffect(() => {
    if (!hydrated || !channelRef.current) {
      return;
    }

    if (skipNextPublishRef.current) {
      skipNextPublishRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      channelRef.current?.publish(lines);
    }, PUBLISH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [lines, hydrated]);
}
