"use client";

import { useState } from "react";
import { ChevronDown, Eye, Loader2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { rankFor, useProgress, type SubjectProgress } from "@/hooks/use-progress";
import { SyllabusRadar } from "./syllabus-radar";
import { ChapterBar } from "./chapter-bar";

export function ProgressTab({ active }: { active: boolean }) {
  const { loading, subjects, totals } = useProgress(active);
  const overallRank = rankFor(totals.percent);

  if (loading && subjects.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/30 p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Reading the syllabus…
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-12 text-center text-muted-foreground">
        No syllabus data yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div
          className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[auto_1fr]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 10%, rgb(16 185 129 / 0.08), transparent 50%), radial-gradient(circle at 88% 90%, rgb(59 130 246 / 0.06), transparent 55%)",
          }}
        >
          <div className="mx-auto">
            <SyllabusRadar subjects={subjects} />
          </div>

          <div className="flex flex-col justify-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Syllabus mastery
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <div
                className="font-mono text-5xl font-bold tabular-nums text-foreground sm:text-6xl"
                style={{ textShadow: overallRank.glow }}
              >
                {Math.round(totals.percent)}
                <span className="text-2xl text-muted-foreground sm:text-3xl">%</span>
              </div>
              <RankPill rank={overallRank} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono tabular-nums text-foreground">
                  {totals.answered.toLocaleString()}
                </span>
                <span>answered</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-sky-400" />
                <span className="font-mono tabular-nums text-foreground">
                  {totals.seen.toLocaleString()}
                </span>
                <span>solutions seen</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono tabular-nums text-foreground">
                  {totals.total.toLocaleString()}
                </span>
                <span>total questions</span>
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {subjects.map((s) => {
                const r = rankFor(s.percent);
                return (
                  <a
                    key={s.subject}
                    href={`#subject-${slugify(s.subject)}`}
                    className="group flex items-center justify-between rounded-lg border bg-background/40 px-3 py-2 transition hover:border-foreground/20 hover:bg-background/70"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        {s.subject}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-lg font-bold tabular-nums">
                          {Math.round(s.percent)}%
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {s.answered}/{s.total}
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wider",
                        r.color,
                      )}
                    >
                      {r.short}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Per-subject blocks */}
      <div className="space-y-4">
        {subjects.map((s) => (
          <SubjectBlock key={s.subject} subject={s} />
        ))}
      </div>
    </div>
  );
}

function RankPill({ rank }: { rank: ReturnType<typeof rankFor> }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.16em]",
        rank.color,
        "border-current/30 bg-current/5",
      )}
      style={{ textShadow: rank.glow }}
      title={`Rank: ${rank.name}`}
    >
      {rank.name}
    </span>
  );
}

function SubjectBlock({ subject }: { subject: SubjectProgress }) {
  const [open, setOpen] = useState(true);
  const rank = rankFor(subject.percent);

  return (
    <div id={`subject-${slugify(subject.subject)}`} className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">{subject.subject}</h3>
            <RankPill rank={rank} />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60 ring-1 ring-foreground/5">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out",
                  subject.percent >= 100
                    ? "from-amber-300 to-amber-500"
                    : subject.percent >= 66
                      ? "from-emerald-400 to-emerald-500"
                      : subject.percent >= 33
                        ? "from-sky-400 to-emerald-400"
                        : subject.percent > 0
                          ? "from-cyan-400 to-sky-500"
                          : "from-zinc-700 to-zinc-700",
                )}
                style={{ width: `${subject.percent}%` }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              <span className="text-foreground">{subject.answered}</span>/{subject.total}
              <span className="ml-2 text-foreground">{Math.round(subject.percent)}%</span>
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t px-4 py-2">
          <div className="divide-y">
            {subject.chapters.map((c) => (
              <ChapterBar key={c.chapter} row={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
