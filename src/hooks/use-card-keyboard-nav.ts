"use client";

import { useEffect, useRef, useState } from "react";

const ACTIONS = ["bookmark", "solution", "answered", "language"] as const;
type Action = (typeof ACTIONS)[number];

function shouldIgnore(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return false;
}

function fireCardAction(qid: number, action: Action): boolean {
  const card = document.querySelector<HTMLElement>(`[data-question-id="${qid}"]`);
  if (!card) return false;
  const btn = card.querySelector<HTMLElement>(`[data-action="${action}"]`);
  if (!btn) return false;
  btn.click();
  return true;
}

export function useCardKeyboardNav(questionIds: readonly number[], enabled = true) {
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const idsRef = useRef(questionIds);
  idsRef.current = questionIds;

  // Keep focus pointing at a real card.
  useEffect(() => {
    if (focusedIdx >= questionIds.length) setFocusedIdx(-1);
  }, [questionIds.length, focusedIdx]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (shouldIgnore(e.target)) return;
      // Skip while a Radix Dialog / AlertDialog / Popover is open.
      const overlayOpen = document.querySelector<HTMLElement>(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      );
      if (overlayOpen) return;

      const ids = idsRef.current;
      if (ids.length === 0) return;

      const key = e.key.toLowerCase();

      if (key === "j") {
        e.preventDefault();
        setFocusedIdx((i) => (i < 0 ? 0 : Math.min(ids.length - 1, i + 1)));
        return;
      }
      if (key === "k") {
        e.preventDefault();
        setFocusedIdx((i) => (i < 0 ? 0 : Math.max(0, i - 1)));
        return;
      }
      if (key === "g") {
        // gg → top — but we accept bare g for "go to top" since most users hit it once.
        e.preventDefault();
        setFocusedIdx(0);
        return;
      }
      if (key === "escape") {
        if (focusedIdx >= 0) {
          e.preventDefault();
          setFocusedIdx(-1);
        }
        return;
      }

      const action: Action | null =
        key === "b" ? "bookmark" : key === "s" ? "solution" : key === "a" ? "answered" : key === "l" ? "language" : null;
      if (!action) return;

      const idx = focusedIdx >= 0 ? focusedIdx : 0;
      const id = ids[idx];
      if (id == null) return;
      if (focusedIdx < 0) setFocusedIdx(0);

      // Defer click so any focus change has a chance to settle.
      const ok = fireCardAction(id, action);
      if (ok) e.preventDefault();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, focusedIdx]);

  // Scroll the focused card into view.
  useEffect(() => {
    if (focusedIdx < 0) return;
    const id = questionIds[focusedIdx];
    if (id == null) return;
    const el = document.querySelector<HTMLElement>(`[data-question-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedIdx, questionIds]);

  return {
    focusedIdx,
    focusedId: focusedIdx >= 0 ? questionIds[focusedIdx] ?? null : null,
    setFocusedIdx,
  };
}
