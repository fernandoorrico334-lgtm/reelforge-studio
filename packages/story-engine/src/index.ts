import {
  getCinematicPresetById,
  suggestPresetIdForEmotion,
  type CinematicPresetId
} from "@reelforge/cinematic-engine";

export const supportedAssetKinds = [
  "image",
  "video",
  "comic",
  "art",
  "screenshot",
  "audio",
  "other"
] as const;

export type SourceAssetKind = (typeof supportedAssetKinds)[number];

export interface SourceAsset {
  id: string;
  kind: SourceAssetKind;
  label: string;
  sourcePath: string;
  durationSeconds?: number;
  notes?: string;
}

export interface NarrativeBeat {
  id: string;
  title: string;
  intent: string;
  assetIds: string[];
  targetDurationSeconds: number;
}

export interface StoryOutline {
  projectId: string;
  hook: string;
  beats: NarrativeBeat[];
  callToAction?: string;
}

export interface StoryRecipe {
  projectId: string;
  aspectRatio: "9:16";
  tone: string;
  audience: string;
  beats: NarrativeBeat[];
}

export function createStoryOutline(recipe: StoryRecipe): StoryOutline {
  return {
    projectId: recipe.projectId,
    hook: recipe.beats[0]?.title ?? "Opening hook",
    beats: recipe.beats,
    callToAction: "Reserved for future CTA generation."
  };
}

export const narrativeSceneRoles = [
  "hook",
  "context",
  "tension",
  "climax",
  "resolution",
  "cta"
] as const;

export type NarrativeSceneRole = (typeof narrativeSceneRoles)[number];

export const storyVisualSourceModes = [
  "asset_only",
  "generated_only",
  "hybrid_overlay",
  "fallback_generated",
  "mixed_sequence"
] as const;

export type StoryVisualSourceMode = (typeof storyVisualSourceModes)[number];

export type StoryEmotionTag =
  | "NEUTRAL"
  | "CURIOUS"
  | "EPIC"
  | "MYSTERIOUS"
  | "DARK"
  | "TENSE"
  | "JOYFUL"
  | "SAD";

export interface StorySceneInput {
  id: string;
  order: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  duration: number | null;
  emotion: StoryEmotionTag | null;
  hasAsset: boolean;
  visualPreset: string | null;
  energyLevel?: number | null;
}

export interface StoryProjectInput {
  id: string;
  title: string;
  script: string | null;
  scenes: StorySceneInput[];
}

export interface SuggestedSceneRole {
  sceneId: string;
  order: number;
  role: NarrativeSceneRole;
  energyScore: number;
  reason: string;
}

export interface StoryAnalysis {
  projectId: string;
  totalDuration: number;
  sceneCount: number;
  missingAssets: number;
  missingVisuals: number;
  visualReadyScenes: number;
  missingCaptions: number;
  openingStrength: number;
  openingStrengthLabel: string;
  climaxDetected: boolean;
  ctaDetected: boolean;
  averageSceneDuration: number;
  rhythmLabel: string;
  pacingWarnings: string[];
  alerts: string[];
  suggestedSceneRoles: SuggestedSceneRole[];
  analysisMode: "deterministic-local-rules";
}

export interface ScriptToSceneOptions {
  durationTarget?: number | null;
  defaultSceneDuration?: number | null;
  preferredEmotion?: StoryEmotionTag | null;
  defaultVisualPreset?: CinematicPresetId | null;
  defaultCaptionStyle?: string | null;
  maxScenes?: number | null;
}

export interface ScriptSceneDraft {
  id: string;
  order: number;
  title: string;
  narrationText: string;
  captionText: string;
  captionStyle: string | null;
  duration: number;
  emotion: StoryEmotionTag | null;
  suggestedRole: NarrativeSceneRole;
  suggestedPresetId: CinematicPresetId;
  energyLevel: number;
  transitionHint: string;
}

export interface StoryAssetSuggestionAsset {
  id: string;
  filename: string;
  type: string;
  category: string;
  franchise?: string | null;
  character?: string | null;
  emotion?: StoryEmotionTag | null;
  tags: string[];
  recommendedUse?: string | null;
}

export interface StoryAssetSuggestionChannel {
  name?: string | null;
  niche?: string | null;
  narrativeTone?: string | null;
  preferredAssetCategories?: string[];
  preferredAssetTags?: string[];
}

export interface StoryAssetSuggestionSceneInput {
  id: string;
  order: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  emotion: StoryEmotionTag | null;
  suggestedRole?: NarrativeSceneRole | null;
}

export interface StoryAssetSuggestion {
  assetId: string;
  score: number;
  reasons: string[];
  matchedTags: string[];
  matchedCategories: string[];
}

export interface ProductionChecklistItem {
  id: string;
  label: string;
  done: boolean;
  detail: string;
}

export interface ProductionChecklistInputScene {
  id: string;
  order: number;
  title: string;
  duration: number | null;
  captionText: string | null;
  assetId: string | null;
  generatedAssetId?: string | null;
  effectiveAssetId?: string | null;
  visualSourceMode?: StoryVisualSourceMode | null;
  visualPreset?: string | null;
  emotion: StoryEmotionTag | null;
}

export interface ProductionChecklistInputProject {
  id: string;
  title: string;
  channelId: string | null;
  script: string | null;
  durationTarget: number | null;
  templateId?: string | null;
  defaultCaptionStyle?: string | null;
  backgroundMusicAssetId?: string | null;
  voiceoverAssetId?: string | null;
  audioMood?: string | null;
  scenes: ProductionChecklistInputScene[];
}

