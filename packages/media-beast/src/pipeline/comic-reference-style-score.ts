import type { ComicNarrationReferenceDna } from "./comic-narration-reference-dna.js";
import type { ComicNarratorDirectorPlan } from "./comic-narrator-director.js";
import type { ComicNarrationEmotionArcPlan } from "./comic-narration-emotion-arc-director.js";

export type ComicReferenceStyleScore = {
  scorerId: "comic_reference_style_score_v1";
  referenceDnaId: ComicNarrationReferenceDna["id"];
  score: number;
  pauseScore: number;
  emotionScore: number;
  deliveryVarietyScore: number;
  questionScore: number;
  warnings: string[];
  status: "passed" | "rejected";
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreComicNarrationAgainstReference(input: {
  referenceDna: ComicNarrationReferenceDna;
  narratorPlan: ComicNarratorDirectorPlan;
  emotionArcPlan: ComicNarrationEmotionArcPlan;
}): ComicReferenceStyleScore {
  const dna = input.referenceDna;
  const targetPause = (dna.pauseProfile.mediumPauseMs[0] + dna.pauseProfile.mediumPauseMs[1]) / 2;
  const pauseScore = clamp(100 - Math.abs(input.narratorPlan.averagePauseAfterMs - targetPause) * 0.12);
  const emotionScore = clamp((input.narratorPlan.averageEmotionIntensity / Math.max(0.1, dna.emotionalProfile.minimumEmotionIntensity)) * 92);
  const deliveryVarietyScore = clamp(input.narratorPlan.deliveryModeCount / Math.max(1, dna.emotionalProfile.preferredDeliveryModes.length) * 100 + 10);
  const questionScore = clamp(Math.min(1, input.narratorPlan.openQuestionCount / 2) * 100);
  const arcScore = clamp(input.emotionArcPlan.stageCount / 4 * 100);
  const score = clamp(pauseScore * 0.22 + emotionScore * 0.24 + deliveryVarietyScore * 0.2 + questionScore * 0.17 + arcScore * 0.17);
  const warnings = [
    ...(score < 86 ? [`reference_style_score_low:${score}`] : []),
    ...(pauseScore < 78 ? ["reference_pause_match_low"] : []),
    ...(emotionScore < 86 ? ["reference_emotion_match_low"] : []),
    ...(questionScore < 70 ? ["reference_question_retention_low"] : []),
  ];
  return { scorerId: "comic_reference_style_score_v1", referenceDnaId: dna.id, score, pauseScore, emotionScore, deliveryVarietyScore, questionScore, warnings, status: warnings.length === 0 ? "passed" : "rejected" };
}
