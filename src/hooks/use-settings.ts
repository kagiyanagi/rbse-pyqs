"use client";

import { useEffect } from "react";
import { useLocalStorage } from "./use-local-storage";

const LEGACY_PROMPT_TEMPLATES = [
  `Solve this RBSE Class 12 {subject} question. {marks_guidance}

Question (chapter: {chapter}, topic: {topic}, marks: {marks}):
{question}

Use clear LaTeX for any math. Use $...$ for inline and $$...$$ for display equations.`,
  `You are a teacher solving an RBSE Class 12 {subject} question. {marks_guidance}

Question (chapter: {chapter}, topic: {topic}, marks: {marks}):
{question}

Output rules — follow strictly:
- Reply in the same language as the question (English or Hindi). Do NOT mix languages unless the question itself is bilingual.
- Use Markdown: short \`###\` headings for each step (e.g. "### Given", "### Formula", "### Step 1", "### Final Answer"). Bold for key terms.
- For math, use LaTeX. Inline math must stay on a single line: \`$...$\`. Multi-line equations or anything with \\frac, \\sqrt, vectors, matrices, or alignment MUST use display math: \`$$...$$\` on its own line.
- Never wrap a single \`$...$\` across a newline — KaTeX will not render it.
- Show the full working in clean, numbered steps. Do not repeat the same calculation twice.
- End with a "### Final Answer" section that states the result clearly.`,
  `You are a teacher solving an RBSE Class 12 {subject} question. {marks_guidance}

Question (chapter: {chapter}, topic: {topic}, marks: {marks}):
{question}

Language — STRICT: {language}

Output rules — follow strictly:
- Use Markdown: short \`###\` headings for each step (e.g. "### Given", "### Formula", "### Step 1", "### Final Answer"). Bold for key terms.
- For math, use LaTeX. Inline math must stay on a single line: \`$...$\`. Multi-line equations or anything with \\frac, \\sqrt, vectors, matrices, or alignment MUST use display math: \`$$...$$\` on its own line.
- Never wrap a single \`$...$\` across a newline — KaTeX will not render it.
- Show the full working in clean, numbered steps. Do not repeat the same calculation twice.
- End with a "### Final Answer" section that states the result clearly.`,
  `You are an RBSE Class 12 {subject} teacher writing a model answer for a board-exam question worth {marks} mark(s).

Question (chapter: {chapter}, topic: {topic}):
{question}

Language — STRICT: {language}

Marking guidance: {marks_guidance}

Output EXACTLY two sections, in this order, separated by a horizontal rule (\`---\`):

## Answer
This is what the student must copy into their answer sheet. Match the marking guidance above EXACTLY — length, depth, and structure. Hard rules:
- For 1–2 mark questions: NO \`###\` sub-headings, NO "Given/Step/Final Answer" sections. Just the clean direct answer (1–3 lines).
- For 3-mark questions: minimal structure only if it genuinely helps (e.g. Formula → Substitution → Result for numerics).
- For 4+ mark questions: short \`###\` sub-headings (Given / Formula / Step 1 / … / Final Answer) are expected.
- Bold the key terms or final result. Don't pad. Don't restate the question.

---

## Notes
A short study aid for the student, NOT for the answer copy. 2–4 short bullets max:
- The core concept or "why this works"
- Common mistakes / what examiners penalise
- A memorable shortcut, mnemonic, or related formula
Keep each bullet to one short line.

Formatting rules (apply to BOTH sections):
- Markdown. Bold for key terms.
- For math, use LaTeX. Inline: \`$…$\` on a single line. Display (anything with \\frac, \\sqrt, vectors, matrices, alignment, or multiple lines): \`$$…$$\` on its own line.
- Never break a single \`$…$\` across newlines — KaTeX won't render it.`,
  `You are an RBSE Class 12 {subject} teacher writing a model answer for a board-exam question worth {marks} mark(s).

Question (chapter: {chapter}, topic: {topic}):
{question}

Language — STRICT: {language}

Marking guidance: {marks_guidance}

Output EXACTLY two sections, in this order, separated by a horizontal rule (\`---\`):

## Answer
This is what the student must copy into their answer sheet. Match the marking guidance above EXACTLY — length, depth, and structure. Hard rules:
- For 1–2 mark questions: NO \`###\` sub-headings, NO "Given/Step/Final Answer" sections. Just the clean direct answer (1–3 lines).
- For 3-mark questions: minimal structure only if it genuinely helps (e.g. Formula → Substitution → Result for numerics).
- For 4+ mark questions: short \`###\` sub-headings (Given / Formula / Step 1 / … / Final Answer) are expected.
- Bold the key terms or final result. Don't pad. Don't restate the question.

Diagrams — include a diagram ONLY when the question genuinely needs one (e.g. ray diagram, circuit, geometric figure, v–t / x–t graph, force diagram, sketch the curve). Do NOT add a diagram for definition / theory / pure-numeric questions. When you do include one, embed inline SVG inside a fenced \`\`\`svg block — no images, no links, no markdown image syntax. SVG rules:
- Self-contained \`<svg>\` element with \`viewBox\` (e.g. \`viewBox="0 0 400 300"\`); omit fixed width/height so it scales.
- Use \`stroke="currentColor"\` and \`fill="none"\` (or \`fill="currentColor"\`) so the diagram inherits the page's text color and works in dark mode.
- Label axes / points with \`<text>\` elements. Keep it minimal — clean schematic, not photo-realistic.
- No \`<script>\`, no event handlers, no external references, no \`<foreignObject>\`.

---

## Notes
A short study aid for the student, NOT for the answer copy. 2–4 short bullets max:
- The core concept or "why this works"
- Common mistakes / what examiners penalise
- A memorable shortcut, mnemonic, or related formula
Keep each bullet to one short line.

Formatting rules (apply to BOTH sections):
- Markdown. Bold for key terms.
- For math, use LaTeX. Inline: \`$…$\` on a single line. Display (anything with \\frac, \\sqrt, vectors, matrices, alignment, or multiple lines): \`$$…$$\` on its own line.
- Never break a single \`$…$\` across newlines — KaTeX won't render it.`,
  `You are an RBSE Class 12 {subject} teacher writing a model answer for a board-exam question worth {marks} mark(s).

Question (chapter: {chapter}, topic: {topic}):
{question}

Language — STRICT: {language}

Marking guidance: {marks_guidance}

Output EXACTLY two sections, in this order, separated by a horizontal rule (\`---\`):

## Answer
This is what the student must copy into their answer sheet. Match the marking guidance above EXACTLY — length, depth, and structure. Hard rules:
- For 1–2 mark questions: NO \`###\` sub-headings, NO "Given/Step/Final Answer" sections. Just the clean direct answer (1–3 lines).
- For 3-mark questions: minimal structure only if it genuinely helps (e.g. Formula → Substitution → Result for numerics).
- For 4+ mark questions: short \`###\` sub-headings (Given / Formula / Step 1 / … / Final Answer) are expected.
- Bold the key terms or final result. Don't pad. Don't restate the question.

Diagrams — include a diagram ONLY when the question genuinely needs one (e.g. ray diagram, circuit, geometric figure, v–t / x–t graph, force diagram, sketch the curve). Do NOT add a diagram for definition / theory / pure-numeric questions. When you do include one, embed inline SVG inside a fenced \`\`\`svg block — no images, no links, no markdown image syntax. SVG rules:
- Self-contained \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">\` (e.g. \`viewBox="0 0 480 320"\`); omit fixed width/height so it scales.
- Leave at LEAST 50 units of empty padding inside the viewBox on every side for axis titles, axis numbers, and labels. Every \`<text>\` must sit fully inside the viewBox — never at the edge. Plot region should be roughly the inner 60–70% of the viewBox.
- Use \`stroke="currentColor"\` (and \`fill="none"\` for lines, \`fill="currentColor"\` for filled shapes and \`<text>\`) so the diagram inherits the page's text color and works in both dark and light mode.
- Set \`font-size="12"\` (12–14 max) and an explicit \`text-anchor\` on every \`<text>\` — \`start\` for left-aligned, \`middle\` for centered (use this for x-axis labels and titles), \`end\` for right-aligned (use this for y-axis numeric labels). For a y-axis title, rotate it: \`<text transform="rotate(-90 X Y)" text-anchor="middle">…\`.
- LABELS — CRITICAL: do NOT put \`$…$\` LaTeX inside \`<text>\` (it won't render — the dollar signs appear literally). Write labels in plain text:
  - Greek letters as Unicode: Δ, λ, α, β, θ, π, μ, ω, σ, φ, ε, ρ, τ
  - Arrows / symbols as Unicode: → ← ↑ ↓ ° ± ∞ ∝
  - Subscripts / superscripts via \`<tspan>\` with \`baseline-shift\` and smaller font: e.g. \`<text>T<tspan baseline-shift="sub" font-size="9">b</tspan><tspan baseline-shift="super" font-size="9">o</tspan></text>\` renders as T_b^o. ΔT_b becomes \`ΔT<tspan baseline-shift="sub" font-size="9">b</tspan>\`.
- Keep it minimal — clean schematic, not photo-realistic. No gridlines unless essential.
- No \`<script>\`, no event handlers, no external references, no \`<foreignObject>\`, no \`<image>\`.

---

## Notes
A short study aid for the student, NOT for the answer copy. 2–4 short bullets max:
- The core concept or "why this works"
- Common mistakes / what examiners penalise
- A memorable shortcut, mnemonic, or related formula
Keep each bullet to one short line.

Formatting rules (apply to BOTH sections, NOT inside SVG):
- Markdown. Bold for key terms.
- For math, use LaTeX. Inline: \`$…$\` on a single line. Display (anything with \\frac, \\sqrt, vectors, matrices, alignment, or multiple lines): \`$$…$$\` on its own line.
- Never break a single \`$…$\` across newlines — KaTeX won't render it.`,
];

