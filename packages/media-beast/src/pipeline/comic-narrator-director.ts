import type { ComicNarrationActingPlan, ComicNarrationActingDirection } from "./comic-narration-acting-director-v2.js";
import type { ComicNarrationPerformancePlan } from "./comic-narration-performance-director.js";
import { getComicNarrationReferenceDnaById, type ComicNarrationReferenceDnaId } from "./comic-narration-reference-dna.js";
import { buildComicMicroPausePlan, type ComicMicroPausePlan } from "./comic-micro-pause-director.js";
import { applyComicTtsPronunciation } from "./comic-pronunciation-dictionary.js";

export type ComicNarratorDeliveryMode =
  | "cold_open_question"
  | "low_suspense"
  | "controlled_storytelling"
  | "urgent_escalation"
  | "impact_hit"
  | "weighted_reveal"
  | "emotional_release";

export type ComicNarratorDirectorCue = {
  phraseId: string;
  sourceBeatId: string;
  sourceBeatIndex: number;
  displayText: string;
  spokenText: string;
  appliedPronunciations: string[];
  deliveryMode: ComicNarratorDeliveryMode;
  performanceNote: string;
  visualContract: string;
  openQuestion: string | null;
  payoffExpectation: string | null;
  emphasisWords: string[];
  pauseBeforeMs: number;
  pauseAfterMs: number;
  targetWordsPerMinute: number;
  emotionIntensity: number;
  shouldHoldVisual: boolean;
  referenceDnaId: ComicNarrationReferenceDnaId;
  microPausePattern: "short" | "medium" | "long";
  pauseReason: string;
};

export type ComicNarratorDirectorPlan = {
  directorId: "comic_narrator_director_v1";
  cues: ComicNarratorDirectorCue[];
  cueCount: number;
  deliveryModeCount: number;
  openQuestionCount: number;
  visualContractCoverage: number;
  performanceNoteCoverage: number;
  averageEmotionIntensity: number;
  referenceDnaId: ComicNarrationReferenceDnaId;
  microPausePlan: ComicMicroPausePlan;
  averagePauseAfterMs: number;
  longPauseCount: number;
  warnings: string[];
  passed: boolean;
};

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function modeFor(direction: ComicNarrationActingDirection): ComicNarratorDeliveryMode {
  if (direction.intention === "hook") return "cold_open_question";
  if (direction.intention === "conceal") return "low_suspense";
  if (direction.intention === "danger") return "urgent_escalation";
  if (direction.intention === "action" || direction.intention === "confront") return "impact_hit";
  if (direction.intention === "reveal") return "weighted_reveal";
  if (direction.intention === "resolve") return "emotional_release";
  return "controlled_storytelling";
}

function noteFor(mode: ComicNarratorDeliveryMode, text: string) {
  if (mode === "cold_open_question") return "Abra como narrador de trailer: baixo, curioso, criando uma pergunta antes de explicar.";
  if (mode === "low_suspense") return "Fale mais baixo, segure a ultima palavra e deixe a suspeita no ar.";
  if (mode === "urgent_escalation") return "Acelere um pouco, como se o perigo estivesse chegando na tela.";
  if (mode === "impact_hit") return "Ataque os verbos de acao e deixe o impacto respirar antes da proxima frase.";
  if (mode === "weighted_reveal") return "Comece contido, pause antes da virada e entregue a revelacao com peso.";
  if (mode === "emotional_release") return "Desacelere e deixe a consequencia humana aparecer, sem perder tensao.";
  return text.includes("?")
    ? "Conduza como pergunta aberta, sem responder tudo cedo demais."
    : "Conte como historia acontecendo agora, nao como resumo de quadrinho.";
}

function visualContract(direction: ComicNarrationActingDirection) {
  const terms = direction.expectedVisualTerms.slice(0, 3);
  if (terms.length === 0) return "A imagem precisa provar a frase com personagem, objeto ou acao visivel.";
  return "A imagem precisa focar em: " + terms.join(", ") + ". Se nao aparecer, trocar painel ou crop.";
}

function openQuestionFor(direction: ComicNarrationActingDirection, mode: ComicNarratorDeliveryMode) {
  if (mode === "cold_open_question") return direction.actingText.endsWith("?") ? direction.actingText : "Por que isso aconteceu?";
  if (mode === "low_suspense") return "O que ainda nao foi revelado?";
  if (mode === "urgent_escalation") return "Como eles vao impedir isso a tempo?";
  if (mode === "impact_hit") return "Qual vai ser a consequencia desse golpe?";
  return null;
}

function payoffExpectationFor(direction: ComicNarrationActingDirection, mode: ComicNarratorDeliveryMode) {
  if (mode === "weighted_reveal") return "A frase precisa fechar uma duvida aberta ou revelar uma causa.";
  if (mode === "emotional_release") return "A frase precisa entregar consequencia e preparar o proximo gancho.";
  return null;
}

function emotionIntensity(direction: ComicNarrationActingDirection) {
  const base = direction.targetExpressiveRangeDb / 20;
  const contourBoost = direction.endingContour === "impact" ? 0.12 : direction.endingContour === "suspend" ? 0.08 : 0;
  return round(Math.max(0.35, Math.min(1, base + contourBoost)));
}

