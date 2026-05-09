import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { and, isNotNull } from "drizzle-orm";

export type ProgressIndex = {
  subjects: Record<string, Record<string, number[]>>;
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

  const subjects: Record<string, Record<string, number[]>> = {};
  for (const r of rows) {
    if (!r.subject || !r.chapter) continue;
    const subj = (subjects[r.subject] ??= {});
    (subj[r.chapter] ??= []).push(r.id);
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
