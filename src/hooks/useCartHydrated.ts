"use client";

import { useEffect, useState } from "react";

import { useCartStore } from "@/store/useCartStore";

/**
 * Menandai apakah store keranjang sudah selesai rehidrasi dari localStorage.
 *
 * `persist` dikonfigurasi `skipHydration: true`, sehingga rehidrasi dilakukan
 * manual di sini: render server & render pertama client sama-sama kosong,
 * lalu isi keranjang dimuat setelah mount.
 *
 * PENTING: saat SSR (atau browser yang memblokir localStorage) middleware
 * `persist` tidak memasang `store.persist` sama sekali, sehingga seluruh akses
 * harus melalui optional chaining — tanpa ini render server akan melempar
 * `Cannot read properties of undefined (reading 'hasHydrated')`.
 */
export function useCartHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistApi = useCartStore.persist;

    if (!persistApi) {
      // Tanpa storage: keranjang tetap berfungsi di memori, tanpa persistensi.
      setHydrated(true);
      return;
    }

    if (persistApi.hasHydrated()) {
      setHydrated(true);
      return;
    }

    const unsubscribe = persistApi.onFinishHydration(() => setHydrated(true));
    void persistApi.rehydrate();

    return unsubscribe;
  }, []);

  return hydrated;
}
