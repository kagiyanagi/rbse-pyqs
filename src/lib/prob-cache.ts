import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { sql, isNotNull, and, ne } from "drizzle-orm";
import { type ChapterStats, type ProbCache, chapterKey } from "@/types";

let cachePromise: Promise<ProbCache> | null = null;

async function build(): Promise<ProbCache> {
  // Distinct years (overall) — used as fallback total
  const yearRows = await db
    .selectDistinct({ year: questions.year })
    .from(questions)
    .where(isNotNull(questions.year));
  const allYears = yearRows
    .map((r) => r.year)
    .filter((y): y is number => y !== null)
    .sort((a, b) => a - b);
  const totalYears = allYears.length || 1;

  // Per-subject distinct year counts (more accurate when filtering by subject)
  const subjectYearRows = await db
    .select({ subject: questions.subject, n: sql<number>`COUNT(DISTINCT ${questions.year})` })
    .from(questions)
    .where(isNotNull(questions.year))
    .groupBy(questions.subject);
  const yearsPerSubject = new Map<string, number>();
  for (const r of subjectYearRows) {
    if (r.subject) yearsPerSubject.set(r.subject, Number(r.n));
  }

  // Per-chapter aggregate stats
  const chapterRows = await db
    .select({
      subject: questions.subject,
      chapter: questions.chapter,
      qs: sql<number>`COUNT(*)`,
      yearsAppeared: sql<number>`COUNT(DISTINCT ${questions.year})`,
      totalMarks: sql<number>`COALESCE(SUM(${questions.marks}), 0)`,
    })
    .from(questions)
    .where(and(isNotNull(questions.chapter), isNotNull(questions.year)))
    .groupBy(questions.subject, questions.chapter);

  const chapters: Record<string, ChapterStats> = {};
  for (const r of chapterRows) {
    if (!r.subject || !r.chapter) continue;
    const subjTotalYears = yearsPerSubject.get(r.subject) || totalYears || 1;
    chapters[chapterKey(r.subject, r.chapter)] = {
      qs: Number(r.qs),
      years_appeared: Number(r.yearsAppeared),
      total_years: subjTotalYears,
      total_marks: Number(r.totalMarks) || 0,
      probability: Math.round((Number(r.yearsAppeared) / subjTotalYears) * 100),
      by_year: {},
      top_topics: [],
    };
  }

  // Per-year breakdown
  const byYearRows = await db
    .select({
      subject: questions.subject,
      chapter: questions.chapter,
      year: questions.year,
      qs: sql<number>`COUNT(*)`,
      marks: sql<number>`COALESCE(SUM(${questions.marks}), 0)`,
    })
    .from(questions)
    .where(and(isNotNull(questions.chapter), isNotNull(questions.year)))
    .groupBy(questions.subject, questions.chapter, questions.year);

  for (const r of byYearRows) {
    if (!r.subject || !r.chapter || r.year == null) continue;
    const k = chapterKey(r.subject, r.chapter);
    if (!chapters[k]) continue;
    chapters[k].by_year[r.year] = { qs: Number(r.qs), marks: Number(r.marks) || 0 };
  }

  // Top topics per chapter (cap at 8)
  const topicRows = await db
    .select({
      subject: questions.subject,
      chapter: questions.chapter,
      topic: questions.topic,
      qs: sql<number>`COUNT(*)`,
      years: sql<number>`COUNT(DISTINCT ${questions.year})`,
    })
    .from(questions)
    .where(
      and(
        isNotNull(questions.chapter),
        isNotNull(questions.topic),
        ne(questions.topic, ""),
      ),
    )
    .groupBy(questions.subject, questions.chapter, questions.topic)
    .orderBy(sql`COUNT(*) DESC`);

  for (const r of topicRows) {
    if (!r.subject || !r.chapter || !r.topic) continue;
    const k = chapterKey(r.subject, r.chapter);
    const stats = chapters[k];
    if (!stats || stats.top_topics.length >= 8) continue;
    stats.top_topics.push({ topic: r.topic, qs: Number(r.qs), years: Number(r.years) });
  }

  return { all_years: allYears, total_years: totalYears, chapters };
}

export function getProbCache(): Promise<ProbCache> {
  if (!cachePromise) cachePromise = build();
  return cachePromise;
}

export function invalidateProbCache() {
  cachePromise = null;
}