export interface ProductionChecklistInputChannel {
  defaultTemplate?: string | null;
  defaultRenderMode?: "v1" | "cinematic_v2" | null;
  defaultRenderQuality?: "draft" | "standard" | "high" | null;
  defaultAudioMood?: string | null;
  defaultCaptionStyle?: string | null;
  defaultVisualPreset?: string | null;
  defaultMusicAssetId?: string | null;
  defaultVoiceoverAssetId?: string | null;
  defaultDurationTarget?: number | null;
  defaultSceneDuration?: number | null;
}

export interface ProductionChecklist {
  projectId: string;
  totalScenes: number;
  totalDuration: number;
  missingAssets: number;
  missingVisuals: number;
  visualReadyScenes: number;
  generatedVisualScenes: number;
  missingCaptions: number;
  missingVisualPresets: number;
  missingDurations: number;
  firstSceneOverFiveSeconds: boolean;
  climaxDetected: boolean;
  ctaDetected: boolean;
  readinessScore: number;
  readyToRender: boolean;
  recommendedRenderMode: "v1" | "cinematic_v2";
  recommendedRenderQuality: "draft" | "standard" | "high";
  alerts: string[];
  warnings: string[];
  suggestions: string[];
  checklist: ProductionChecklistItem[];
}

const ctaKeywords = [
  "comenta",
  "comentarios",
  "segue",
  "siga",
  "curte",
  "curta",
  "salva",
  "salve",
  "compartilha",
  "inscreva",
  "parte 2",
  "quer mais",
  "me diz",
  "deixa ai"
] as const;

const climaxKeywords = [
  "revelacao",
  "revela",
  "verdade",
  "twist",
  "batalha",
  "confronto",
  "queda",
  "colapso",
  "ponto de nao retorno",
  "final"
] as const;

const hookKeywords = [
  "pouca gente",
  "ninguem percebeu",
  "e se",
  "segredo",
  "antes de",
  "verdade",
  "nunca te contaram"
] as const;

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeText(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
}

function containsAnyKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferEmotionEnergy(emotion: StoryEmotionTag | null) {
  switch (emotion) {
    case "EPIC":
      return 90;
    case "TENSE":
      return 84;
    case "DARK":
      return 74;
    case "MYSTERIOUS":
      return 68;
    case "CURIOUS":
      return 60;
    case "JOYFUL":
      return 54;
    case "SAD":
      return 40;
    case "NEUTRAL":
      return 34;
    default:
      return 38;
  }
}

function inferSceneEnergy(scene: StorySceneInput) {
  const sceneText = normalizeText([
    scene.title,
    scene.narrationText,
    scene.captionText
  ]);

  let energyScore =
    typeof scene.energyLevel === "number" && !Number.isNaN(scene.energyLevel)
      ? clamp(Math.round(scene.energyLevel), 0, 100)
      : inferEmotionEnergy(scene.emotion);

  if (scene.hasAsset) {
    energyScore += 6;
  }

  if (typeof scene.duration === "number") {
    if (scene.duration <= 4.5) {
      energyScore += 8;
    }

    if (scene.duration >= 7.5) {
      energyScore -= 10;
    }
  }

  if (sceneText.includes("?") || sceneText.includes("!")) {
    energyScore += 10;
  }

  if (containsAnyKeyword(sceneText, hookKeywords)) {
    energyScore += 10;
  }

  if (containsAnyKeyword(sceneText, climaxKeywords)) {
    energyScore += 18;
  }

  return clamp(energyScore, 0, 100);
}

function describeOpeningStrength(score: number) {
  if (score >= 82) {
    return "abertura forte";
  }

  if (score >= 62) {
    return "abertura promissora";
  }

  if (score >= 42) {
    return "abertura moderada";
  }

  return "abertura fraca";
}

function describeRhythm(
  averageSceneDuration: number,
  durationSpread: number
) {
  if (averageSceneDuration >= 6.8) {
    return "ritmo lento";
  }

  if (averageSceneDuration <= 2.4) {
    return "ritmo acelerado";
  }

  if (durationSpread >= 4.5) {
    return "ritmo irregular";
  }

  return "ritmo equilibrado";
}

function findCtaIndex(scenes: StorySceneInput[]) {
  let matchedIndex: number | null = null;

  scenes.forEach((scene, index) => {
    const sceneText = normalizeText([
      scene.title,
      scene.narrationText,
      scene.captionText
    ]);

    if (containsAnyKeyword(sceneText, ctaKeywords)) {
      matchedIndex = index;
    }
  });

  return matchedIndex;
}

function findClimaxIndex(
  scenes: StorySceneInput[],
  energyScores: number[],
  ctaIndex: number | null
) {
  let matchedIndex: number | null = null;
  let highestEnergy = 0;
  const secondHalfStart = Math.max(1, Math.floor(scenes.length / 2));

  scenes.forEach((scene, index) => {
    if (index < secondHalfStart || index === ctaIndex) {
      return;
    }

    const sceneText = normalizeText([
      scene.title,
      scene.narrationText,
      scene.captionText
    ]);
    const energyScore = energyScores[index] ?? 0;
    const hasClimaxSignal =
      energyScore >= 78 || containsAnyKeyword(sceneText, climaxKeywords);

    if (!hasClimaxSignal || energyScore < highestEnergy) {
      return;
    }

    highestEnergy = energyScore;
    matchedIndex = index;
  });

  return matchedIndex;
}

