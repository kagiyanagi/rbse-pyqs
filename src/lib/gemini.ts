export type GeminiStreamOpts = {
  apiKey: string;
  prompt: string;
  signal?: AbortSignal;
  model?: string;
};

export class GeminiApiError extends Error {
  status: number;
  raw: string;
  retryAfterSec?: number;

  constructor(status: number, raw: string) {
    super(`Gemini ${status}`);
    this.name = "GeminiApiError";
    this.status = status;
    this.raw = raw;
    this.retryAfterSec = parseRetryAfter(raw);
  }

  /**
   * A deleted, mistyped or project-disabled key comes back as 400 API_KEY_INVALID
   * rather than 401, so it has to be recognised by body before it can be treated
   * as a key fault instead of a bad prompt.
   */
  get isKeyFault(): boolean {
    if (this.status === 401 || this.status === 403) return true;
    return this.status === 400 && /API_KEY_INVALID|API key not valid/i.test(this.raw);
  }
}

function parseRetryAfter(raw: string): number | undefined {
  const m = raw.match(/retry in ([0-9.]+)s/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? Math.ceil(n) : undefined;
}

export type FriendlyError = {
  title: string;
  hint: string;
  raw: string;
  status?: number;
  retryAfterSec?: number;
};

export function formatGeminiError(err: unknown): FriendlyError {
  if (err instanceof GeminiApiError) {
    const raw = err.raw;
    if (err.status === 429) {
      const wait = err.retryAfterSec ? `${err.retryAfterSec}s` : "a bit";
      return {
        title: "Rate limit reached",
        hint: `All your Gemini keys are throttled. Wait ${wait} and try again, or add another key in Settings.`,
        raw,
        status: err.status,
        retryAfterSec: err.retryAfterSec,
      };
    }
    if (err.isKeyFault) {
      return {
        title: "API key rejected",
        hint:
          "None of your Gemini keys worked. A key that was deleted or mistyped reports this. " +
          "Remove the dead ones in Settings → Gemini API keys and keep one you just created.",
        raw,
        status: err.status,
      };
    }
    if (err.status === 400) {
      return {
        title: "Bad request",
        hint: "Gemini rejected the prompt. The question text might be malformed - try a different question or model.",
        raw,
        status: err.status,
      };
    }
    if (err.status >= 500) {
      return {
        title: "Gemini is down",
        hint: "Google's API returned a server error. Wait a moment and hit Regenerate.",
        raw,
        status: err.status,
      };
    }
    return {
      title: `Gemini ${err.status}`,
      hint: "Something went wrong on Gemini's end. Open details to see the raw response.",
      raw,
      status: err.status,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/network|failed to fetch|TypeError/i.test(msg)) {
    return {
      title: "Network error",
      hint: "Couldn't reach Gemini. Check your connection and try again.",
      raw: msg,
    };
  }
  return { title: "Generation failed", hint: msg, raw: msg };
}

class KeyRotator {
  private cooldowns = new Map<string, number>();

  isCoolingDown(key: string): boolean {
    const t = this.cooldowns.get(key);
    if (t == null) return false;
    if (Date.now() >= t) {
      this.cooldowns.delete(key);
      return false;
    }
    return true;
  }

  cooldownRemaining(key: string): number {
    const t = this.cooldowns.get(key);
    if (t == null) return 0;
    return Math.max(0, Math.ceil((t - Date.now()) / 1000));
  }

  markCooldown(key: string, sec: number) {
    this.cooldowns.set(key, Date.now() + Math.max(1, sec) * 1000);
  }
}

export const geminiKeyRotator = new KeyRotator();

export type KeyAdvanceInfo = {
  fromIndex: number;
  toIndex: number;
  reason: GeminiApiError;
};

export type GeminiStreamMultiOpts = Omit<GeminiStreamOpts, "apiKey"> & {
  apiKeys: string[];
  onKeyAdvance?: (info: KeyAdvanceInfo) => void;
};

// Tries each key in order (live keys first, then those nearest to coming off
// cooldown). If a key returns 429/401/403 BEFORE any chunk has been yielded,
// switch to the next key. Mid-stream errors are not retried - that would
// duplicate already-emitted text.
export async function* streamGeminiWithRotation(
  opts: GeminiStreamMultiOpts,
): AsyncGenerator<string, void, void> {
  const cleaned = opts.apiKeys.map((k) => k.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error("Add your Gemini API key in Settings first.");
  }

  const order = cleaned
    .map((k, i) => ({ key: k, index: i, cooldown: geminiKeyRotator.cooldownRemaining(k) }))
    .sort((a, b) => a.cooldown - b.cooldown);

  let yielded = false;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < order.length; attempt++) {
    const { key, index } = order[attempt];
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      for await (const chunk of streamGemini({
        apiKey: key,
        prompt: opts.prompt,
        signal: opts.signal,
        model: opts.model,
      })) {
        yielded = true;
        yield chunk;
      }
      return;
    } catch (e) {
      lastError = e;
      if (yielded) throw e;
      if (opts.signal?.aborted) throw e;
      if (e instanceof GeminiApiError) {
        if (e.status === 429) {
          geminiKeyRotator.markCooldown(key, e.retryAfterSec ?? 60);
        }
        const rotatable = e.status === 429 || e.isKeyFault;
        if (rotatable && attempt + 1 < order.length) {
          opts.onKeyAdvance?.({
            fromIndex: index,
            toIndex: order[attempt + 1].index,
            reason: e,
          });
          continue;
        }
      }
      throw e;
    }
  }
  throw lastError ?? new Error("All API keys exhausted.");
}

