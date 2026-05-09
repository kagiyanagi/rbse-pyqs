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
];

export const DEFAULT_PROMPT_TEMPLATE = `You are a teacher solving an RBSE Class 12 {subject} question. {marks_guidance}

Question (chapter: {chapter}, topic: {topic}, marks: {marks}):
{question}

Language — STRICT: {language}

Output rules — follow strictly:
- Use Markdown: short \`###\` headings for each step (e.g. "### Given", "### Formula", "### Step 1", "### Final Answer"). Bold for key terms.
- For math, use LaTeX. Inline math must stay on a single line: \`$...$\`. Multi-line equations or anything with \\frac, \\sqrt, vectors, matrices, or alignment MUST use display math: \`$$...$$\` on its own line.
- Never wrap a single \`$...$\` across a newline — KaTeX will not render it.
- Show the full working in clean, numbered steps. Do not repeat the same calculation twice.
- End with a "### Final Answer" section that states the result clearly.`;

export function useGeminiKey() {
  return useLocalStorage<string>("geminiKey", "");
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
