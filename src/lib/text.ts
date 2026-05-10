import type { LanguageMode } from "@/hooks/use-language";

export const HINDI_RE = /[ऀ-ॿ]/;
const ENGLISH_WORD_RE = /[A-Za-z]{4,}/;

export function normalizeNewlines(s: string): string {
  return s.replace(/\\n/g, "\n");
}

// The source data occasionally drops the closing `$` of an inline-math span, so
// MathJax never finds a delimiter pair and prints the raw `$\text{...}^{-2}`
// LaTeX literally. If a line has an odd number of unescaped `$` (after pairing
// off `$$…$$` blocks) and contains math-like markup, append a closing `$`.
const MATH_LIKE = /(\\(?:text|frac|sqrt|sum|int|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|times|cdot|leq|geq|infty|partial|nabla|vec|hat|bar|to|rightarrow|leftarrow)\b|[_^]\{)/;

function balanceLineDollars(line: string): string {
  // Pair off $$…$$ blocks first (they are independent of single-$ math).
  const withoutBlocks = line.replace(/\$\$[\s\S]*?\$\$/g, "");
  // Drop escaped \$ so they don't count.
  const stripped = withoutBlocks.replace(/\\\$/g, "");
  const dollars = (stripped.match(/\$/g) ?? []).length;
  if (dollars % 2 === 0) return line;
  if (!MATH_LIKE.test(line)) return line;
  return line + "$";
}

export function balanceMathDelimiters(s: string): string {
  return s.split(/\r?\n/).map(balanceLineDollars).join("\n");
}

// The source data sometimes wraps an entire question line in `\text{...}` with
// no surrounding `$...$` math delimiters. MathJax never enters math mode, so
// the literal `\text{...}` shows up in the rendered output. Unwrap it per line
// when it's the whole line (the wrapper has no semantic value outside math).
export function unwrapStrayTextMacro(s: string): string {
  return s
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      const m = trimmed.match(/^\\text\{([\s\S]*)\}$/);
      if (!m) return line;
      const inner = m[1];
      // Make sure braces are balanced inside the unwrapped content. If they
      // aren't, our greedy match grabbed too much; bail.
      let depth = 0;
      for (const ch of inner) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth < 0) return line;
        }
      }
      if (depth !== 0) return line;
      return inner;
    })
    .join("\n");
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
