"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./use-local-storage";

export type LanguageMode = "english" | "hindi" | "both";
export const LANGUAGE_CYCLE: LanguageMode[] = ["english", "hindi", "both"];

export function useDefaultLanguage() {
  return useLocalStorage<LanguageMode>("defaultLanguage", "english");
}

export function useLanguageOverrides() {
  const [overrides, set, hydrated] = useLocalStorage<Record<string, LanguageMode>>(
    "rbse_language_overrides",
    {},
  );

  const cycle = useCallback(
    (id: number, fallback: LanguageMode) => {
      set((m) => {
        const cur = m[String(id)] ?? fallback;
        const idx = LANGUAGE_CYCLE.indexOf(cur);
        const next = LANGUAGE_CYCLE[(idx + 1) % LANGUAGE_CYCLE.length];
        return { ...m, [String(id)]: next };
      });
    },
    [set],
  );

  const get = useCallback(
    (id: number, fallback: LanguageMode): LanguageMode => overrides[String(id)] ?? fallback,
    [overrides],
  );

  return { overrides, get, cycle, hydrated };
}
