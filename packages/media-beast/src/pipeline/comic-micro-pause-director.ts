import type { ComicNarrationReferenceDna } from "./comic-narration-reference-dna.js";

export type ComicMicroPauseCueInput = {
  phraseId: string;
  deliveryMode: string;
  emotionIntensity: number;
  pauseBeforeMs: number;
  pauseAfterMs: number;
  openQuestion: string | null;
  payoffExpectation: string | null;
  shouldHoldVisual: boolean;
};

export type ComicMicroPauseCue = {
  phraseId: string;
  pauseBeforeMs: number;
  pauseAfterMs: number;
  pausePattern: "short" | "medium" | "long";
  pauseReason: string;
};

export type ComicMicroPausePlan = {
  directorId: "comic_micro_pause_director_v1";
  referenceDnaId: ComicNarrationReferenceDna["id"];
  cues: ComicMicroPauseCue[];
  averagePauseAfterMs: number;
  longPauseCount: number;
  repeatedPauseRunCount: number;
  warnings: string[];
  passed: boolean;
};

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pickRange(range: [number, number], index: number) {
  const [min, max] = range;
  const steps = [0.25, 0.65, 0.45, 0.85, 0.15];
  return Math.round(min + (max - min) * (steps[index % steps.length] ?? 0.5));
}

function targetPause(input: ComicMicroPauseCueInput, dna: ComicNarrationReferenceDna, index: number) {
  if (input.deliveryMode === "weighted_reveal" || input.deliveryMode === "emotional_release" || input.payoffExpectation) {
    return { pattern: "long" as const, ms: pickRange(dna.pauseProfile.longPauseMs, index), reason: "virada/payoff precisa respirar" };
  }
  if (input.deliveryMode === "cold_open_question" || input.deliveryMode === "low_suspense" || input.openQuestion) {
    return { pattern: "medium" as const, ms: pickRange(dna.pauseProfile.mediumPauseMs, index), reason: "pergunta ou suspense precisa de expectativa" };
  }
  if (input.deliveryMode === "impact_hit" || input.emotionIntensity >= 0.88) {
    return { pattern: "medium" as const, ms: pickRange(dna.pauseProfile.mediumPauseMs, index) - 50, reason: "impacto precisa pontuar sem frear o ritmo" };
  }
  if (input.deliveryMode === "urgent_escalation") {
    return { pattern: "short" as const, ms: pickRange(dna.pauseProfile.shortPauseMs, index) - 35, reason: "urgencia pede pausa curta" };
  }
  return { pattern: "short" as const, ms: pickRange(dna.pauseProfile.shortPauseMs, index), reason: "cadencia conversacional com micro-pausa" };
}

export function buildComicMicroPausePlan(input: {
  cues: ComicMicroPauseCueInput[];
  referenceDna: ComicNarrationReferenceDna;
}): ComicMicroPausePlan {
  const cues: ComicMicroPauseCue[] = input.cues.map((cue, index) => {
    const target = targetPause(cue, input.referenceDna, index);
    const previous = index > 0 ? input.cues[index - 1] : null;
    const previousDistance = previous ? Math.abs(cue.pauseAfterMs - previous.pauseAfterMs) : 999;
    const antiPatternOffset = previousDistance < 65 ? (index % 2 === 0 ? 90 : -45) : 0;
    const pauseAfterMs = clamp(Math.max(cue.pauseAfterMs, target.ms) + antiPatternOffset, 120, input.referenceDna.pauseProfile.longPauseMs[1]);
    const pauseBeforeMs = cue.shouldHoldVisual
      ? clamp(Math.max(cue.pauseBeforeMs, 80), 0, 260)
      : clamp(cue.pauseBeforeMs, 0, 180);
    return {
      phraseId: cue.phraseId,
      pauseBeforeMs,
      pauseAfterMs,
      pausePattern: target.pattern,
      pauseReason: target.reason,
    };
  });

  for (let index = 2; index < cues.length; index += 1) {
    const cue = cues[index]!;
    const previous = cues[index - 1]!;
    const beforePrevious = cues[index - 2]!;
    const repeated = Math.abs(cue.pauseAfterMs - previous.pauseAfterMs) < 70 && Math.abs(previous.pauseAfterMs - beforePrevious.pauseAfterMs) < 70;
    if (repeated) {
      cue.pauseAfterMs = clamp(cue.pauseAfterMs + (index % 2 === 0 ? 115 : -85), 120, input.referenceDna.pauseProfile.longPauseMs[1]);
    }
  }

  const repeatedPauseRunCount = cues.slice(2).filter((cue, index) => {
    const previous = cues[index + 1]!;
    const beforePrevious = cues[index]!;
    return Math.abs(cue.pauseAfterMs - previous.pauseAfterMs) < 70 && Math.abs(previous.pauseAfterMs - beforePrevious.pauseAfterMs) < 70;
  }).length;
  const longPauseCount = cues.filter((cue) => cue.pausePattern === "long").length;
  const averagePauseAfterMs = round(cues.reduce((sum, cue) => sum + cue.pauseAfterMs, 0) / Math.max(1, cues.length));
  const warnings = [
    ...(input.cues.length >= 6 && repeatedPauseRunCount > 0 ? ["micro_pause_repeated_pattern_detected"] : []),
    ...(longPauseCount === 0 ? ["micro_pause_no_long_reveal_pause"] : []),
    ...(averagePauseAfterMs < input.referenceDna.pauseProfile.shortPauseMs[0] ? ["micro_pause_average_too_short"] : []),
  ];

  return {
    directorId: "comic_micro_pause_director_v1",
    referenceDnaId: input.referenceDna.id,
    cues,
    averagePauseAfterMs,
    longPauseCount,
    repeatedPauseRunCount,
    warnings,
    passed: warnings.length === 0,
  };
}
