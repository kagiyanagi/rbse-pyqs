import type { QuestionPayload } from "@/types";
import type { LanguageMode } from "@/hooks/use-language";
import {
  HINDI_RE,
  balanceMathDelimiters,
  dedupeLines,
  normalizeNewlines,
  splitLanguages,
  unwrapStrayTextMacro,
} from "./text";

/**
 * The exact text a question should display in a given language mode, after the
 * source-data repairs (stray `\text{}` unwrapping, unbalanced `$` closing).
 * QuestionCard, the print view and the file exporters all go through this so a
 * printed question is character-for-character what the card shows.
 */
/**
 * Strip markdown decoration a model adds despite being told not to: surrounding code
 * fences, and backticks wrapping a math span, which would render as code not maths.
 */
export function cleanAiText(s: string): string {
  return s
    .replace(/^\s*```[a-z]*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .replace(/`+(\$[^`\n]*?\$)`+/g, "$1")
    .trim();
}

/**
 * Overlay an AI-repaired text onto a question row. Both text fields are replaced so
 * language splitting and MathJax rendering run against the repaired version.
 */
export function withQuestionFix(q: QuestionPayload, fixed: string | undefined): QuestionPayload {
  if (!fixed) return q;
  return { ...q, question_text: fixed, question_latex: fixed };
}

export function questionDisplayText(q: QuestionPayload, mode: LanguageMode): string {
  const raw = q.question_latex || q.question_text || "";
  const text = normalizeNewlines(raw);
  const split = splitLanguages(q.question_text || "");
  const splitLatex = splitLanguages(q.question_latex || "");

  let display: string;
  if (mode === "both") display = dedupeLines(text);
  else if (mode === "english") display = (q.question_latex ? splitLatex.english : split.english) || text;
  else display = (q.question_latex ? splitLatex.hindi : split.hindi) || text;

  return balanceMathDelimiters(unwrapStrayTextMacro(display));
}

// ---------- math-aware tokenizing ----------

// `$$…$$` and `\[…\]` first so they aren't chewed up by the single-`$` branch.
const MATH_SPAN_RE =
  /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:\\.|[^$\\\n]|\n(?!\n))*?\$/g;

type Segment = { kind: "math" | "text"; value: string };

/** Split a string into math spans and the plain text between them. */
export function segmentMath(s: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of s.matchAll(MATH_SPAN_RE)) {
    const start = m.index;
    if (start > last) out.push({ kind: "text", value: s.slice(last, start) });
    out.push({ kind: "math", value: m[0] });
    last = start + m[0].length;
  }
  if (last < s.length) out.push({ kind: "text", value: s.slice(last) });
  return out;
}

// ---------- markdown ----------

