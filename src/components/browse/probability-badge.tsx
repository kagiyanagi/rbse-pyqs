"use client";

import { ChevronDown } from "lucide-react";
import type { ChapterStats, QuestionPrediction } from "@/types";
import { cn } from "@/lib/utils";
import { predictionTierOf, type PredictionTierId } from "@/lib/prediction-tiers";

const pct = (x: number) => Math.round(x * 100);

const TIER_CLASSES = {
  high: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  mid: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  low: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  none: "bg-muted text-muted-foreground border-border",
};

// Question-level recurrence chance; bands come from src/lib/prediction-tiers.ts so the badge
// and the "Repeat chance" filter always agree.
const TIER_VIEW: Record<PredictionTierId, { label: string; cls: string }> = {
  high: { label: "High", cls: TIER_CLASSES.high },
  above_avg: { label: "Above avg", cls: TIER_CLASSES.mid },
  average: { label: "Average", cls: TIER_CLASSES.low },
  low: { label: "Low", cls: TIER_CLASSES.none },
};

function predictionTier(p: number) {
  return TIER_VIEW[predictionTierOf(p)];
}

// Legacy chapter-level "appeared in X of N years" tiers, used where no
// question-level prediction exists (Hindi, English, out-of-syllabus).
function chapterTier(probability: number) {
  if (probability >= 75) return { label: "High", cls: TIER_CLASSES.high };
  if (probability >= 50) return { label: "Med-High", cls: TIER_CLASSES.mid };
  if (probability >= 25) return { label: "Medium", cls: TIER_CLASSES.low };
  return { label: "Low", cls: TIER_CLASSES.none };
}

function paperSuffix(paperType: string) {
  if (paperType === "main") return "";
  if (paperType === "main_set2") return " set 2";
  if (paperType === "supplementary") return " supp";
  if (paperType === "model") return " model";
  return ` ${paperType}`;
}

export function ProbabilityButton({
  stats,
  prediction,
  expanded,
  onToggle,
}: {
  stats: ChapterStats | null | undefined;
  prediction?: QuestionPrediction | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!prediction && !stats) return null;
  const view = prediction
    ? {
        ...predictionTier(prediction.p),
        text: `${pct(prediction.p)}%`,
        title: `Chance that this or a very similar question is in the ${prediction.target_year} main paper`,
      }
    : {
        ...chapterTier(stats!.probability),
        text: `${stats!.probability}%`,
        title: "Share of past years in which this chapter appeared",
      };
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      title={view.title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        view.cls,
      )}
    >
      <span>
        {view.text} · {view.label}
      </span>
      <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
    </button>
  );
}

function PredictionDetails({ prediction: pr }: { prediction: QuestionPrediction }) {
  const years = new Set(pr.appearances.map((a) => a.year));
  const last = pr.appearances.reduce((m, a) => Math.max(m, a.year), 0);
  const forecast = pr.chapter_forecast;
  return (
    <div className="space-y-3">
      <div>
        <div className="font-medium text-foreground">
          Chance of appearing in the {pr.target_year} main paper
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span>
            This or a very similar question:{" "}
            <span className="font-semibold tabular-nums text-foreground">{pct(pr.p)}%</span>
          </span>
          <span>
            Nearly the same question:{" "}
            <span className="font-semibold tabular-nums text-foreground">{pct(pr.px)}%</span>
          </span>
          <span>
            Any question on this topic:{" "}
            <span className="font-semibold tabular-nums text-foreground">{pct(pr.pt)}%</span>
          </span>
        </div>
      </div>

      <div>
        <div className="mb-1 text-muted-foreground">
          Asked {pr.appearances.length} {pr.appearances.length === 1 ? "time" : "times"} across{" "}
          {years.size} {years.size === 1 ? "year" : "years"}, last in {last}
          {pr.related_papers > 0 && (
            <>
              {" · "}related questions in {pr.related_papers} more{" "}
              {pr.related_papers === 1 ? "paper" : "papers"}
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {pr.appearances.map((a) => (
            <span
              key={a.id}
              className="rounded-sm border bg-muted/50 px-1.5 py-0.5 text-[11px] tabular-nums"
            >
              {a.year}
              {paperSuffix(a.paper_type)}
              {a.marks != null ? ` · ${a.marks}m` : ""}
            </span>
          ))}
        </div>
      </div>

      {forecast && (
        <div className="border-t pt-2 text-muted-foreground">
          <span className="font-medium text-foreground">{pr.chapter}</span>:{" "}
          {forecast.official_marks != null
            ? `${forecast.official_marks} marks in the official blueprint`
            : `about ${forecast.expected_marks} marks expected`}
          {forecast.marks_low != null && forecast.marks_high != null && (
            <> ({forecast.marks_low}–{forecast.marks_high} in the last three real papers)</>
          )}
          , roughly {forecast.expected_questions} questions, {forecast.families} known question
          families in {forecast.topics} topics. {pct(pr.reuse_rate)}% of recent questions were repeats of
          earlier ones.
        </div>
      )}

      <div className="text-[11px] leading-snug text-muted-foreground">
        Estimated from how often this question and its variants recurred in past RBSE papers and
        official model papers, weighted towards recent years and scaled by the chapter&apos;s share of
        the blueprint. Backtested on the last two real papers.
      </div>
    </div>
  );
}

function ChapterHistory({ stats, compact }: { stats: ChapterStats; compact: boolean }) {
  const years = Object.keys(stats.by_year)
    .map(Number)
    .sort((a, b) => b - a);
  const maxQs = Math.max(1, ...years.map((y) => stats.by_year[y]?.qs ?? 0));

  return (
    <div className={cn(compact && "mt-3 border-t pt-2")}>
      <div className="mb-2 text-muted-foreground">
        {compact ? "Chapter history · " : `Appeared in ${stats.years_appeared}/${stats.total_years} years · `}
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

export function ProbabilityPanel({
  stats,
  prediction,
}: {
  stats: ChapterStats | null | undefined;
  prediction?: QuestionPrediction | null;
}) {
  if (!prediction && !stats) return null;
  return (
    <div className="rounded-md border bg-card p-3 text-xs shadow-sm">
      {prediction && <PredictionDetails prediction={prediction} />}
      {stats && <ChapterHistory stats={stats} compact={!!prediction} />}
    </div>
  );
}
