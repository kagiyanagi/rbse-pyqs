"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatGeminiError } from "@/lib/gemini";
import { cn } from "@/lib/utils";

export function AiErrorBanner({ error }: { error: unknown }) {
  const f = formatGeminiError(error);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(f.raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            {f.title}
            {f.status ? <span className="ml-1.5 font-normal opacity-70">· {f.status}</span> : null}
          </div>
          <div className="mt-0.5 text-xs leading-relaxed opacity-90">{f.hint}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs hover:bg-destructive/15"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              <ChevronDown
                className={cn("mr-1 h-3.5 w-3.5 transition-transform", open && "rotate-180")}
              />
              {open ? "Hide details" : "Show details"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs hover:bg-destructive/15"
              onClick={copy}
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Copy log
                </>
              )}
            </Button>
          </div>
          {open && (
            <pre className="mt-2 max-h-56 overflow-auto rounded bg-background/40 p-2 font-mono text-[11px] leading-snug whitespace-pre-wrap break-all text-foreground/90">
              {f.raw}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
