import "dotenv/config";
import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import path from "node:path";

const SOURCE = path.resolve(__dirname, "..", "..", "questions.db");
const BATCH = 200;

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const COLS = [
  "id",
  "subject",
  "class_level",
  "year",
  "paper_type",
  "source_file",
  "question_number",
  "question_text",
  "question_latex",
  "marks",
  "chapter",
  "topic",
  "question_type",
  "in_current_syllabus",
  "confidence",
  "needs_review",
  "extracted_at",
] as const;

async function main() {
  console.log(`Reading ${SOURCE}`);
  const src = new Database(SOURCE, { readonly: true, fileMustExist: true });
  const total = src.prepare("SELECT COUNT(*) AS n FROM questions").get() as { n: number };
  console.log(`Source has ${total.n} rows`);

  const existing = await turso.execute("SELECT COUNT(*) AS n FROM questions");
  const existingCount = Number((existing.rows[0] as Record<string, unknown>).n);
  if (existingCount > 0) {
    console.log(`Target already has ${existingCount} rows. Truncating.`);
    await turso.execute("DELETE FROM questions");
  }

  const stmt = src.prepare(`SELECT ${COLS.join(", ")} FROM questions ORDER BY id`);
  const placeholders = COLS.map(() => "?").join(", ");
  const insertSQL = `INSERT INTO questions (${COLS.join(", ")}) VALUES (${placeholders})`;

  let buffered: Array<{ sql: string; args: unknown[] }> = [];
  let inserted = 0;

  for (const row of stmt.iterate() as IterableIterator<Record<string, unknown>>) {
    const args = COLS.map((c) => {
      const v = row[c];
      // better-sqlite3 returns BigInt for some integer columns; libSQL accepts BigInt but
      // safer to coerce small ints to Number to avoid edge serialization weirdness.
      if (typeof v === "bigint") return Number(v);
      return v ?? null;
    });
    buffered.push({ sql: insertSQL, args });

    if (buffered.length >= BATCH) {
      await turso.batch(buffered, "write");
      inserted += buffered.length;
      process.stdout.write(`  inserted ${inserted}/${total.n}\r`);
      buffered = [];
    }
  }
  if (buffered.length) {
    await turso.batch(buffered, "write");
    inserted += buffered.length;
  }
  process.stdout.write("\n");

  const after = await turso.execute("SELECT COUNT(*) AS n FROM questions");
  const afterCount = Number((after.rows[0] as Record<string, unknown>).n);
  console.log(`Done. Target now has ${afterCount} rows.`);

  if (afterCount !== total.n) {
    throw new Error(`Row count mismatch: source ${total.n}, target ${afterCount}`);
  }

  const sample = await turso.execute("SELECT id, subject, year, marks FROM questions WHERE id IN (1, 100, 1000) ORDER BY id");
  console.log("Sample rows:", sample.rows);

  src.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