export function buildComicNarratorDirectorPlan(input: {
  actingPlan: ComicNarrationActingPlan;
  performancePlan: ComicNarrationPerformancePlan;
  referenceDnaId?: ComicNarrationReferenceDnaId;
}): ComicNarratorDirectorPlan {
  const referenceDna = getComicNarrationReferenceDnaById(input.referenceDnaId ?? "thwip_storytelling_v1");
  const performanceByPhrase = new Map(input.performancePlan.performances.map((performance) => [performance.phraseId, performance]));
  const baseCues = input.actingPlan.directions.map((direction) => {
    const performance = performanceByPhrase.get(direction.phraseId);
    const mode = modeFor(direction);
    const intensity = emotionIntensity(direction);
    const pronunciation = applyComicTtsPronunciation(direction.actingText);
    return {
      phraseId: direction.phraseId,
      sourceBeatId: direction.sourceBeatId,
      sourceBeatIndex: direction.sourceBeatIndex,
      displayText: direction.displayText,
      spokenText: pronunciation.spokenText,
      appliedPronunciations: pronunciation.appliedLabels,
      deliveryMode: mode,
      performanceNote: noteFor(mode, direction.displayText),
      visualContract: visualContract(direction),
      openQuestion: openQuestionFor(direction, mode),
      payoffExpectation: payoffExpectationFor(direction, mode),
      emphasisWords: direction.expectedVisualTerms.slice(0, 4),
      pauseBeforeMs: direction.pauseBeforeMs,
      pauseAfterMs: Math.max(direction.pauseAfterMs, mode === "weighted_reveal" ? 220 : mode === "emotional_release" ? 260 : direction.pauseAfterMs),
      targetWordsPerMinute: performance?.targetWordsPerMinute ?? 160,
      emotionIntensity: intensity,
      shouldHoldVisual: mode === "weighted_reveal" || mode === "low_suspense" || intensity >= 0.85,
    };
  });
  const microPausePlan = buildComicMicroPausePlan({ cues: baseCues, referenceDna });
  const microPauseByPhrase = new Map(microPausePlan.cues.map((cue) => [cue.phraseId, cue]));
  const cues: ComicNarratorDirectorCue[] = baseCues.map((cue) => {
    const microPause = microPauseByPhrase.get(cue.phraseId);
    return {
      ...cue,
      pauseBeforeMs: microPause?.pauseBeforeMs ?? cue.pauseBeforeMs,
      pauseAfterMs: microPause?.pauseAfterMs ?? cue.pauseAfterMs,
      referenceDnaId: referenceDna.id,
      microPausePattern: microPause?.pausePattern ?? "short",
      pauseReason: microPause?.pauseReason ?? "cadencia narrativa",
    };
  });

  const deliveryModeCount = new Set(cues.map((cue) => cue.deliveryMode)).size;
  const visualContractCoverage = round(cues.filter((cue) => cue.visualContract.length > 0).length / Math.max(1, cues.length));
  const performanceNoteCoverage = round(cues.filter((cue) => cue.performanceNote.length > 0).length / Math.max(1, cues.length));
  const averageEmotionIntensity = round(cues.reduce((sum, cue) => sum + cue.emotionIntensity, 0) / Math.max(1, cues.length));
  const openQuestionCount = cues.filter((cue) => cue.openQuestion).length;
  const requiredDeliveryModeCount = Math.min(4, Math.max(3, Math.ceil(cues.length * 0.45)));
  const warnings = [
    ...(deliveryModeCount < requiredDeliveryModeCount ? ["narrator_delivery_modes_too_flat"] : []),
    ...(openQuestionCount === 0 ? ["narrator_has_no_open_questions"] : []),
    ...(visualContractCoverage < 1 ? ["narrator_visual_contract_missing"] : []),
    ...(averageEmotionIntensity < referenceDna.emotionalProfile.minimumEmotionIntensity ? ["narrator_emotion_intensity_too_low"] : []),
    ...microPausePlan.warnings,
  ];

  return {
    directorId: "comic_narrator_director_v1",
    cues,
    cueCount: cues.length,
    deliveryModeCount,
    openQuestionCount,
    visualContractCoverage,
    performanceNoteCoverage,
    averageEmotionIntensity,
    referenceDnaId: referenceDna.id,
    microPausePlan,
    averagePauseAfterMs: microPausePlan.averagePauseAfterMs,
    longPauseCount: microPausePlan.longPauseCount,
    warnings,
    passed: cues.length > 0 && warnings.length === 0,
  };
}

export function summarizeComicNarratorDirectorPlan(plan: ComicNarratorDirectorPlan) {
  return {
    directorId: plan.directorId,
    cueCount: plan.cueCount,
    deliveryModeCount: plan.deliveryModeCount,
    openQuestionCount: plan.openQuestionCount,
    visualContractCoverage: plan.visualContractCoverage,
    averageEmotionIntensity: plan.averageEmotionIntensity,
    referenceDnaId: plan.referenceDnaId,
    averagePauseAfterMs: plan.averagePauseAfterMs,
    longPauseCount: plan.longPauseCount,
    status: plan.passed ? "passed" : "rejected",
    warnings: plan.warnings,
  };
}

