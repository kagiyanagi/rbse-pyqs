"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Activity, BookmarkIcon, Moon, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FilterBar } from "@/components/browse/filter-bar";
import { ResultsList } from "@/components/browse/results-list";
import { BookmarksTab } from "@/components/bookmarks/bookmarks-tab";
import { SettingsModal } from "@/components/settings/settings-modal";
import { SolutionModal } from "@/components/solution/solution-modal";
import { TextSizePopover } from "@/components/text-size-popover";
import { AuthButton } from "@/components/auth/auth-button";
import { ProgressTab } from "@/components/progress/progress-tab";
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
  const [tab, setTab] = useState("browse");

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
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="browse" className="gap-2">
              <Search className="h-4 w-4" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-2">
              <BookmarkIcon className="h-4 w-4" />
              Bookmarks
            </TabsTrigger>
            <TabsTrigger value="progress" className="gap-2">
              <Activity className="h-4 w-4" />
              Progress
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
              <QuestionsSkeleton />
            ) : (
              <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
                <ResultsList
                  questions={questions}
                  totalMarks={totalMarks}
                  onSolution={setSolutionFor}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="bookmarks">
            <BookmarksTab onSolution={setSolutionFor} />
          </TabsContent>

          <TabsContent value="progress">
            <ProgressTab active={tab === "progress"} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-8 border-t px-4 pt-6 pb-24 text-center font-mono text-[10px] leading-relaxed text-muted-foreground/70 sm:pb-8 sm:text-[11px]">
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

function QuestionsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-4 w-24" />
      </div>
      <div className="skeleton h-9 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card p-4 shadow-sm"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-20" />
              <div className="skeleton ml-auto h-4 w-12" />
            </div>
            <div className="skeleton mb-2 h-4 w-[92%]" />
            <div className="skeleton mb-2 h-4 w-[78%]" />
            <div className="skeleton h-4 w-[55%]" />
          </div>
        ))}
      </div>
    </div>
  );
}
