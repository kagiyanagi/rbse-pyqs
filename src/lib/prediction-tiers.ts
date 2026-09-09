// Bands of the question-level repeat chance (`QuestionPrediction.p`). Shared by the badge, the
// "Repeat chance" filter and the API so that a card's badge and its filter membership always agree.
// The distribution is skewed: the median PCM question sits near 1-2%, the top decile above 7%,
// the maximum around 60%.
export const PREDICTION_TIERS = [
  { id: "high", label: "High (20% or more)", min: 0.2 },
  { id: "above_avg", label: "Above average (10–20%)", min: 0.1 },
  { id: "average", label: "Average (4–10%)", min: 0.04 },
  { id: "low", label: "Low (under 4%)", min: 0 },
] as const;

export type PredictionTierId = (typeof PREDICTION_TIERS)[number]["id"];

export const PREDICTION_TIER_IDS = PREDICTION_TIERS.map((t) => t.id) as PredictionTierId[];

export function predictionTierOf(p: number): PredictionTierId {
  for (const t of PREDICTION_TIERS) if (p >= t.min) return t.id;
  return "low";
}

/** Accepts tier ids in any case; unknown values are dropped. */
export function parsePredictionTiers(values: string[]): Set<PredictionTierId> {
  const out = new Set<PredictionTierId>();
  for (const v of values) {
    const k = v.trim().toLowerCase();
    if ((PREDICTION_TIER_IDS as string[]).includes(k)) out.add(k as PredictionTierId);
  }
  return out;
}