function buildSuggestedRoles(
  scenes: StorySceneInput[],
  energyScores: number[],
  ctaIndex: number | null,
  climaxIndex: number | null
): SuggestedSceneRole[] {
  const assignedRoles = new Map<number, SuggestedSceneRole>();

  scenes.forEach((scene, index) => {
    if (index === 0) {
      assignedRoles.set(index, {
        sceneId: scene.id,
        order: scene.order,
        role: "hook",
        energyScore: energyScores[index] ?? 0,
        reason: "A primeira cena assume o papel de hook na timeline."
      });
    }
  });

  if (ctaIndex !== null) {
    const ctaScene = scenes[ctaIndex];

    if (ctaScene) {
      assignedRoles.set(ctaIndex, {
        sceneId: ctaScene.id,
        order: ctaScene.order,
        role: "cta",
        energyScore: energyScores[ctaIndex] ?? 0,
        reason: "A cena contem gatilhos textuais de call to action."
      });
    }
  }

  if (climaxIndex !== null) {
    const climaxScene = scenes[climaxIndex];

    if (climaxScene) {
      assignedRoles.set(climaxIndex, {
        sceneId: climaxScene.id,
        order: climaxScene.order,
        role: "climax",
        energyScore: energyScores[climaxIndex] ?? 0,
        reason: "A cena concentra o pico de energia dramÃ¡tica detectado."
      });
    }
  }

  let contextAssigned = false;

  scenes.forEach((scene, index) => {
    if (assignedRoles.has(index)) {
      return;
    }

    const energyScore = energyScores[index] ?? 0;
    const lastNarrativeIndex =
      ctaIndex ?? climaxIndex ?? Math.max(0, scenes.length - 1);
    const isBeforeMainPeak = climaxIndex !== null
      ? index < climaxIndex
      : index < lastNarrativeIndex;

    let role: NarrativeSceneRole = "resolution";
    let reason = "A cena ajuda a fechar a progressao atual do projeto.";

    if (isBeforeMainPeak) {
      if (!contextAssigned && index > 0) {
        role = energyScore >= 66 ? "tension" : "context";
        contextAssigned = role === "context";
        reason =
          role === "context"
            ? "A cena expande contexto antes do pico narrativo."
            : "A cena ja entra elevando tensao antes do pico.";
      } else {
        role = "tension";
        reason = "A cena sustenta tensao antes do ponto de maior energia.";
      }
    } else if (
      climaxIndex === null &&
      index === scenes.length - 1 &&
      ctaIndex === null
    ) {
      role = scenes.length <= 2 ? "resolution" : "tension";
      reason =
        role === "resolution"
          ? "Sem clÃ­max detectado, a ultima cena fecha o arco atual."
          : "Sem clÃ­max claro, a ultima cena ainda funciona como tensao aberta.";
    }

    assignedRoles.set(index, {
      sceneId: scene.id,
      order: scene.order,
      role,
      energyScore,
      reason
    });
  });

  return scenes
    .map((_, index) => assignedRoles.get(index))
    .filter((role): role is SuggestedSceneRole => role !== undefined)
    .sort((left, right) => left.order - right.order);
}

function buildPacingWarnings(
  scenes: StorySceneInput[],
  totalDuration: number,
  averageSceneDuration: number,
  durationSpread: number
) {
  const warnings: string[] = [];

  if (averageSceneDuration >= 6.8) {
    warnings.push(
      "A duracao media por cena esta alta para short vertical e pode desacelerar o ritmo."
    );
  }

  if (averageSceneDuration <= 2.4 && scenes.length > 2) {
    warnings.push(
      "As cenas estao muito curtas e podem comprometer clareza narrativa."
    );
  }

  if (durationSpread >= 4.5) {
    warnings.push(
      "Ha salto brusco de duracao entre cenas; vale aproximar o tempo dos blocos."
    );
  }

  if (totalDuration >= 55) {
    warnings.push(
      "A duracao total ja encosta no limite alto para videos verticais curtos."
    );
  }

  return warnings;
}

function normalizeStoryVisualSourceMode(
  value: string | null | undefined
): StoryVisualSourceMode | null {
  switch (value) {
    case "asset_only":
    case "generated_only":
    case "hybrid_overlay":
    case "fallback_generated":
    case "mixed_sequence":
      return value;
    default:
      return null;
  }
}

