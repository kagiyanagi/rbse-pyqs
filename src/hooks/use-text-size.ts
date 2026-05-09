"use client";

import { useEffect } from "react";
import { useLocalStorage } from "./use-local-storage";

export type TextSize = { question: number; ui: number };
const DEFAULT: TextSize = { question: 100, ui: 100 };

export function useTextSize() {
  const [size, set, hydrated] = useLocalStorage<TextSize>("rbse_text_size", DEFAULT);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty("--question-scale", `${size.question / 100}`);
    document.documentElement.style.setProperty("--ui-scale", `${size.ui / 100}`);
  }, [size.question, size.ui, hydrated]);

  return { size, set, hydrated };
}
