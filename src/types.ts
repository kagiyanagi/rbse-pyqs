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

/** Blueprint-style forecast for one canonical chapter in the next main paper. */
export type ChapterForecast = {
  expected_marks: number;
  /** marks in the board's official blueprint for the reference year, when parsed */
  official_marks: number | null;
  /** exponentially weighted marks share of recent papers, scaled to the paper total */
  history_marks: number;
  marks_low: number | null;
  marks_high: number | null;
  expected_questions: number;
  families: number;
  topics: number;
  type_mix: Record<string, number>;
};

export type PredictionAppearance = {
  year: number;
  paper_type: string;
  marks: number | null;
  id: number;
};

/**
 * Chance that a question, or a very similar one, is asked in the next main paper.
 * Only present for current-syllabus PCM questions; produced by scripts/predict.
 */
export type QuestionPrediction = {
  target_year: number;
  /** this or a very similar question */
  p: number;
  /** a near-verbatim repeat */
  px: number;
  /** a question on the same topic, however worded */
  pt: number;
  /** question-family id shared by all near-duplicates */
  fid: string;
  /** topic-cluster id, shared by related questions of the chapter */
  tid: string;
  subject: string;
  chapter: string;
  score: number;
  related_papers: number;
  appearances: PredictionAppearance[];
  reuse_rate: number;
  chapter_forecast: ChapterForecast | null;
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
  prediction: QuestionPrediction | null;
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

export type SortOrder = "newest" | "oldest" | "random" | "marks_asc" | "marks_desc" | "predicted";

export const chapterKey = (subject: string | null, chapter: string | null) =>
  `${subject ?? ""}|${chapter ?? ""}`;