function escapeMarkdownText(s: string): string {
  return s
    .replace(/([\\`*_[\]<>|~])/g, "\\$1")
    .replace(/^(\s*)([#>])/gm, "$1\\$2")
    .replace(/^(\s*)(\d+)([.)])(\s)/gm, "$1$2\\$3$4")
    .replace(/^(\s*)([-+])(\s)/gm, "$1\\$2$3");
}

/**
 * Question text is plain text that happens to contain LaTeX, not markdown. Feed
 * it to a markdown renderer untouched and `a_1`, `*`, or a leading `#` silently
 * restyle the question. Escape everything outside math spans, leave the math
 * spans byte-identical, and turn single newlines into hard breaks so the
 * original line structure survives.
 */
type MathSpan = { inner: string; display: boolean };

/**
 * Normalize a math span to its content plus whether it is display math.
 * The question data mixes `$…$`, `$$…$$` and the TeX `\(…\)` / `\[…\]` forms —
 * the MathJax config on the cards accepts all four, but remark-math only knows
 * the dollar ones, so the TeX delimiters have to be rewritten or they print
 * literally.
 */
function parseMathSpan(value: string): MathSpan {
  if (value.startsWith("$$")) return { inner: value.slice(2, -2), display: true };
  if (value.startsWith("\\[")) return { inner: value.slice(2, -2), display: true };
  if (value.startsWith("\\(")) return { inner: value.slice(2, -2), display: false };
  return { inner: value.slice(1, -1), display: false };
}

export function toMarkdownSafe(s: string): string {
  const segs = segmentMath(s);
  const parts: string[] = [];
  let trimNextLeadingNewline = false;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];

    if (seg.kind === "text") {
      let v = seg.value;
      if (trimNextLeadingNewline) {
        v = v.replace(/^[ \t]*\r?\n/, "");
        trimNextLeadingNewline = false;
      }
      parts.push(escapeMarkdownText(v).replace(/\n/g, "  \n"));
      continue;
    }

    const { inner, display } = parseMathSpan(seg.value);
    const prev = segs[i - 1];
    const next = segs[i + 1];
    const startsLine = i === 0 || (prev?.kind === "text" && /\n[ \t]*$/.test(prev.value));
    const endsLine =
      i === segs.length - 1 || (next?.kind === "text" && /^[ \t]*(\r?\n|$)/.test(next.value));

    // remark-math only centres display math when `$$` fences its own block on
    // its own lines. A `$$…$$` written inline would otherwise be parsed as
    // inline math with a doubled marker, and hard breaks would glue it to the
    // paragraph above. Promote a display span that already sits alone on a line.
    if (display && startsLine && endsLine) {
      const last = parts.length - 1;
      if (last >= 0) parts[last] = parts[last].replace(/(?:[ \t]{2})?\r?\n$/, "\n");
      parts.push(`\n$$\n${inner.trim()}\n$$\n\n`);
      trimNextLeadingNewline = true;
      continue;
    }

    parts.push(`$${inner}$`);
  }

  return parts.join("");
}

// ---------- latex ----------

const LATEX_ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  "\u00b7": "\\textperiodcentered{}",
};

function escapeLatexText(s: string): string {
  return s.replace(/[\\&%$#_{}~^\u00b7]/g, (c) => LATEX_ESCAPES[c]);
}

/** Escape prose for LaTeX while leaving `$…$` / `\[…\]` spans untouched. */
export function toLatexSafe(s: string): string {
  return segmentMath(s)
    .map((seg) => (seg.kind === "math" ? seg.value : escapeLatexText(seg.value)))
    .join("")
    .split(/\n/)
    .map((l) => l.trimEnd())
    .join(" \\\\\n")
    .replace(/(\s*\\\\\n)+$/, "");
}

function inlineMarkdownToLatex(line: string): string {
  return toLatexSafe(line)
    .replace(/\*\*([^*]+)\*\*/g, "\\textbf{$1}")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1\\emph{$2}")
    .replace(/`([^`]+)`/g, "\\texttt{$1}");
}

/**
 * Notes and AI solutions are markdown, not plain text — `marksGuidance` asks
 * Gemini for `###` headings. Escaping them wholesale prints literal `###`, so
 * convert the constructs that actually show up (headings, bold, bullets) and
 * escape the rest. Lines become paragraphs rather than `\\`-terminated rows,
 * which keeps LaTeX from erroring on a break with no line to end.
 */
export function markdownBodyToLatex(s: string): string {
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("\\end{itemize}");
      inList = false;
    }
  };

  for (const raw of s.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push("\\begin{itemize}[leftmargin=*]");
        inList = true;
      }
      out.push(`\\item ${inlineMarkdownToLatex(bullet[1])}`);
      continue;
    }
    closeList();

    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) {
      out.push("", `\\textbf{${inlineMarkdownToLatex(heading[1])}}`, "");
      continue;
    }
    if (!line.trim()) {
      out.push("");
      continue;
    }
    out.push(inlineMarkdownToLatex(line));
  }
  closeList();

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------- document assembly ----------

export type ExportOptions = {
  title: string;
  language: LanguageMode;
  includeMeta: boolean;
  includeNotes: boolean;
  includeSolutions: boolean;
  /** Blank writing space under each question, in centimetres. 0 disables it. */
  answerSpaceCm: number;
};

export type ExportItem = {
  question: QuestionPayload;
  note?: string;
  solution?: string;
  /** Per-question language override, from the card's EN / हि / EN+हि toggle. */
  language?: LanguageMode;
};

export function itemLanguage(it: ExportItem, opts: ExportOptions): LanguageMode {
  return it.language ?? opts.language;
}

export function totalMarksOf(items: ExportItem[]): number {
  return items.reduce((sum, it) => sum + (it.question.marks ?? 0), 0);
}

export function metaLine(q: QuestionPayload): string {
  const bits: string[] = [];
  if (q.year) bits.push(q.paper_type && q.paper_type !== "main" ? `${q.year} ${q.paper_type}` : String(q.year));
  if (q.subject) bits.push(q.subject);
  if (q.question_number) bits.push(`Q${q.question_number}`);
  if (q.marks != null) bits.push(`${q.marks} mark${q.marks === 1 ? "" : "s"}`);
  return bits.join(" · ");
}

