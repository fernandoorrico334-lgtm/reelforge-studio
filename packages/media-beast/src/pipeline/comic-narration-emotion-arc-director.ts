import type { ComicNarratorDirectorCue } from "./comic-narrator-director.js";

export type ComicNarrationEmotionArcStep = {
  phraseId: string;
  sourceBeatIndex: number;
  arcStage: "hook" | "context" | "suspense" | "escalation" | "impact" | "payoff";
  targetEmotionIntensity: number;
  deliveryMode: string;
  instruction: string;
};

export type ComicNarrationEmotionArcPlan = {
  directorId: "comic_narration_emotion_arc_director_v1";
  steps: ComicNarrationEmotionArcStep[];
  stageCount: number;
  averageTargetEmotionIntensity: number;
  peakIntensity: number;
  warnings: string[];
  passed: boolean;
};

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function stageFor(cue: ComicNarratorDirectorCue, index: number, total: number): ComicNarrationEmotionArcStep["arcStage"] {
  if (index === 0 || cue.deliveryMode === "cold_open_question") return "hook";
  if (cue.deliveryMode === "low_suspense") return "suspense";
  if (cue.deliveryMode === "urgent_escalation") return "escalation";
  if (cue.deliveryMode === "impact_hit") return "impact";
  if (cue.deliveryMode === "weighted_reveal" || cue.deliveryMode === "emotional_release" || index >= total - 2) return "payoff";
  return "context";
}

function instructionFor(stage: ComicNarrationEmotionArcStep["arcStage"]) {
  if (stage === "hook") return "Abra baixo e curioso, como quem promete uma historia maior do que a primeira imagem mostra.";
  if (stage === "context") return "Explique com clareza, mas mantenha uma pergunta viva no fundo da frase.";
  if (stage === "suspense") return "Reduza energia, segure a ultima palavra e deixe a suspeita respirar.";
  if (stage === "escalation") return "Aumente velocidade e tensao; a frase precisa parecer que o perigo esta chegando.";
  if (stage === "impact") return "Ataque o verbo principal, pause depois do impacto e deixe a imagem bater junto.";
  return "Feche a resposta com peso e abra vontade de continuar.";
}

export function buildComicNarrationEmotionArcPlan(input: { cues: ComicNarratorDirectorCue[] }): ComicNarrationEmotionArcPlan {
  const total = Math.max(1, input.cues.length);
  const steps = input.cues.map((cue, index) => {
    const stage = stageFor(cue, index, total);
    const progressBoost = index / Math.max(1, total - 1) * 0.12;
    const stageBoost = stage === "impact" ? 0.14 : stage === "payoff" ? 0.1 : stage === "suspense" ? 0.06 : 0;
    return {
      phraseId: cue.phraseId,
      sourceBeatIndex: cue.sourceBeatIndex,
      arcStage: stage,
      targetEmotionIntensity: round(Math.min(1, Math.max(cue.emotionIntensity, 0.62 + progressBoost + stageBoost))),
      deliveryMode: cue.deliveryMode,
      instruction: instructionFor(stage),
    };
  });
  const stageCount = new Set(steps.map((step) => step.arcStage)).size;
  const averageTargetEmotionIntensity = round(steps.reduce((sum, step) => sum + step.targetEmotionIntensity, 0) / Math.max(1, steps.length));
  const peakIntensity = round(Math.max(...steps.map((step) => step.targetEmotionIntensity), 0));
  const warnings = [
    ...(stageCount < 4 ? ["emotion_arc_too_flat"] : []),
    ...(peakIntensity < 0.82 ? ["emotion_arc_has_no_peak"] : []),
    ...(steps.length > 3 && steps.slice(-2).every((step) => step.arcStage !== "payoff") ? ["emotion_arc_missing_payoff_end"] : []),
  ];
  return {
    directorId: "comic_narration_emotion_arc_director_v1",
    steps,
    stageCount,
    averageTargetEmotionIntensity,
    peakIntensity,
    warnings,
    passed: warnings.length === 0,
  };
}
