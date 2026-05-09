"use client";

import { useEffect, useMemo, useState } from "react";
import { useAnswered } from "./use-answered";
import { useSolutionCache } from "./use-solutions";

export type SubjectGroup = {
  currentSyllabus: Record<string, number[]>;
  outOfSyllabus: number[];
};

export type ProgressIndex = {
  subjects: Record<string, SubjectGroup>;
};

export type ChapterProgress = {
  subject: string;
  chapter: string;
  total: number;
  answered: number;
  seen: number;
  percent: number;
};

export type OutOfSyllabusStats = {
  total: number;
  answered: number;
  seen: number;
  percent: number;
};

export type SubjectProgress = {
  subject: string;
  total: number;
  answered: number;
  seen: number;
  percent: number;
  chapters: ChapterProgress[];
  outOfSyllabus: OutOfSyllabusStats;
};

let _cached: ProgressIndex | null = null;
let _inflight: Promise<ProgressIndex> | null = null;

function loadIndex(): Promise<ProgressIndex> {
  if (_cached) return Promise.resolve(_cached);
  if (_inflight) return _inflight;
  _inflight = fetch("/api/progress-index")
    .then((r) => {
      if (!r.ok) throw new Error(`progress-index ${r.status}`);
      return r.json() as Promise<ProgressIndex>;
    })
    .then((d) => {
      _cached = d;
      _inflight = null;
      return d;
    })
    .catch((e) => {
      _inflight = null;
      throw e;
    });
  return _inflight;
}

export function useProgress(active: boolean = true) {
  const [index, setIndex] = useState<ProgressIndex | null>(_cached);
  const [loading, setLoading] = useState(!_cached);
  const { ids: answeredIds } = useAnswered();
  const { ids: solutionIds } = useSolutionCache();

  useEffect(() => {
    if (!active || _cached) {
      if (_cached) {
        setIndex(_cached);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    let cancelled = false;
    loadIndex()
      .then((d) => {
        if (cancelled) return;
        setIndex(d);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const answeredSet = useMemo(() => new Set(answeredIds), [answeredIds]);
  const seenSet = useMemo(() => new Set(solutionIds), [solutionIds]);

  const subjects = useMemo<SubjectProgress[]>(() => {
    if (!index) return [];
    const list = Object.entries(index.subjects).map(([subject, group]) => {
      const cur = group.currentSyllabus ?? {};
      const oos = group.outOfSyllabus ?? [];

      const chapterRows: ChapterProgress[] = Object.entries(cur).map(
        ([chapter, ids]) => {
          let answered = 0;
          let seen = 0;
          for (const id of ids) {
            if (answeredSet.has(id)) answered++;
            if (seenSet.has(id)) seen++;
          }
          return {
            subject,
            chapter,
            total: ids.length,
            answered,
            seen,
            percent: ids.length > 0 ? (answered / ids.length) * 100 : 0,
          };
        },
      );
      chapterRows.sort((a, b) => {
        if (b.percent !== a.percent) return b.percent - a.percent;
        return b.total - a.total;
      });

      const total = chapterRows.reduce((s, c) => s + c.total, 0);
      const answered = chapterRows.reduce((s, c) => s + c.answered, 0);
      const seen = chapterRows.reduce((s, c) => s + c.seen, 0);

      let oosAnswered = 0;
      let oosSeen = 0;
      for (const id of oos) {
        if (answeredSet.has(id)) oosAnswered++;
        if (seenSet.has(id)) oosSeen++;
      }
      const oosTotal = oos.length;

      return {
        subject,
        total,
        answered,
        seen,
        percent: total > 0 ? (answered / total) * 100 : 0,
        chapters: chapterRows,
        outOfSyllabus: {
          total: oosTotal,
          answered: oosAnswered,
          seen: oosSeen,
          percent: oosTotal > 0 ? (oosAnswered / oosTotal) * 100 : 0,
        },
      } satisfies SubjectProgress;
    });
    list.sort((a, b) => a.subject.localeCompare(b.subject));
    return list;
  }, [index, answeredSet, seenSet]);

  const totals = useMemo(() => {
    let total = 0,
      answered = 0,
      seen = 0;
    for (const s of subjects) {
      total += s.total;
      answered += s.answered;
      seen += s.seen;
    }
    return {
      total,
      answered,
      seen,
      percent: total > 0 ? (answered / total) * 100 : 0,
    };
  }, [subjects]);

  return { loading, subjects, totals };
}

export type Rank = {
  name: string;
  short: string;
  color: string;
  glow: string;
};

export function rankFor(percent: number): Rank {
  if (percent >= 100) return { name: "Legendary", short: "LGND", color: "text-amber-400", glow: "0 0 18px rgb(251 191 36 / 0.55)" };
  if (percent >= 90) return { name: "Master", short: "MSTR", color: "text-fuchsia-400", glow: "0 0 14px rgb(232 121 249 / 0.45)" };
  if (percent >= 66) return { name: "Expert", short: "EXPT", color: "text-emerald-400", glow: "0 0 12px rgb(52 211 153 / 0.45)" };
  if (percent >= 41) return { name: "Adept", short: "ADPT", color: "text-sky-400", glow: "0 0 10px rgb(56 189 248 / 0.4)" };
  if (percent >= 16) return { name: "Apprentice", short: "APRC", color: "text-cyan-400", glow: "0 0 10px rgb(34 211 238 / 0.35)" };
  if (percent > 0) return { name: "Newcomer", short: "NWCR", color: "text-zinc-300", glow: "0 0 8px rgb(212 212 216 / 0.25)" };
  return { name: "Untouched", short: "ZERO", color: "text-muted-foreground", glow: "none" };
}