export function chapterLine(q: QuestionPayload): string {
  return [q.chapter, q.topic].filter(Boolean).join(" · ");
}

export function containsDevanagari(items: ExportItem[], opts: ExportOptions): boolean {
  return items.some((it) => {
    const parts = [
      questionDisplayText(it.question, itemLanguage(it, opts)),
      it.note ?? "",
      it.solution ?? "",
    ];
    return parts.some((p) => HINDI_RE.test(p));
  });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportFilename(ext: string): string {
  return `rbse-questions-${today()}.${ext}`;
}

export function buildMarkdown(items: ExportItem[], opts: ExportOptions): string {
  const out: string[] = [];
  out.push(`# ${opts.title}`, "");
  out.push(
    `_${items.length} question${items.length === 1 ? "" : "s"} · ${totalMarksOf(items)} marks · exported ${today()}_`,
    "",
  );

  items.forEach((it, i) => {
    const q = it.question;
    out.push("---", "");
    out.push(`## ${i + 1}. ${metaLine(q) || `Question ${q.id}`}`, "");
    if (opts.includeMeta) {
      const ch = chapterLine(q);
      if (ch) out.push(`_${escapeMarkdownText(ch)}_`, "");
    }
    out.push(toMarkdownSafe(questionDisplayText(q, itemLanguage(it, opts))), "");
    if (opts.includeNotes && it.note) {
      out.push("> **Note**", ...it.note.split(/\r?\n/).map((l) => `> ${l}`), "");
    }
    if (opts.includeSolutions && it.solution) {
      out.push("### Solution", "", it.solution.trim(), "");
    }
    if (opts.answerSpaceCm > 0 && !(opts.includeSolutions && it.solution)) {
      out.push("<!-- answer space -->", "");
    }
  });

  return out.join("\n");
}

export function buildLatex(items: ExportItem[], opts: ExportOptions): string {
  const devanagari = containsDevanagari(items, opts);
  const head = [
    "% Generated by RBSE Q-Bank.",
    devanagari
      ? "% This export contains Devanagari — compile with XeLaTeX or LuaLaTeX, not pdfLaTeX."
      : "% Compile with pdfLaTeX, XeLaTeX or LuaLaTeX.",
    "\\documentclass[12pt,a4paper]{article}",
    "\\usepackage{amsmath,amssymb}",
    "\\usepackage[margin=2cm]{geometry}",
    "\\usepackage{iftex}",
    "\\ifPDFTeX",
    "  \\usepackage[utf8]{inputenc}",
    "  \\usepackage[T1]{fontenc}",
    "\\else",
    "  \\usepackage{fontspec}",
    devanagari
      ? "  \\newfontfamily\\devanagarifont{Noto Sans Devanagari}"
      : "  % \\setmainfont{Latin Modern Roman}",
    "\\fi",
    "\\usepackage{enumitem}",
    "\\setlength{\\parindent}{0pt}",
    `\\title{${escapeLatexText(opts.title)}}`,
    `\\date{${today()}}`,
    "\\begin{document}",
    "\\maketitle",
    `\\noindent\\textit{${items.length} question${items.length === 1 ? "" : "s"} \\textperiodcentered{} ${totalMarksOf(items)} marks}`,
    "",
    "\\begin{enumerate}[leftmargin=*]",
  ];

  const body: string[] = [];
  for (const it of items) {
    const q = it.question;
    body.push("\\item");
    const meta = metaLine(q);
    if (meta) body.push(`{\\small\\textbf{${escapeLatexText(meta)}}}\\\\`);
    if (opts.includeMeta) {
      const ch = chapterLine(q);
      if (ch) body.push(`{\\small\\textit{${escapeLatexText(ch)}}}\\\\[2pt]`);
    }
    body.push(toLatexSafe(questionDisplayText(q, itemLanguage(it, opts))));
    if (opts.includeNotes && it.note) {
      body.push("", "\\textbf{Note:}", markdownBodyToLatex(it.note));
    }
    if (opts.includeSolutions && it.solution) {
      body.push("", "\\textbf{Solution:}", "", markdownBodyToLatex(it.solution));
    } else if (opts.answerSpaceCm > 0) {
      body.push("", `\\vspace{${opts.answerSpaceCm}cm}`);
    }
    body.push("");
  }

  return [...head, ...body, "\\end{enumerate}", "\\end{document}", ""].join("\n");
}

export function downloadTextFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has picked the blob up.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
