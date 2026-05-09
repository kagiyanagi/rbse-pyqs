"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { BookmarkIcon, Loader2, Moon, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FilterBar } from "@/components/browse/filter-bar";
import { ResultsList } from "@/components/browse/results-list";
import { BookmarksTab } from "@/components/bookmarks/bookmarks-tab";
import { SettingsModal } from "@/components/settings/settings-modal";
import { SolutionModal } from "@/components/solution/solution-modal";
import { TextSizePopover } from "@/components/text-size-popover";
import { AuthButton } from "@/components/auth/auth-button";
import { api, DEFAULT_FILTER, type QuestionFilter } from "@/lib/api";
import type { QuestionPayload, StatsResponse } from "@/types";

export default function HomePage() {
  const { theme, setTheme } = useTheme();
  const [filter, setFilter] = useState<QuestionFilter>(DEFAULT_FILTER);
  const [questions, setQuestions] = useState<QuestionPayload[]>([]);
  const [totalMarks, setTotalMarks] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [solutionFor, setSolutionFor] = useState<QuestionPayload | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null));
  }, []);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.questions(filter);
      setQuestions(res.questions);
      setTotalMarks(res.total_marks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/95">
        <div className="container mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <h1 className="text-base font-semibold sm:text-lg">RBSE Q-Bank</h1>
          {stats && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {stats.total.toLocaleString()} questions
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-5 w-5 dark:hidden" />
              <Moon className="hidden h-5 w-5 dark:block" />
            </Button>
            <SettingsModal />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-6">
        <Tabs defaultValue="browse" className="space-y-6">
          <TabsList>
            <TabsTrigger value="browse" className="gap-2">
              <Search className="h-4 w-4" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-2">
              <BookmarkIcon className="h-4 w-4" />
              Bookmarks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-6">
            <FilterBar filter={filter} onFilterChange={setFilter} onSubmit={submit} loading={loading} />
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {loading && questions.length === 0 ? (
              <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/30 p-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading questions…
              </div>
            ) : (
              <ResultsList
                questions={questions}
                totalMarks={totalMarks}
                onSolution={setSolutionFor}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
              />
            )}
          </TabsContent>

          <TabsContent value="bookmarks">
            <BookmarksTab onSolution={setSolutionFor} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-8 border-t px-4 pt-6 pb-24 text-center font-mono text-[11px] leading-relaxed text-muted-foreground sm:pb-8 sm:text-sm">
        <p className="mx-auto max-w-prose">
          Thanks for visiting! Make sure to give this a ★ on{" "}
          <a
            href="https://github.com/kagiyanagi/rbse-pyqs"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline hover:text-foreground"
          >
            GitHub
          </a>
          .
        </p>
        <p className="mx-auto mt-2 max-w-prose">
          Copyleft © [whatever-year-this-is]. Developed by{" "}
          <a
            href="https://github.com/kagiyanagi"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline hover:text-foreground"
          >
            @kagiyanagi
          </a>
          , with the help of{" "}
          <a
            href="https://claude.com/claude-code"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline hover:text-foreground"
          >
            Claude
          </a>
          .
        </p>
      </footer>

      <TextSizePopover />
      <SolutionModal question={solutionFor} onClose={() => setSolutionFor(null)} />
    </div>
  );
}