export async function* streamGemini(opts: GeminiStreamOpts): AsyncGenerator<string, void, void> {
  const model = opts.model ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(opts.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: { temperature: 0.3 },
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new GeminiApiError(res.status, text || res.statusText);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const obj = JSON.parse(payload) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = obj.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch {
        // malformed chunk, skip
      }
    }
  }
}

/**
 * Prompt for repairing a mangled question row. The extraction pipeline sometimes
 * drops a closing `$`, runs words together, mixes the Hindi and English halves or
 * mangles option markers. The model only reformats: it must not solve, translate
 * or invent content, because a "fixed" question that no longer matches the paper
 * is worse than a badly rendered one.
 */
export function buildFixPrompt(input: {
  text: string;
  subject: string | null;
  chapter: string | null;
  marks: number | null;
  questionType: string | null;
}): string {
  return [
    "You repair OCR-damaged exam questions from RBSE Class 12 board papers.",
    "",
    `Subject: ${input.subject ?? "unknown"}`,
    `Chapter: ${input.chapter ?? "unknown"}`,
    `Marks: ${input.marks ?? "unknown"}`,
    `Question type: ${input.questionType ?? "unknown"}`,
    "",
    "Repair ONLY the formatting of the question below. Rules:",
    "1. Do NOT answer, solve, explain or comment on the question.",
    "2. Do NOT translate. Keep the Hindi text Hindi and the English text English.",
    "   If both versions are present, keep both: Hindi block first, then a blank line, then English.",
    "3. Fix broken LaTeX. Every inline formula must be wrapped in a matched pair of single dollars,",
    "   every display formula in a matched pair of double dollars. Never leave an unmatched dollar.",
    "   Plain prose must stay OUTSIDE the dollars, never inside \\text{...} covering a whole sentence.",
    "4. Restore spaces between words that were run together, and normal sentence punctuation.",
    "5. Put each multiple-choice option on its own line, labelled (A) (B) (C) (D) or (अ) (ब) (स) (द)",
    "   to match the language of that block. Keep the options in their original order.",
    "6. Keep fill-in-the-blank gaps as a run of underscores.",
    "7. Do not add a question number, marks, headings, commentary, markdown fences or backticks.",
    "8. If the text is already clean, return it unchanged.",
    "",
    "Return ONLY the repaired question text, as plain text with LaTeX dollars and no backticks.",
    "",
    "--- QUESTION ---",
    input.text,
  ].join("\n");
}

export function marksGuidance(marks: number | null | undefined): string {
  const m = marks ?? 0;
  if (m <= 1)
    return "1 mark - write ONE concise sentence (max 2 short lines). State the fact or definition directly. NO headings, NO 'Given/Step/Final Answer' sections - just the clean answer.";
  if (m <= 2)
    return "2 marks - 2-3 short lines containing the key formula or the single main step. NO multi-section headings; keep it a tight, compact answer.";
  if (m <= 3)
    return "3 marks - 4-6 lines. For numeric questions: Formula → Substitution → Result (one short line each). For theory: 3-4 sentences with the key reasoning. Light structure only.";
  if (m <= 4)
    return "4 marks - 6-10 lines with formula, worked steps, and final answer. Short `###` headings (Given / Formula / Steps / Answer) are okay if they clarify; skip them if not.";
  if (m <= 5)
    return "5 marks - 10-15 lines, full derivation: Given → Formula → Steps → Final Answer. Use short `###` headings for each section.";
  return "6+ marks - complete derivation with every step (15-25 lines). Use `###` headings for Given, Formula, Step 1, Step 2, …, Final Answer.";
}

export function fillTemplate(
  template: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key];
    return v == null || v === "" ? "-" : String(v);
  });
}
