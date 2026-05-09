import { sqliteTable, integer, text, real, index } from "drizzle-orm/sqlite-core";

export const questions = sqliteTable(
  "questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subject: text("subject"),
    classLevel: text("class_level"),
    year: integer("year"),
    paperType: text("paper_type"),
    sourceFile: text("source_file"),
    questionNumber: text("question_number"),
    questionText: text("question_text"),
    questionLatex: text("question_latex"),
    marks: real("marks"),
    chapter: text("chapter"),
    topic: text("topic"),
    questionType: text("question_type"),
    inCurrentSyllabus: integer("in_current_syllabus").default(1),
    confidence: text("confidence").default("medium"),
    needsReview: integer("needs_review").default(0),
    extractedAt: text("extracted_at"),
  },
  (t) => [
    index("idx_subject_chapter").on(t.subject, t.chapter),
    index("idx_year").on(t.year),
    index("idx_in_syllabus").on(t.inCurrentSyllabus),
  ],
);

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
