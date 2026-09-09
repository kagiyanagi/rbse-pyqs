import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { sql, asc, desc } from "drizzle-orm";
import { buildWhere, getMulti, parseInt32, parseFloatClamp, parseOrder } from "@/lib/filters";
import { getProbCache } from "@/lib/prob-cache";
import { getQuestionPrediction } from "@/lib/predictions";
import { parsePredictionTiers, predictionTierOf } from "@/lib/prediction-tiers";
import {
  CANONICAL_SUBJECTS,
  OUT_OF_SYLLABUS,
  canonicalSubject,
} from "@/lib/syllabus";
import { getChapterAliases } from "@/lib/syllabus-aliases";
import { chapterKey, type QuestionPayload, type QuestionsResponse } from "@/types";

type Row = typeof questions.$inferSelect;

/** Greedy pack in the given order until the marks total reaches the target (±0.5). */
function packToMarks(candidates: Row[], target: number): Row[] {
  const selected: Row[] = [];
  let total = 0;
  for (const r of candidates) {
    const m = r.marks ?? 0;
    if (total + m > target + 0.5) continue;
    selected.push(r);
    total += m;
    if (total >= target - 0.5) break;
  }
  return selected;
}

/**
 * Rank by the chance of recurring in the next main paper, keeping one row per
 * question family so near-duplicates from different years do not crowd the list.
 * Rows without a prediction (non-PCM, out of syllabus) sink to the bottom.
 */
function rankByPrediction(candidates: Row[]): Row[] {
  const scored = candidates.map((r) => ({ r, pred: getQuestionPrediction(r.id) }));
  scored.sort(
    (a, b) =>
      (b.pred?.p ?? -1) - (a.pred?.p ?? -1) ||
      (b.r.year ?? 0) - (a.r.year ?? 0) ||
      b.r.id - a.r.id,
  );
  const seenFamilies = new Set<string>();
  const ranked: Row[] = [];
  for (const { r, pred } of scored) {
    if (pred) {
      if (seenFamilies.has(pred.fid)) continue;
      seenFamilies.add(pred.fid);
    }
    ranked.push(r);
  }
  return ranked;
}

export async function GET(request: NextRequest) {
  const sp = new URLSearchParams(request.nextUrl.searchParams);

  // Expand canonical chapter filters to all matching raw DB variants.
  const requestedChapters = getMulti(sp, "chapters", "chapter");
  if (requestedChapters.length > 0) {
    const aliases = await getChapterAliases();
    const requestedSubjects = getMulti(sp, "subjects", "subject");
    const subjectScope = requestedSubjects.length > 0 ? requestedSubjects : CANONICAL_SUBJECTS;
    const expanded = new Set<string>();
    for (const ch of requestedChapters) {
      // OOS bucket → union of all raw chapters that mapped to OOS in any subject in scope.
      const isOOS = ch === OUT_OF_SYLLABUS;
      for (const s of subjectScope) {
        const subj = canonicalSubject(s);
        if (!subj) continue;
        const variants = aliases.get(`${subj}|${ch}`) ?? [];
        for (const v of variants) expanded.add(v);
      }
      if (!isOOS) expanded.add(ch); // honour exact-match too
    }
    sp.delete("chapters");
    sp.delete("chapter");
    for (const v of expanded) sp.append("chapters", v);
  }

  const where = buildWhere(sp);
  const order = parseOrder(sp.get("order"));
  const count = parseInt32(sp.get("count"), 10, 1, 5000);
  const targetMarksRaw = sp.get("target_marks_total");
  const targetMarks = targetMarksRaw ? parseFloatClamp(targetMarksRaw, 30, 1, 200) : null;
  // Repeat-chance bands live in the prediction JSON, not in Turso, so they are applied in-process.
  const tiers = parsePredictionTiers(getMulti(sp, "prob_tiers"));

  const orderBy = (() => {
    switch (order) {
      case "random":
        return [sql`RANDOM()`];
      case "oldest":
        return [asc(questions.year), asc(questions.id)];
      case "marks_asc":
        return [asc(questions.marks), desc(questions.year)];
      case "marks_desc":
        return [desc(questions.marks), desc(questions.year)];
      default:
        return [desc(questions.year), desc(questions.id)];
    }
  })();

  const baseQuery = db.select().from(questions);
  const filtered = where ? baseQuery.where(where) : baseQuery;

  let rows: Row[];
  if (order === "predicted" || tiers.size > 0) {
    let candidates = (await filtered.orderBy(...orderBy).limit(6000)) as Row[];
    if (tiers.size > 0) {
      // rows without a prediction (Hindi, English, out of syllabus) have no band and drop out
      candidates = candidates.filter((r) => {
        const pred = getQuestionPrediction(r.id);
        return pred !== null && tiers.has(predictionTierOf(pred.p));
      });
    }
    if (order === "predicted") candidates = rankByPrediction(candidates);
    rows = targetMarks != null ? packToMarks(candidates, targetMarks) : candidates.slice(0, count);
  } else if (targetMarks != null) {
    const candidates = (await filtered.orderBy(...orderBy).limit(500)) as Row[];
    rows = packToMarks(candidates, targetMarks);
  } else {
    rows = (await filtered.orderBy(...orderBy).limit(count)) as Row[];
  }

  const cache = await getProbCache();

  const payload: QuestionPayload[] = rows.map((r) => {
    const stats = r.subject && r.chapter ? cache.chapters[chapterKey(r.subject, r.chapter)] ?? null : null;
    let latex: string | null = r.questionLatex ?? null;
    if (!latex || latex === r.questionText) latex = null;
    return {
      id: r.id,
      subject: r.subject,
      year: r.year,
      paper_type: r.paperType,
      source_file: r.sourceFile,
      question_number: r.questionNumber,
      marks: r.marks,
      chapter: r.chapter,
      topic: r.topic,
      question_type: r.questionType,
      question_text: r.questionText,
      question_latex: latex,
      chapter_stats: stats,
      prediction: getQuestionPrediction(r.id),
    };
  });

  const response: QuestionsResponse = {
    questions: payload,
    count: payload.length,
    total_marks: payload.reduce((sum, q) => sum + (q.marks ?? 0), 0),
  };

  return NextResponse.json(response);
}
