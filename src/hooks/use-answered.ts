"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./use-local-storage";

export function useAnswered() {
  const [ids, set, hydrated] = useLocalStorage<number[]>("rbse_answered", []);
  const setRef = new Set(ids);

  const toggle = useCallback(
    (id: number) => {
      set((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
    },
    [set],
  );

  const isAnswered = useCallback((id: number) => setRef.has(id), [setRef]);

  const clear = useCallback(() => set([]), [set]);

  return { ids, toggle, isAnswered, clear, hydrated };
}
