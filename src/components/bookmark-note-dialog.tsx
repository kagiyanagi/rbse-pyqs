"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Loader2, NotebookPen, Sparkles, StopCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useBookmarkNotes } from "@/hooks/use-bookmark-notes";
import { useDefaultLanguage, useLanguageOverrides } from "@/hooks/use-language";
import { useGeminiKeys, useGeminiModel } from "@/hooks/use-settings";
import { streamGeminiWithRotation } from "@/lib/gemini";
import { PreWithSvg } from "@/lib/markdown-svg";
import { AiErrorBanner } from "@/components/ai-error-banner";
import { extractByMode, languageDirective } from "@/lib/text";
import type { QuestionPayload } from "@/types";

export function BookmarkNoteDialog({
  question,
  open,
  onOpenChange,
}: {
  question: QuestionPayload;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { get, save, remove } = useBookmarkNotes();
  const [apiKeys] = useGeminiKeys();
  const hasKey = apiKeys.some((k) => k.trim());
  const [model] = useGeminiModel();
  const [defaultLang] = useDefaultLanguage();
  const { get: getLangMode } = useLanguageOverrides();
  const stored = get(question.id);
  const [draft, setDraft] = useState(stored);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<unknown>(null);
  const [tab, setTab] = useState<string>("edit");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(get(question.id));
      setGenError(null);
      setTab("edit");
    } else {
      abortRef.current?.abort();
      setGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, question.id]);

  const onSave = () => {
    save(question.id, draft);
    onOpenChange(false);
  };

  const onDelete = () => {
    remove(question.id);
    setDraft("");
    onOpenChange(false);
  };

  const generate = async () => {
    if (!hasKey) {
      setGenError(new Error("Add your Gemini API key in Settings first."));
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setGenError(null);
    setGenerating(true);
    setDraft("");
    setTab("edit");
    const mode = getLangMode(question.id, defaultLang);
    const prompt = buildNotePrompt(question, mode);
    let acc = "";
    try {
      for await (const chunk of streamGeminiWithRotation({
        apiKeys,
        prompt,
        model,
        signal: ac.signal,
      })) {
        acc += chunk;
        setDraft(acc);
      }
    } catch (e: unknown) {
      if (!ac.signal.aborted) setGenError(e);
    } finally {
      setGenerating(false);
    }
  };

  const stopGenerating = () => {
    abortRef.current?.abort();
    setGenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-3 overflow-hidden sm:w-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="h-4 w-4" />
            Note
          </DialogTitle>
          <DialogDescription>
            Things to remember, the trick that solved it, gotchas, formulas — anything. Supports
            Markdown and LaTeX (use $…$ for inline math, $$…$$ for display).
          </DialogDescription>
        </DialogHeader>

        {genError != null && <AiErrorBanner error={genError} />}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </Tabs>
          {generating ? (
            <Button variant="outline" size="sm" onClick={stopGenerating}>
              <StopCircle className="mr-1.5 h-4 w-4" />
              Stop
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={generate}
              disabled={!hasKey}
              title={
                draft
                  ? "Replace the current note with an AI-generated one"
                  : "Generate a study note for this question"
              }
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {draft ? "Regenerate with AI" : "Generate with AI"}
            </Button>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsContent value="edit" className="flex-1 overflow-hidden">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                generating
                  ? "Generating…"
                  : "e.g. Use integration by parts with u = ln(x) — the trick is to spot $\\frac{d}{dx} \\tan x = \\sec^2 x$ in the numerator."
              }
              disabled={generating}
              className="h-full min-h-[260px] resize-none font-mono text-sm"
              autoFocus
            />
            {generating && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating with {model}…
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-y-auto">
            <div className="solution-prose min-h-[260px] rounded-md border bg-muted/30 p-3">
              {draft.trim() ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                  components={{ pre: PreWithSvg }}
                >
                  {draft}
                </ReactMarkdown>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={!stored || generating}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSave} disabled={generating}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildNotePrompt(q: QuestionPayload, mode: import("@/hooks/use-language").LanguageMode): string {
  const sliced = extractByMode(q.question_text ?? "", mode);
  return `You are a Class 12 RBSE study coach. Produce a SHORT study note a student can re-read in 10 seconds to remember how to attack this question. This is a memory aid, NOT a worked solution.

Question (subject: ${q.subject ?? "—"}, chapter: ${q.chapter ?? "—"}, topic: ${q.topic ?? "—"}, marks: ${q.marks ?? "—"}):
${sliced}

Language — STRICT: ${languageDirective(mode)}

Output rules — follow strictly:
- 3 to 5 bullet points, each one short line. No headings. No introduction. No conclusion.
- Each bullet should be one of: the key concept, the formula to apply, the trick / approach, a common pitfall, or what to memorise.
- Inline math: $…$. Display math: $$…$$ on its own line. Never break $…$ across newlines.
- Be crisp and concrete. Quote the actual formula or method names, not generic advice.
- Do NOT solve the question. Do NOT compute the answer. Do NOT restate the question.
- No filler. No "remember to…", no "always check…". Pure information density.`;
}
