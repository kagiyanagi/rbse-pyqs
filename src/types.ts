export type ChapterStats = {
  qs: number;
  years_appeared: number;
  total_years: number;
  total_marks: number;
  probability: number;
  by_year: Record<number, { qs: number; marks: number }>;
  top_topics: Array<{ topic: string; qs: number; years: number }>;
};

export type ProbCache = {
  all_years: number[];
  total_years: number;
  chapters: Record<string, ChapterStats>;
};

export type QuestionPayload = {
  id: number;
  subject: string | null;
  year: number | null;
  paper_type: string | null;
  source_file: string | null;
  question_number: string | null;
  marks: number | null;
  chapter: string | null;
  topic: string | null;
  question_type: string | null;
  question_text: string | null;
  question_latex: string | null;
  chapter_stats: ChapterStats | null;
};

export type QuestionsResponse = {
  questions: QuestionPayload[];
  count: number;
  total_marks: number;
};

export type StatsResponse = {
  total: number;
  by_subject: Record<string, number>;
  has_latex: boolean;
};

export type SortOrder = "newest" | "oldest" | "random" | "marks_asc" | "marks_desc";

export const chapterKey = (subject: string | null, chapter: string | null) =>
  `${subject ?? ""}|${chapter ?? ""}`;
