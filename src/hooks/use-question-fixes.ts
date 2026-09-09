"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./use-local-storage";

const MAX_ENTRIES = 500;

export type QuestionFix = {
  /** repaired question text, replacing both question_text and question_latex for display */
  text: string;
  /** epoch ms, so a later "clear old fixes" action has something to sort on */
  at: number;
};

type FixCache = {
  ids: number[];
  byId: Record<number, QuestionFix>;
};

const initial: FixCache = { ids: [], byId: {} };

/**
 * AI-repaired question text, kept per browser like bookmarks and solutions.
 * The Turso table is read-only at runtime, so a fix can never be written back
 * to the source row; it is an overlay applied at display time.
 */
export function useQuestionFixes() {
  const [cache, set, hydrated] = useLocalStorage<FixCache>("rbse_question_fixes", initial);

  const get = useCallback((id: number): QuestionFix | undefined => cache.byId[id], [cache]);

  const save = useCallback(
    (id: number, text: string) => {
      if (!text.trim()) return;
      set((c) => {
        const byId = { ...c.byId, [id]: { text, at: Date.now() } };
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
