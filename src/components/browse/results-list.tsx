"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuestionCard } from "./question-card";
import { useAnswered } from "@/hooks/use-answered";
import { useHideAnswered } from "@/hooks/use-settings";
import { useCardKeyboardNav } from "@/hooks/use-card-keyboard-nav";
import { cn } from "@/lib/utils";
import type { QuestionPayload } from "@/types";

const PAGE_SIZE = 30;

export function ResultsList({
  questions,
  totalMarks,
  onSolution,
  searchQuery,
  onSearchQueryChange,
}: {
  questions: QuestionPayload[];
  totalMarks: number;
  onSolution: (q: QuestionPayload) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
}) {
  const { isAnswered } = useAnswered();
  const [hideAnswered] = useHideAnswered();
  const [page, setPage] = useState(1);

  const visible = useMemo(
    () =>
      questions.filter((q) => {
        if (hideAnswered && isAnswered(q.id)) return false;
        if (!searchQuery) return true;
        const q1 = (q.question_text ?? "").toLowerCase();
        const q2 = (q.question_latex ?? "").toLowerCase();
        const needle = searchQuery.toLowerCase();
        return q1.includes(needle) || q2.includes(needle);
      }),
    [questions, hideAnswered, isAnswered, searchQuery],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [questions, searchQuery, hideAnswered]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = (page - 1) * PAGE_SIZE;
  const end = Math.min(visible.length, start + PAGE_SIZE);
  const pageSlice = visible.slice(start, end);
  const pageIds = useMemo(() => pageSlice.map((q) => q.id), [pageSlice]);
  const { focusedId } = useCardKeyboardNav(pageIds);

  const goTo = (n: number) => {
    const clamped = Math.max(1, Math.min(totalPages, n));
    setPage(clamped);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const pageNumbers = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{visible.length}</span>
          {questions.length !== visible.length ? ` of ${questions.length}` : ""} ·{" "}
          <span className="font-medium text-foreground">{totalMarks}</span> marks total
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search in results…"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-12 text-center text-muted-foreground">
          No questions to show. Adjust filters and try again.
        </div>
      ) : (
        <>
          <div className="grid min-w-0 gap-4">
            {pageSlice.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                onSolution={onSolution}
                searchQuery={searchQuery}
                focused={focusedId === q.id}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              className="flex flex-wrap items-center justify-center gap-1 border-t pt-4"
              aria-label="Pagination"
            >
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => goTo(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Prev</span>
              </Button>
              {pageNumbers.map((p, i) =>
                p === "…" ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-2 text-sm text-muted-foreground select-none"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "ghost"}
                    size="sm"
                    className={cn("min-w-9", p === page && "pointer-events-none")}
                    onClick={() => goTo(p)}
                    aria-current={p === page ? "page" : undefined}
                  >
                    {p}
                  </Button>
                ),
              )}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => goTo(page + 1)}
                disabled={page === totalPages}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function buildPageList(current: number, total: number): Array<number | "…"> {
  const set = new Set<number>([1, total]);
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= total) set.add(i);
  }
  const sorted = Array.from(set).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}
