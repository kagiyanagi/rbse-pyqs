"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eraser, Lightbulb, NotebookPen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isBuiltinCategory, useBookmarks } from "@/hooks/use-bookmarks";
import { useAnswered } from "@/hooks/use-answered";
import { useBookmarkNotes } from "@/hooks/use-bookmark-notes";
import { useSolutionCache } from "@/hooks/use-solutions";
import { useCardKeyboardNav } from "@/hooks/use-card-keyboard-nav";
import { QuestionCard } from "@/components/browse/question-card";
import { MultiSelect } from "@/components/multi-select";
import { api } from "@/lib/api";
import type { QuestionPayload } from "@/types";

const ANSWERED = "✅ Answered";
const NOTES = "📝 Notes";
const SOLUTIONS = "💡 Solutions";

type SortMode = "lastAdded" | "firstAdded" | "year" | "random";

const SORT_LABELS: Record<SortMode, string> = {
  lastAdded: "Last added",
  firstAdded: "First added",
  year: "By year",
  random: "Random",
};

type ConfirmKind = "clear" | "delete";
type Confirm = {
  kind: ConfirmKind;
  category: string;
  count: number;
};

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function BookmarksTab({ onSolution }: { onSolution: (q: QuestionPayload) => void }) {
  const { state, removeCategory, addCategory, clearCategory } = useBookmarks();
  const { ids: answeredIds, clear: clearAnswered } = useAnswered();
  const { ids: noteIds, clearAll: clearAllNotes } = useBookmarkNotes();
  const { ids: solutionIds, clear: clearAllSolutions, count: solutionCount } = useSolutionCache();
  const [active, setActive] = useState<string>(state.categories[0] ?? ANSWERED);
  const [newCat, setNewCat] = useState("");
  const [questions, setQuestions] = useState<QuestionPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [sort, setSort] = useState<SortMode>("lastAdded");
  const [shuffleTick, setShuffleTick] = useState(0);
  const [filterSubjects, setFilterSubjects] = useState<string[]>([]);
  const [filterChapters, setFilterChapters] = useState<string[]>([]);

  const allIds: number[] = useMemo(() => {
    if (active === ANSWERED) return answeredIds;
    if (active === NOTES) return noteIds;
    if (active === SOLUTIONS) return solutionIds;
    return state.byCategory[active] ?? [];
  }, [active, state, answeredIds, noteIds, solutionIds]);

  useEffect(() => {
    setQuestions([]);
    if (allIds.length === 0) return;
    setLoading(true);
    api
      .questions({
        subjects: [],
        chapters: [],
        topics: [],
        marks_list: [],
        question_types: [],
        min_year: null,
        max_year: null,
        order: "newest",
        count: 5000,
        target_marks_total: null,
      })
      .then((res) => {
        const set = new Set(allIds);
        setQuestions(res.questions.filter((q) => set.has(q.id)));
      })
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [allIds]);

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "delete") {
      removeCategory(confirm.category);
      if (active === confirm.category) setActive(ANSWERED);
    } else {
      if (confirm.category === ANSWERED) clearAnswered();
      else if (confirm.category === NOTES) clearAllNotes();
      else if (confirm.category === SOLUTIONS) clearAllSolutions();
      else clearCategory(confirm.category);
    }
    setConfirm(null);
  };

  const activeCount =
    active === ANSWERED
      ? answeredIds.length
      : active === NOTES
        ? noteIds.length
        : active === SOLUTIONS
          ? solutionCount
          : state.byCategory[active]?.length ?? 0;

  const orderedQuestions = useMemo(() => {
    if (questions.length === 0) return questions;
    const byId = new Map(questions.map((q) => [q.id, q]));
    if (sort === "year") {
      return [...questions].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    }
    if (sort === "random") {
      // Reference shuffleTick so reshuffles are explicit.
      void shuffleTick;
      return shuffle(questions);
    }
    const ordered =
      sort === "lastAdded" ? [...allIds].reverse() : allIds;
    const result: QuestionPayload[] = [];
    for (const id of ordered) {
      const q = byId.get(id);
      if (q) result.push(q);
    }
    return result;
  }, [questions, allIds, sort, shuffleTick]);

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    for (const q of questions) if (q.subject) set.add(q.subject);
    return [...set].sort();
  }, [questions]);

  const effectiveSubjects = useMemo(() => {
    if (filterSubjects.length === 0) return filterSubjects;
    const valid = new Set(availableSubjects);
    return filterSubjects.filter((s) => valid.has(s));
  }, [filterSubjects, availableSubjects]);

  const availableChapters = useMemo(() => {
    const set = new Set<string>();
    const subjFilter = effectiveSubjects.length > 0 ? new Set(effectiveSubjects) : null;
    for (const q of questions) {
      if (!q.chapter) continue;
      if (subjFilter && (!q.subject || !subjFilter.has(q.subject))) continue;
      set.add(q.chapter);
    }
    return [...set].sort();
  }, [questions, effectiveSubjects]);

  const effectiveChapters = useMemo(() => {
    if (filterChapters.length === 0) return filterChapters;
    const valid = new Set(availableChapters);
    return filterChapters.filter((c) => valid.has(c));
  }, [filterChapters, availableChapters]);

  const visibleQuestions = useMemo(() => {
    if (effectiveSubjects.length === 0 && effectiveChapters.length === 0) return orderedQuestions;
    const subjSet = effectiveSubjects.length > 0 ? new Set(effectiveSubjects) : null;
    const chapSet = effectiveChapters.length > 0 ? new Set(effectiveChapters) : null;
    return orderedQuestions.filter((q) => {
      if (subjSet && (!q.subject || !subjSet.has(q.subject))) return false;
      if (chapSet && (!q.chapter || !chapSet.has(q.chapter))) return false;
      return true;
    });
  }, [orderedQuestions, effectiveSubjects, effectiveChapters]);

  const visibleIds = useMemo(() => visibleQuestions.map((q) => q.id), [visibleQuestions]);
  const { focusedId } = useCardKeyboardNav(visibleIds);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3 rounded-lg border bg-card p-3">
        <div className="text-sm font-semibold">Categories</div>
        <div className="space-y-1">
          {state.categories.map((c) => {
            const count = state.byCategory[c]?.length ?? 0;
            const builtin = isBuiltinCategory(c);
            return (
              <div key={c} className="group flex items-center">
                <button
                  className={`flex flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                    active === c ? "bg-accent" : ""
                  }`}
                  onClick={() => setActive(c)}
                >
                  <span>{c}</span>
                  <span className="text-xs text-muted-foreground">{count}</span>
                </button>
                {!builtin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    aria-label={`Delete category ${c}`}
                    onClick={() => setConfirm({ kind: "delete", category: c, count })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
          <button
            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
              active === ANSWERED ? "bg-accent" : ""
            }`}
            onClick={() => setActive(ANSWERED)}
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Answered
            </span>
            <span className="text-xs text-muted-foreground">{answeredIds.length}</span>
          </button>
          <button
            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
              active === NOTES ? "bg-accent" : ""
            }`}
            onClick={() => setActive(NOTES)}
          >
            <span className="flex items-center gap-1.5">
              <NotebookPen className="h-3.5 w-3.5 text-sky-500" />
              Notes
            </span>
            <span className="text-xs text-muted-foreground">{noteIds.length}</span>
          </button>
          <button
            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
              active === SOLUTIONS ? "bg-accent" : ""
            }`}
            onClick={() => setActive(SOLUTIONS)}
          >
            <span className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              Solutions
            </span>
            <span className="text-xs text-muted-foreground">{solutionCount}</span>
          </button>
        </div>
        <div className="flex items-center gap-1 border-t pt-3">
          <Input
            placeholder="New category"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addCategory(newCat);
                setNewCat("");
              }
            }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              addCategory(newCat);
              setNewCat("");
            }}
          >
            Add
          </Button>
        </div>
      </aside>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{active}</span> ·{" "}
            {visibleQuestions.length}
            {visibleQuestions.length !== questions.length ? ` of ${questions.length}` : ""} question
            {visibleQuestions.length === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={sort}
              onValueChange={(v) => {
                const next = v as SortMode;
                setSort(next);
                if (next === "random") setShuffleTick((t) => t + 1);
              }}
            >
              <SelectTrigger className="h-8 w-auto gap-1.5 px-2.5 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortMode[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SORT_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sort === "random" && questions.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShuffleTick((t) => t + 1)}
                title="Reshuffle"
              >
                Shuffle
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={activeCount === 0}
              onClick={() =>
                setConfirm({ kind: "clear", category: active, count: activeCount })
              }
            >
              <Eraser className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
        {questions.length > 0 && (availableSubjects.length > 0 || availableChapters.length > 0) && (
          <div className="mb-3 flex flex-wrap items-end gap-2">
            {availableSubjects.length > 0 && (
              <MultiSelect
                label="Subject"
                options={availableSubjects}
                value={effectiveSubjects}
                onChange={setFilterSubjects}
                className="min-w-[160px] flex-1 sm:flex-none sm:w-[200px]"
              />
            )}
            {availableChapters.length > 0 && (
              <MultiSelect
                label="Chapter"
                options={availableChapters}
                value={effectiveChapters}
                onChange={setFilterChapters}
                className="min-w-[160px] flex-1 sm:flex-none sm:w-[240px]"
              />
            )}
            {(effectiveSubjects.length > 0 || effectiveChapters.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setFilterSubjects([]);
                  setFilterChapters([]);
                }}
              >
                Reset
              </Button>
            )}
          </div>
        )}
        {loading ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Loading…
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-muted-foreground">
            {active === NOTES
              ? "No notes yet. Open a question's bookmark menu and choose “Add note” to start one."
              : active === ANSWERED
                ? "No answered questions yet. Mark one from the Browse tab."
                : active === SOLUTIONS
                  ? "No solutions yet. Generate one for any question and it'll show up here."
                  : "Nothing here yet. Bookmark questions from the Browse tab."}
          </div>
        ) : visibleQuestions.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-muted-foreground">
            No questions match the current subject/chapter filter.
          </div>
        ) : (
          <div className="grid min-w-0 gap-4">
            {visibleQuestions.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                onSolution={onSolution}
                searchQuery=""
                focused={focusedId === q.id}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirm != null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete"
                ? `Delete "${confirm.category}"?`
                : `Clear "${confirm?.category ?? ""}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete"
                ? `This removes the category and its ${confirm.count} bookmark${
                    confirm.count === 1 ? "" : "s"
                  }. The questions themselves are not deleted.`
                : confirm?.category === NOTES
                  ? `This deletes all ${confirm.count} note${
                      confirm.count === 1 ? "" : "s"
                    }. The questions themselves are not deleted.`
                  : confirm?.category === ANSWERED
                    ? `This unmarks all ${confirm.count} answered question${
                        confirm.count === 1 ? "" : "s"
                      }.`
                    : confirm?.category === SOLUTIONS
                      ? `This clears all ${confirm.count} cached solution${
                          confirm.count === 1 ? "" : "s"
                        }. The questions themselves are not deleted.`
                      : `This removes all ${confirm?.count ?? 0} bookmark${
                          confirm?.count === 1 ? "" : "s"
                        } from this category. The category itself is kept.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={runConfirm}>
              {confirm?.kind === "delete" ? "Delete" : "Clear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
