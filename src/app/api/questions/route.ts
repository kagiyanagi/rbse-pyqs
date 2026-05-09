import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { sql, asc, desc } from "drizzle-orm";
import { buildWhere, parseInt32, parseFloatClamp, parseOrder } from "@/lib/filters";
import { getProbCache } from "@/lib/prob-cache";
import { chapterKey, type QuestionPayload, type QuestionsResponse } from "@/types";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const where = buildWhere(sp);
  const order = parseOrder(sp.get("order"));
  const count = parseInt32(sp.get("count"), 10, 1, 5000);
  const targetMarksRaw = sp.get("target_marks_total");

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

  type Row = typeof questions.$inferSelect;
  let rows: Row[];
  if (targetMarksRaw) {
    const target = parseFloatClamp(targetMarksRaw, 30, 1, 200);
    const candidates = (await filtered.orderBy(...orderBy).limit(500)) as Row[];
    const selected: Row[] = [];
    let total = 0;
    for (const r of candidates) {
      const m = r.marks ?? 0;
      if (total + m > target + 0.5) continue;
      selected.push(r);
      total += m;
      if (total >= target - 0.5) break;
    }
    rows = selected;
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
    };
  });

  const response: QuestionsResponse = {
    questions: payload,
    count: payload.length,
    total_marks: payload.reduce((sum, q) => sum + (q.marks ?? 0), 0),
  };

  return NextResponse.json(response);
}
