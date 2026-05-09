"use client";

import { useEffect, useState } from "react";
import { Filter, RefreshCw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { MultiSelect } from "@/components/multi-select";
import { api, MARKS_BUCKETS, QUESTION_TYPES, type QuestionFilter } from "@/lib/api";

const ORDER_LABELS: Record<QuestionFilter["order"], string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  random: "Random",
  marks_asc: "Marks ↑",
  marks_desc: "Marks ↓",
};

const YEAR_MIN = 2010;
const YEAR_MAX = 2025;

export function FilterBar({
  filter,
  onFilterChange,
  onSubmit,
  loading,
}: {
  filter: QuestionFilter;
  onFilterChange: (f: QuestionFilter) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [byTarget, setByTarget] = useState(filter.target_marks_total != null);

  useEffect(() => {
    api.subjects().then(setSubjects).catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    api
      .chapters(filter.subjects)
      .then(setChapters)
      .catch(() => setChapters([]));
    if (filter.chapters.some((c) => !chapters.includes(c))) {
      onFilterChange({ ...filter, chapters: filter.chapters.filter((c) => chapters.includes(c)) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.subjects.join("|")]);

  useEffect(() => {
    api
      .topics(filter.subjects, filter.chapters)
      .then(setTopics)
      .catch(() => setTopics([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.subjects.join("|"), filter.chapters.join("|")]);

  const update = <K extends keyof QuestionFilter>(key: K, value: QuestionFilter[K]) =>
    onFilterChange({ ...filter, [key]: value });

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Filter className="h-4 w-4" />
        <h2 className="text-sm font-semibold">Filters</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MultiSelect
          label="Subjects"
          options={subjects}
          value={filter.subjects}
          onChange={(v) => update("subjects", v)}
        />
        <MultiSelect
          label="Chapters"
          options={chapters}
          value={filter.chapters}
          onChange={(v) => update("chapters", v)}
        />
        <MultiSelect
          label="Topics"
          options={topics}
          value={filter.topics}
          onChange={(v) => update("topics", v)}
        />
        <MultiSelect
          label="Marks"
          searchable={false}
          options={MARKS_BUCKETS}
          value={filter.marks_list}
          onChange={(v) => update("marks_list", v)}
        />
        <MultiSelect
          label="Question type"
          options={QUESTION_TYPES}
          value={filter.question_types}
          onChange={(v) => update("question_types", v)}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">From year: <span className="tabular-nums">{filter.min_year ?? YEAR_MIN}</span></Label>
          <Slider
            min={YEAR_MIN}
            max={YEAR_MAX}
            step={1}
            value={[filter.min_year ?? YEAR_MIN]}
            onValueChange={([v]) => update("min_year", v === YEAR_MIN ? null : v)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Sort</Label>
          <Select value={filter.order} onValueChange={(v) => update("order", v as QuestionFilter["order"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ORDER_LABELS) as QuestionFilter["order"][]).map((o) => (
                <SelectItem key={o} value={o}>
                  {ORDER_LABELS[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{byTarget ? "Target marks total" : "Number of questions"}</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">target</span>
              <Switch
                checked={byTarget}
                onCheckedChange={(v) => {
                  setByTarget(v);
                  update("target_marks_total", v ? 30 : null);
                }}
              />
            </div>
          </div>
          {byTarget ? (
            <Input
              type="number"
              min={1}
              max={200}
              value={filter.target_marks_total ?? 30}
              onChange={(e) =>
                update("target_marks_total", Math.max(1, Math.min(200, Number(e.target.value) || 1)))
              }
            />
          ) : (
            <Input
              type="number"
              min={1}
              max={500}
              value={filter.count}
              onChange={(e) =>
                update("count", Math.max(1, Math.min(500, Number(e.target.value) || 10)))
              }
            />
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
          Get questions
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            update("order", "random");
            onSubmit();
          }}
          disabled={loading}
        >
          <Shuffle className="mr-2 h-4 w-4" />
          Random
        </Button>
      </div>
    </div>
  );
}
