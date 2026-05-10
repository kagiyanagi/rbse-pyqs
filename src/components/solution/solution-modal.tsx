"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Database, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookmarkPicker } from "@/components/bookmark-picker";
import { fillTemplate, marksGuidance, streamGeminiWithRotation } from "@/lib/gemini";
import { PreWithSvg } from "@/lib/markdown-svg";
import { AiErrorBanner } from "@/components/ai-error-banner";
import { extractByMode, languageDirective } from "@/lib/text";
import { useDefaultLanguage, useLanguageOverrides } from "@/hooks/use-language";
import {
  GEMINI_MODELS,
  useGeminiKeys,
  useGeminiModel,
  usePromptTemplate,
  type GeminiModelId,
} from "@/hooks/use-settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSolutionCache } from "@/hooks/use-solutions";
import type { QuestionPayload } from "@/types";

export function SolutionModal({
  question,
  onClose,
}: {
  question: QuestionPayload | null;
  onClose: () => void;
}) {
  const [apiKeys] = useGeminiKeys();
  const hasKey = apiKeys.some((k) => k.trim());
  const [model, setModel] = useGeminiModel();
  const [template] = usePromptTemplate();
  const [defaultLang] = useDefaultLanguage();
  const { get: getLangMode } = useLanguageOverrides();
  const solutions = useSolutionCache();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fromCache, setFromCache] = useState(false);
  const [regenTick, setRegenTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const open = question != null;

  const run = async (force: boolean) => {
    if (!question) return;
    if (!force) {
      const cached = solutions.get(question.id);
      if (cached) {
        setText(cached);
        setError(null);
        setLoading(false);
        setFromCache(true);
        return;
      }
    }
    if (!hasKey) {
      setError(new Error("Add your Gemini API key in Settings first."));
      setText("");
      setFromCache(false);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setError(null);
    setText("");
    setFromCache(false);
    setLoading(true);
    const mode = getLangMode(question.id, defaultLang);
    const questionForAi = extractByMode(question.question_text ?? "", mode);
    const prompt = fillTemplate(template, {
      question: questionForAi,
      marks: question.marks,
      subject: question.subject,
      chapter: question.chapter,
      topic: question.topic,
      marks_guidance: marksGuidance(question.marks),
      language: languageDirective(mode),
    });
    let acc = "";
    try {
      for await (const chunk of streamGeminiWithRotation({
        apiKeys,
        prompt,
        model,
        signal: ac.signal,
      })) {
        acc += chunk;
        setText(acc);
      }
      if (!ac.signal.aborted && acc) {
        solutions.save(question.id, acc);
      }
    } catch (e: unknown) {
      if (!ac.signal.aborted) setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setRegenTick(0);
    run(false);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, question?.id]);

  useEffect(() => {
    if (!open || regenTick === 0) return;
    run(true);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenTick]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          abortRef.current?.abort();
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>Solution{question?.marks != null ? ` · ${question.marks} marks` : ""}</span>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!loading && fromCache && (
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                <Database className="h-3 w-3" />
                Saved
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {error != null && <AiErrorBanner error={error} />}

        {!hasKey && !error && !text && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            Set your Gemini API key in Settings to generate solutions.
          </div>
        )}

        <div className="solution-prose flex-1 overflow-y-auto pr-2">
          {text ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
              components={{ pre: PreWithSvg }}
            >
              {text}
            </ReactMarkdown>
          ) : loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating solution…
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRegenTick((t) => t + 1)}
              disabled={loading || !hasKey}
              title={fromCache ? "Replace the saved solution with a fresh one" : "Generate again"}
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Regenerate
            </Button>
            <Select
              value={model}
              onValueChange={(v) => setModel(v as GeminiModelId)}
              disabled={loading}
            >
              <SelectTrigger size="sm" className="h-8 max-w-[160px]" aria-label="AI model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GEMINI_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label.replace(/^Gemini /, "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {question && <BookmarkPicker question={question} />}
            <Button variant="ghost" size="sm" onClick={() => onClose()}>
              <X className="mr-1.5 h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
