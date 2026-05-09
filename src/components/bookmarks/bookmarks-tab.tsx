"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eraser, NotebookPen, Trash2 } from "lucide-react";
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
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useAnswered } from "@/hooks/use-answered";
import { useBookmarkNotes } from "@/hooks/use-bookmark-notes";
import { QuestionCard } from "@/components/browse/question-card";
import { api } from "@/lib/api";
import type { QuestionPayload } from "@/types";

const ANSWERED = "✅ Answered";
const NOTES = "📝 Notes";

type ConfirmKind = "clear" | "delete";
type Confirm = {
  kind: ConfirmKind;
  category: string;
  count: number;
};

export function BookmarksTab({ onSolution }: { onSolution: (q: QuestionPayload) => void }) {
  const { state, removeCategory, addCategory, clearCategory } = useBookmarks();
  const { ids: answeredIds, clear: clearAnswered } = useAnswered();
  const { ids: noteIds, clearAll: clearAllNotes } = useBookmarkNotes();
  const [active, setActive] = useState<string>(state.categories[0] ?? ANSWERED);
  const [newCat, setNewCat] = useState("");
  const [questions, setQuestions] = useState<QuestionPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const allIds: number[] = useMemo(() => {
    if (active === ANSWERED) return answeredIds;
    if (active === NOTES) return noteIds;
    return state.byCategory[active] ?? [];
  }, [active, state, answeredIds, noteIds]);

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
      else clearCategory(confirm.category);
    }
    setConfirm(null);
  };

  const activeCount =
    active === ANSWERED
      ? answeredIds.length
      : active === NOTES
        ? noteIds.length
        : state.byCategory[active]?.length ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3 rounded-lg border bg-card p-3">
        <div className="text-sm font-semibold">Categories</div>
        <div className="space-y-1">
          {state.categories.map((c) => {
            const count = state.byCategory[c]?.length ?? 0;
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  aria-label={`Delete category ${c}`}
                  onClick={() => setConfirm({ kind: "delete", category: c, count })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{active}</span> · {questions.length} question
            {questions.length === 1 ? "" : "s"}
          </div>
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
                : "Nothing here yet. Bookmark questions from the Browse tab."}
          </div>
        ) : (
          <div className="grid min-w-0 gap-4">
            {questions.map((q) => (
              <QuestionCard key={q.id} q={q} onSolution={onSolution} searchQuery="" />
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
