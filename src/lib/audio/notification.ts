/**
 * Nada notifikasi POS tanpa file audio (Web Audio API).
 *
 * Membuat dua nada pendek memakai oscillator + envelope gain sehingga tidak
 * perlu aset .mp3. Browser mewajibkan interaksi pengguna sebelum AudioContext
 * berjalan → panggil `unlockAudioContext()` pada klik pertama.
 */

export type NotificationToneKind = "new-order" | "waiter-call";

interface ToneStep {
  frequency: number;
  duration: number;
  offset: number;
}

const TONES: Record<NotificationToneKind, ToneStep[]> = {
  "new-order": [
    { frequency: 880, duration: 0.16, offset: 0 },
    { frequency: 1320, duration: 0.24, offset: 0.18 },
  ],
  "waiter-call": [
    { frequency: 660, duration: 0.24, offset: 0 },
    { frequency: 660, duration: 0.24, offset: 0.3 },
  ],
};

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (sharedContext) {
    return sharedContext;
  }

  const legacyWindow = window as unknown as { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = window.AudioContext ?? legacyWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  sharedContext = new AudioContextConstructor();
  return sharedContext;
}

/** Membuka AudioContext setelah interaksi pengguna. `true` bila siap berbunyi. */
export async function unlockAudioContext(): Promise<boolean> {
  const context = getAudioContext();

  if (!context) {
    return false;
  }

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return false;
    }
  }

  return context.state === "running";
}

/**
 * Memutar nada notifikasi.
 * Mengembalikan `false` bila audio belum diizinkan/belum siap (tidak melempar).
 */
export function playNotificationTone(
  kind: NotificationToneKind,
  options: { volume?: number } = {},
): boolean {
  const context = getAudioContext();

  if (!context || context.state !== "running") {
    return false;
  }

  const volume = Math.min(1, Math.max(0, options.volume ?? 0.16));

  try {
    for (const tone of TONES[kind]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime + tone.offset;

      oscillator.type = "sine";
      oscillator.frequency.value = tone.frequency;

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(startAt);
      oscillator.stop(startAt + tone.duration + 0.02);
    }

    return true;
  } catch {
    return false;
  }
}

/** Hanya untuk test: melepas konteks audio. */
export function resetNotificationAudio(): void {
  sharedContext?.close().catch(() => undefined);
  sharedContext = null;
}
