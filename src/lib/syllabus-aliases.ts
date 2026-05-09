import { and, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { canonicalSubject, canonicalizeChapter } from "./syllabus";

// canonicalSubject + "|" + canonicalChapter  →  list of raw chapter strings in DB
let _aliasPromise: Promise<Map<string, string[]>> | null = null;

export async function getChapterAliases(): Promise<Map<string, string[]>> {
  if (_aliasPromise) return _aliasPromise;
  _aliasPromise = (async () => {
    const rows = await db
      .selectDistinct({
        subject: questions.subject,
        chapter: questions.chapter,
      })
      .from(questions)
      .where(and(isNotNull(questions.subject), isNotNull(questions.chapter)));

    const map = new Map<string, string[]>();
    for (const r of rows) {
      if (!r.subject || !r.chapter) continue;
      const subj = canonicalSubject(r.subject);
      if (!subj) continue;
      const canon = canonicalizeChapter(subj, r.chapter);
      const key = `${subj}|${canon}`;
      const arr = map.get(key) ?? [];
      arr.push(r.chapter);
      map.set(key, arr);
    }
    return map;
  })().catch((e) => {
    _aliasPromise = null;
    throw e;
  });
  return _aliasPromise;
}

export function invalidateChapterAliases() {
  _aliasPromise = null;
}
