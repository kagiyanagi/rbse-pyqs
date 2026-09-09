"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Printer, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { useBookmarkNotes } from "@/hooks/use-bookmark-notes";
import { useSolutionCache } from "@/hooks/use-solutions";
import { useDefaultLanguage, useLanguageOverrides, type LanguageMode } from "@/hooks/use-language";
import {
  buildLatex,
  buildMarkdown,
  downloadTextFile,
  exportFilename,
  totalMarksOf,
  type ExportItem,
  type ExportOptions,
} from "@/lib/export";
import type { QuestionPayload } from "@/types";
import { PrintDocument } from "./print-document";

/** Above this many questions a print job gets slow enough to warn about. */
const PRINT_WARN_THRESHOLD = 250;

type LanguageChoice = LanguageMode | "auto";

const LANGUAGE_LABELS: Record<LanguageChoice, string> = {
  auto: "Match each card",
  english: "English only",
  hindi: "हिन्दी only",
  both: "English + हिन्दी",
};

const ANSWER_SPACE_LABELS: Record<string, string> = {
  "0": "None",
  "2": "Small (2 cm)",
  "4": "Medium (4 cm)",
  "7": "Large (7 cm)",
};

export function ExportDialog({
  questions,
  defaultTitle = "RBSE Question Bank",
  triggerLabel = "Export",
  triggerClassName,
}: {
  questions: QuestionPayload[];
  defaultTitle?: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const toast = useToast();
  const { get: getNote } = useBookmarkNotes();
  const { get: getSolution } = useSolutionCache();
  const [defaultLang] = useDefaultLanguage();
  const { get: getLangOverride } = useLanguageOverrides();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [language, setLanguage] = useState<LanguageChoice>("auto");
  const [includeMeta, setIncludeMeta] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeSolutions, setIncludeSolutions] = useState(false);
  const [answerSpace, setAnswerSpace] = useState("0");

  const [printPayload, setPrintPayload] = useState<{
    items: ExportItem[];
    options: ExportOptions;
  } | null>(null);
  const printingRef = useRef(false);

  const options: ExportOptions = useMemo(
    () => ({
      title: title.trim() || defaultTitle,
      language: language === "auto" ? defaultLang : language,
      includeMeta,
      includeNotes,
      includeSolutions,
      answerSpaceCm: Number(answerSpace) || 0,
    }),
    [title, defaultTitle, language, defaultLang, includeMeta, includeNotes, includeSolutions, answerSpace],
  );

  const items: ExportItem[] = useMemo(
    () =>
      questions.map((q) => ({
        question: q,
        note: getNote(q.id) || undefined,
        solution: getSolution(q.id) || undefined,
        language: language === "auto" ? getLangOverride(q.id, defaultLang) : undefined,
      })),
    [questions, getNote, getSolution, language, getLangOverride, defaultLang],
  );

  const solutionCount = useMemo(() => items.filter((it) => it.solution).length, [items]);
  const noteCount = useMemo(() => items.filter((it) => it.note).length, [items]);

  // ---- print ----

  useEffect(() => {
    if (!printPayload || printingRef.current) return;
    printingRef.current = true;

    let cancelled = false;
    const cleanup = () => {
      if (cancelled) return;
      cancelled = true;
      window.removeEventListener("afterprint", cleanup);
      printingRef.current = false;
      setPrintPayload(null);
    };

    window.addEventListener("afterprint", cleanup);

    // KaTeX typesets during the React commit, but the fonts it measures against
    // may still be loading, and the browser needs a frame to lay the portal out.
    const run = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        // font loading API unavailable; fall through to the rAF wait
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;
      window.print();
      // Safari never fires afterprint in some configurations.
      window.setTimeout(cleanup, 1000);
    };
    void run();

    return () => {
      window.removeEventListener("afterprint", cleanup);
    };
  }, [printPayload]);

  const startPrint = useCallback(() => {
    if (items.length === 0) return;
    setOpen(false);
    setPrintPayload({ items, options });
  }, [items, options]);

  // ---- file downloads ----

  const downloadMarkdown = () => {
    downloadTextFile(exportFilename("md"), "text/markdown", buildMarkdown(items, options));
    toast.success("Markdown saved", `${items.length} questions written to your downloads.`);
    setOpen(false);
  };

  const downloadLatex = () => {
    downloadTextFile(exportFilename("tex"), "application/x-tex", buildLatex(items, options));
    toast.success("LaTeX saved", "Compile the .tex file to get a typeset PDF.");
    setOpen(false);
  };

  const disabled = questions.length === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className={triggerClassName} disabled={disabled}>
            <Download className="mr-1.5 h-4 w-4" />
            {triggerLabel}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Export questions</DialogTitle>
            <DialogDescription>
              {questions.length} question{questions.length === 1 ? "" : "s"} ·{" "}
              {totalMarksOf(items)} marks. Math is typeset with KaTeX, so formulas keep
              their formatting in every format below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="export-title">Title</Label>
              <Input
                id="export-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={defaultTitle}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="export-language">Language</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as LanguageChoice)}
                >
                  <SelectTrigger id="export-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LANGUAGE_LABELS) as LanguageChoice[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {LANGUAGE_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="export-space">Answer space</Label>
                <Select value={answerSpace} onValueChange={setAnswerSpace}>
                  <SelectTrigger id="export-space">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(ANSWER_SPACE_LABELS).map((k) => (
                      <SelectItem key={k} value={k}>
                        {ANSWER_SPACE_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <fieldset className="space-y-2.5">
              <legend className="mb-1 text-sm font-medium">Include</legend>
              <CheckRow
                id="export-meta"
                checked={includeMeta}
                onChange={setIncludeMeta}
                label="Chapter and topic"
              />
              <CheckRow
                id="export-notes"
                checked={includeNotes}
                onChange={setIncludeNotes}
                label="My notes"
                hint={noteCount === 0 ? "none saved for these questions" : `${noteCount} available`}
                disabled={noteCount === 0}
              />
              <CheckRow
                id="export-solutions"
                checked={includeSolutions}
                onChange={setIncludeSolutions}
                label="Saved AI solutions"
                hint={
                  solutionCount === 0
                    ? "none generated yet"
                    : `${solutionCount} of ${items.length} available`
                }
                disabled={solutionCount === 0}
              />
            </fieldset>

            {questions.length > PRINT_WARN_THRESHOLD && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                {questions.length} questions is a large print job. Rendering it may take a
                few seconds and the browser may become unresponsive while it works.
              </p>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadMarkdown}>
                <FileText className="mr-1.5 h-4 w-4" />
                Markdown
              </Button>
              <Button variant="outline" size="sm" onClick={downloadLatex}>
                <Sigma className="mr-1.5 h-4 w-4" />
                LaTeX
              </Button>
            </div>
            <Button onClick={startPrint}>
              <Printer className="mr-1.5 h-4 w-4" />
              Print / Save as PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printPayload && (
        <PrintDocument items={printPayload.items} options={printPayload.options} />
      )}
    </>
  );
}

function CheckRow({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox
        id={id}
        checked={checked && !disabled}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <Label htmlFor={id} className={disabled ? "text-muted-foreground" : undefined}>
        {label}
        {hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({hint})</span>}
      </Label>
    </div>
  );
}
