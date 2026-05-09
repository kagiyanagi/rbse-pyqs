"use client";

import { Check, Languages, Lightbulb, NotebookPen, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProbabilityButton, ProbabilityPanel } from "./probability-badge";
import { BookmarkPicker } from "@/components/bookmark-picker";
import { BookmarkNoteDialog } from "@/components/bookmark-note-dialog";
import { MathContent } from "@/components/math-content";
import type { QuestionPayload } from "@/types";
import { useAnswered } from "@/hooks/use-answered";
import { useBookmarkNotes } from "@/hooks/use-bookmark-notes";
import { useDefaultLanguage, useLanguageOverrides, type LanguageMode } from "@/hooks/use-language";
import { cn } from "@/lib/utils";
import { normalizeNewlines, splitLanguages } from "@/lib/text";
import { useMemo, useState } from "react";

function langSymbol(mode: LanguageMode) {
  if (mode === "english") return "EN";
  if (mode === "hindi") return "हि";
  return "EN+हि";
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-300/70 text-foreground dark:bg-amber-400/40">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function QuestionCard({
  q,
  onSolution,
  searchQuery,
}: {
  q: QuestionPayload;
  onSolution: (q: QuestionPayload) => void;
  searchQuery: string;
}) {
  const { isAnswered, toggle: toggleAnswered } = useAnswered();
  const [defaultLang] = useDefaultLanguage();
  const { get, cycle } = useLanguageOverrides();
  const { get: getNote } = useBookmarkNotes();
  const note = getNote(q.id);
  const [noteOpen, setNoteOpen] = useState(false);
  const [probExpanded, setProbExpanded] = useState(false);
  const mode = get(q.id, defaultLang);
  const answered = isAnswered(q.id);

  const rawText = q.question_latex || q.question_text || "";
  const text = useMemo(() => normalizeNewlines(rawText), [rawText]);
  const split = useMemo(() => splitLanguages(q.question_text || ""), [q.question_text]);
  const splitLatex = useMemo(() => splitLanguages(q.question_latex || ""), [q.question_latex]);

  let display: string;
  if (mode === "both") display = text;
  else if (mode === "english")
    display = (q.question_latex ? splitLatex.english : split.english) || text;
  else display = (q.question_latex ? splitLatex.hindi : split.hindi) || text;

  return (
    <div
      className={cn(
        "group relative min-w-0 max-w-full overflow-hidden rounded-lg border bg-card p-4 shadow-sm",
        "transition-[opacity,box-shadow,border-color] duration-200 hover:border-foreground/15 hover:shadow-md",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
        answered && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {q.year && (
          <Badge variant="outline" className="font-mono">
            {q.year}
            {q.paper_type && q.paper_type !== "main" ? ` · ${q.paper_type}` : ""}
          </Badge>
        )}
        {q.subject && <Badge variant="secondary">{q.subject}</Badge>}
        {q.marks != null && (
          <Badge variant="default" className="bg-primary/80">
            {q.marks}m
          </Badge>
        )}
        {q.question_type && <Badge variant="outline">{q.question_type}</Badge>}
        {q.question_number && (
          <span className="text-muted-foreground">Q{q.question_number}</span>
        )}
        <div className="ml-auto">
          <ProbabilityButton
            stats={q.chapter_stats}
            expanded={probExpanded}
            onToggle={() => setProbExpanded((v) => !v)}
          />
        </div>
      </div>

      {probExpanded && q.chapter_stats && (
        <div className="mt-3">
          <ProbabilityPanel stats={q.chapter_stats} />
        </div>
      )}

      {(q.chapter || q.topic) && (
        <div className="mt-2 text-xs text-muted-foreground">
          {q.chapter}
          {q.topic ? ` · ${q.topic}` : ""}
        </div>
      )}

      <div
        className="question-text mt-3 max-w-full overflow-x-auto whitespace-pre-wrap break-words text-foreground"
        style={{ fontSize: "calc(1rem * var(--question-scale, 1))", lineHeight: 1.6 }}
      >
        {q.question_latex ? (
          <MathContent key={`${q.id}:${mode}:${display.length}`}>
            <span>{searchQuery ? highlight(display, searchQuery) : display}</span>
          </MathContent>
        ) : (
          <span>{searchQuery ? highlight(display, searchQuery) : display}</span>
        )}
      </div>

      {q.source_file && (
        <div className="mt-2 text-[11px] text-muted-foreground">📄 {q.source_file}</div>
      )}

      {note && (
        <div className="group/note mt-3 rounded-md border border-sky-500/30 bg-sky-500/5 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400">
              <NotebookPen className="h-3.5 w-3.5" />
              Note
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setNoteOpen(true)}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </div>
          <div className="solution-prose text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
            >
              {note}
            </ReactMarkdown>
          </div>
        </div>
      )}

      <BookmarkNoteDialog question={q} open={noteOpen} onOpenChange={setNoteOpen} />

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => onSolution(q)}
        >
          <Lightbulb className="h-4 w-4" />
          <span className="hidden sm:inline">Solution</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => cycle(q.id, defaultLang)}
        >
          <Languages className="h-4 w-4" />
          <span>{langSymbol(mode)}</span>
        </Button>
        <BookmarkPicker question={q} />
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 gap-1.5", answered && "text-emerald-500")}
          onClick={() => toggleAnswered(q.id)}
        >
          <Check className={cn("h-4 w-4", answered && "stroke-[3]")} />
          <span className="hidden sm:inline">{answered ? "Answered" : "Mark answered"}</span>
        </Button>
      </div>
    </div>
  );
}
