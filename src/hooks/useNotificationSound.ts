"use client";

import { useCallback, useEffect, useState } from "react";

import {
  playNotificationTone,
  unlockAudioContext,
  type NotificationToneKind,
} from "@/lib/audio/notification";

const STORAGE_KEY = "fnb-pos-sound-enabled";

/**
 * Preferensi suara notifikasi POS (persisted di localStorage).
 * Audio baru bisa berbunyi setelah pengguna berinteraksi (klik toggle).
 */
export function useNotificationSound() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      setIsEnabled(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // localStorage diblokir: biarkan default mati.
    }
  }, []);

  const enable = useCallback(async () => {
    const ready = await unlockAudioContext();
    setIsEnabled(true);
    setIsReady(ready);

    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // abaikan
    }

    return ready;
  }, []);

  const disable = useCallback(() => {
    setIsEnabled(false);
    setIsReady(false);

    try {
      window.localStorage.setItem(STORAGE_KEY, "false");
    } catch {
      // abaikan
    }
  }, []);

  const play = useCallback(
    (kind: NotificationToneKind) => {
      if (!isEnabled) {
        return false;
      }

      return playNotificationTone(kind);
    },
    [isEnabled],
  );

  return { isEnabled, isReady, enable, disable, play };
}