function resolveSceneEffectiveVisual(
  scene: ProductionChecklistInputScene
): {
  assetId: string | null;
  source: "base" | "generated" | "fallback" | "missing";
  usesGenerated: boolean;
  hasEffectiveVisual: boolean;
} {
  const assetId = scene.assetId ?? null;
  const generatedAssetId = scene.generatedAssetId ?? null;
  const effectiveAssetId = scene.effectiveAssetId ?? null;
  const visualSourceMode = normalizeStoryVisualSourceMode(
    scene.visualSourceMode ?? null
  );

  switch (visualSourceMode) {
    case "asset_only":
      return {
        assetId: assetId ?? effectiveAssetId,
        source: assetId ?? effectiveAssetId ? "base" : "missing",
        usesGenerated: false,
        hasEffectiveVisual: Boolean(assetId ?? effectiveAssetId)
      };
    case "generated_only":
      return {
        assetId: generatedAssetId ?? effectiveAssetId,
        source:
          generatedAssetId ?? effectiveAssetId ? "generated" : "missing",
        usesGenerated: Boolean(generatedAssetId ?? effectiveAssetId),
        hasEffectiveVisual: Boolean(generatedAssetId ?? effectiveAssetId)
      };
    case "fallback_generated":
      return {
        assetId: assetId ?? generatedAssetId ?? effectiveAssetId,
        source:
          assetId ?? generatedAssetId ?? effectiveAssetId
            ? "fallback"
            : "missing",
        usesGenerated: !assetId && Boolean(generatedAssetId ?? effectiveAssetId),
        hasEffectiveVisual: Boolean(
          assetId ?? generatedAssetId ?? effectiveAssetId
        )
      };
    case "mixed_sequence":
      return {
        assetId: generatedAssetId ?? effectiveAssetId ?? assetId,
        source:
          generatedAssetId ?? effectiveAssetId
            ? "generated"
            : assetId
              ? "base"
              : "missing",
        usesGenerated: Boolean(generatedAssetId ?? effectiveAssetId),
        hasEffectiveVisual: Boolean(generatedAssetId ?? effectiveAssetId ?? assetId)
      };
    case "hybrid_overlay":
      return {
        assetId: assetId ?? generatedAssetId ?? effectiveAssetId,
        source: assetId
          ? "base"
          : generatedAssetId || effectiveAssetId
            ? "generated"
            : "missing",
        usesGenerated: !assetId && Boolean(generatedAssetId ?? effectiveAssetId),
        hasEffectiveVisual: Boolean(
          assetId ?? generatedAssetId ?? effectiveAssetId
        )
      };
    default:
      if (generatedAssetId ?? effectiveAssetId) {
        return {
          assetId: generatedAssetId ?? effectiveAssetId,
          source: "generated",
          usesGenerated: true,
          hasEffectiveVisual: true
        };
      }

      if (assetId) {
        return {
          assetId,
          source: "base",
          usesGenerated: false,
          hasEffectiveVisual: true
        };
      }

      return {
        assetId: null,
        source: "missing",
        usesGenerated: false,
        hasEffectiveVisual: false
      };
    }
}

export function analyzeStoryProject(project: StoryProjectInput): StoryAnalysis {
  const scenes = [...project.scenes].sort((left, right) => left.order - right.order);
  const sceneCount = scenes.length;
  const totalDuration = roundToSingleDecimal(
    scenes.reduce((total, scene) => total + (scene.duration ?? 0), 0)
  );
  const missingAssets = scenes.filter((scene) => !scene.hasAsset).length;
  const missingCaptions = scenes.filter(
    (scene) => !scene.captionText?.trim()
  ).length;
  const energyScores = scenes.map(inferSceneEnergy);
  const averageSceneDuration =
    sceneCount > 0 ? roundToSingleDecimal(totalDuration / sceneCount) : 0;
  const maxSceneDuration = Math.max(
    ...scenes.map((scene) => scene.duration ?? 0),
    0
  );
  const minSceneDuration =
    sceneCount > 0
      ? Math.min(...scenes.map((scene) => scene.duration ?? maxSceneDuration))
      : 0;
  const durationSpread = roundToSingleDecimal(maxSceneDuration - minSceneDuration);
  const firstScene = scenes[0];
  const firstSceneEnergy = energyScores[0] ?? 0;
  const openingStrength = clamp(
    firstSceneEnergy +
      (firstScene?.hasAsset ? 10 : -4) +
      (firstScene?.captionText?.trim() ? 8 : -10) -
      ((firstScene?.duration ?? 0) > 5 ? 18 : 0),
    0,
    100
  );
  const ctaIndex = findCtaIndex(scenes);
  const climaxIndex = findClimaxIndex(scenes, energyScores, ctaIndex);
  const suggestedSceneRoles = buildSuggestedRoles(
    scenes,
    energyScores,
    ctaIndex,
    climaxIndex
  );
  const pacingWarnings = buildPacingWarnings(
    scenes,
    totalDuration,
    averageSceneDuration,
    durationSpread
  );
  const alerts: string[] = [];

  if ((firstScene?.duration ?? 0) > 5) {
    alerts.push("A primeira cena passa de 5s e enfraquece o hook inicial.");
  }

  if (climaxIndex === null) {
    alerts.push("Nenhum clÃ­max claro foi detectado na ordem atual das cenas.");
  }

  if (ctaIndex === null) {
    alerts.push("Nenhum CTA foi detectado; considere fechar com convite de acao.");
  }

  return {
    projectId: project.id,
    totalDuration,
    sceneCount,
    missingAssets,
    missingVisuals: missingAssets,
    visualReadyScenes: Math.max(sceneCount - missingAssets, 0),
    missingCaptions,
    openingStrength,
    openingStrengthLabel: describeOpeningStrength(openingStrength),
    climaxDetected: climaxIndex !== null,
    ctaDetected: ctaIndex !== null,
    averageSceneDuration,
    rhythmLabel: describeRhythm(averageSceneDuration, durationSpread),
    pacingWarnings,
    alerts,
    suggestedSceneRoles,
    analysisMode: "deterministic-local-rules"
  };
}

const visualAssetTypes = new Set(["IMAGE", "VIDEO", "OVERLAY"]);

