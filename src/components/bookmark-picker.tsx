"use client";

import { useState } from "react";
import { Bookmark, NotebookPen, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { BookmarkNoteDialog } from "@/components/bookmark-note-dialog";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useBookmarkNotes } from "@/hooks/use-bookmark-notes";
import { cn } from "@/lib/utils";
import type { QuestionPayload } from "@/types";

export function BookmarkPicker({ question }: { question: QuestionPayload }) {
  const { state, toggle, addCategory } = useBookmarks();
  const { get: getNote } = useBookmarkNotes();
  const [name, setName] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const id = question.id;
  const isBookmarked = state.categories.some((c) => state.byCategory[c]?.includes(id));
  const hasNote = !!getNote(id);

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 gap-1.5", isBookmarked && "text-amber-500")}
            aria-label="Bookmark"
          >
            <Bookmark className={cn("h-4 w-4", isBookmarked && "fill-current")} />
            <span className="hidden sm:inline">Bookmark</span>
            {hasNote && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="end">
          <div className="space-y-1">
            {state.categories.map((c) => {
              const checked = state.byCategory[c]?.includes(id) ?? false;
              return (
                <label
                  key={c}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(c, id)} />
                  <span className="text-sm">{c}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-1 border-t pt-2">
            <Input
              placeholder="New category"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addCategory(name);
                  setName("");
                }
              }}
              className="h-8 text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                addCategory(name);
                setName("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2"
              onClick={() => {
                setPopoverOpen(false);
                setNoteOpen(true);
              }}
            >
              <NotebookPen className="h-4 w-4" />
              {hasNote ? "Edit note" : "Add note"}
              {hasNote && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
              )}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <BookmarkNoteDialog question={question} open={noteOpen} onOpenChange={setNoteOpen} />
    </>
  );
}
