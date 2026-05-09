import { and, eq, gte, inArray, isNotNull, ne, or, type SQL } from "drizzle-orm";
import { questions } from "@/db/schema";
import type { SortOrder } from "@/types";

export function getMulti(searchParams: URLSearchParams, key: string, legacyKey?: string): string[] {
  const multi = searchParams.getAll(key).filter(Boolean);
  if (multi.length > 0) return multi;
  if (legacyKey) {
    const single = searchParams.get(legacyKey);
    if (single) return [single];
  }
  return [];
}

export function parseInt32(s: string | null, fallback: number, min: number, max: number) {
  if (!s) return fallback;
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function parseFloatClamp(s: string | null, fallback: number, min: number, max: number) {
  if (!s) return fallback;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function buildMarksCondition(marksList: string[]): SQL | undefined {
  const conds: SQL[] = [];
  for (const m of marksList) {
    if (m.endsWith("+")) {
      const v = parseFloat(m.slice(0, -1));
      if (!Number.isNaN(v)) conds.push(gte(questions.marks, v));
    } else {
      const v = parseFloat(m);
      if (!Number.isNaN(v)) conds.push(eq(questions.marks, v));
    }
  }
  if (!conds.length) return undefined;
  return or(...conds);
}

export function buildWhere(searchParams: URLSearchParams): SQL | undefined {
  const subjects = getMulti(searchParams, "subjects", "subject");
  const chapters = getMulti(searchParams, "chapters", "chapter");
  const topics = getMulti(searchParams, "topics", "topic");
  const marksList = getMulti(searchParams, "marks_list", "marks");
  const qtypes = getMulti(searchParams, "question_types", "question_type");
  const minYearRaw = searchParams.get("min_year");

  const parts: Array<SQL | undefined> = [];
  if (subjects.length) parts.push(inArray(questions.subject, subjects));
  if (chapters.length) parts.push(inArray(questions.chapter, chapters));
  if (topics.length) parts.push(inArray(questions.topic, topics));
  if (qtypes.length) parts.push(inArray(questions.questionType, qtypes));
  parts.push(buildMarksCondition(marksList));
  if (minYearRaw) {
    const v = parseInt(minYearRaw, 10);
    if (!Number.isNaN(v)) parts.push(gte(questions.year, v));
  }

  const filtered = parts.filter((p): p is SQL => Boolean(p));
  if (!filtered.length) return undefined;
  return and(...filtered);
}

export function parseOrder(s: string | null): SortOrder {
  if (s === "oldest" || s === "random" || s === "marks_asc" || s === "marks_desc") return s;
  return "newest";
}

export const topicNotEmpty = and(isNotNull(questions.topic), ne(questions.topic, ""));
