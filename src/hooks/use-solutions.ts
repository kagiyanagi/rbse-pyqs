"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./use-local-storage";

const MAX_ENTRIES = 200;

type SolutionCache = {
  ids: number[];
  byId: Record<number, string>;
};

const initial: SolutionCache = { ids: [], byId: {} };

export function useSolutionCache() {
  const [cache, set, hydrated] = useLocalStorage<SolutionCache>("rbse_solutions", initial);

  const get = useCallback(
    (id: number): string | undefined => cache.byId[id],
    [cache],
  );

  const save = useCallback(
    (id: number, text: string) => {
      if (!text) return;
      set((c) => {
        const byId = { ...c.byId, [id]: text };
        const ids = c.ids.filter((x) => x !== id);
        ids.push(id);
        while (ids.length > MAX_ENTRIES) {
          const evicted = ids.shift();
          if (evicted != null) delete byId[evicted];
        }
        return { ids, byId };
      });
    },
    [set],
  );

  const remove = useCallback(
    (id: number) => {
      set((c) => {
        if (!(id in c.byId)) return c;
        const byId = { ...c.byId };
        delete byId[id];
        return { ids: c.ids.filter((x) => x !== id), byId };
      });
    },
    [set],
  );

  const clear = useCallback(() => set(initial), [set]);

  return { get, save, remove, clear, ids: cache.ids, count: cache.ids.length, hydrated };
}
