import type { LanguageMode } from "@/hooks/use-language";

export const HINDI_RE = /[ऀ-ॿ]/;

export function normalizeNewlines(s: string): string {
  return s.replace(/\\n/g, "\n");
}

export function splitLanguages(text: string): { english: string; hindi: string } {
  const lines = text.split(/\\n|\r?\n/);
  const en: string[] = [];
  const hi: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (HINDI_RE.test(trimmed)) hi.push(trimmed);
    else en.push(trimmed);
  }
  return { english: en.join("\n"), hindi: hi.join("\n") };
}

export function extractByMode(text: string, mode: LanguageMode): string {
  const normalized = normalizeNewlines(text);
  if (mode === "both") return normalized;
  const { english, hindi } = splitLanguages(text);
  if (mode === "english") return english || normalized;
  return hindi || normalized;
}

export function languageDirective(mode: LanguageMode): string {
  if (mode === "english") return "English only. Do NOT include any Hindi.";
  if (mode === "hindi") return "Hindi (Devanagari) only. Do NOT include any English except for standard math/scientific symbols.";
  return "Match the question's primary language. If the question is bilingual, use English.";
}
