import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { and, inArray, isNotNull, ne, type SQL } from "drizzle-orm";
import { getMulti } from "@/lib/filters";

export async function GET(request: NextRequest) {
  const subjects = getMulti(request.nextUrl.searchParams, "subjects", "subject");
  const chapters = getMulti(request.nextUrl.searchParams, "chapters", "chapter");

  const parts: SQL[] = [isNotNull(questions.topic), ne(questions.topic, "")];
  if (subjects.length) parts.push(inArray(questions.subject, subjects));
  if (chapters.length) parts.push(inArray(questions.chapter, chapters));

  const rows = await db
    .selectDistinct({ topic: questions.topic })
    .from(questions)
    .where(and(...parts))
    .orderBy(questions.topic);

  return NextResponse.json(rows.map((r) => r.topic).filter(Boolean));
}
