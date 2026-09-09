"use client";

import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  chapterLine,
  metaLine,
  itemLanguage,
  questionDisplayText,
  toMarkdownSafe,
  totalMarksOf,
  type ExportItem,
  type ExportOptions,
} from "@/lib/export";

const KATEX_OPTS = { strict: false as const, throwOnError: false };

function Prose({ children }: { children: string }) {
  return (
    <div className="print-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, KATEX_OPTS]]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/**
 * A print-only rendering of the exported questions, portalled to `document.body`
 * so the `@media print` rules in globals.css can hide every other top-level node.
 *
 * Everything here renders through KaTeX rather than the MathJax provider the
 * question cards use: KaTeX typesets synchronously during the React commit, so
 * the layout is final by the time `window.print()` runs. MathJax typesets
 * asynchronously and would print half-rendered.
 */
export function PrintDocument({
  items,
  options,
}: {
  items: ExportItem[];
  options: ExportOptions;
}) {
  // Rendered only in response to a click, so `document` always exists by then.
  // The guard is belt-and-braces for any server render of the parent tree.
  if (typeof document === "undefined") return null;

  const marks = totalMarksOf(items);

  return createPortal(
    <div id="print-root" lang={options.language === "hindi" ? "hi" : "en"}>
      <header className="print-header">
        <h1>{options.title}</h1>
        <p>
          {items.length} question{items.length === 1 ? "" : "s"} · {marks} marks ·{" "}
          {new Date().toLocaleDateString()}
        </p>
      </header>

      <ol className="print-list">
        {items.map((it) => {
          const q = it.question;
          const meta = metaLine(q);
          const chapter = chapterLine(q);
          const showSolution = options.includeSolutions && Boolean(it.solution);
          return (
            <li key={q.id} className="print-question">
              <div className="print-question-head">
                {meta && <span className="print-meta">{meta}</span>}
                {options.includeMeta && chapter && (
                  <span className="print-chapter">{chapter}</span>
                )}
              </div>

              <Prose>{toMarkdownSafe(questionDisplayText(q, itemLanguage(it, options)))}</Prose>

              {options.includeNotes && it.note && (
                <div className="print-note">
                  <strong>Note: </strong>
                  <Prose>{it.note}</Prose>
                </div>
              )}

              {showSolution && (
                <div className="print-solution">
                  <strong>Solution</strong>
                  <Prose>{it.solution as string}</Prose>
                </div>
              )}

              {options.answerSpaceCm > 0 && !showSolution && (
                <div
                  className="print-answer-space"
                  style={{ height: `${options.answerSpaceCm}cm` }}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>,
    document.body,
  );
}
