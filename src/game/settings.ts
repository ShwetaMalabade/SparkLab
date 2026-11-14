// src/game/settings.ts: player settings that last on this laptop (sound on/off, reduced motion). Never throws.
import { create } from "zustand";

type Settings = { sound: boolean; reducedMotion: boolean };
const KEY = "ha:settings";

function load(): Settings {
  const fallback: Settings = { sound: true, reducedMotion: false };
  if (typeof window === "undefined") return fallback;
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<Settings> | null;
    const osReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    return { sound: saved?.sound ?? true, reducedMotion: saved?.reducedMotion ?? osReduced };
  } catch {
    return fallback;
  }
}

// Starts at the defaults (same on server and client → no hydration mismatch); loadSettings() reads the saved ones.
export const useSettings = create<Settings & { set: (p: Partial<Settings>) => void }>((setState, get) => ({
  sound: true,
  reducedMotion: false,
  set: (p) => {
    setState(p);
    try {
      const { sound, reducedMotion } = get();
      window.localStorage.setItem(KEY, JSON.stringify({ sound, reducedMotion }));
    } catch {
      /* blocked storage: the setting still applies this session */
    }
  },
}));

/** Call once on mount (client only). */
export const loadSettings = () => useSettings.setState(load());