const roleCategoryHints: Record<NarrativeSceneRole, string[]> = {
  hook: ["COVER", "PANEL", "CHARACTER", "SCREENSHOT"],
  context: ["BACKGROUND", "REFERENCE", "SCREENSHOT", "PANEL"],
  tension: ["BROLL", "PANEL", "VIDEO", "SCREENSHOT"],
  climax: ["VIDEO", "BROLL", "PANEL", "CHARACTER"],
  resolution: ["BACKGROUND", "CHARACTER", "REFERENCE", "SCREENSHOT"],
  cta: ["COVER", "CHARACTER", "SCREENSHOT", "PANEL"]
};

const emotionKeywordMap: Array<{
  emotion: StoryEmotionTag;
  keywords: string[];
}> = [
  {
    emotion: "EPIC",
    keywords: ["guerra", "batalha", "hero", "lenda", "destino", "imperio"]
  },
  {
    emotion: "TENSE",
    keywords: ["urgencia", "colapso", "queda", "perigo", "confronto", "crise"]
  },
  {
    emotion: "MYSTERIOUS",
    keywords: ["segredo", "misterio", "enig", "oculto", "arquivo", "sombra"]
  },
  {
    emotion: "DARK",
    keywords: ["massacre", "crime", "medo", "tragedia", "sombr", "abismo"]
  },
  {
    emotion: "CURIOUS",
    keywords: ["como", "por que", "e se", "ninguem", "pouca gente", "descoberta"]
  },
  {
    emotion: "JOYFUL",
    keywords: ["vitoria", "celebra", "renasce", "brilha", "sorriso", "alivio"]
  },
  {
    emotion: "SAD",
    keywords: ["perda", "adeus", "luto", "sozinho", "saudade", "silencio"]
  }
];

