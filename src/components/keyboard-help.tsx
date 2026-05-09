"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Row = { keys: string[]; label: string };

const NAV: Row[] = [
  { keys: ["J"], label: "Next question" },
  { keys: ["K"], label: "Previous question" },
  { keys: ["G"], label: "Jump to first" },
  { keys: ["Esc"], label: "Clear focus" },
];

const ACTIONS: Row[] = [
  { keys: ["B"], label: "Bookmark / open bookmark menu" },
  { keys: ["S"], label: "Open solution" },
  { keys: ["A"], label: "Toggle answered" },
  { keys: ["L"], label: "Cycle language (EN / हि / EN+हि)" },
];

const META: Row[] = [{ keys: ["?"], label: "Show this cheat sheet" }];

function shouldIgnore(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (shouldIgnore(e.target)) return;
      const overlayOpen = document.querySelector<HTMLElement>(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      );
      if (overlayOpen) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Vim-style. Works on Browse and Bookmarks. Disabled while typing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Section title="Navigation" rows={NAV} />
          <Section title="Actions on focused card" rows={ACTIONS} />
          <Section title="Other" rows={META} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <ul className="divide-y rounded-md border">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>{r.label}</span>
            <span className="flex items-center gap-1">
              {r.keys.map((k) => (
                <kbd
                  key={k}
                  className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none text-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
