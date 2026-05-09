import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { StatsResponse } from "@/types";

export async function GET() {
  const totalRow = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(questions);
  const total = Number(totalRow[0]?.n ?? 0);

  const bySubjectRows = await db
    .select({ subject: questions.subject, n: sql<number>`COUNT(*)` })
    .from(questions)
    .groupBy(questions.subject);
  const by_subject: Record<string, number> = {};
  for (const r of bySubjectRows) {
    if (r.subject) by_subject[r.subject] = Number(r.n);
  }

  const response: StatsResponse = { total, by_subject, has_latex: true };
  return NextResponse.json(response);
}
