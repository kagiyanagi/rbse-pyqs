// Question-level exam-recurrence predictions for PCM, generated offline by
// scripts/predict/build_predictions.py (see its docstring for the model).
// The JSON is bundled server-side only; route handlers attach the per-question
// slice to their payloads.
import raw from "@/data/predictions.json";
import { canonicalSubject, canonicalizeChapter } from "@/lib/syllabus";
import type { ChapterForecast, QuestionPrediction } from "@/types";

type FamilyRecord = {
  subject: string;
  chapter: string;
  p: number;
  score: number;
  topic: string;
  related_papers: number;
  appearances: Array<[number, string, number | null, number]>;
};

export type SubjectForecast = {
  official_total_marks: number;
  reuse_rate: number;
  reuse_by_bucket: Record<string, number>;
  exact_share: number;
  families: number;
  topics: number;
  questions: number;
  eval: Record<string, unknown>;
  model_papers: Record<string, Record<string, number>>;
  paper_structure: { year: number; paper_type: string; slots: Array<{ type: string; marks: number; count: number }> };
  blueprint_year: number | null;
  chapters: Record<string, ChapterForecast>;
};

type TopicRecord = { subject: string; chapter: string; p: number; families: number; years: number[] };

type PredictionsFile = {
  generated_at: string;
  source_db: string;
  target_year: number;
  thresholds: { similar: number; exact: number; related: number };
  subjects: Record<string, SubjectForecast>;
  families: Record<string, FamilyRecord>;
  topics: Record<string, TopicRecord>;
  questions: Record<string, { fid: string; tid: string; p: number; px: number; pt: number }>;
};

const data = raw as unknown as PredictionsFile;

export const PREDICTION_TARGET_YEAR = data.target_year;
export const PREDICTIONS_GENERATED_AT = data.generated_at;

/** Prediction for one question, or null for non-PCM / out-of-syllabus questions. */
export function getQuestionPrediction(id: number): QuestionPrediction | null {
  const q = data.questions[String(id)];
  if (!q) return null;
  const fam = data.families[q.fid];
  if (!fam) return null;
  const subj = data.subjects[fam.subject];
  return {
    target_year: data.target_year,
    p: q.p,
    px: q.px,
    pt: q.pt,
    fid: q.fid,
    tid: q.tid,
    subject: fam.subject,
    chapter: fam.chapter,
    score: fam.score,
    related_papers: fam.related_papers,
    appearances: fam.appearances.map(([year, paper_type, marks, qid]) => ({ year, paper_type, marks, id: qid })),
    reuse_rate: subj?.reuse_rate ?? 0,
    chapter_forecast: subj?.chapters[fam.chapter] ?? null,
  };
}

export function getSubjectForecast(subject: string | null | undefined): SubjectForecast | null {
  const subj = canonicalSubject(subject);
  return subj ? data.subjects[subj] ?? null : null;
}

export function getChapterForecast(subject: string | null | undefined, chapter: string | null | undefined): ChapterForecast | null {
  const subj = canonicalSubject(subject);
  if (!subj) return null;
  return data.subjects[subj]?.chapters[canonicalizeChapter(subj, chapter)] ?? null;
}
