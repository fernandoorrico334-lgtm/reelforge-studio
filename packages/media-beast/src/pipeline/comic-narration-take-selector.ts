import type { ComicNarrationPhrasePerformance } from "./comic-narration-performance-director.js";

export type ComicNarrationTakeMeasurement = {
  takeId: string;
  path: string;
  durationSeconds: number;
  asrSimilarity?: number;
  asrTranscript?: string;
  asrPassed?: boolean;
  clippingDetected?: boolean;
  silenceRatio?: number;
  expressiveRangeDb?: number;
  energyVariation?: number;
  activeRmsDb?: number;
  peakDb?: number;
  activeFloorDb?: number;
  presenceConsistency?: number;
};

export type ComicNarrationTakeSelection = {
  phraseId: string;
  selectedTakeId: string;
  selectedPath: string;
  score: number;
  targetDurationSeconds: number;
  measuredDurationSeconds: number;
  rejectedTakes: Array<{ takeId: string; score: number; reason: string }>;
  selectedActiveRmsDb: number | null;
  selectedPeakDb: number | null;
  presencePassed: boolean;
  selectedAsrSimilarity: number | null;
  asrPassed: boolean;
};

function words(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function scoreTake(performance: ComicNarrationPhrasePerformance, take: ComicNarrationTakeMeasurement, targetDurationSeconds: number, targetExpressiveRangeDb: number, targetActiveRmsDb?: number, targetPeakDb?: number) {
  const timingError = Math.abs(take.durationSeconds - targetDurationSeconds) / Math.max(0.35, targetDurationSeconds);
  let score = 100 - timingError * 24;
  if (typeof take.asrSimilarity === "number") score += (take.asrSimilarity - 0.8) * 100;
  if (take.clippingDetected) score -= 35;
  if ((take.silenceRatio ?? 0) > 0.35) score -= 18;
  if (typeof take.expressiveRangeDb === "number") {
    score -= Math.min(12, Math.abs(take.expressiveRangeDb - targetExpressiveRangeDb) * 1.2);
    if (take.expressiveRangeDb < 6) score -= 20;
  }
  if (typeof take.energyVariation === "number" && take.energyVariation < 0.35) score -= 15;
  if (performance.narrativeFunction === "question" && take.durationSeconds < targetDurationSeconds * 0.78) score -= 12;
  if (performance.narrativeFunction === "impact" && take.durationSeconds > targetDurationSeconds * 1.28) score -= 10;
  if (typeof take.activeRmsDb === "number") {
    if (take.activeRmsDb < -28) score -= 38;
    else if (take.activeRmsDb < -25) score -= 14;
    else if (take.activeRmsDb > -17) score -= 6;
  }
  if (typeof take.peakDb === "number" && take.peakDb < -14) score -= 16;
  if (typeof targetActiveRmsDb === "number" && typeof take.activeRmsDb === "number") score -= Math.min(18, Math.abs(take.activeRmsDb - targetActiveRmsDb) * 3);
  if (typeof targetPeakDb === "number" && typeof take.peakDb === "number") score -= Math.min(10, Math.abs(take.peakDb - targetPeakDb) * 1.2);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function selectComicNarrationTake(input: {
  performance: ComicNarrationPhrasePerformance;
  takes: ComicNarrationTakeMeasurement[];
  targetExpressiveRangeDb?: number;
  targetActiveRmsDb?: number;
  targetPeakDb?: number;
}): ComicNarrationTakeSelection {
  if (!input.takes.length) throw new Error(`No narration takes provided for ${input.performance.phraseId}.`);
  const targetDurationSeconds = words(input.performance.text) / (input.performance.targetWordsPerMinute / 60);
  const scored = input.takes.map((take) => ({ take, score: scoreTake(input.performance, take, targetDurationSeconds, input.targetExpressiveRangeDb ?? 5, input.targetActiveRmsDb, input.targetPeakDb) })).sort((left, right) => right.score - left.score || left.take.takeId.localeCompare(right.take.takeId));
  const eligible = scored.filter(({ take }) => typeof take.asrSimilarity !== "number" || take.asrSimilarity >= 0.72);
  const selected = eligible[0] ?? scored[0]!;
  return {
    phraseId: input.performance.phraseId,
    selectedTakeId: selected.take.takeId,
    selectedPath: selected.take.path,
    score: selected.score,
    targetDurationSeconds: Number(targetDurationSeconds.toFixed(3)),
    measuredDurationSeconds: Number(selected.take.durationSeconds.toFixed(3)),
    selectedActiveRmsDb: selected.take.activeRmsDb ?? null,
    selectedPeakDb: selected.take.peakDb ?? null,
    presencePassed: typeof selected.take.activeRmsDb !== "number" || typeof selected.take.peakDb !== "number" || (selected.take.activeRmsDb >= -28 && selected.take.peakDb >= -14),
    selectedAsrSimilarity: selected.take.asrSimilarity ?? null,
    asrPassed: typeof selected.take.asrSimilarity !== "number" || selected.take.asrSimilarity >= 0.72,
    rejectedTakes: scored.filter(({ take }) => take.takeId !== selected.take.takeId).map(({ take, score }) => ({ takeId: take.takeId, score, reason: typeof take.asrSimilarity === "number" && take.asrSimilarity < 0.72 ? "asr_intelligibility_below_threshold" : score < selected.score ? "lower_prosody_timing_fit" : "deterministic_tie_break" })),
  };
}
