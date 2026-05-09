import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { isNotNull } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .selectDistinct({ subject: questions.subject })
    .from(questions)
    .where(isNotNull(questions.subject))
    .orderBy(questions.subject);
  return NextResponse.json(rows.map((r) => r.subject).filter(Boolean));
}
