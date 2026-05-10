import type { LanguageMode } from "@/hooks/use-language";

export const HINDI_RE = /[ऀ-ॿ]/;
const ENGLISH_WORD_RE = /[A-Za-z]{4,}/;

export function normalizeNewlines(s: string): string {
  return s.replace(/\\n/g, "\n");
}

// "neutral" lines have no Devanagari AND no run of 4+ ASCII letters — typically
// pure math/formula lines like `m_p = 1.0073 amu` or `1 amu = 931 MeV.`. These
// belong to both language versions, not just whichever bucket happens to use
// the same script.
function classifyLine(line: string): "hindi" | "english" | "neutral" {
  if (HINDI_RE.test(line)) return "hindi";
  if (ENGLISH_WORD_RE.test(line)) return "english";
  return "neutral";
}

export function dedupeLines(text: string): string {
  const lines = text.split(/\\n|\r?\n/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const key = raw.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out.join("\n");
}

export function splitLanguages(text: string): { english: string; hindi: string } {
  const lines = text.split(/\\n|\r?\n/);
  const en: string[] = [];
  const hi: string[] = [];
  const seenEn = new Set<string>();
  const seenHi = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cls = classifyLine(trimmed);
    if ((cls === "hindi" || cls === "neutral") && !seenHi.has(trimmed)) {
      hi.push(trimmed);
      seenHi.add(trimmed);
    }
    if ((cls === "english" || cls === "neutral") && !seenEn.has(trimmed)) {
      en.push(trimmed);
      seenEn.add(trimmed);
    }
  }
  return { english: en.join("\n"), hindi: hi.join("\n") };
}

export function extractByMode(text: string, mode: LanguageMode): string {
  const normalized = normalizeNewlines(text);
  if (mode === "both") return dedupeLines(normalized);
  const { english, hindi } = splitLanguages(text);
  if (mode === "english") return english || normalized;
  return hindi || normalized;
}

export function languageDirective(mode: LanguageMode): string {
  if (mode === "english") return "English only. Do NOT include any Hindi.";
  if (mode === "hindi") return "Hindi (Devanagari) only. Do NOT include any English except for standard math/scientific symbols.";
  return "Match the question's primary language. If the question is bilingual, use English.";
}