function normalizeSpacing(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function tokenizeSearchText(value: string) {
  return normalizeSpacing(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u017f\s]/giu, " ")
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function splitScriptIntoSegments(script: string) {
  const normalizedScript = script.replace(/\r/g, "").trim();
  const paragraphs = normalizedScript
    .split(/\n{2,}/u)
    .map((segment) => normalizeSpacing(segment))
    .filter(Boolean);
  const rawSegments = (paragraphs.length > 0 ? paragraphs : [normalizedScript])
    .flatMap((paragraph) => {
      const sentenceParts = paragraph
        .split(/(?<=[.!?])\s+/u)
        .map((segment) => normalizeSpacing(segment))
        .filter(Boolean);

      return sentenceParts.length > 0 ? sentenceParts : [paragraph];
    })
    .flatMap((segment) => {
      if (segment.length <= 180) {
        return [segment];
      }

      return segment
        .split(/[,;:]\s+/u)
        .map((part) => normalizeSpacing(part))
        .filter(Boolean);
    });

  return rawSegments.filter(Boolean);
}

function estimateTargetSceneCount(
  segments: string[],
  options: ScriptToSceneOptions
) {
  const defaultSceneDuration = clamp(
    Math.round((options.defaultSceneDuration ?? 4) * 10) / 10,
    2.5,
    8
  );
  const maxScenes =
    typeof options.maxScenes === "number" && Number.isFinite(options.maxScenes)
      ? Math.max(1, Math.round(options.maxScenes))
      : null;

  if (maxScenes) {
    return Math.min(Math.max(segments.length, 1), maxScenes);
  }

  if (
    typeof options.durationTarget === "number" &&
    Number.isFinite(options.durationTarget) &&
    options.durationTarget > 0
  ) {
    return clamp(
      Math.round(options.durationTarget / defaultSceneDuration),
      1,
      Math.max(segments.length, 1)
    );
  }

  return clamp(segments.length, 1, 6);
}

function mergeSegmentsToSceneCount(segments: string[], targetSceneCount: number) {
  if (segments.length <= targetSceneCount) {
    return segments;
  }

  const grouped: string[] = [];
  let cursor = 0;

  for (let index = 0; index < targetSceneCount; index += 1) {
    const remainingSegments = segments.length - cursor;
    const remainingGroups = targetSceneCount - index;
    const takeCount = Math.ceil(remainingSegments / remainingGroups);

    grouped.push(
      normalizeSpacing(segments.slice(cursor, cursor + takeCount).join(" "))
    );
    cursor += takeCount;
  }

  return grouped.filter(Boolean);
}

function buildSceneTitle(segment: string, order: number) {
  const words = tokenizeSearchText(segment).slice(0, 5);
  const basis = words.length > 0 ? words.join(" ") : `cena ${order}`;
  return basis.charAt(0).toUpperCase() + basis.slice(1);
}

function buildCaptionFromSegment(segment: string) {
  const shortSentence = normalizeSpacing(segment)
    .split(/[.!?]/u)[0]
    ?.trim();

  if (!shortSentence) {
    return "Legenda sugerida";
  }

  const words = shortSentence.split(/\s+/u);
  const clipped =
    words.length > 12 ? `${words.slice(0, 12).join(" ")}...` : shortSentence;

  return clipped;
}

function detectEmotionFromText(
  text: string,
  preferredEmotion: StoryEmotionTag | null = null
): StoryEmotionTag {
  const normalizedText = normalizeText([text]);

  for (const entry of emotionKeywordMap) {
    if (containsAnyKeyword(normalizedText, entry.keywords)) {
      return entry.emotion;
    }
  }

  if (normalizedText.includes("?")) {
    return "CURIOUS";
  }

  if (normalizedText.includes("!")) {
    return "EPIC";
  }

  return preferredEmotion ?? "NEUTRAL";
}

function buildRoleDurationWeight(role: NarrativeSceneRole) {
  switch (role) {
    case "hook":
      return 0.92;
    case "context":
      return 1.02;
    case "tension":
      return 1.08;
    case "climax":
      return 1.16;
    case "resolution":
      return 0.94;
    case "cta":
      return 0.78;
    default:
      return 1;
  }
}

function normalizeSceneDurationValue(value: number) {
  return roundToSingleDecimal(clamp(value, 2.4, 9.5));
}

function buildTransitionHint(presetId: CinematicPresetId) {
  return getCinematicPresetById(presetId)?.suggestedTransition ?? "cut";
}

export function createScenesFromScript(
  script: string,
  options: ScriptToSceneOptions = {}
): ScriptSceneDraft[] {
  const normalizedScript = normalizeSpacing(script);

  if (!normalizedScript) {
    return [];
  }

  const splitSegments = splitScriptIntoSegments(normalizedScript);
  const targetSceneCount = estimateTargetSceneCount(splitSegments, options);
  const sceneSegments = mergeSegmentsToSceneCount(splitSegments, targetSceneCount);
  const defaultSceneDuration = clamp(
    Math.round((options.defaultSceneDuration ?? 4) * 10) / 10,
    2.5,
    8
  );
  const initialDraftScenes = sceneSegments.map((segment, index) => {
    const emotion = detectEmotionFromText(
      segment,
      options.preferredEmotion ?? null
    );

    return {
      id: `draft-scene-${String(index + 1).padStart(2, "0")}`,
      order: index + 1,
      title: buildSceneTitle(segment, index + 1),
      narrationText: segment,
      captionText: buildCaptionFromSegment(segment),
      duration: defaultSceneDuration,
      emotion,
      visualPreset: null,
      hasAsset: false,
      energyLevel: inferSceneEnergy({
        id: `draft-scene-${index + 1}`,
        order: index + 1,
        title: buildSceneTitle(segment, index + 1),
        narrationText: segment,
        captionText: buildCaptionFromSegment(segment),
        duration: defaultSceneDuration,
        emotion,
        hasAsset: false,
        visualPreset: null,
        energyLevel: null
      })
    };
  });

  const storyAnalysis = analyzeStoryProject({
    id: "script-draft",
    title: "Script Draft",
    script: normalizedScript,
    scenes: initialDraftScenes
  });
  const roleMap = new Map(
    storyAnalysis.suggestedSceneRoles.map((suggestion) => [
      suggestion.sceneId,
      suggestion
    ])
  );
  const roleAwareDurations = initialDraftScenes.map((scene) => {
    const role = roleMap.get(scene.id)?.role ?? "context";
    return defaultSceneDuration * buildRoleDurationWeight(role);
  });
  const durationTarget =
    typeof options.durationTarget === "number" &&
    Number.isFinite(options.durationTarget) &&
    options.durationTarget > 0
      ? options.durationTarget
      : null;
  const durationScale =
    durationTarget && roleAwareDurations.reduce((total, value) => total + value, 0) > 0
      ? durationTarget /
        roleAwareDurations.reduce((total, value) => total + value, 0)
      : 1;

  return initialDraftScenes.map((scene, index) => {
    const roleSuggestion = roleMap.get(scene.id);
    const suggestedRole = roleSuggestion?.role ?? "context";
    const suggestedPresetId =
      options.defaultVisualPreset ?? suggestPresetIdForEmotion(scene.emotion);
    const resolvedCaptionStyle =
      options.defaultCaptionStyle ??
      getCinematicPresetById(suggestedPresetId)?.suggestedCaptionStyle ??
      null;

    return {
      id: scene.id,
      order: scene.order,
      title: scene.title,
      narrationText: scene.narrationText,
      captionText: scene.captionText,
      captionStyle: resolvedCaptionStyle,
      duration: normalizeSceneDurationValue(
        (roleAwareDurations[index] ?? defaultSceneDuration) * durationScale
      ),
      emotion: scene.emotion,
      suggestedRole,
      suggestedPresetId,
      energyLevel: roleSuggestion?.energyScore ?? scene.energyLevel,
      transitionHint: buildTransitionHint(suggestedPresetId)
    };
  });
}

function uniqueTextValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function scoreSceneRoleAffinity(
  role: NarrativeSceneRole | null | undefined,
  category: string
) {
  if (!role) {
    return false;
  }

  return roleCategoryHints[role]?.includes(category.toUpperCase()) ?? false;
}

export function suggestAssetsForScene(
  scene: StoryAssetSuggestionSceneInput,
  assets: StoryAssetSuggestionAsset[],
  channel: StoryAssetSuggestionChannel = {},
  options: {
    limit?: number;
    recentlyUsedAssetIds?: string[];
  } = {}
): StoryAssetSuggestion[] {
  const sceneText = normalizeText([
    scene.title,
    scene.narrationText,
    scene.captionText
  ]);
  const sceneTokens = new Set(tokenizeSearchText(sceneText));
  const preferredCategorySet = new Set(
    (channel.preferredAssetCategories ?? []).map((entry) =>
      entry.trim().toUpperCase()
    )
  );
  const preferredTagSet = new Set(
    (channel.preferredAssetTags ?? []).map((entry) => entry.trim().toLowerCase())
  );
  const recentlyUsedAssetIds = new Set(options.recentlyUsedAssetIds ?? []);
  const limit = Math.max(1, options.limit ?? 5);

  return assets
    .filter((asset) => visualAssetTypes.has(asset.type.toUpperCase()))
    .map((asset) => {
      const reasons: string[] = [];
      const matchedTags: string[] = [];
      const matchedCategories: string[] = [];
      let score = asset.type.toUpperCase() === "VIDEO" ? 28 : 24;
      const assetTagSet = new Set(asset.tags.map((entry) => entry.toLowerCase()));
      const assetTokenSet = new Set([
        ...tokenizeSearchText(asset.filename),
        ...tokenizeSearchText(asset.franchise ?? ""),
        ...tokenizeSearchText(asset.character ?? ""),
        ...tokenizeSearchText(asset.recommendedUse ?? ""),
        ...asset.tags.flatMap((entry) => tokenizeSearchText(entry))
      ]);
      const overlappingTokens = [...sceneTokens].filter((token) =>
        assetTokenSet.has(token)
      );

      if (scene.emotion && asset.emotion === scene.emotion) {
        score += 16;
        reasons.push(`emocao alinhada com ${scene.emotion.toLowerCase()}`);
      }

      if (overlappingTokens.length > 0) {
        score += Math.min(30, overlappingTokens.length * 7);
        matchedTags.push(...overlappingTokens.slice(0, 4));
        reasons.push(
          `termos em comum com a cena: ${overlappingTokens.slice(0, 3).join(", ")}`
        );
      }

      if (preferredCategorySet.has(asset.category.toUpperCase())) {
        score += 14;
        matchedCategories.push(asset.category.toUpperCase());
        reasons.push("categoria preferida do canal");
      }

      const preferredTagMatches = [...preferredTagSet].filter((tag) =>
        assetTagSet.has(tag)
      );

      if (preferredTagMatches.length > 0) {
        score += Math.min(18, preferredTagMatches.length * 6);
        matchedTags.push(...preferredTagMatches);
        reasons.push(
          `tag favorita do canal encontrada: ${preferredTagMatches.slice(0, 2).join(", ")}`
        );
      }

      if (scoreSceneRoleAffinity(scene.suggestedRole, asset.category)) {
        score += 12;
        matchedCategories.push(asset.category.toUpperCase());
        reasons.push(`categoria reforca o papel narrativo ${scene.suggestedRole}`);
      }

      if (
        asset.franchise &&
        sceneText.includes(asset.franchise.toLowerCase())
      ) {
        score += 10;
        reasons.push(`franquia citada na cena: ${asset.franchise}`);
      }

      if (
        asset.character &&
        sceneText.includes(asset.character.toLowerCase())
      ) {
        score += 10;
        reasons.push(`personagem citado na cena: ${asset.character}`);
      }

      if (recentlyUsedAssetIds.has(asset.id)) {
        score -= 18;
        reasons.push("penalidade por uso recente neste projeto");
      }

      return {
        assetId: asset.id,
        score: clamp(Math.round(score), 0, 100),
        reasons: uniqueTextValues(reasons).slice(0, 4),
        matchedTags: uniqueTextValues(matchedTags),
        matchedCategories: uniqueTextValues(matchedCategories)
      };
    })
    .sort((left, right) => right.score - left.score || left.assetId.localeCompare(right.assetId))
    .slice(0, limit);
}

export function buildProductionChecklist(
  project: ProductionChecklistInputProject,
  channel: ProductionChecklistInputChannel | null = null
): ProductionChecklist {
  const orderedScenes = [...project.scenes].sort((left, right) => left.order - right.order);
  const effectiveVisuals = orderedScenes.map((scene) =>
    resolveSceneEffectiveVisual(scene)
  );
  const storyAnalysis = analyzeStoryProject({
    id: project.id,
    title: project.title,
    script: project.script,
    scenes: orderedScenes.map((scene, index) => ({
      id: scene.id,
      order: scene.order,
      title: scene.title,
      narrationText: null,
      captionText: scene.captionText,
      duration: scene.duration,
      emotion: scene.emotion,
      hasAsset: effectiveVisuals[index]?.hasEffectiveVisual ?? false,
      visualPreset: scene.visualPreset ?? null,
      energyLevel: null
    }))
  });
  const totalScenes = orderedScenes.length;
  const missingAssets = effectiveVisuals.filter(
    (scene) => !scene.hasEffectiveVisual
  ).length;
  const missingVisuals = missingAssets;
  const visualReadyScenes = totalScenes - missingVisuals;
  const generatedVisualScenes = effectiveVisuals.filter(
    (scene) => scene.usesGenerated
  ).length;
  const missingCaptions = orderedScenes.filter(
    (scene) => !scene.captionText?.trim()
  ).length;
  const missingVisualPresets = orderedScenes.filter(
    (scene) => !scene.visualPreset?.trim()
  ).length;
  const missingDurations = orderedScenes.filter(
    (scene) =>
      typeof scene.duration !== "number" ||
      Number.isNaN(scene.duration) ||
      scene.duration <= 0
  ).length;
  const firstSceneOverFiveSeconds = (orderedScenes[0]?.duration ?? 0) > 5;
  const templateResolved = Boolean(project.templateId || channel?.defaultTemplate);
  const captionStyleResolved = Boolean(
    project.defaultCaptionStyle || channel?.defaultCaptionStyle
  );
  const audioConfigured = Boolean(
    project.backgroundMusicAssetId ||
      project.voiceoverAssetId ||
      project.audioMood ||
      channel?.defaultMusicAssetId ||
      channel?.defaultVoiceoverAssetId ||
      channel?.defaultAudioMood
  );
  const coreReady =
    Boolean(project.channelId) &&
    totalScenes > 0 &&
    missingVisuals === 0 &&
    missingCaptions === 0 &&
    missingDurations === 0 &&
    templateResolved &&
    captionStyleResolved;
  let readinessScore = 100;

  readinessScore -= missingVisuals * 12;
  readinessScore -= missingCaptions * 10;
  readinessScore -= missingVisualPresets * 6;
  readinessScore -= missingDurations * 8;
  readinessScore -= totalScenes === 0 ? 24 : 0;
  readinessScore -= project.channelId ? 0 : 18;
  readinessScore -= templateResolved ? 0 : 8;
  readinessScore -= captionStyleResolved ? 0 : 6;
  readinessScore -= storyAnalysis.climaxDetected ? 0 : 8;
  readinessScore -= storyAnalysis.ctaDetected ? 0 : 8;
  readinessScore -= firstSceneOverFiveSeconds ? 10 : 0;

  const alerts = [
    ...storyAnalysis.alerts,
    !templateResolved
      ? "Nenhum template efetivo foi resolvido para o projeto."
      : null,
    !captionStyleResolved
      ? "Nenhum caption style default foi resolvido para o projeto."
      : null
  ].filter((entry): entry is string => Boolean(entry));
  const warnings = [
    ...storyAnalysis.pacingWarnings,
    !audioConfigured
      ? "Projeto ainda sem audio base configurado; o render segue valido, mas sem trilha padrao."
      : null,
    missingVisualPresets > 0
      ? `${missingVisualPresets} cena(s) ainda sem preset visual explicito.`
      : null
  ].filter((entry): entry is string => Boolean(entry));
  const suggestions = [
    missingVisuals > 0
      ? `${missingVisuals} cena(s) ainda precisam de visual efetivo.`
      : null,
    missingCaptions > 0
      ? `${missingCaptions} cena(s) ainda precisam de legenda.`
      : null,
    missingVisualPresets > 0 && channel?.defaultVisualPreset
      ? "Aplicar defaults do canal pode preencher presets visuais pendentes."
      : null,
    !audioConfigured && channel?.defaultMusicAssetId
      ? "Aplicar defaults do canal pode conectar a trilha base do canal."
      : null
  ].filter((entry): entry is string => Boolean(entry));

  return {
    projectId: project.id,
    totalScenes,
    totalDuration: storyAnalysis.totalDuration,
    missingAssets,
    missingVisuals,
    visualReadyScenes,
    generatedVisualScenes,
    missingCaptions,
    missingVisualPresets,
    missingDurations,
    firstSceneOverFiveSeconds,
    climaxDetected: storyAnalysis.climaxDetected,
    ctaDetected: storyAnalysis.ctaDetected,
    readinessScore: clamp(Math.round(readinessScore), 0, 100),
    readyToRender: coreReady,
    recommendedRenderMode: channel?.defaultRenderMode ?? "v1",
    recommendedRenderQuality: channel?.defaultRenderQuality ?? "standard",
    alerts,
    warnings,
    suggestions,
    checklist: [
      {
        id: "channel",
        label: "Canal associado",
        done: Boolean(project.channelId),
        detail: project.channelId
          ? "Projeto ligado a um canal editorial."
          : "Associe um canal antes de produzir."
      },
      {
        id: "template",
        label: "Template efetivo",
        done: templateResolved,
        detail: templateResolved
          ? "Projeto ou canal ja define um template."
          : "Defina um template no projeto ou no canal."
      },
      {
        id: "scenes",
        label: "Cenas prontas",
        done: totalScenes > 0,
        detail:
          totalScenes > 0
            ? `${totalScenes} cena(s) na timeline.`
            : "Crie pelo menos uma cena."
      },
      {
        id: "assets",
        label: "Visuais efetivos",
        done: missingVisuals === 0 && totalScenes > 0,
        detail:
          missingVisuals === 0
            ? "Todas as cenas possuem visual efetivo."
            : `${missingVisuals} cena(s) ainda sem visual.`
      },
      {
        id: "captions",
        label: "Legendas definidas",
        done: missingCaptions === 0 && totalScenes > 0,
        detail:
          missingCaptions === 0
            ? "Todas as cenas possuem legenda."
            : `${missingCaptions} cena(s) ainda sem legenda.`
      },
      {
        id: "durations",
        label: "Duracoes validas",
        done: missingDurations === 0 && totalScenes > 0,
        detail:
          missingDurations === 0
            ? "Todas as cenas possuem duracao."
            : `${missingDurations} cena(s) com duracao faltando ou invalida.`
      },
      {
        id: "captions-style",
        label: "Caption style default",
        done: captionStyleResolved,
        detail: captionStyleResolved
          ? "Projeto ou canal ja resolve um caption style base."
          : "Configure um caption style default para padronizar o projeto."
      },
      {
        id: "audio",
        label: "Base de audio",
        done: audioConfigured,
        detail: audioConfigured
          ? "Projeto ou canal ja carrega setup de audio inicial."
          : "Opcional, mas ajuda a fechar o fluxo de producao."
      }
    ]
  };
}

