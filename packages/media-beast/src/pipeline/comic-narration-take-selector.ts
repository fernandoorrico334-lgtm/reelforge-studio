import type { ComicNarrationPhrasePerformance } from "./comic-narration-performance-director.js";

export type ComicNarrationTakeMeasurement = {
  takeId: string;
  path: string;
  durationSeconds: number;
  asrSimilarity?: number;
  clippingDetected?: boolean;
  silenceRatio?: number;
  expressiveRangeDb?: number;
  energyVariation?: number;
};

export type ComicNarrationTakeSelection = {
  phraseId: string;
  selectedTakeId: string;
  selectedPath: string;
  score: number;
  targetDurationSeconds: number;
  measuredDurationSeconds: number;
  rejectedTakes: Array<{ takeId: string; score: number; reason: string }>;
};

function words(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function scoreTake(performance: ComicNarrationPhrasePerformance, take: ComicNarrationTakeMeasurement, targetDurationSeconds: number, targetExpressiveRangeDb: number) {
  const timingError = Math.abs(take.durationSeconds - targetDurationSeconds) / Math.max(0.35, targetDurationSeconds);
  let score = 100 - timingError * 24;
  if (typeof take.asrSimilarity === "number") score += (take.asrSimilarity - 0.8) * 45;
  if (take.clippingDetected) score -= 35;
  if ((take.silenceRatio ?? 0) > 0.35) score -= 18;
  if (typeof take.expressiveRangeDb === "number") {
    score -= Math.min(12, Math.abs(take.expressiveRangeDb - targetExpressiveRangeDb) * 1.2);
    if (take.expressiveRangeDb < 6) score -= 20;
  }
  if (typeof take.energyVariation === "number" && take.energyVariation < 0.35) score -= 15;
  if (performance.narrativeFunction === "question" && take.durationSeconds < targetDurationSeconds * 0.78) score -= 12;
  if (performance.narrativeFunction === "impact" && take.durationSeconds > targetDurationSeconds * 1.28) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function selectComicNarrationTake(input: {
  performance: ComicNarrationPhrasePerformance;
  takes: ComicNarrationTakeMeasurement[];
  targetExpressiveRangeDb?: number;
}): ComicNarrationTakeSelection {
  if (!input.takes.length) throw new Error(`No narration takes provided for ${input.performance.phraseId}.`);
  const targetDurationSeconds = words(input.performance.text) / (input.performance.targetWordsPerMinute / 60);
  const scored = input.takes.map((take) => ({ take, score: scoreTake(input.performance, take, targetDurationSeconds, input.targetExpressiveRangeDb ?? 5) })).sort((left, right) => right.score - left.score || left.take.takeId.localeCompare(right.take.takeId));
  const selected = scored[0]!;
  return {
    phraseId: input.performance.phraseId,
    selectedTakeId: selected.take.takeId,
    selectedPath: selected.take.path,
    score: selected.score,
    targetDurationSeconds: Number(targetDurationSeconds.toFixed(3)),
    measuredDurationSeconds: Number(selected.take.durationSeconds.toFixed(3)),
    rejectedTakes: scored.slice(1).map(({ take, score }) => ({ takeId: take.takeId, score, reason: score < selected.score ? "lower_prosody_timing_fit" : "deterministic_tie_break" })),
  };
}
