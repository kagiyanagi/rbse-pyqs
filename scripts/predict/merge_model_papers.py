#!/usr/bin/env python3
"""Append rows extracted from model papers (main.py output, unfiltered-latex.db) to a copy of questions.db.

Usage: python scripts/predict/merge_model_papers.py --base ../rbse-qbank/questions.db --extra <unfiltered-latex.db> --out ../questions.db
Rows are appended with fresh ids after the current max id; source_files already present in the base are skipped, so the
script is idempotent. The output is what scripts/migrate-from-sqlite.ts pushes to Turso."""
import argparse, os, shutil, sqlite3

COLS = ["subject", "class_level", "year", "paper_type", "source_file", "question_number", "question_text", "question_latex", "marks",
        "chapter", "topic", "question_type", "in_current_syllabus", "confidence", "needs_review", "extracted_at"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--extra", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    if os.path.abspath(args.out) != os.path.abspath(args.base):
        shutil.copyfile(args.base, args.out)
    con = sqlite3.connect(args.out)
    con.execute("ATTACH DATABASE ? AS extra", (args.extra,))
    have = {r[0] for r in con.execute("SELECT DISTINCT source_file FROM questions")}
    extra_files = [r[0] for r in con.execute("SELECT DISTINCT source_file FROM extra.questions ORDER BY 1")]
    new_files = [f for f in extra_files if f not in have]
    cols = ", ".join(COLS)
    n = 0
    for f in new_files:
        cur = con.execute(f"INSERT INTO questions ({cols}) SELECT {cols} FROM extra.questions WHERE source_file=? ORDER BY id", (f,))
        n += cur.rowcount
        print(f"  + {f}: {cur.rowcount} rows")
    con.commit()
    total = con.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    print(f"appended {n} rows from {len(new_files)} files (skipped {len(extra_files)-len(new_files)} already present); total {total} rows -> {args.out}")


if __name__ == "__main__":
    main()
