"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
export type Palette = "standard" | "cvd";

const read = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function usePreference<T extends string>(key: string, fallback: T, attribute: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback) as T,
    () => fallback,
  );
  const set = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // storage blocked; the attribute still applies for this session
      }
      document.documentElement.setAttribute(attribute, next);
      for (const fn of listeners) fn();
    },
    [key, attribute],
  );
  return [value, set] as const;
}

export const useTheme = () => usePreference<Theme>("covenant:theme", "dark", "data-theme");
export const usePalette = () => usePreference<Palette>("covenant:palette", "standard", "data-palette");

/** Runs before first paint so the stored theme never flashes. */
export const preferenceScript = `try{var d=document.documentElement;d.setAttribute("data-theme",localStorage.getItem("covenant:theme")||"dark");d.setAttribute("data-palette",localStorage.getItem("covenant:palette")||"standard")}catch(e){}`;
