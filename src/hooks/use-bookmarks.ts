"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./use-local-storage";

export type BookmarksState = {
  categories: string[];
  byCategory: Record<string, number[]>;
};

const DEFAULT_CATEGORIES = ["Important", "Hard", "Wrong", "Revise"];

const initial: BookmarksState = {
  categories: [...DEFAULT_CATEGORIES],
  byCategory: Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c, []])),
};

export function useBookmarks() {
  const [state, set, hydrated] = useLocalStorage<BookmarksState>("rbse_bookmarks", initial);

  const toggle = useCallback(
    (category: string, id: number) => {
      set((s) => {
        const list = new Set(s.byCategory[category] ?? []);
        if (list.has(id)) list.delete(id);
        else list.add(id);
        return {
          ...s,
          byCategory: { ...s.byCategory, [category]: Array.from(list) },
        };
      });
    },
    [set],
  );

  const addCategory = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      set((s) => {
        if (s.categories.includes(trimmed)) return s;
        return {
          categories: [...s.categories, trimmed],
          byCategory: { ...s.byCategory, [trimmed]: [] },
        };
      });
    },
    [set],
  );

  const removeCategory = useCallback(
    (name: string) => {
      set((s) => {
        const next = { ...s.byCategory };
        delete next[name];
        return {
          categories: s.categories.filter((c) => c !== name),
          byCategory: next,
        };
      });
    },
    [set],
  );

  const clearCategory = useCallback(
    (name: string) => {
      set((s) => ({
        ...s,
        byCategory: { ...s.byCategory, [name]: [] },
      }));
    },
    [set],
  );

  const isBookmarked = useCallback(
    (id: number, category?: string) => {
      if (category) return (state.byCategory[category] ?? []).includes(id);
      return Object.values(state.byCategory).some((arr) => arr.includes(id));
    },
    [state],
  );

  const categoriesFor = useCallback(
    (id: number) => state.categories.filter((c) => (state.byCategory[c] ?? []).includes(id)),
    [state],
  );

  return {
    state,
    toggle,
    addCategory,
    removeCategory,
    clearCategory,
    isBookmarked,
    categoriesFor,
    hydrated,
  };
}
