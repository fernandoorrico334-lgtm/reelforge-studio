import { analyzeCaptionQuality, getCaptionStyleById } from "@reelforge/caption-engine";
import { generateCaptionDirection, type CaptionDirectionCue } from "./caption-direction-engine.js";
import type { ComicShortProductionPlan, ComicShortScenePlan } from "./comic-shorts-factory.js";
import { doctorComicSceneNarration, type ComicNarrationDoctorResult } from "./comic-narration-doctor.js";

export type ComicNarrationBeatRole =
  | "hook_shock"
  | "setup_anchor"
  | "tension_raise"
  | "impact_reveal"
  | "loop_close";

export type ComicCaptionTimingCue = {
  cueIndex: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
  highlightedWords: string[];
  layout: CaptionDirectionCue["layout"];
  animation: CaptionDirectionCue["animation"];
  sfxSuggestion: CaptionDirectionCue["sfxSuggestion"];
  readingImpactScore: number;
  readingWarnings: string[];
};

export type ComicCaptionNarrationSceneDirection = {
  sceneOrder: number;
  panelId: string;
  role: ComicNarrationBeatRole;
  narrationText: string;
  narrationDelivery: {
    pace: "fast" | "medium";
    voiceEnergy: "high" | "extreme";
    pauseAfterMs: number;
    emphasisWords: string[];
    oralNotes: string;
  };
  captionText: string;
  captionCues: ComicCaptionTimingCue[];
  captionQualityScore: number;
  captionWarnings: string[];
  narrationDoctor: ComicNarrationDoctorResult;
};

