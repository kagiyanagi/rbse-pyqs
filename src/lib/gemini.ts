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
        hint: `Gemini's free tier is throttled. Wait ${wait} and try again, or paste a different API key in Settings.`,
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
  if (m <= 1) return "Give a concise 1–2 line answer.";
  if (m <= 2) return "Give a 2–3 line answer with the key step.";
  if (m <= 3) return "Give a 4–6 line answer with the formula and brief reasoning.";
  if (m <= 4) return "Give a 6–10 line answer with the formula and worked steps.";
  if (m <= 5) return "Give a thorough 10–15 line answer with full derivation.";
  return "Give a complete derivation with every step, 15–25 lines.";
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
