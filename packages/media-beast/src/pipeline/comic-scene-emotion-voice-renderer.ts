import type { ComicNarratorDirectorCue } from "./comic-narrator-director.js";
import type { ComicNarrationEmotionArcPlan } from "./comic-narration-emotion-arc-director.js";

export type ComicSceneEmotionVoiceCue = {
  phraseId: string;
  deliveryMode: string;
  arcStage: string;
  targetWordsPerMinute: number;
  gainDb: number;
  pauseBeforeMs: number;
  pauseAfterMs: number;
  expressiveRangeDb: number;
  ttsExaggeration: number;
  ttsTemperature: number;
  instruction: string;
};

export type ComicSceneEmotionVoicePlan = {
  directorId: "comic_scene_emotion_voice_renderer_v1";
  cues: ComicSceneEmotionVoiceCue[];
  cueCount: number;
  averageExpressiveRangeDb: number;
  averageGainDb: number;
  warnings: string[];
  passed: boolean;
};

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function profileFor(stage: string, mode: string) {
  if (stage === "hook") return { speed: 150, gain: -0.2, range: 15, exaggeration: 0.72, temperature: 0.66 };
  if (stage === "suspense") return { speed: 144, gain: -0.45, range: 16, exaggeration: 0.76, temperature: 0.68 };
  if (stage === "escalation") return { speed: 180, gain: 0.45, range: 17, exaggeration: 0.78, temperature: 0.7 };
  if (stage === "impact" || mode === "impact_hit") return { speed: 174, gain: 0.85, range: 20, exaggeration: 0.82, temperature: 0.72 };
  if (stage === "payoff") return { speed: 148, gain: 0.15, range: 18, exaggeration: 0.78, temperature: 0.67 };
  return { speed: 165, gain: 0, range: 13, exaggeration: 0.68, temperature: 0.64 };
}

export function buildComicSceneEmotionVoicePlan(input: {
  narratorCues: ComicNarratorDirectorCue[];
  emotionArcPlan: ComicNarrationEmotionArcPlan;
}): ComicSceneEmotionVoicePlan {
  const arcByPhrase = new Map(input.emotionArcPlan.steps.map((step) => [step.phraseId, step]));
  const cues = input.narratorCues.map((cue): ComicSceneEmotionVoiceCue => {
    const arc = arcByPhrase.get(cue.phraseId);
    const stage = arc?.arcStage ?? "context";
    const profile = profileFor(stage, cue.deliveryMode);
    const intensityBoost = (arc?.targetEmotionIntensity ?? cue.emotionIntensity) - 0.7;
    return {
      phraseId: cue.phraseId,
      deliveryMode: cue.deliveryMode,
      arcStage: stage,
      targetWordsPerMinute: Math.round(profile.speed + intensityBoost * 18),
      gainDb: round(profile.gain + intensityBoost * 0.8),
      pauseBeforeMs: cue.pauseBeforeMs,
      pauseAfterMs: cue.pauseAfterMs,
      expressiveRangeDb: round(profile.range + Math.max(0, intensityBoost) * 5),
      ttsExaggeration: round(Math.min(0.9, profile.exaggeration + Math.max(0, intensityBoost) * 0.08)),
      ttsTemperature: round(Math.min(0.78, profile.temperature + Math.max(0, intensityBoost) * 0.04)),
      instruction: `${arc?.instruction ?? cue.performanceNote} Voz: ${stage}, ${cue.deliveryMode}.`,
    };
  });
  const averageExpressiveRangeDb = round(cues.reduce((sum, cue) => sum + cue.expressiveRangeDb, 0) / Math.max(1, cues.length));
  const averageGainDb = round(cues.reduce((sum, cue) => sum + cue.gainDb, 0) / Math.max(1, cues.length));
  const minimumStageCount = cues.length < 8 ? 3 : 4;
  const warnings = [
    ...(averageExpressiveRangeDb < 14 ? ["scene_voice_expressive_range_too_low"] : []),
    ...(new Set(cues.map((cue) => cue.arcStage)).size < minimumStageCount ? ["scene_voice_arc_too_flat"] : []),
  ];
  return { directorId: "comic_scene_emotion_voice_renderer_v1", cues, cueCount: cues.length, averageExpressiveRangeDb, averageGainDb, warnings, passed: warnings.length === 0 };
}
