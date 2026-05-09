"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChapterProgress } from "@/hooks/use-progress";

function tierFor(percent: number) {
  if (percent >= 100)
    return {
      from: "from-amber-300",
      to: "to-amber-500",
      glow: "shadow-[0_0_12px_rgba(251,191,36,0.55)]",
      mastery: true,
    };
  if (percent >= 66) return { from: "from-emerald-400", to: "to-emerald-500", glow: "", mastery: false };
  if (percent >= 33) return { from: "from-sky-400", to: "to-emerald-400", glow: "", mastery: false };
  if (percent > 0) return { from: "from-cyan-400", to: "to-sky-500", glow: "", mastery: false };
  return { from: "from-zinc-700", to: "to-zinc-700", glow: "", mastery: false };
}

export function ChapterBar({ row }: { row: ChapterProgress }) {
  const tier = tierFor(row.percent);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  const widthPct = mounted ? row.percent : 0;
  const seenOnly = Math.max(0, row.seen - row.answered);

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="truncate font-medium">{row.chapter}</span>
          {tier.mastery && (
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
          )}
        </div>
        <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-muted/60 ring-1 ring-foreground/5">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out",
              tier.from,
              tier.to,
              tier.glow,
            )}
            style={{ width: `${widthPct}%` }}
          />
          {seenOnly > 0 && row.percent < 100 && (
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-full bg-foreground/10 mix-blend-overlay transition-[width] duration-700 ease-out"
              style={{
                width: `${mounted ? Math.min(100, ((row.answered + seenOnly) / Math.max(row.total, 1)) * 100) : 0}%`,
              }}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
        <span className={cn("text-foreground", row.answered === row.total && row.total > 0 && "text-amber-400")}>
          {row.answered}
          <span className="text-muted-foreground">/{row.total}</span>
        </span>
        <span
          className={cn(
            "min-w-[2.5rem] rounded px-1.5 py-0.5 text-right text-[10px]",
            row.percent >= 100
              ? "bg-amber-500/15 text-amber-400"
              : row.percent >= 66
                ? "bg-emerald-500/15 text-emerald-400"
                : row.percent >= 33
                  ? "bg-sky-500/15 text-sky-400"
                  : row.percent > 0
                    ? "bg-cyan-500/15 text-cyan-400"
                    : "bg-muted text-muted-foreground",
          )}
        >
          {Math.round(row.percent)}%
        </span>
      </div>
    </div>
  );
}
