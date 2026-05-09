import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { and, inArray, isNotNull } from "drizzle-orm";
import { getMulti } from "@/lib/filters";

export async function GET(request: NextRequest) {
  const subjects = getMulti(request.nextUrl.searchParams, "subjects", "subject");
  const where = subjects.length
    ? and(isNotNull(questions.chapter), inArray(questions.subject, subjects))
    : isNotNull(questions.chapter);

  const rows = await db
    .selectDistinct({ chapter: questions.chapter })
    .from(questions)
    .where(where)
    .orderBy(questions.chapter);

  return NextResponse.json(rows.map((r) => r.chapter).filter(Boolean));
}