export const DEFAULT_PROMPT_TEMPLATE = `You are an RBSE Class 12 {subject} teacher writing a model answer for a board-exam question worth {marks} mark(s).

Question (chapter: {chapter}, topic: {topic}):
{question}

Language — STRICT: {language}

Marking guidance: {marks_guidance}

Output EXACTLY three sections, in this order, separated by horizontal rules (\`---\`):

## Question
Re-state the question itself, cleanly typeset for the student. The raw question text above may contain OCR artefacts, malformed LaTeX, stray backslashes, unbalanced \`$\`, broken \`\\frac\`, garbled symbols, or other anomalies that make it unreadable to a human — fix all of that here so the student can finally read the question properly.
- Faithfully preserve the original wording, numbers, sub-parts, and intent. Do NOT add hints, do NOT begin solving, do NOT prepend "Solution:" or "Q:" — this section is JUST the question, rendered cleanly.
- Rewrite every math fragment as clean KaTeX-renderable LaTeX following the same inline / display rules below.
- Match the language of the source (English / Hindi / bilingual as given). If the source is bilingual, keep both.
- Preserve sub-parts as a clean list (a) / (b) / (c)… when present.
- Keep it tight — one block, no commentary, no meta-notes about what you fixed.

---

## Answer
This is what the student must copy into their answer sheet. Match the marking guidance above EXACTLY — length, depth, and structure. Hard rules:
- For 1–2 mark questions: NO \`###\` sub-headings, NO "Given/Step/Final Answer" sections. Just the clean direct answer (1–3 lines).
- For 3-mark questions: minimal structure only if it genuinely helps (e.g. Formula → Substitution → Result for numerics).
- For 4+ mark questions: short \`###\` sub-headings (Given / Formula / Step 1 / … / Final Answer) are expected.
- Bold the key terms or final result. Don't pad. Don't restate the question.

Diagrams — include a diagram ONLY when the question genuinely needs one (e.g. ray diagram, circuit, geometric figure, v–t / x–t graph, force diagram, sketch the curve). Do NOT add a diagram for definition / theory / pure-numeric questions. When you do include one, embed inline SVG inside a fenced \`\`\`svg block — no images, no links, no markdown image syntax. SVG rules:
- Self-contained \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">\` (e.g. \`viewBox="0 0 480 320"\`); omit fixed width/height so it scales.
- Leave at LEAST 50 units of empty padding inside the viewBox on every side for axis titles, axis numbers, and labels. Every \`<text>\` must sit fully inside the viewBox — never at the edge. Plot region should be roughly the inner 60–70% of the viewBox.
- Use \`stroke="currentColor"\` (and \`fill="none"\` for lines, \`fill="currentColor"\` for filled shapes and \`<text>\`) so the diagram inherits the page's text color and works in both dark and light mode.
- Set \`font-size="12"\` (12–14 max) and an explicit \`text-anchor\` on every \`<text>\` — \`start\` for left-aligned, \`middle\` for centered (use this for x-axis labels and titles), \`end\` for right-aligned (use this for y-axis numeric labels). For a y-axis title, rotate it: \`<text transform="rotate(-90 X Y)" text-anchor="middle">…\`.
- LABELS — CRITICAL: do NOT put \`$…$\` LaTeX inside \`<text>\` (it won't render — the dollar signs appear literally). Write labels in plain text:
  - Greek letters as Unicode: Δ, λ, α, β, θ, π, μ, ω, σ, φ, ε, ρ, τ
  - Arrows / symbols as Unicode: → ← ↑ ↓ ° ± ∞ ∝
  - Subscripts / superscripts via \`<tspan>\` with \`baseline-shift\` and smaller font: e.g. \`<text>T<tspan baseline-shift="sub" font-size="9">b</tspan><tspan baseline-shift="super" font-size="9">o</tspan></text>\` renders as T_b^o. ΔT_b becomes \`ΔT<tspan baseline-shift="sub" font-size="9">b</tspan>\`.
- Keep it minimal — clean schematic, not photo-realistic. No gridlines unless essential.
- No \`<script>\`, no event handlers, no external references, no \`<foreignObject>\`, no \`<image>\`.

---

## Notes
A short study aid for the student, NOT for the answer copy. 2–4 short bullets max:
- The core concept or "why this works"
- Common mistakes / what examiners penalise
- A memorable shortcut, mnemonic, or related formula
Keep each bullet to one short line.

Formatting rules (apply to BOTH sections, NOT inside SVG):
- Markdown. Bold for key terms.
- For math, use LaTeX. Inline: \`$…$\` on a single line. Display (anything with \\frac, \\sqrt, vectors, matrices, alignment, or multiple lines): \`$$…$$\` on its own line.
- Never break a single \`$…$\` across newlines — KaTeX won't render it.`;

