import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { and, isNotNull } from "drizzle-orm";
import {
  CANONICAL_CHAPTERS,
  CANONICAL_SUBJECTS,
  OUT_OF_SYLLABUS,
  canonicalSubject,
  canonicalizeChapter,
  type CanonicalSubject,
} from "@/lib/syllabus";

export type SubjectGroup = {
  currentSyllabus: Record<string, number[]>;
  outOfSyllabus: number[];
};

export type ProgressIndex = {
  subjects: Record<string, SubjectGroup>;
};

export async function GET() {
  const rows = await db
    .select({
      id: questions.id,
      subject: questions.subject,
      chapter: questions.chapter,
    })
    .from(questions)
    .where(and(isNotNull(questions.subject), isNotNull(questions.chapter)));

  const subjects = {} as Record<CanonicalSubject, SubjectGroup>;
  for (const subj of CANONICAL_SUBJECTS) {
    subjects[subj] = { currentSyllabus: {}, outOfSyllabus: [] };
    for (const c of CANONICAL_CHAPTERS[subj]) subjects[subj].currentSyllabus[c] = [];
  }

  for (const r of rows) {
    if (!r.subject || !r.chapter) continue;
    const subj = canonicalSubject(r.subject);
    if (!subj) continue;
    const canon = canonicalizeChapter(subj, r.chapter);
    if (canon === OUT_OF_SYLLABUS) {
      subjects[subj].outOfSyllabus.push(r.id);
    } else {
      const arr = subjects[subj].currentSyllabus[canon] ??= [];
      arr.push(r.id);
    }
  }

  return NextResponse.json(
    { subjects } satisfies ProgressIndex,
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
