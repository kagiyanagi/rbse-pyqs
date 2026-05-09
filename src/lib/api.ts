import type { QuestionsResponse, StatsResponse } from "@/types";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  subjects: () => getJSON<string[]>("/api/subjects"),
  chapters: (subjects: string[]) => {
    const sp = new URLSearchParams();
    for (const s of subjects) sp.append("subjects", s);
    return getJSON<string[]>(`/api/chapters?${sp.toString()}`);
  },
  topics: (subjects: string[], chapters: string[]) => {
    const sp = new URLSearchParams();
    for (const s of subjects) sp.append("subjects", s);
    for (const c of chapters) sp.append("chapters", c);
    return getJSON<string[]>(`/api/topics?${sp.toString()}`);
  },
  stats: () => getJSON<StatsResponse>("/api/stats"),
  questions: (filter: QuestionFilter) => {
    const sp = new URLSearchParams();
    for (const s of filter.subjects) sp.append("subjects", s);
    for (const c of filter.chapters) sp.append("chapters", c);
    for (const t of filter.topics) sp.append("topics", t);
    for (const m of filter.marks_list) sp.append("marks_list", m);
    for (const q of filter.question_types) sp.append("question_types", q);
    if (filter.min_year != null) sp.set("min_year", String(filter.min_year));
    if (filter.max_year != null) sp.set("max_year", String(filter.max_year));
    sp.set("order", filter.order);
    if (filter.target_marks_total != null) sp.set("target_marks_total", String(filter.target_marks_total));
    else sp.set("count", String(filter.count));
    return getJSON<QuestionsResponse>(`/api/questions?${sp.toString()}`);
  },
};

export type QuestionFilter = {
  subjects: string[];
  chapters: string[];
  topics: string[];
  marks_list: string[];
  question_types: string[];
  min_year: number | null;
  max_year: number | null;
  order: "newest" | "oldest" | "random" | "marks_asc" | "marks_desc";
  count: number;
  target_marks_total: number | null;
};

export const DEFAULT_FILTER: QuestionFilter = {
  subjects: [],
  chapters: [],
  topics: [],
  marks_list: [],
  question_types: [],
  min_year: null,
  max_year: null,
  order: "newest",
  count: 10,
  target_marks_total: null,
};

export const QUESTION_TYPES = [
  "MCQ",
  "very_short",
  "short",
  "short_answer",
  "long",
  "essay",
  "numerical",
  "fill_blank",
  "diagram",
  "instruction",
];

export const MARKS_BUCKETS = ["1", "2", "3", "4", "5", "5+"];