let legacyKeyMigrated = false;
function migrateLegacyKey() {
  if (legacyKeyMigrated || typeof window === "undefined") return;
  legacyKeyMigrated = true;
  try {
    if (window.localStorage.getItem("geminiKeys") != null) return;
    const legacy = window.localStorage.getItem("geminiKey");
    if (!legacy) return;
    const parsed = JSON.parse(legacy);
    if (typeof parsed === "string" && parsed.trim()) {
      window.localStorage.setItem("geminiKeys", JSON.stringify([parsed.trim()]));
    }
  } catch {
    // ignore
  }
}

export function useGeminiKeys() {
  if (typeof window !== "undefined") migrateLegacyKey();
  return useLocalStorage<string[]>("geminiKeys", []);
}

export const GEMINI_MODELS = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Recommended · fast, accurate for Class 12 math/physics",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Best quality on hard derivations · stricter free-tier quota",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    description: "Fastest · weaker on multi-step derivations",
  },
] as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[number]["id"];

export function useGeminiModel() {
  return useLocalStorage<GeminiModelId>("geminiModel", "gemini-2.5-flash");
}

export function usePromptTemplate() {
  const tuple = useLocalStorage<string>("promptTemplate", DEFAULT_PROMPT_TEMPLATE);
  const [value, set, hydrated] = tuple;
  useEffect(() => {
    if (!hydrated) return;
    if (LEGACY_PROMPT_TEMPLATES.includes(value)) set(DEFAULT_PROMPT_TEMPLATE);
  }, [hydrated, value, set]);
  return tuple;
}

export function useHideAnswered() {
  return useLocalStorage<boolean>("hideAnswered", false);
}
