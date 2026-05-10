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
    if (err.status === 401 || err.status === 403) {
      return {
        title: "API key rejected",
        hint: "Your Gemini key is missing, expired, or restricted. Update it in Settings → Gemini API key.",
        raw,
        status: err.status,
      };
    }
    if (err.status === 400) {
      return {
        title: "Bad request",
        hint: "Gemini rejected the prompt. The question text might be malformed — try a different question or model.",
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
// switch to the next key. Mid-stream errors are not retried — that would
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
        const rotatable = e.status === 429 || e.status === 401 || e.status === 403;
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

export function marksGuidance(marks: number | null | undefined): string {
  const m = marks ?? 0;
  if (m <= 1)
    return "1 mark — write ONE concise sentence (max 2 short lines). State the fact or definition directly. NO headings, NO 'Given/Step/Final Answer' sections — just the clean answer.";
  if (m <= 2)
    return "2 marks — 2–3 short lines containing the key formula or the single main step. NO multi-section headings; keep it a tight, compact answer.";
  if (m <= 3)
    return "3 marks — 4–6 lines. For numeric questions: Formula → Substitution → Result (one short line each). For theory: 3–4 sentences with the key reasoning. Light structure only.";
  if (m <= 4)
    return "4 marks — 6–10 lines with formula, worked steps, and final answer. Short `###` headings (Given / Formula / Steps / Answer) are okay if they clarify; skip them if not.";
  if (m <= 5)
    return "5 marks — 10–15 lines, full derivation: Given → Formula → Steps → Final Answer. Use short `###` headings for each section.";
  return "6+ marks — complete derivation with every step (15–25 lines). Use `###` headings for Given, Formula, Step 1, Step 2, …, Final Answer.";
}

export function fillTemplate(
  template: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key];
    return v == null || v === "" ? "—" : String(v);
  });
}
