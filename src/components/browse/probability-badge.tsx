"use client";

import { ChevronDown } from "lucide-react";
import type { ChapterStats } from "@/types";
import { cn } from "@/lib/utils";

function tierColor(probability: number) {
  if (probability >= 75) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (probability >= 50) return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30";
  if (probability >= 25) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function tierLabel(probability: number) {
  if (probability >= 75) return "High";
  if (probability >= 50) return "Med-High";
  if (probability >= 25) return "Medium";
  return "Low";
}

export function ProbabilityButton({
  stats,
  expanded,
  onToggle,
}: {
  stats: ChapterStats | null | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!stats) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        tierColor(stats.probability),
      )}
    >
      <span>
        {stats.probability}% · {tierLabel(stats.probability)}
      </span>
      <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
    </button>
  );
}

export function ProbabilityPanel({ stats }: { stats: ChapterStats | null | undefined }) {
  if (!stats) return null;
  const years = Object.keys(stats.by_year)
    .map(Number)
    .sort((a, b) => b - a);
  const maxQs = Math.max(1, ...years.map((y) => stats.by_year[y]?.qs ?? 0));

  return (
    <div className="rounded-md border bg-card p-3 text-xs shadow-sm">
      <div className="mb-2 text-muted-foreground">
        Appeared in {stats.years_appeared}/{stats.total_years} years
        {" · "}
        {stats.qs} questions
        {" · "}
        {stats.total_marks} total marks
      </div>
      <div className="space-y-1">
        {years.map((y) => {
          const v = stats.by_year[y];
          const w = v ? Math.round((v.qs / maxQs) * 100) : 0;
          return (
            <div key={y} className="flex items-center gap-2">
              <span className="w-10 tabular-nums text-muted-foreground">{y}</span>
              <div className="relative h-3 flex-1 rounded bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded bg-primary/60"
                  style={{ width: `${w}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums">{v?.qs ?? 0}</span>
              <span className="w-10 text-right tabular-nums text-muted-foreground">
                {v?.marks ?? 0}m
              </span>
            </div>
          );
        })}
      </div>
      {stats.top_topics.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <div className="mb-1 text-muted-foreground">Top topics</div>
          <div className="flex flex-wrap gap-1">
            {stats.top_topics.map((t) => (
              <span
                key={t.topic}
                className="rounded-sm border bg-muted/50 px-1.5 py-0.5 text-[11px]"
                title={`${t.qs} questions over ${t.years} year${t.years === 1 ? "" : "s"}`}
              >
                {t.topic} <span className="text-muted-foreground">×{t.qs}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
