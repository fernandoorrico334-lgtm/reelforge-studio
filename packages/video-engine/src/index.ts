import {
  analyzeCaptionQuality,
  generateAssSubtitle,
  generateSrt,
  getCaptionStyleById,
  splitCaptionIntoLines,
  suggestCaptionStyleByEmotion,
  suggestCaptionStyleByTemplate,
  type CaptionEmotionTag,
  type CaptionPosition,
  type CaptionQualityAnalysis,
  type CaptionStyle,
  type CaptionStyleId
} from "@reelforge/caption-engine";
import {
  buildAudioMixPlan,
  buildBeatSyncPlan,
  getMusicPresetById,
  suggestMusicPresetByContext,
  type AudioLicenseStatus,
  type AudioMixPlan,
  type MusicAssetProfile,
  type SfxAssetProfile
} from "@reelforge/audio-engine";
import {
  getCinematicPresetById,
  suggestPresetForEmotion,
  type CinematicPreset,
  type CinematicPresetId,
  type PresetEmotionTag
} from "@reelforge/cinematic-engine";
import {
  analyzeStoryProject,
  type SuggestedSceneRole,
  type NarrativeSceneRole,
  type StoryAnalysis
} from "@reelforge/story-engine";
import {
  getTemplateById,
  suggestTemplateByProject,
  type ReelTemplate
} from "@reelforge/templates";

export interface BlueprintEditingStyleSummary {
  presetId: string;
  presetName: string;
  useCase: string;
  pacing: string;
  cutPace: number | null;
  zoomStyle: string;
  flashStyle: string;
  transitionStyle: string;
  captionStyle: string;
  narrationStyle: string;
  musicStyle: string;
  sfxStyle: string;
  hookStyle: string;
  ctaStyle: string;
  microclipPlacement: string;
  defaultShotDurationSeconds: number | null;
  recommendedMusicPresetId: string | null;
  recommendedAudioMasteringPresetId: string | null;
  recommendedNarrationVoicePackId: string | null;
  notes: string | null;
}

