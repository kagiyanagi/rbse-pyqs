import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { and, inArray, isNotNull } from "drizzle-orm";
import { getMulti } from "@/lib/filters";
import {
  CANONICAL_CHAPTERS,
  CANONICAL_SUBJECTS,
  canonicalSubject,
  canonicalizeChapter,
  OUT_OF_SYLLABUS,
} from "@/lib/syllabus";

export async function GET(request: NextRequest) {
  const subjects = getMulti(request.nextUrl.searchParams, "subjects", "subject");

  // If the caller scoped to canonical subjects, return canonical lists directly.
  const canonicalAsked = subjects
    .map((s) => canonicalSubject(s))
    .filter((s): s is NonNullable<ReturnType<typeof canonicalSubject>> => s !== null);

  if (canonicalAsked.length > 0 && canonicalAsked.length === subjects.length) {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const subj of canonicalAsked) {
      for (const c of CANONICAL_CHAPTERS[subj]) {
        if (!seen.has(c)) {
          seen.add(c);
          out.push(c);
        }
      }
    }
    out.sort((a, b) => a.localeCompare(b));
    return NextResponse.json(out);
  }

  // Otherwise return the union of canonical chapters across all subjects, plus
  // any non-canonical names from the DB collapsed into a single OOS entry if any.
  const where = subjects.length
    ? and(isNotNull(questions.chapter), inArray(questions.subject, subjects))
    : isNotNull(questions.chapter);

  const rows = await db
    .selectDistinct({ subject: questions.subject, chapter: questions.chapter })
    .from(questions)
    .where(where);

  const seen = new Set<string>();
  const out: string[] = [];
  let hasOOS = false;

  for (const subj of CANONICAL_SUBJECTS) {
    for (const c of CANONICAL_CHAPTERS[subj]) {
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
  }

  for (const r of rows) {
    if (!r.subject || !r.chapter) continue;
    const subj = canonicalSubject(r.subject);
    if (!subj) {
      if (!seen.has(r.chapter)) {
        seen.add(r.chapter);
        out.push(r.chapter);
      }
      continue;
    }
    const canon = canonicalizeChapter(subj, r.chapter);
    if (canon === OUT_OF_SYLLABUS) hasOOS = true;
  }

  out.sort((a, b) => a.localeCompare(b));
  if (hasOOS) out.push(OUT_OF_SYLLABUS);
  return NextResponse.json(out);
}