export type ComicCaptionNarrationDirectorReport = {
  directorId: "comic_caption_narration_v2";
  styleTarget: "viral_comic_hype";
  averageCaptionQualityScore: number;
  narrationWordCount: number;
  captionCueCount: number;
  scenes: ComicCaptionNarrationSceneDirection[];
  averagePanelAlignmentScore: number;
  warnings: string[];
};

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeNoAccent(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function subjectFromTitle(title: string): string {
  return title
    .replace(/^(luta|curiosidade|revelacao|origem|transformacao|relacao|humor|cliffhanger|momento visual):\s*/i, "")
    .trim() || title;
}

function roleForScene(scene: ComicShortScenePlan): ComicNarrationBeatRole {
  if (scene.role === "hook") return "hook_shock";
  if (scene.role === "context") return "setup_anchor";
  if (scene.role === "development") return "tension_raise";
  if (scene.role === "climax") return "impact_reveal";
  return "loop_close";
}

function impactVerbForCategory(category: ComicShortProductionPlan["category"]): string {
  if (category === "fight") return "vira a luta";
  if (category === "transformation") return "muda o corpo da historia";
  if (category === "reveal" || category === "cliffhanger") return "entrega a pista que faltava";
  if (category === "relationship") return "muda a relacao entre eles";
  if (category === "humor") return "faz a cena funcionar";
  return "muda a leitura da pagina";
}

function buildNarration(scene: ComicShortScenePlan, short: ComicShortProductionPlan): string {
  const subject = subjectFromTitle(short.title);
  const original = cleanText(scene.narration).replace(/^esse momento parece simples, mas\s*/i, "");
  const role = roleForScene(scene);

  if (role === "hook_shock") {
    return `Olha esse painel: parece so impacto, mas ele ${impactVerbForCategory(short.category)} de ${subject}.`;
  }
  if (role === "setup_anchor") {
    return `A pagina primeiro te prende no contexto, porque sem esse detalhe o proximo golpe perde forca.`;
  }
  if (role === "tension_raise") {
    const trimmed = original.length > 90 ? `${original.slice(0, 86).replace(/\s+\S*$/, "")}...` : original;
    return `${trimmed} E repara: a tensao sobe antes do corte.`;
  }
  if (role === "impact_reveal") {
    return `Aqui vem a virada. Esse painel e o ponto exato onde o short precisa explodir.`;
  }
  return `E esse fechamento deixa a melhor pergunta: o que acontece na pagina seguinte?`;
}

function pickKeywords(text: string, short: ComicShortProductionPlan): string[] {
  const preferred = [
    ...subjectFromTitle(short.title).split(/\s+/),
    "painel",
    "virada",
    "impacto",
    "luta",
    "segredo",
    "pagina"
  ];
  const normalized = normalizeNoAccent(text);
  const hits = preferred
    .map((word) => word.replace(/[^a-zA-Z?-?0-9-]/g, ""))
    .filter((word) => word.length > 2 && normalized.includes(normalizeNoAccent(word)));
  return [...new Set(hits)].slice(0, 4);
}

function captionWordsFromNarration(text: string, short: ComicShortProductionPlan, role: ComicNarrationBeatRole): string[] {
  const keywords = pickKeywords(text, short);
  if (role === "hook_shock") return ["ESSE", "PAINEL", "MUDA", ...(keywords.slice(0, 2).map((w) => w.toUpperCase()))].slice(0, 6);
  if (role === "impact_reveal") return ["A", "VIRADA", "ESTA", "AQUI"];
  if (role === "loop_close") return ["E", "AGORA", "VEM", "A", "PERGUNTA"];
  const words = text
    .replace(/[.,!?;:]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 7)
    .map((word) => word.toUpperCase());
  return words.length >= 3 ? words : ["REPARA", "NESSE", "DETALHE"];
}

function splitCueText(words: string[], maxWordsPerCue: number): string[] {
  const cues: string[] = [];
  for (let index = 0; index < words.length; index += maxWordsPerCue) {
    cues.push(words.slice(index, index + maxWordsPerCue).join(" "));
  }
  return cues.filter(Boolean).slice(0, 2);
}

function cueTimings(sceneDuration: number, cueCount: number): Array<{ start: number; end: number }> {
  const safeDuration = Math.max(sceneDuration, 1.1);
  const cueDuration = safeDuration / Math.max(cueCount, 1);
  return Array.from({ length: cueCount }, (_, index) => ({
    start: Number((index * cueDuration).toFixed(2)),
    end: Number(Math.min(safeDuration, (index + 1) * cueDuration).toFixed(2))
  }));
}

function sceneEmotion(scene: ComicShortScenePlan): "excited" | "tense" | "surprised" | "curious" {
  if (scene.role === "hook") return "excited";
  if (scene.role === "climax") return "surprised";
  if (scene.role === "development") return "tense";
  return "curious";
}

function captionDirectionGoal(role: ComicNarrationBeatRole): string {
  if (role === "hook_shock") return "gancho instantaneo";
  if (role === "setup_anchor") return "contexto rapido";
  if (role === "tension_raise") return "curiosidade crescente";
  if (role === "impact_reveal") return "climax";
  return "fechar loop";
}

function buildSceneDirection(scene: ComicShortScenePlan, short: ComicShortProductionPlan): ComicCaptionNarrationSceneDirection {
  const role = roleForScene(scene);
  const narrationDoctor = doctorComicSceneNarration({ scene, short });
  const narrationText = narrationDoctor.narrationAfter;
  const captionWords = captionWordsFromNarration(narrationText, short, role);
  const cueTexts = splitCueText(captionWords, role === "hook_shock" || role === "impact_reveal" ? 4 : 5);
  const timings = cueTimings(scene.durationSeconds, cueTexts.length);
  const captionStyle = getCaptionStyleById("sports_hype") ?? getCaptionStyleById("bold_impact")!;
  const direction = generateCaptionDirection({
    style: "viral",
    maxWordsOnScreen: 5,
    beats: cueTexts.map((text, index) => ({
      id: `${scene.panelId}-caption-${index + 1}`,
      text,
      captionWords: text.split(/\s+/),
      emotion: sceneEmotion(scene),
      pace: "fast",
      pauseAfterMs: role === "impact_reveal" ? 120 : 60,
      emphasisWords: pickKeywords(narrationText, short),
      visualCue: scene.motion,
      retentionGoal: captionDirectionGoal(role),
      timing: {
        startSec: timings[index]?.start ?? 0,
        endSec: timings[index]?.end ?? scene.durationSeconds
      }
    }))
  });

  const cues: ComicCaptionTimingCue[] = direction.cues.map((cue, index) => {
    const quality = analyzeCaptionQuality(cue.textOnScreen, (cue.endSec ?? scene.durationSeconds) - (cue.startSec ?? 0), captionStyle);
    return {
      cueIndex: index + 1,
      startSeconds: cue.startSec ?? timings[index]?.start ?? 0,
      endSeconds: cue.endSec ?? timings[index]?.end ?? scene.durationSeconds,
      text: cue.textOnScreen.toUpperCase(),
      highlightedWords: cue.highlightedWords,
      layout: cue.layout,
      animation: cue.animation,
      sfxSuggestion: cue.sfxSuggestion,
      readingImpactScore: quality.impactScore,
      readingWarnings: [...quality.lineWarnings, ...quality.durationWarnings]
    };
  });

  const captionText = cues.map((cue) => cue.text).join(" / ");
  const scores = cues.map((cue) => cue.readingImpactScore);
  return {
    sceneOrder: scene.order,
    panelId: scene.panelId,
    role,
    narrationText,
    narrationDelivery: {
      pace: "fast",
      voiceEnergy: role === "hook_shock" || role === "impact_reveal" ? "extreme" : "high",
      pauseAfterMs: role === "impact_reveal" ? 120 : 60,
      emphasisWords: pickKeywords(narrationText, short),
      oralNotes: "Ler como comentario de cultura pop, frase curta, sem pausa longa e com subida de energia no fim."
    },
    captionText: narrationDoctor.captionAfter || captionText,
    captionCues: cues,
    captionQualityScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
    captionWarnings: [...direction.warnings, ...cues.flatMap((cue) => cue.readingWarnings), ...narrationDoctor.panelAlignment.warnings],
    narrationDoctor
  };
}

export function directComicCaptionNarration(input: {
  short: ComicShortProductionPlan;
}): ComicCaptionNarrationDirectorReport {
  const scenes = input.short.scenes.map((scene) => buildSceneDirection(scene, input.short));
  const warnings = scenes.flatMap((scene) => scene.captionWarnings.map((warning) => `scene_${scene.sceneOrder}:${warning}`));
  const averageCaptionQualityScore = scenes.length
    ? Math.round(scenes.reduce((sum, scene) => sum + scene.captionQualityScore, 0) / scenes.length)
    : 0;
  const narrationWordCount = scenes.reduce((sum, scene) => sum + scene.narrationText.split(/\s+/).filter(Boolean).length, 0);
  const captionCueCount = scenes.reduce((sum, scene) => sum + scene.captionCues.length, 0);
  const averagePanelAlignmentScore = scenes.length
    ? Math.round(scenes.reduce((sum, scene) => sum + scene.narrationDoctor.panelAlignment.score, 0) / scenes.length)
    : 0;

  return {
    directorId: "comic_caption_narration_v2",
    styleTarget: "viral_comic_hype",
    averageCaptionQualityScore,
    narrationWordCount,
    captionCueCount,
    scenes,
    averagePanelAlignmentScore,
    warnings
  };
}