export interface BlueprintChannelInput {
  id: string;
  name: string;
  niche: string;
  language: string;
  visualStyle: string | null;
  narrativeTone: string | null;
  defaultTemplate: string | null;
  defaultRenderMode: "v1" | "cinematic_v2";
  defaultRenderQuality: "draft" | "standard" | "high";
  defaultAudioMood: string | null;
  defaultCaptionStyle: string | null;
  defaultVisualPreset: string | null;
  defaultMusicAssetId: string | null;
  defaultVoiceoverAssetId: string | null;
  defaultDurationTarget: number | null;
  defaultSceneDuration: number;
  preferredAssetCategories: string[];
  preferredAssetTags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BlueprintAssetInput {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  type: string;
  category: string;
  franchise: string | null;
  character: string | null;
  emotion: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  extension: string | null;
  musicProfile?: MusicAssetProfile | null;
  sfxProfile?: SfxAssetProfile | null;
}

export interface BlueprintEditorialMicroclipInput {
  id: string;
  projectId: string;
  sceneId: string | null;
  assetId: string;
  asset: BlueprintAssetInput | null;
  label: string;
  sourceType: "local_clip" | "uploaded_clip" | "library_clip";
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  usageMode: "supporting_evidence" | "impact_moment" | "quick_reference";
  narrationOverlay: boolean;
  textOverlay: string | null;
  calloutStyle: "none" | "minimal" | "bold";
  transitionIn: "cut" | "flash" | "whoosh";
  transitionOut: "cut" | "flash" | "whoosh";
  volumeMode: "mute_original" | "low_original" | "keep_original";
  orderIndex: number;
  metadata: Record<string, unknown> | null;
}

export interface BlueprintSceneInput {
  id: string;
  order: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  duration: number | null;
  emotion: CaptionEmotionTag | null;
  assetId: string | null;
  asset: BlueprintAssetInput | null;
  generatedAssetId?: string | null;
  generatedAsset?: BlueprintAssetInput | null;
  generatedNarrationAssetId?: string | null;
  generatedNarrationAsset?: BlueprintAssetInput | null;
  narrationStatus?: string | null;
  narrationProvider?: string | null;
  narrationVoicePackId?: string | null;
  visualSourceMode?: string | null;
  sfxAssetId: string | null;
  sfxAsset: BlueprintAssetInput | null;
  sfxStartTime: number;
  sfxVolume: number;
  visualPreset: string | null;
  transition: string | null;
  captionStyle: string | null;
  captionPosition: string | null;
  captionEmphasisWords: string[];
  energyLevel: number | null;
  editorialMicroclips?: BlueprintEditorialMicroclipInput[];
  visualRecipe?: string | null;
}

export interface BlueprintProjectInput {
  id: string;
  title: string;
  status: string;
  channelId: string;
  channel: BlueprintChannelInput;
  script: string | null;
  durationTarget: number | null;
  format: string;
  templateId: string | null;
  editingReferencePresetId: string | null;
  editingStyleSummary: BlueprintEditingStyleSummary | null;
  defaultCaptionStyle: string | null;
  backgroundMusicAssetId: string | null;
  backgroundMusicAsset: BlueprintAssetInput | null;
  musicPresetId: string | null;
  voiceoverAssetId: string | null;
  voiceoverAsset: BlueprintAssetInput | null;
  audioMood: string | null;
  musicVolume: number;
  voiceVolume: number;
  sfxVolume: number;
  enableAudioDucking: boolean;
  duckingLevel: number;
  scenes: BlueprintSceneInput[];
}

export interface ResolvedProjectTemplate {
  configuredTemplateId: string | null;
  template: ReelTemplate;
  source: "project" | "channel" | "suggested";
}

export interface ResolvedCaptionStyle {
  configuredStyleId: string | null;
  projectDefaultStyleId: string | null;
  templateSuggestedStyleId: CaptionStyleId;
  emotionSuggestedStyleId: CaptionStyleId;
  style: CaptionStyle;
  source: "scene" | "project" | "template" | "emotion";
}

export interface ResolvedScenePreset {
  configuredPresetId: string | null;
  templateSuggestedPresetId: CinematicPresetId;
  emotionSuggestedPresetId: CinematicPresetId;
  preset: CinematicPreset;
  source: "scene" | "template" | "emotion";
}

export interface ProjectCaptionAnalysisScene {
  sceneId: string;
  order: number;
  title: string;
  captionText: string | null;
  duration: number | null;
  splitLines: string[];
  quality: CaptionQualityAnalysis;
  suggestedByTemplate: CaptionStyle;
  suggestedByEmotion: CaptionStyle;
  resolvedStyle: ResolvedCaptionStyle;
}

export interface ProjectCaptionAnalysisSummary {
  sceneCount: number;
  scenesWithCaptions: number;
  scenesWithoutCaptions: number;
  tooFastScenes: number;
  scenesWithWarnings: number;
  averageImpactScore: number;
  alerts: string[];
}

export interface ProjectCaptionAnalysis {
  projectId: string;
  template: ResolvedProjectTemplate;
  defaultCaptionStyle: CaptionStyle;
  summary: ProjectCaptionAnalysisSummary;
  scenes: ProjectCaptionAnalysisScene[];
}


export interface RenderBlueprintCaptionCue {
  cueIndex: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
  highlightedWords: string[];
  layout: string | null;
  animation: string | null;
  sfxSuggestion: string | null;
  readingImpactScore: number | null;
  readingWarnings: string[];
}

export interface RenderBlueprintSmartCropDirective {
  sceneOrder: number;
  panelId: string;
  pageNumber: number | null;
  focus: string;
  normalizedCrop: { x: number; y: number; width: number; height: number };
  safeCaptionZone: string;
  cameraMove: string;
  startScale: number;
  endScale: number;
  anchorPoint: { x: number; y: number };
  holdSeconds: number;
  motionIntensity: number;
  textSafety: string;
  renderInstruction: string;
  reasons: string[];
  confidenceScore: number;
}

export interface RenderBlueprintScene {
  sceneId: string;
  order: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  captionPreviewLines: string[];
  duration: number | null;
  emotion: CaptionEmotionTag | null;
  energyLevel: number;
  assetId: string | null;
  asset: BlueprintAssetInput | null;
  generatedAssetId: string | null;
  generatedAsset: BlueprintAssetInput | null;
  effectiveAsset: BlueprintAssetInput | null;
  effectiveAssetId: string | null;
  effectiveAssetPath: string | null;
  effectiveAssetSource:
    | "project_asset"
    | "generated_asset"
    | "fallback_generated"
    | "missing";
  generatedNarrationAssetId: string | null;
  generatedNarrationAsset: BlueprintAssetInput | null;
  effectiveNarrationAsset: BlueprintAssetInput | null;
  effectiveNarrationAssetId: string | null;
  effectiveNarrationAssetPath: string | null;
  narrationSource: "generated" | "manual" | "missing";
  effectiveNarrationSource: "generated" | "manual" | "missing";
  narrationReady: boolean;
  narrationDurationSeconds: number | null;
  narrationStatus: string | null;
  narrationProvider: string | null;
  narrationVoicePackId: string | null;
  visualSourceMode: string | null;
  suggestedShotDurationSeconds: number | null;
  suggestedMicroclipPlacement: string | null;
  suggestedIntensity: "low" | "medium" | "high" | "extreme" | null;
  transition: string;
  visualPreset: ResolvedScenePreset;
  captionStyle: ResolvedCaptionStyle & {
    effectivePosition: CaptionPosition;
    emphasisWords: string[];
  };
  storyRole: NarrativeSceneRole;
  storyReason: string;
  readingSpeedStatus: CaptionQualityAnalysis["readingSpeedStatus"];
  editorialMicroclips: RenderBlueprintEditorialMicroclip[];
  smartCropDirective: RenderBlueprintSmartCropDirective | null;
  captionCues: RenderBlueprintCaptionCue[];
  premiumVisualRecipe: Record<string, unknown> | null;
  warnings: string[];
  ready: boolean;
}

export interface RenderBlueprintEditorialMicroclip {
  microclipId: string;
  assetId: string;
  assetPath: string | null;
  asset: BlueprintAssetInput | null;
  label: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  usageMode: "supporting_evidence" | "impact_moment" | "quick_reference";
  narrationOverlay: boolean;
  textOverlay: string | null;
  calloutStyle: "none" | "minimal" | "bold";
  transitionIn: "cut" | "flash" | "whoosh";
  transitionOut: "cut" | "flash" | "whoosh";
  volumeMode: "mute_original" | "low_original" | "keep_original";
  orderIndex: number;
  insertStartSeconds: number;
  insertEndSeconds: number;
  metadata: Record<string, unknown> | null;
}

export interface RenderBlueprintSummary {
  durationTotal: number;
  sceneCount: number;
  readyScenes: number;
  scenesWithProblems: number;
  templateId: string;
  defaultCaptionStyleId: CaptionStyleId;
  hasEditorialMicroclips: boolean;
  microclipCount: number;
  totalMicroclipDurationSeconds: number;
}

export interface RenderBlueprint {
  projectId: string;
  title: string;
  status: string;
  format: "vertical_9_16";
  sourceFormat: string;
  channel: BlueprintChannelInput;
  template: ResolvedProjectTemplate;
  defaultCaptionStyle: CaptionStyle;
  storyAnalysis: StoryAnalysis;
  captionAnalysis: ProjectCaptionAnalysisSummary;
  resolution: {
    width: 1080;
    height: 1920;
  };
  fps: 30;
  durationTotal: number;
  sceneCount: number;
  hasEditorialMicroclips: boolean;
  microclipCount: number;
  totalMicroclipDurationSeconds: number;
  editingReferencePresetId: string | null;
  editingReferencePresetName: string | null;
  editingStyleSummary: BlueprintEditingStyleSummary | null;
  selectedMusicAssetId: string | null;
  selectedMusicAssetPath: string | null;
  musicPresetId: string | null;
  musicLicenseStatus: AudioLicenseStatus | null;
  beatSyncPlan: AudioMixPlan["beatSyncPlan"];
  sfxCueCount: number;
  musicWarnings: string[];
  audio: AudioMixPlan;
  summary: RenderBlueprintSummary;
  subtitleExports: {
    srt: string;
    ass: string;
  };
  scenes: RenderBlueprintScene[];
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFromRecord(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringFromRecord(record: Record<string, unknown>, key: string, fallback = ""): string {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function stringArrayFromRecord(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function parseSceneVisualRecipe(scene: BlueprintSceneInput): Record<string, unknown> | null {
  if (!scene.visualRecipe?.trim()) return null;
  try {
    const parsed = JSON.parse(scene.visualRecipe) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseSmartCropDirective(recipe: Record<string, unknown> | null): RenderBlueprintSmartCropDirective | null {
  const raw = recipe?.smartCropDirective;
  if (!isRecord(raw)) return null;
  const crop = isRecord(raw.normalizedCrop) ? raw.normalizedCrop : {};
  const anchor = isRecord(raw.anchorPoint) ? raw.anchorPoint : {};
  return {
    sceneOrder: numberFromRecord(raw, "sceneOrder", 0),
    panelId: stringFromRecord(raw, "panelId", ""),
    pageNumber: typeof raw.pageNumber === "number" ? raw.pageNumber : null,
    focus: stringFromRecord(raw, "focus", "impact_detail"),
    normalizedCrop: {
      x: numberFromRecord(crop, "x", 0),
      y: numberFromRecord(crop, "y", 0),
      width: numberFromRecord(crop, "width", 1),
      height: numberFromRecord(crop, "height", 1)
    },
    safeCaptionZone: stringFromRecord(raw, "safeCaptionZone", "lower-third"),
    cameraMove: stringFromRecord(raw, "cameraMove", "slow_push_center"),
    startScale: numberFromRecord(raw, "startScale", 1),
    endScale: numberFromRecord(raw, "endScale", 1),
    anchorPoint: {
      x: numberFromRecord(anchor, "x", 0.5),
      y: numberFromRecord(anchor, "y", 0.5)
    },
    holdSeconds: numberFromRecord(raw, "holdSeconds", 0.3),
    motionIntensity: numberFromRecord(raw, "motionIntensity", 6),
    textSafety: stringFromRecord(raw, "textSafety", "caption_safe"),
    renderInstruction: stringFromRecord(raw, "renderInstruction", ""),
    reasons: stringArrayFromRecord(raw, "reasons"),
    confidenceScore: numberFromRecord(raw, "confidenceScore", 0)
  };
}

function normalizeCueEnd(startSeconds: number, endSeconds: number) {
  return endSeconds > startSeconds ? endSeconds : startSeconds + 0.45;
}

function parseCaptionCues(recipe: Record<string, unknown> | null): RenderBlueprintCaptionCue[] {
  const raw = recipe?.premiumDirection;
  const nestedCues = isRecord(raw) ? raw.captionCues : undefined;
  const sceneCues = Array.isArray(nestedCues) ? nestedCues : recipe?.captionCues;
  if (Array.isArray(sceneCues)) {
    return sceneCues.filter(isRecord).map((cue, index) => {
      const startSeconds = numberFromRecord(cue, "startSeconds", 0);
      const endSeconds = normalizeCueEnd(startSeconds, numberFromRecord(cue, "endSeconds", startSeconds + 0.45));
      return {
        cueIndex: numberFromRecord(cue, "cueIndex", index + 1),
        startSeconds,
        endSeconds,
        text: stringFromRecord(cue, "text", ""),
        highlightedWords: stringArrayFromRecord(cue, "highlightedWords"),
        layout: typeof cue.layout === "string" ? cue.layout : null,
        animation: typeof cue.animation === "string" ? cue.animation : null,
        sfxSuggestion: typeof cue.sfxSuggestion === "string" ? cue.sfxSuggestion : null,
        readingImpactScore: typeof cue.readingImpactScore === "number" ? cue.readingImpactScore : null,
        readingWarnings: stringArrayFromRecord(cue, "readingWarnings")
      };
    }).filter((cue) => cue.text.trim().length > 0);
  }

  const captionRenderPlan = recipe?.captionRenderPlan;
  const wordCues = isRecord(captionRenderPlan) && Array.isArray(captionRenderPlan.wordCues)
    ? captionRenderPlan.wordCues
    : [];
  const emphasisWords = isRecord(captionRenderPlan) ? stringArrayFromRecord(captionRenderPlan, "emphasisWords") : [];
  const safeZone = isRecord(captionRenderPlan) ? stringFromRecord(captionRenderPlan, "safeZone", "lower-third") : "lower-third";
  const impactScore = isRecord(captionRenderPlan) ? numberFromRecord(captionRenderPlan, "impactScore", 88) : 88;
  const planAnimation = isRecord(captionRenderPlan) ? stringFromRecord(captionRenderPlan, "animation", "comic_pop") : "comic_pop";

  return wordCues.filter(isRecord).map((cue, index) => {
    const startSeconds = numberFromRecord(cue, "startSeconds", index * 0.55);
    const endSeconds = normalizeCueEnd(startSeconds, numberFromRecord(cue, "endSeconds", startSeconds + 0.55));
    const text = stringFromRecord(cue, "word", "");
    const emphasis = stringFromRecord(cue, "emphasis", "punch");
    const animation = stringFromRecord(cue, "animation", planAnimation);
    return {
      cueIndex: index + 1,
      startSeconds,
      endSeconds,
      text,
      highlightedWords: text ? [text, ...emphasisWords.filter((word) => word.toLowerCase() !== text.toLowerCase()).slice(0, 2)] : emphasisWords.slice(0, 3),
      layout: safeZone,
      animation,
      sfxSuggestion: emphasis === "impact" || animation.includes("slam") || animation.includes("shake") ? "caption_hit" : null,
      readingImpactScore: impactScore,
      readingWarnings: []
    };
  }).filter((cue) => cue.text.trim().length > 0);
}
function normalizeSceneOrder(left: BlueprintSceneInput, right: BlueprintSceneInput) {
  return left.order - right.order;
}

function normalizeVisualSourceMode(value: string | null | undefined) {
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

function resolveEditingIntensity(
  summary: BlueprintEditingStyleSummary | null
): "low" | "medium" | "high" | "extreme" | null {
  if (!summary) {
    return null;
  }

  if (
    summary.pacing === "hyper" ||
    summary.flashStyle === "high" ||
    summary.sfxStyle === "high"
  ) {
    return "extreme";
  }

  if (
    summary.pacing === "fast" ||
    summary.flashStyle === "medium" ||
    summary.sfxStyle === "medium"
  ) {
    return "high";
  }

  if (summary.pacing === "slow") {
    return "low";
  }

  return "medium";
}

function resolveEffectiveAsset(
  scene: BlueprintSceneInput
): Pick<
  RenderBlueprintScene,
  | "effectiveAsset"
  | "effectiveAssetId"
  | "effectiveAssetPath"
  | "effectiveAssetSource"
  | "generatedAsset"
  | "generatedAssetId"
> {
  const baseAsset = scene.asset;
  const baseAssetId = scene.assetId ?? null;
  const generatedAsset =
    "generatedAsset" in scene
      ? ((scene as BlueprintSceneInput & { generatedAsset?: BlueprintAssetInput | null })
          .generatedAsset ?? null)
      : null;
  const generatedAssetId =
    "generatedAssetId" in scene
      ? ((scene as BlueprintSceneInput & { generatedAssetId?: string | null })
          .generatedAssetId ?? null)
      : null;
  const mode = normalizeVisualSourceMode(scene.visualSourceMode);

  if (mode === "asset_only") {
    return {
      generatedAsset,
      generatedAssetId,
      effectiveAsset: baseAsset,
      effectiveAssetId: baseAssetId,
      effectiveAssetPath: baseAsset?.path ?? null,
      effectiveAssetSource: baseAsset ? "project_asset" : "missing"
    };
  }

  if (mode === "generated_only") {
    const effectiveAsset = generatedAsset;
    return {
      generatedAsset,
      generatedAssetId,
      effectiveAsset,
      effectiveAssetId: generatedAssetId,
      effectiveAssetPath: effectiveAsset?.path ?? null,
      effectiveAssetSource: effectiveAsset ? "generated_asset" : "missing"
    };
  }

  if (mode === "fallback_generated") {
    const effectiveAsset = baseAsset ?? generatedAsset;
    const effectiveAssetId = baseAssetId ?? generatedAssetId;
    return {
      generatedAsset,
      generatedAssetId,
      effectiveAsset,
      effectiveAssetId,
      effectiveAssetPath: effectiveAsset?.path ?? null,
      effectiveAssetSource: effectiveAsset ? "fallback_generated" : "missing"
    };
  }

  if (mode === "mixed_sequence") {
    const effectiveAsset = generatedAsset ?? baseAsset;
    return {
      generatedAsset,
      generatedAssetId,
      effectiveAsset,
      effectiveAssetId: generatedAssetId ?? baseAssetId,
      effectiveAssetPath: effectiveAsset?.path ?? null,
      effectiveAssetSource: effectiveAsset
        ? generatedAsset
          ? "generated_asset"
          : "project_asset"
        : "missing"
    };
  }

  if (mode === "hybrid_overlay") {
    const effectiveAsset = baseAsset ?? generatedAsset;
    return {
      generatedAsset,
      generatedAssetId,
      effectiveAsset,
      effectiveAssetId: baseAssetId ?? generatedAssetId,
      effectiveAssetPath: effectiveAsset?.path ?? null,
      effectiveAssetSource: effectiveAsset
        ? baseAsset
          ? "project_asset"
          : "generated_asset"
        : "missing"
    };
  }

  const effectiveAsset = generatedAsset ?? baseAsset;

  return {
    generatedAsset,
    generatedAssetId,
    effectiveAsset,
    effectiveAssetId: generatedAssetId ?? baseAssetId,
    effectiveAssetPath: effectiveAsset?.path ?? null,
    effectiveAssetSource: generatedAsset
      ? "generated_asset"
      : baseAsset
        ? "project_asset"
        : "missing"
  };
}

function resolveEffectiveNarration(
  scene: BlueprintSceneInput,
  project: BlueprintProjectInput
): Pick<
  RenderBlueprintScene,
  | "generatedNarrationAssetId"
  | "generatedNarrationAsset"
  | "effectiveNarrationAsset"
  | "effectiveNarrationAssetId"
  | "effectiveNarrationAssetPath"
  | "narrationSource"
  | "effectiveNarrationSource"
  | "narrationReady"
  | "narrationDurationSeconds"
  | "narrationStatus"
  | "narrationProvider"
  | "narrationVoicePackId"
> {
  const generatedNarrationAsset =
    "generatedNarrationAsset" in scene
      ? (
          scene as BlueprintSceneInput & {
            generatedNarrationAsset?: BlueprintAssetInput | null;
          }
        ).generatedNarrationAsset ?? null
      : null;
  const generatedNarrationAssetId =
    "generatedNarrationAssetId" in scene
      ? (
          scene as BlueprintSceneInput & {
            generatedNarrationAssetId?: string | null;
          }
        ).generatedNarrationAssetId ?? null
      : null;

  if (generatedNarrationAsset || generatedNarrationAssetId) {
    return {
      generatedNarrationAssetId,
      generatedNarrationAsset,
      effectiveNarrationAsset: generatedNarrationAsset,
      effectiveNarrationAssetId: generatedNarrationAssetId,
      effectiveNarrationAssetPath: generatedNarrationAsset?.path ?? null,
      narrationSource: "generated",
      effectiveNarrationSource: "generated",
      narrationReady: Boolean(
        generatedNarrationAssetId ?? generatedNarrationAsset?.path ?? null
      ),
      narrationDurationSeconds: generatedNarrationAsset?.duration ?? null,
      narrationStatus:
        "narrationStatus" in scene
          ? (scene as BlueprintSceneInput & { narrationStatus?: string | null })
              .narrationStatus ?? null
          : null,
      narrationProvider:
        "narrationProvider" in scene
          ? (scene as BlueprintSceneInput & { narrationProvider?: string | null })
              .narrationProvider ?? null
          : null,
      narrationVoicePackId:
        "narrationVoicePackId" in scene
          ? (
              scene as BlueprintSceneInput & {
                narrationVoicePackId?: string | null;
              }
            ).narrationVoicePackId ?? null
          : null
    };
  }

  return {
    generatedNarrationAssetId,
    generatedNarrationAsset,
    effectiveNarrationAsset: project.voiceoverAsset,
    effectiveNarrationAssetId: project.voiceoverAssetId,
    effectiveNarrationAssetPath: project.voiceoverAsset?.path ?? null,
    narrationSource:
      project.voiceoverAssetId || project.voiceoverAsset ? "manual" : "missing",
    effectiveNarrationSource:
      project.voiceoverAssetId || project.voiceoverAsset ? "manual" : "missing",
    narrationReady: Boolean(
      project.voiceoverAssetId ?? project.voiceoverAsset?.path ?? null
    ),
    narrationDurationSeconds: project.voiceoverAsset?.duration ?? null,
    narrationStatus:
      "narrationStatus" in scene
        ? (scene as BlueprintSceneInput & { narrationStatus?: string | null })
            .narrationStatus ?? null
        : null,
    narrationProvider:
      "narrationProvider" in scene
        ? (scene as BlueprintSceneInput & { narrationProvider?: string | null })
            .narrationProvider ?? null
        : null,
    narrationVoicePackId:
      "narrationVoicePackId" in scene
        ? (
            scene as BlueprintSceneInput & {
              narrationVoicePackId?: string | null;
            }
          ).narrationVoicePackId ?? null
        : null
  };
}

function normalizePosition(position: string | null | undefined): CaptionPosition | null {
  if (typeof position !== "string" || position.trim().length === 0) {
    return null;
  }

  const normalized = position.trim().toLowerCase();

  if (
    normalized === "top" ||
    normalized === "center" ||
    normalized === "lower-third" ||
    normalized === "bottom" ||
    normalized === "split"
  ) {
    return normalized;
  }

  return null;
}

function normalizeEmotionTag(
  emotion: string | null | undefined
): CaptionEmotionTag | null {
  switch (emotion) {
    case "NEUTRAL":
    case "CURIOUS":
    case "EPIC":
    case "MYSTERIOUS":
    case "DARK":
    case "TENSE":
    case "JOYFUL":
    case "SAD":
      return emotion;
    default:
      return null;
  }
}

function normalizeSceneDurationValue(duration: number | null | undefined) {
  if (typeof duration !== "number" || Number.isNaN(duration) || duration <= 0) {
    return 4;
  }

  return duration;
}

function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}

function resolveSceneEditorialMicroclips(
  scene: BlueprintSceneInput
): RenderBlueprintEditorialMicroclip[] {
  const rawMicroclips = [...(scene.editorialMicroclips ?? [])]
    .filter((microclip) => microclip.sceneId === scene.id)
    .sort((left, right) => left.orderIndex - right.orderIndex);

  if (rawMicroclips.length === 0) {
    return [];
  }

  const sceneDuration = normalizeSceneDurationValue(scene.duration);
  const totalClipDuration = rawMicroclips.reduce(
    (total, microclip) => total + microclip.durationSeconds,
    0
  );
  const gapCount = rawMicroclips.length + 1;
  const baseGap = Math.max((sceneDuration - totalClipDuration) / gapCount, 0.08);
  let cursor = Math.min(baseGap, 0.6);

  return rawMicroclips.map((microclip) => {
    const remainingAfter = rawMicroclips
      .slice(rawMicroclips.indexOf(microclip) + 1)
      .reduce((total, entry) => total + entry.durationSeconds, 0);
    const maxStart = Math.max(sceneDuration - microclip.durationSeconds - remainingAfter, 0);
    const insertStartSeconds = roundToThreeDecimals(Math.min(cursor, maxStart));
    const insertEndSeconds = roundToThreeDecimals(
      Math.min(insertStartSeconds + microclip.durationSeconds, sceneDuration)
    );

    cursor = roundToThreeDecimals(insertEndSeconds + baseGap);

    return {
      microclipId: microclip.id,
      assetId: microclip.assetId,
      assetPath: microclip.asset?.path ?? null,
      asset: microclip.asset,
      label: microclip.label,
      startTimeSeconds: microclip.startTimeSeconds,
      endTimeSeconds: microclip.endTimeSeconds,
      durationSeconds: microclip.durationSeconds,
      usageMode: microclip.usageMode,
      narrationOverlay: microclip.narrationOverlay,
      textOverlay: microclip.textOverlay,
      calloutStyle: microclip.calloutStyle,
      transitionIn: microclip.transitionIn,
      transitionOut: microclip.transitionOut,
      volumeMode: microclip.volumeMode,
      orderIndex: microclip.orderIndex,
      insertStartSeconds,
      insertEndSeconds,
      metadata: microclip.metadata
    };
  });
}

function toStoryProjectInput(project: BlueprintProjectInput) {
  return {
    id: project.id,
    title: project.title,
    script: project.script,
    scenes: [...project.scenes].sort(normalizeSceneOrder).map((scene) => {
      const effectiveAsset = resolveEffectiveAsset(scene);

      return {
        id: scene.id,
        order: scene.order,
        title: scene.title,
        narrationText: scene.narrationText,
        captionText: scene.captionText,
        duration: scene.duration,
        emotion: scene.emotion,
        hasAsset: Boolean(effectiveAsset.effectiveAssetId),
        visualPreset: scene.visualPreset,
        energyLevel: scene.energyLevel
      };
    })
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return roundToSingleDecimal(
    values.reduce((total, value) => total + value, 0) / values.length
  );
}

function buildBlueprintAudioPlan(
  project: BlueprintProjectInput
) {
  const sceneMicroclipMap = new Map(
    project.scenes.map((scene) => [scene.id, resolveSceneEditorialMicroclips(scene)] as const)
  );
  const audioAssets = [
    project.backgroundMusicAsset,
    project.voiceoverAsset,
    ...project.scenes.map((scene) => scene.sfxAsset),
    ...project.scenes.map((scene) => scene.generatedNarrationAsset ?? null),
    ...project.scenes.flatMap((scene) =>
      (sceneMicroclipMap.get(scene.id) ?? []).map((microclip) => microclip.asset)
    )
  ]
    .filter((asset): asset is BlueprintAssetInput => asset !== null)
    .map((asset) => ({
      id: asset.id,
      filename: asset.filename,
      path: asset.path,
      type: asset.type,
      duration: asset.duration,
      mimeType: asset.mimeType,
      extension: asset.extension
    }));

  const audioPlan = buildAudioMixPlan(
    {
      id: project.id,
      title: project.title,
      durationTarget: project.durationTarget,
      backgroundMusicAssetId: project.backgroundMusicAssetId,
      musicPresetId: project.musicPresetId,
      voiceoverAssetId: project.voiceoverAssetId,
      audioMood: project.audioMood,
      musicVolume: project.musicVolume,
      voiceVolume: project.voiceVolume,
      sfxVolume: project.sfxVolume,
      enableAudioDucking: project.enableAudioDucking,
      duckingLevel: project.duckingLevel
    },
    project.scenes.map((scene) => ({
      id: scene.id,
      order: scene.order,
      title: scene.title,
      duration: scene.duration,
      narrationAssetId: scene.generatedNarrationAssetId ?? null,
      narrationSource: scene.generatedNarrationAssetId ? "generated" : null,
      sfxAssetId: scene.sfxAssetId,
      sfxStartTime: scene.sfxStartTime,
      sfxVolume: scene.sfxVolume,
      clipAudioInserts: (sceneMicroclipMap.get(scene.id) ?? [])
        .filter(
          (microclip) =>
            microclip.volumeMode === "low_original" ||
            microclip.volumeMode === "keep_original"
        )
        .map((microclip) => ({
          microclipId: microclip.microclipId,
          label: microclip.label,
          assetId: microclip.assetId,
          startTime: microclip.insertStartSeconds,
          sourceStartTime: microclip.startTimeSeconds,
          duration: microclip.durationSeconds,
          volume:
            microclip.volumeMode === "keep_original"
              ? 0.78
              : 0.34,
          volumeMode:
            microclip.volumeMode === "keep_original"
              ? "keep_original"
              : "low_original",
          narrationOverlay: microclip.narrationOverlay
        }))
    })),
    [...new Map(audioAssets.map((asset) => [asset.id, asset] as const)).values()]
  );
  const selectedMusicPreset =
    getMusicPresetById(project.musicPresetId) ??
    suggestMusicPresetByContext({
      templateId: project.templateId,
      tone: project.channel.narrativeTone,
      useCase: project.channel.niche,
      niche: project.channel.niche
    });
  const beatSyncPlan = buildBeatSyncPlan({
    musicAssetProfile: project.backgroundMusicAsset?.musicProfile ?? null,
    reelDurationSeconds: audioPlan.totalDuration,
    microclips: project.scenes.flatMap((scene) =>
      (sceneMicroclipMap.get(scene.id) ?? []).map((microclip) => ({
        microclipId: microclip.microclipId,
        sceneId: scene.id,
        label: microclip.label,
        usageMode: microclip.usageMode,
        durationSeconds: microclip.durationSeconds,
        insertStartSeconds: microclip.insertStartSeconds,
        narrationOverlay: microclip.narrationOverlay
      }))
    ),
    sceneCount: project.scenes.length,
    presetId: selectedMusicPreset.id,
    narrationWindows: audioPlan.sceneNarrations.map((sceneNarration) => ({
      startSeconds: sceneNarration.startTime,
      endSeconds: sceneNarration.startTime + sceneNarration.duration
    }))
  });
  const musicWarnings = [...beatSyncPlan.warnings];

  if (!project.backgroundMusicAssetId) {
    musicWarnings.push("Projeto sem musica selecionada na biblioteca local.");
  }

  if (project.backgroundMusicAsset?.musicProfile?.safetyWarning) {
    musicWarnings.push(project.backgroundMusicAsset.musicProfile.safetyWarning);
  }

  return {
    ...audioPlan,
    musicPresetId: selectedMusicPreset.id,
    musicPreset: selectedMusicPreset,
    narrationDucking: {
      enabled: audioPlan.enableAudioDucking,
      strategy: audioPlan.narrationDucking.strategy,
      amount: audioPlan.duckingLevel
    },
    sfxCues: beatSyncPlan.suggestedSfxCues,
    microclipBeatSyncStrategy: selectedMusicPreset.microclipBeatSyncStrategy,
    beatSyncPlan,
    musicWarnings: [...new Set(musicWarnings)],
    warnings: [...new Set([...audioPlan.warnings, ...musicWarnings])]
  };
}

export function resolveProjectTemplate(
  project: BlueprintProjectInput
): ResolvedProjectTemplate {
  const configuredProjectTemplate = getTemplateById(project.templateId);

  if (configuredProjectTemplate) {
    return {
      configuredTemplateId: project.templateId,
      template: configuredProjectTemplate,
      source: "project"
    };
  }

  const configuredChannelTemplate = getTemplateById(project.channel.defaultTemplate);

  if (configuredChannelTemplate) {
    return {
      configuredTemplateId: project.channel.defaultTemplate,
      template: configuredChannelTemplate,
      source: "channel"
    };
  }

  return {
    configuredTemplateId: null,
    template: suggestTemplateByProject({
      title: project.title,
      script: project.script,
      templateId: project.templateId,
      channel: project.channel
    }),
    source: "suggested"
  };
}

export function resolveSceneCaptionStyle(
  scene: BlueprintSceneInput,
  project: BlueprintProjectInput,
  template: ReelTemplate
): ResolvedCaptionStyle {
  const configuredSceneStyle = getCaptionStyleById(scene.captionStyle);
  const configuredProjectDefault = getCaptionStyleById(project.defaultCaptionStyle);
  const templateSuggested = suggestCaptionStyleByTemplate(template.id);
  const emotionSuggested = suggestCaptionStyleByEmotion(scene.emotion);

  if (configuredSceneStyle) {
    return {
      configuredStyleId: scene.captionStyle,
      projectDefaultStyleId: project.defaultCaptionStyle,
      templateSuggestedStyleId: templateSuggested.id,
      emotionSuggestedStyleId: emotionSuggested.id,
      style: configuredSceneStyle,
      source: "scene"
    };
  }

  if (configuredProjectDefault) {
    return {
      configuredStyleId: null,
      projectDefaultStyleId: configuredProjectDefault.id,
      templateSuggestedStyleId: templateSuggested.id,
      emotionSuggestedStyleId: emotionSuggested.id,
      style: configuredProjectDefault,
      source: "project"
    };
  }

  if (templateSuggested) {
    return {
      configuredStyleId: null,
      projectDefaultStyleId: null,
      templateSuggestedStyleId: templateSuggested.id,
      emotionSuggestedStyleId: emotionSuggested.id,
      style: templateSuggested,
      source: "template"
    };
  }

  return {
    configuredStyleId: null,
    projectDefaultStyleId: null,
    templateSuggestedStyleId: emotionSuggested.id,
    emotionSuggestedStyleId: emotionSuggested.id,
    style: emotionSuggested,
    source: "emotion"
  };
}

export function resolveScenePreset(
  scene: BlueprintSceneInput,
  template: ReelTemplate
): ResolvedScenePreset {
  const configuredPreset = getCinematicPresetById(scene.visualPreset);
  const templatePreset =
    getCinematicPresetById(template.defaultVisualPreset) ??
    suggestPresetForEmotion(scene.emotion as PresetEmotionTag | null);
  const emotionPreset = suggestPresetForEmotion(scene.emotion as PresetEmotionTag | null);

  if (configuredPreset) {
    return {
      configuredPresetId: scene.visualPreset,
      templateSuggestedPresetId: templatePreset.id,
      emotionSuggestedPresetId: emotionPreset.id,
      preset: configuredPreset,
      source: "scene"
    };
  }

  if (templatePreset) {
    return {
      configuredPresetId: null,
      templateSuggestedPresetId: templatePreset.id,
      emotionSuggestedPresetId: emotionPreset.id,
      preset: templatePreset,
      source: "template"
    };
  }

  return {
    configuredPresetId: null,
    templateSuggestedPresetId: emotionPreset.id,
    emotionSuggestedPresetId: emotionPreset.id,
    preset: emotionPreset,
    source: "emotion"
  };
}

export function buildProjectCaptionAnalysis(
  project: BlueprintProjectInput
): ProjectCaptionAnalysis {
  const orderedScenes = [...project.scenes].sort(normalizeSceneOrder);
  const resolvedTemplate = resolveProjectTemplate(project);
  const defaultCaptionStyle =
    getCaptionStyleById(project.defaultCaptionStyle) ??
    getCaptionStyleById(resolvedTemplate.template.defaultCaptionStyle) ??
    suggestCaptionStyleByTemplate(resolvedTemplate.template.id);

  const scenes = orderedScenes.map((scene) => {
    const suggestedByTemplate = suggestCaptionStyleByTemplate(resolvedTemplate.template.id);
    const suggestedByEmotion = suggestCaptionStyleByEmotion(scene.emotion);
    const resolvedStyle = resolveSceneCaptionStyle(
      scene,
      project,
      resolvedTemplate.template
    );
    const quality = analyzeCaptionQuality(
      scene.captionText ?? "",
      scene.duration,
      resolvedStyle.style
    );

    return {
      sceneId: scene.id,
      order: scene.order,
      title: scene.title,
      captionText: scene.captionText,
      duration: scene.duration,
      splitLines: splitCaptionIntoLines(scene.captionText ?? "", resolvedStyle.style),
      quality,
      suggestedByTemplate,
      suggestedByEmotion,
      resolvedStyle
    };
  });

  const tooFastScenes = scenes.filter(
    (scene) => scene.quality.readingSpeedStatus === "too_fast"
  ).length;
  const scenesWithoutCaptions = scenes.filter(
    (scene) => !scene.captionText?.trim()
  ).length;
  const scenesWithWarnings = scenes.filter(
    (scene) =>
      scene.quality.lineWarnings.length > 0 ||
      scene.quality.durationWarnings.length > 0
  ).length;
  const alerts: string[] = [];

  if (scenesWithoutCaptions > 0) {
    alerts.push(
      `${scenesWithoutCaptions} cena(s) ainda nao possuem legenda definida.`
    );
  }

  if (tooFastScenes > 0) {
    alerts.push(
      `${tooFastScenes} cena(s) estao com leitura rapida demais para um acabamento premium.`
    );
  }

  if (scenesWithWarnings > 0) {
    alerts.push(
      `${scenesWithWarnings} cena(s) pedem ajuste de quebra de linha ou duracao.`
    );
  }

  return {
    projectId: project.id,
    template: resolvedTemplate,
    defaultCaptionStyle,
    summary: {
      sceneCount: orderedScenes.length,
      scenesWithCaptions: orderedScenes.length - scenesWithoutCaptions,
      scenesWithoutCaptions,
      tooFastScenes,
      scenesWithWarnings,
      averageImpactScore: average(scenes.map((scene) => scene.quality.impactScore)),
      alerts
    },
    scenes
  };
}


function buildCaptionExportScenesFromBlueprintScenes(scenes: RenderBlueprintScene[]): Array<{
  order: number;
  captionText: string | null;
  duration: number | null;
  captionStyle: string | null;
}> {
  const exportScenes: Array<{ order: number; captionText: string | null; duration: number | null; captionStyle: string | null }> = [];
  for (const scene of [...scenes].sort((left, right) => left.order - right.order)) {
    if (scene.captionCues.length === 0) {
      exportScenes.push({
        order: scene.order,
        captionText: scene.captionText,
        duration: scene.duration,
        captionStyle: scene.captionStyle.style.id
      });
      continue;
    }
    const sceneDuration = scene.duration ?? scene.captionCues.at(-1)?.endSeconds ?? null;
    const cueTotal = Math.max(...scene.captionCues.map((cue) => cue.endSeconds), sceneDuration ?? 0, 0.1);
    for (const cue of scene.captionCues) {
      const cueDuration = Math.max(0.35, cue.endSeconds - cue.startSeconds);
      const scaledDuration = sceneDuration ? Math.max(0.35, (cueDuration / cueTotal) * sceneDuration) : cueDuration;
      exportScenes.push({
        order: scene.order + cue.cueIndex / 100,
        captionText: cue.text,
        duration: scaledDuration,
        captionStyle: scene.captionStyle.style.id
      });
    }
  }
  return exportScenes;
}

export function buildRenderBlueprint(project: BlueprintProjectInput): RenderBlueprint {
  const orderedScenes = [...project.scenes].sort(normalizeSceneOrder);
  const resolvedTemplate = resolveProjectTemplate(project);
  const captionAnalysis = buildProjectCaptionAnalysis(project);
  const storyAnalysis = analyzeStoryProject(toStoryProjectInput(project));
  const audio = buildBlueprintAudioPlan(project);
  const roleMap = new Map<string, SuggestedSceneRole>(
    storyAnalysis.suggestedSceneRoles.map(
      (role: SuggestedSceneRole) => [role.sceneId, role] as const
    )
  );

  const scenes: RenderBlueprintScene[] = orderedScenes.map((scene) => {
    const captionScene =
      captionAnalysis.scenes.find((entry) => entry.sceneId === scene.id) ?? null;
    const resolvedCaptionStyle =
      captionScene?.resolvedStyle ??
      resolveSceneCaptionStyle(scene, project, resolvedTemplate.template);
    const resolvedPreset = resolveScenePreset(scene, resolvedTemplate.template);
    const role = roleMap.get(scene.id);
    const effectivePosition =
      normalizePosition(scene.captionPosition) ?? resolvedCaptionStyle.style.position;
    const transition =
      scene.transition ??
      resolvedPreset.preset.suggestedTransition ??
      resolvedTemplate.template.defaultTransition;
    const effectiveVisual = resolveEffectiveAsset(scene);
    const effectiveNarration = resolveEffectiveNarration(scene, project);
    const editorialMicroclips = resolveSceneEditorialMicroclips(scene);
    const premiumVisualRecipe = parseSceneVisualRecipe(scene);
    const smartCropDirective = parseSmartCropDirective(premiumVisualRecipe);
    const captionCues = parseCaptionCues(premiumVisualRecipe);
    const warnings: string[] = [];

    if (!effectiveVisual.effectiveAssetId) {
      warnings.push("Cena sem visual efetivo associado.");
    }

    if (!scene.captionText?.trim()) {
      warnings.push("Cena sem legenda definida.");
    }

    if (captionScene) {
      warnings.push(...captionScene.quality.lineWarnings);
      warnings.push(...captionScene.quality.durationWarnings);
    }

    if (editorialMicroclips.some((microclip) => !microclip.assetPath)) {
      warnings.push("Existe microclip editorial sem asset resolvido.");
    }

    return {
      sceneId: scene.id,
      order: scene.order,
      title: scene.title,
      narrationText: scene.narrationText,
      captionText: scene.captionText,
      captionPreviewLines:
        captionScene?.splitLines ?? splitCaptionIntoLines(scene.captionText ?? "", resolvedCaptionStyle.style),
      duration: scene.duration,
      emotion: normalizeEmotionTag(scene.emotion),
      energyLevel: scene.energyLevel ?? role?.energyScore ?? 40,
      assetId: scene.assetId,
      asset: scene.asset,
      ...effectiveVisual,
      ...effectiveNarration,
      visualSourceMode: scene.visualSourceMode ?? null,
      suggestedShotDurationSeconds:
        project.editingStyleSummary?.defaultShotDurationSeconds ??
        project.editingStyleSummary?.cutPace ??
        null,
      suggestedMicroclipPlacement:
        project.editingStyleSummary?.microclipPlacement ?? null,
      suggestedIntensity: resolveEditingIntensity(project.editingStyleSummary),
      transition,
      visualPreset: resolvedPreset,
      captionStyle: {
        ...resolvedCaptionStyle,
        effectivePosition,
        emphasisWords: [...scene.captionEmphasisWords]
      },
      storyRole: role?.role ?? "context",
      storyReason:
        role?.reason ?? "Fallback local aplicado por ausencia de papel narrativo.",
      readingSpeedStatus: captionScene?.quality.readingSpeedStatus ?? "slow",
      editorialMicroclips,
      smartCropDirective,
      captionCues,
      premiumVisualRecipe,
      warnings: [...new Set(warnings)],
      ready: warnings.length === 0
    };
  });

  const readyScenes = scenes.filter((scene) => scene.ready).length;
  const scenesWithProblems = scenes.length - readyScenes;
  const microclipCount = scenes.reduce(
    (total, scene) => total + scene.editorialMicroclips.length,
    0
  );
  const totalMicroclipDurationSeconds = roundToSingleDecimal(
    scenes.reduce(
      (total, scene) =>
        total +
        scene.editorialMicroclips.reduce(
          (sceneTotal, microclip) => sceneTotal + microclip.durationSeconds,
          0
        ),
      0
    )
  );
  const hasEditorialMicroclips = microclipCount > 0;
  const durationTotal = roundToSingleDecimal(
    orderedScenes.reduce((total, scene) => total + (scene.duration ?? 0), 0)
  );
  const defaultCaptionStyle =
    captionAnalysis.defaultCaptionStyle ??
    suggestCaptionStyleByTemplate(resolvedTemplate.template.id);

  return {
    projectId: project.id,
    title: project.title,
    status: project.status,
    format: "vertical_9_16",
    sourceFormat: project.format,
    channel: project.channel,
    template: resolvedTemplate,
    defaultCaptionStyle,
    storyAnalysis,
    captionAnalysis: captionAnalysis.summary,
    resolution: {
      width: 1080,
      height: 1920
    },
    fps: 30,
    durationTotal,
    sceneCount: scenes.length,
    hasEditorialMicroclips,
    microclipCount,
    totalMicroclipDurationSeconds,
    editingReferencePresetId: project.editingReferencePresetId,
    editingReferencePresetName:
      project.editingStyleSummary?.presetName ?? null,
    editingStyleSummary: project.editingStyleSummary,
    selectedMusicAssetId: project.backgroundMusicAssetId,
    selectedMusicAssetPath: project.backgroundMusicAsset?.path ?? null,
    musicPresetId: audio.musicPresetId,
    musicLicenseStatus:
      project.backgroundMusicAsset?.musicProfile?.licenseStatus ?? null,
    beatSyncPlan: audio.beatSyncPlan,
    sfxCueCount: audio.sfxCues.length,
    musicWarnings: audio.musicWarnings,
    audio,
    summary: {
      durationTotal,
      sceneCount: scenes.length,
      readyScenes,
      scenesWithProblems,
      templateId: resolvedTemplate.template.id,
      defaultCaptionStyleId: defaultCaptionStyle.id,
      hasEditorialMicroclips,
      microclipCount,
      totalMicroclipDurationSeconds
    },
    subtitleExports: {
      srt: generateSrt({
        title: project.title,
        scenes: buildCaptionExportScenesFromBlueprintScenes(scenes)
      }),
      ass: generateAssSubtitle(
        {
          title: project.title,
          scenes: buildCaptionExportScenesFromBlueprintScenes(scenes)
        },
        defaultCaptionStyle
      )
    },
    scenes
  };
}

