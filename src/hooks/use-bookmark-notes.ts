"use client";

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./use-local-storage";

type Notes = Record<number, string>;

export function useBookmarkNotes() {
  const [notes, set, hydrated] = useLocalStorage<Notes>("rbse_bookmark_notes", {});

  const get = useCallback((id: number): string => notes[id] ?? "", [notes]);

  const save = useCallback(
    (id: number, text: string) => {
      const trimmed = text.trim();
      set((n) => {
        const next = { ...n };
        if (trimmed) next[id] = trimmed;
        else delete next[id];
        return next;
      });
    },
    [set],
  );

  const remove = useCallback(
    (id: number) => {
      set((n) => {
        if (!(id in n)) return n;
        const next = { ...n };
        delete next[id];
        return next;
      });
    },
    [set],
  );

  const clearAll = useCallback(() => set({}), [set]);

  const ids = useMemo(
    () => Object.keys(notes).map(Number).filter((n) => Number.isFinite(n)),
    [notes],
  );

  return { get, save, remove, clearAll, ids, hydrated };
}
