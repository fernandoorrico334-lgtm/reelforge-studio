"use client";

import { getMusicPresetById, getMusicPresets } from "@reelforge/audio-engine";
import {
  buildPremiumAudioMixPlan,
  getAudioMasteringPresets
} from "@reelforge/audio-engine/mastering";
import {
  getCaptionStyleById,
  getCaptionStyles
} from "@reelforge/caption-engine";
import {
  getReelsFactoryTemplateById,
  isReelsFactoryTemplateId
} from "@reelforge/story-engine/reels-factory";
import {
  getTemplateById,
  getTemplates,
  suggestTemplateByProject
} from "@reelforge/templates";
import { useEffect, useState, type FormEvent } from "react";
import { AssetMediaPreview } from "./asset-media-preview";
import { CaptionEnginePanel } from "./caption-engine-panel";
import { CaptionFramePreview } from "./caption-frame-preview";
import { CinematicPresetCard } from "./cinematic-preset-card";
import { RenderBlueprintPanel } from "./render-blueprint-panel";
import { RenderJobsPanel } from "./render-jobs-panel";
import { StoryEnginePanel } from "./story-engine-panel";
import {
  createEditorialMicroclipRequest,
  createSceneRequest,
  deleteEditorialMicroclipRequest,
  deleteSceneRequest,
  getEditingReferencePresetSuggestionsSnapshot,
  generateSceneNarrationRequest,
  generateSceneVisualRequest,
  getEditorialMicroclipsForProjectRequest,
  getProjectBeatSyncPlanSnapshot,
  getProjectCaptionAnalysisSnapshot,
  getProjectProductionChecklistSnapshot,
  getProjectRenderBlueprintSnapshot,
  getSceneGeneratedImagesRequest,
  getSceneNarrationsRequest,
  markVisualGenerationJobReviewedRequest,
  regenerateVisualGenerationJobRequest,
  reorderScenesRequest,
  selectMusicForProjectSnapshot,
  useSceneNarrationRequest,
  useGeneratedImageForSceneRequest,
  updateEditorialMicroclipRequest,
  updateProjectRequest,
  updateSceneRequest
} from "../lib/studio-api";
import {
  buildProjectStoryAnalysis,
  cinematicPresetsCatalog,
  resolveScenePresetPreview
} from "../lib/project-story-analysis";
import type {
  AudioMasteringPreview,
  AudioMasteringPresetId,
  BuildBeatSyncPlanResponse,
  CaptionPosition,
  CaptionStyleId,
  ComfyWorkflowPack,
  DataSource,
  EditorialMicroclip,
  EditorialMicroclipCalloutStyle,
  EditorialMicroclipPayload,
  EditorialMicroclipSourceType,
  EditorialMicroclipTransition,
  EditorialMicroclipUsageMode,
  EditorialMicroclipVolumeMode,
  EmotionTag,
  EditingReferenceSuggestion,
  GeneratedAudioGalleryItem,
  GeneratedImageGalleryItem,
  NarrationProviderDescriptor,
  NarrationJob,
  NarrationVoicePack,
  ImageQualityPreset,
  ProjectCaptionAnalysisResponse,
  ProjectPayload,
  ProjectProductionChecklistResponse,
  ProjectScene,
  ProjectStatus,
  ReelsFactoryNextAction,
  RenderBlueprintResponse,
  ScenePayload,
  StudioAsset,
  StudioChannel,
  StudioProject,
  VisualGenerationJob
} from "../lib/studio-types";
import {
  captionPositions,
  editorialMicroclipCalloutStyles,
  editorialMicroclipSourceTypes,
  editorialMicroclipTransitions,
  editorialMicroclipUsageModes,
  editorialMicroclipVolumeModes,
  emotionTags,
  projectStatuses
} from "../lib/studio-types";
import {
  getSceneEffectiveAssetId,
  getSceneEffectiveAssetLabel,
  getSceneEffectiveAssetSource,
  isBaseAssetActive,
  isGeneratedAssetActive,
  sceneHasEffectiveAsset
} from "../lib/effective-assets";

interface ProjectStudioProps {
  assets: StudioAsset[];
  assetsSource: DataSource;
  channels: StudioChannel[];
  channelsSource: DataSource;
  initialProject: StudioProject;
  initialSource: DataSource;
  workflowPacks: ComfyWorkflowPack[];
  workflowPacksSource: DataSource;
  qualityPresets: ImageQualityPreset[];
  qualityPresetsSource: DataSource;
  initialGeneratedImages: GeneratedImageGalleryItem[];
  initialGeneratedImagesSource: DataSource;
  narrationProviders: NarrationProviderDescriptor[];
  narrationProvidersSource: DataSource;
  narrationVoicePacks: NarrationVoicePack[];
  narrationVoicePacksSource: DataSource;
  initialGeneratedNarrations: GeneratedAudioGalleryItem[];
  initialGeneratedNarrationsSource: DataSource;
  initialEditingReferenceSuggestions: EditingReferenceSuggestion[];
  initialEditingReferenceSuggestionsSource: DataSource;
}

interface ProjectFormState {
  title: string;
  status: ProjectStatus;
  channelId: string;
  script: string;
  durationTarget: string;
  format: string;
  templateId: string;
  defaultCaptionStyle: string;
  musicPresetId: string;
}

interface SceneFormState {
  order: string;
  title: string;
  narrationText: string;
  captionText: string;
  duration: string;
  emotion: EmotionTag | "";
  assetId: string;
  visualPreset: string;
  transition: string;
  captionStyle: string;
  captionPosition: CaptionPosition | "";
  captionEmphasisWords: string;
  energyLevel: string;
}

interface EditorialMicroclipFormState {
  sceneId: string;
  assetId: string;
  label: string;
  sourceType: EditorialMicroclipSourceType;
  startTimeSeconds: string;
  endTimeSeconds: string;
  usageMode: EditorialMicroclipUsageMode;
  narrationOverlay: boolean;
  textOverlay: string;
  calloutStyle: EditorialMicroclipCalloutStyle;
  transitionIn: EditorialMicroclipTransition;
  transitionOut: EditorialMicroclipTransition;
  volumeMode: EditorialMicroclipVolumeMode;
  orderIndex: string;
}

const captionStylesCatalog = getCaptionStyles();
const templateCatalog = getTemplates();
const audioMasteringPresetsCatalog = getAudioMasteringPresets();
const musicPresetsCatalog = getMusicPresets();

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function sortScenes(scenes: ProjectScene[]) {
  return [...scenes].sort((left, right) => left.order - right.order);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDuration(value: number | null) {
  if (!value || value <= 0) {
    return "n/d";
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)}s`;
}

function formatTagLabel(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function formatRoleLabel(value: string) {
  return value.toUpperCase();
}

function formatFactoryActionLabel(value: ReelsFactoryNextAction) {
  return value.replaceAll("_", " ");
}

function formatEffectiveVisualSourceLabel(value: "base" | "generated" | "fallback" | "missing") {
  switch (value) {
    case "base":
      return "base";
    case "generated":
      return "generated";
    case "fallback":
      return "fallback";
    default:
      return "missing";
  }
}

function inferMusicUseCase(channel: StudioChannel, templateId: string | null) {
  const haystack = [
    channel.name,
    channel.niche,
    channel.narrativeTone ?? "",
    templateId ?? ""
  ]
    .join(" ")
    .toLowerCase();

  if (haystack.includes("football") || haystack.includes("futebol")) {
    return "football";
  }

  if (
    haystack.includes("crime") ||
    haystack.includes("sombr") ||
    haystack.includes("mister")
  ) {
    return "true_crime";
  }

  if (
    haystack.includes("doc") ||
    haystack.includes("explic") ||
    haystack.includes("analit")
  ) {
    return "documentary";
  }

  if (haystack.includes("epic") || haystack.includes("cinematic")) {
    return "cinematic";
  }

  return "shorts";
}

function inferMusicTone(channel: StudioChannel, templateId: string | null) {
  return [channel.narrativeTone ?? "", channel.visualStyle ?? "", templateId ?? ""]
    .join(" ")
    .trim();
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Operacao falhou na API local.";
}

function toNullableString(value: string) {
  return value.trim() || null;
}

function toNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalPositiveInteger(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

function toEnergyLevel(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(Math.max(Math.round(parsed), 0), 100);
}

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeNoticeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase();
}

function filterContradictoryNarrativeNotice(
  notice: string,
  options: {
    climaxDetected: boolean;
    ctaDetected: boolean;
  }
) {
  const normalized = normalizeNoticeToken(notice);

  if (options.climaxDetected && normalized.includes("nenhum cl")) {
    return false;
  }

  if (options.ctaDetected && normalized.includes("nenhum cta")) {
    return false;
  }

  return true;
}

interface ReelsFactorySceneRecipe {
  source?: string;
  templateId?: string;
  tone?: string;
  durationSeconds?: number;
  suggestedWorkflowPackId?: string;
  suggestedVoicePackId?: string;
  suggestedAudioMasteringPresetId?: string;
  suggestedVisualPresetId?: string;
  microclipSlot?: {
    label?: string;
    usageMode?: string;
    textOverlay?: string | null;
  } | null;
  hashtags?: string[];
  shortDescription?: string;
  caption?: string;
  recommendedNextActions?: string[];
}

function parseReelsFactorySceneRecipe(
  value: string | null | undefined
): ReelsFactorySceneRecipe | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as ReelsFactorySceneRecipe;
  } catch {
    return null;
  }
}

function readFactoryRecommendedActions(
  recipes: Array<ReelsFactorySceneRecipe | null>,
  templateAllowsMicroclip: boolean
): ReelsFactoryNextAction[] {
  const supportedActions = new Set<ReelsFactoryNextAction>([
    "generate_narration",
    "generate_visuals",
    "attach_microclip",
    "render"
  ]);
  const fromRecipes = recipes
    .flatMap((recipe) =>
      Array.isArray(recipe?.recommendedNextActions)
        ? recipe.recommendedNextActions
        : []
    )
    .map((action) => action.trim())
    .filter(
      (action): action is ReelsFactoryNextAction =>
        supportedActions.has(action as ReelsFactoryNextAction)
    );

  if (fromRecipes.length > 0) {
    return [...new Set(fromRecipes)];
  }

  return [
    "generate_narration",
    "generate_visuals",
    ...(templateAllowsMicroclip ? (["attach_microclip"] as const) : []),
    "render"
  ];
}

function toAudioMasteringPreviewSummary(
  preview: ReturnType<typeof buildPremiumAudioMixPlan> | null
): AudioMasteringPreview | null {
  if (!preview) {
    return null;
  }

  return {
    masteringPresetId: preview.masteringPresetId,
    masteringPresetName: preview.preset.name,
    narrationIncluded: preview.narrationIncluded,
    musicIncluded: preview.musicIncluded,
    sfxIncluded: preview.sfxIncluded,
    duckingEnabled: preview.duckingEnabled,
    duckingMode: preview.duckingMode,
    compressorApplied: preview.compressorApplied,
    limiterApplied: preview.limiterApplied,
    loudnormApplied: preview.loudnormApplied,
    removeLongSilences: preview.removeLongSilences,
    maxSilenceMs: preview.maxSilenceMs,
    targetLufs: preview.targetLufs,
    truePeakDb: preview.truePeakDb,
    narrationGainDb: preview.narrationGainDb,
    musicGainDb: preview.musicGainDb,
    sfxGainDb: preview.sfxGainDb,
    warnings: preview.warnings,
    summary: preview.summary
  };
}

function toProjectFormState(project: StudioProject): ProjectFormState {
  return {
    title: project.title,
    status: project.status,
    channelId: project.channelId,
    script: project.script ?? "",
    durationTarget: project.durationTarget?.toString() ?? "",
    format: project.format,
    templateId: project.templateId ?? "",
    defaultCaptionStyle: project.defaultCaptionStyle ?? "",
    musicPresetId: project.musicPresetId ?? ""
  };
}

function createEmptySceneForm(nextOrder: number): SceneFormState {
  return {
    order: String(nextOrder),
    title: "",
    narrationText: "",
    captionText: "",
    duration: "4",
    emotion: "",
    assetId: "",
    visualPreset: "",
    transition: "",
    captionStyle: "",
    captionPosition: "",
    captionEmphasisWords: "",
    energyLevel: "60"
  };
}

function sortEditorialMicroclips(items: EditorialMicroclip[]) {
  return [...items].sort(
    (left, right) =>
      left.orderIndex - right.orderIndex ||
      left.createdAt.localeCompare(right.createdAt)
  );
}

function createEmptyEditorialMicroclipForm(
  sceneId: string,
  orderIndex: number
): EditorialMicroclipFormState {
  return {
    sceneId,
    assetId: "",
    label: "",
    sourceType: "library_clip",
    startTimeSeconds: "0",
    endTimeSeconds: "1.2",
    usageMode: "supporting_evidence",
    narrationOverlay: true,
    textOverlay: "",
    calloutStyle: "none",
    transitionIn: "cut",
    transitionOut: "cut",
    volumeMode: "mute_original",
    orderIndex: String(orderIndex)
  };
}

function toEditorialMicroclipFormState(
  microclip: EditorialMicroclip
): EditorialMicroclipFormState {
  return {
    sceneId: microclip.sceneId ?? "",
    assetId: microclip.assetId,
    label: microclip.label,
    sourceType: microclip.sourceType,
    startTimeSeconds: String(microclip.startTimeSeconds),
    endTimeSeconds: String(microclip.endTimeSeconds),
    usageMode: microclip.usageMode,
    narrationOverlay: microclip.narrationOverlay,
    textOverlay: microclip.textOverlay ?? "",
    calloutStyle: microclip.calloutStyle,
    transitionIn: microclip.transitionIn,
    transitionOut: microclip.transitionOut,
    volumeMode: microclip.volumeMode,
    orderIndex: String(microclip.orderIndex)
  };
}

function toSceneFormState(scene: ProjectScene): SceneFormState {
  return {
    order: String(scene.order),
    title: scene.title,
    narrationText: scene.narrationText ?? "",
    captionText: scene.captionText ?? "",
    duration: scene.duration?.toString() ?? "",
    emotion: scene.emotion ?? "",
    assetId: scene.assetId ?? "",
    visualPreset: scene.visualPreset ?? "",
    transition: scene.transition ?? "",
    captionStyle: scene.captionStyle ?? "",
    captionPosition: scene.captionPosition ?? "",
    captionEmphasisWords: scene.captionEmphasisWords.join(", "),
    energyLevel: scene.energyLevel?.toString() ?? ""
  };
}

function buildProjectPayload(form: ProjectFormState): ProjectPayload {
  return {
    title: form.title.trim(),
    status: form.status,
    channelId: form.channelId,
    script: toNullableString(form.script),
    durationTarget: toNullableNumber(form.durationTarget),
    format: form.format.trim() || "9:16",
    templateId: form.templateId || null,
    defaultCaptionStyle: form.defaultCaptionStyle || null,
    musicPresetId: form.musicPresetId || null
  };
}

function buildScenePayload(form: SceneFormState): ScenePayload {
  const order = toOptionalPositiveInteger(form.order);

  return {
    ...(typeof order === "number" ? { order } : {}),
    title: form.title.trim(),
    narrationText: toNullableString(form.narrationText),
    captionText: toNullableString(form.captionText),
    duration: toNullableNumber(form.duration),
    emotion: form.emotion || null,
    assetId: form.assetId || null,
    visualPreset: toNullableString(form.visualPreset),
    transition: toNullableString(form.transition),
    captionStyle: form.captionStyle || null,
    captionPosition: form.captionPosition || null,
    captionEmphasisWords: parseCommaList(form.captionEmphasisWords),
    energyLevel: toEnergyLevel(form.energyLevel)
  };
}

function resolveChannel(
  channels: StudioChannel[],
  channelId: string,
  fallback: StudioChannel
) {
  return channels.find((entry) => entry.id === channelId) ?? fallback;
}

function resolveAsset(assets: StudioAsset[], assetId: string | null) {
  if (!assetId) {
    return null;
  }

  return assets.find((entry) => entry.id === assetId) ?? null;
}

function replaceScene(scenes: ProjectScene[], nextScene: ProjectScene) {
  return sortScenes(
    scenes.map((scene) => (scene.id === nextScene.id ? nextScene : scene))
  );
}

function reorderLocalScenes(scenes: ProjectScene[], sceneIds: string[]) {
  const now = new Date().toISOString();
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));

  return sceneIds
    .map((sceneId, index) => {
      const scene = sceneMap.get(sceneId);

      if (!scene) {
        return null;
      }

      return {
        ...scene,
        order: index + 1,
        updatedAt: now
      };
    })
    .filter((scene): scene is ProjectScene => scene !== null);
}

function moveSceneIds(
  scenes: ProjectScene[],
  sceneId: string,
  direction: -1 | 1
) {
  const orderedIds = sortScenes(scenes).map((scene) => scene.id);
  const currentIndex = orderedIds.findIndex((id) => id === sceneId);
  const targetIndex = currentIndex + direction;

  if (
    currentIndex === -1 ||
    targetIndex < 0 ||
    targetIndex >= orderedIds.length
  ) {
    return null;
  }

  const nextIds = [...orderedIds];
  const [removed] = nextIds.splice(currentIndex, 1);

  if (!removed) {
    return null;
  }

  nextIds.splice(targetIndex, 0, removed);
  return nextIds;
}

function createLocalScene(
  payload: ScenePayload,
  assets: StudioAsset[],
  scenes: ProjectScene[]
) {
  const timestamp = new Date().toISOString();
  const orderedScenes = sortScenes(scenes);
  const scene: ProjectScene = {
    id: createLocalId("scene"),
    order: orderedScenes.length + 1,
    title: payload.title,
    narrationText: payload.narrationText,
    captionText: payload.captionText,
    duration: payload.duration,
    emotion: payload.emotion,
    assetId: payload.assetId,
    asset: resolveAsset(assets, payload.assetId),
    visualPreset: payload.visualPreset,
    transition: payload.transition,
    captionStyle: payload.captionStyle,
    captionPosition: payload.captionPosition,
    captionEmphasisWords: [...payload.captionEmphasisWords],
    energyLevel: payload.energyLevel,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  let nextScenes = sortScenes([...orderedScenes, scene]);

  if (payload.order) {
    const ids = nextScenes.map((entry) => entry.id);
    const currentIndex = ids.findIndex((id) => id === scene.id);

    if (currentIndex !== -1) {
      ids.splice(currentIndex, 1);
      ids.splice(Math.min(Math.max(payload.order - 1, 0), ids.length), 0, scene.id);
      nextScenes = reorderLocalScenes(nextScenes, ids);
    }
  }

  return nextScenes;
}

function applyLocalSceneUpdate(
  scenes: ProjectScene[],
  sceneId: string,
  payload: ScenePayload,
  assets: StudioAsset[]
) {
  const timestamp = new Date().toISOString();
  const currentScene = scenes.find((scene) => scene.id === sceneId);

  if (!currentScene) {
    return scenes;
  }

  let nextScenes = replaceScene(scenes, {
    ...currentScene,
    title: payload.title,
    narrationText: payload.narrationText,
    captionText: payload.captionText,
    duration: payload.duration,
    emotion: payload.emotion,
    assetId: payload.assetId,
    asset: resolveAsset(assets, payload.assetId),
    visualPreset: payload.visualPreset,
    transition: payload.transition,
    captionStyle: payload.captionStyle,
    captionPosition: payload.captionPosition,
    captionEmphasisWords: [...payload.captionEmphasisWords],
    energyLevel: payload.energyLevel,
    updatedAt: timestamp
  });

  if (payload.order) {
    const ids = nextScenes.map((scene) => scene.id);
    const currentIndex = ids.findIndex((id) => id === sceneId);

    if (currentIndex !== -1) {
      ids.splice(currentIndex, 1);
      ids.splice(Math.min(Math.max(payload.order - 1, 0), ids.length), 0, sceneId);
      nextScenes = reorderLocalScenes(nextScenes, ids);
    }
  }

  return nextScenes;
}

function removeScene(scenes: ProjectScene[], sceneId: string) {
  const remainingIds = sortScenes(scenes)
    .filter((scene) => scene.id !== sceneId)
    .map((scene) => scene.id);

  return reorderLocalScenes(
    scenes.filter((scene) => scene.id !== sceneId),
    remainingIds
  );
}

function sortGeneratedImageItems(items: GeneratedImageGalleryItem[]) {
  return [...items].sort((left, right) =>
    right.job.createdAt.localeCompare(left.job.createdAt)
  );
}

function mergeSceneGeneratedImages(
  items: GeneratedImageGalleryItem[],
  sceneId: string,
  nextItems: GeneratedImageGalleryItem[]
) {
  return sortGeneratedImageItems([
    ...items.filter((item) => item.scene?.id !== sceneId),
    ...nextItems
  ]);
}

function sortNarrationItems(items: GeneratedAudioGalleryItem[]) {
  return [...items].sort((left, right) =>
    right.job.createdAt.localeCompare(left.job.createdAt)
  );
}

function mergeSceneNarrations(
  items: GeneratedAudioGalleryItem[],
  sceneId: string,
  nextItems: GeneratedAudioGalleryItem[]
) {
  return sortNarrationItems([
    ...items.filter((item) => item.scene?.id !== sceneId),
    ...nextItems
  ]);
}

function readGeneratedMetadataString(
  item: GeneratedImageGalleryItem | null | undefined,
  key: string
) {
  const value = item?.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readReviewNotesFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const direct = metadata?.reviewNotes;

  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const review = metadata?.review;

  if (!review || typeof review !== "object" || Array.isArray(review)) {
    return null;
  }

  const notes = (review as { notes?: unknown }).notes;
  return typeof notes === "string" && notes.trim() ? notes.trim() : null;
}

function buildGeneratedImageGalleryItem(
  project: StudioProject,
  scene: ProjectScene,
  job: VisualGenerationJob,
  asset: StudioAsset | null
): GeneratedImageGalleryItem {
  const reviewStatus =
    typeof job.metadata?.reviewStatus === "string" &&
    (job.metadata.reviewStatus === "approved" ||
      job.metadata.reviewStatus === "rejected" ||
      job.metadata.reviewStatus === "favorite")
      ? job.metadata.reviewStatus
      : null;

  return {
    job: {
      ...job,
      generatedAsset: asset ?? job.generatedAsset ?? null
    },
    asset: asset ?? job.generatedAsset ?? null,
    scene: {
      id: scene.id,
      order: scene.order,
      title: scene.title,
      videoProjectId: project.id,
      captionText: scene.captionText,
      duration: scene.duration,
      emotion: scene.emotion,
      assetId: scene.assetId,
      generatedAssetId: job.generatedAssetId ?? scene.generatedAssetId ?? null,
      visualSourceMode: scene.visualSourceMode ?? null,
      generationStatus: job.status,
      generationProvider: job.provider
    },
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      channelId: project.channelId,
      channelName: project.channel.name,
      format: project.format,
      templateId: project.templateId ?? null
    },
    metadata: job.metadata ?? null,
    previewUrl:
      asset?.id || job.generatedAssetId
        ? `/media/assets/${encodeURIComponent(asset?.id ?? job.generatedAssetId ?? "")}`
        : null,
    thumbnailUrl:
      asset?.id || job.generatedAssetId
        ? `/media/assets/${encodeURIComponent(asset?.id ?? job.generatedAssetId ?? "")}`
        : null,
    isCurrentSceneGeneratedAsset:
      Boolean((job.generatedAssetId ?? scene.generatedAssetId ?? null) && (job.generatedAssetId ?? scene.generatedAssetId) === (asset?.id ?? job.generatedAssetId)),
    isSceneEffectiveAsset:
      Boolean((job.generatedAssetId ?? scene.generatedAssetId ?? null) && (job.generatedAssetId ?? scene.generatedAssetId) === (asset?.id ?? job.generatedAssetId)),
    reviewStatus,
    reviewNotes: readReviewNotesFromMetadata(job.metadata ?? null),
    isFavorite: reviewStatus === "favorite"
  };
}

function buildEditorialMicroclipPayload(
  projectId: string,
  form: EditorialMicroclipFormState
): EditorialMicroclipPayload {
  return {
    projectId,
    sceneId: form.sceneId || null,
    assetId: form.assetId,
    label: form.label.trim(),
    sourceType: form.sourceType,
    startTimeSeconds: Number(form.startTimeSeconds),
    endTimeSeconds: Number(form.endTimeSeconds),
    usageMode: form.usageMode,
    narrationOverlay: form.narrationOverlay,
    textOverlay: toNullableString(form.textOverlay),
    calloutStyle: form.calloutStyle,
    transitionIn: form.transitionIn,
    transitionOut: form.transitionOut,
    volumeMode: form.volumeMode,
    orderIndex: Math.max(1, Number(form.orderIndex) || 1)
  };
}

function buildGeneratedNarrationItem(
  project: StudioProject,
  scene: ProjectScene,
  job: NarrationJob,
  asset: StudioAsset | null
): GeneratedAudioGalleryItem {
  return {
    job: {
      ...job,
      generatedAsset: asset ?? job.generatedAsset ?? null
    },
    asset: asset ?? job.generatedAsset ?? null,
    scene: {
      id: scene.id,
      order: scene.order,
      title: scene.title,
      videoProjectId: project.id,
      narrationText: job.text,
      duration: scene.duration,
      generatedNarrationAssetId:
        job.generatedAssetId ?? scene.generatedNarrationAssetId ?? null,
      narrationStatus: job.status,
      narrationProvider: job.provider,
      narrationVoicePackId: job.voicePackId
    },
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      channelId: project.channelId,
      channelName: project.channel.name,
      format: project.format
    },
    metadata: job.metadata ?? null,
    previewUrl:
      asset?.id || job.generatedAssetId
        ? `/media/assets/${encodeURIComponent(asset?.id ?? job.generatedAssetId ?? "")}`
        : null,
    isCurrentSceneNarration: Boolean(
      (job.generatedAssetId ?? scene.generatedNarrationAssetId ?? null) &&
        (job.generatedAssetId ?? scene.generatedNarrationAssetId) ===
          (asset?.id ?? job.generatedAssetId)
    ),
    isSceneEffectiveNarration: Boolean(
      (job.generatedAssetId ?? scene.generatedNarrationAssetId ?? null) &&
        (job.generatedAssetId ?? scene.generatedNarrationAssetId) ===
          (asset?.id ?? job.generatedAssetId)
    )
  };
}

export function ProjectStudio({
  assets,
  assetsSource,
  channels,
  channelsSource,
  initialProject,
  initialSource,
  workflowPacks,
  workflowPacksSource,
  qualityPresets,
  qualityPresetsSource,
  initialGeneratedImages,
  initialGeneratedImagesSource,
  narrationProviders,
  narrationProvidersSource,
  narrationVoicePacks,
  narrationVoicePacksSource,
  initialGeneratedNarrations,
  initialGeneratedNarrationsSource,
  initialEditingReferenceSuggestions,
  initialEditingReferenceSuggestionsSource
}: ProjectStudioProps) {
  const [project, setProject] = useState<StudioProject>({
    ...initialProject,
    scenes: sortScenes(initialProject.scenes)
  });
  const [source, setSource] = useState<DataSource>(initialSource);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(
    toProjectFormState(initialProject)
  );
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [sceneForm, setSceneForm] = useState<SceneFormState>(
    createEmptySceneForm(initialProject.scenes.length + 1)
  );
  const [statusMessage, setStatusMessage] = useState(
    initialSource === "api"
      ? "Timeline conectada a API local."
      : "Timeline em modo mock ate a API ficar disponivel."
  );
  const [captionAnalysis, setCaptionAnalysis] =
    useState<ProjectCaptionAnalysisResponse | null>(null);
  const [captionAnalysisSource, setCaptionAnalysisSource] =
    useState<DataSource>("mock");
  const [productionChecklist, setProductionChecklist] =
    useState<ProjectProductionChecklistResponse | null>(null);
  const [productionChecklistSource, setProductionChecklistSource] =
    useState<DataSource>("mock");
  const [blueprint, setBlueprint] = useState<RenderBlueprintResponse | null>(null);
  const [beatSyncPlan, setBeatSyncPlan] =
    useState<BuildBeatSyncPlanResponse | null>(null);
  const [beatSyncPlanSource, setBeatSyncPlanSource] =
    useState<DataSource>("mock");
  const [blueprintSource, setBlueprintSource] = useState<DataSource | null>(null);
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [visualSceneId, setVisualSceneId] = useState(
    initialProject.scenes[0]?.id ?? ""
  );
  const [visualWorkflowPackId, setVisualWorkflowPackId] = useState(
    workflowPacks[0]?.id ?? "cinematic_story"
  );
  const [visualQualityPresetId, setVisualQualityPresetId] = useState<
    "draft" | "standard" | "high" | string
  >("standard");
  const [visualWorkflowId, setVisualWorkflowId] = useState("txt2img-basic");
  const [visualSeedMode, setVisualSeedMode] = useState("reuse");
  const [visualSeed, setVisualSeed] = useState("");
  const [lastVisualJob, setLastVisualJob] = useState<VisualGenerationJob | null>(
    null
  );
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageGalleryItem[]>(
    sortGeneratedImageItems(initialGeneratedImages)
  );
  const [generatedImagesSource, setGeneratedImagesSource] = useState<DataSource>(
    initialGeneratedImagesSource
  );
  const [narrationProviderId, setNarrationProviderId] = useState<
    NarrationProviderDescriptor["id"]
  >(
    narrationProviders.find((provider) => provider.id === "mock-tts")?.id ??
      narrationProviders[0]?.id ??
      "mock-tts"
  );
  const [narrationVoicePackId, setNarrationVoicePackId] = useState(
    narrationVoicePacks.find((voicePack) => voicePack.id === "documentary_ptbr")?.id ??
      narrationVoicePacks[0]?.id ??
      ""
  );
  const [narrationTextDraft, setNarrationTextDraft] = useState(
    initialProject.scenes[0]?.narrationText ??
      initialProject.scenes[0]?.captionText ??
      initialProject.script ??
      ""
  );
  const [generatedNarrations, setGeneratedNarrations] = useState<
    GeneratedAudioGalleryItem[]
  >(sortNarrationItems(initialGeneratedNarrations));
  const [generatedNarrationsSource, setGeneratedNarrationsSource] = useState<DataSource>(
    initialGeneratedNarrationsSource
  );
  const [editingReferenceSuggestions, setEditingReferenceSuggestions] = useState<
    EditingReferenceSuggestion[]
  >(initialEditingReferenceSuggestions);
  const [editingReferenceSuggestionsSource, setEditingReferenceSuggestionsSource] =
    useState<DataSource>(initialEditingReferenceSuggestionsSource);
  const [editorialMicroclips, setEditorialMicroclips] = useState<
    EditorialMicroclip[]
  >([]);
  const [editorialMicroclipsSource, setEditorialMicroclipsSource] =
    useState<DataSource>(initialSource === "api" ? "api" : "mock");
  const [editingMicroclipId, setEditingMicroclipId] = useState<string | null>(
    null
  );
  const [editorialMicroclipForm, setEditorialMicroclipForm] =
    useState<EditorialMicroclipFormState>(
      createEmptyEditorialMicroclipForm(initialProject.scenes[0]?.id ?? "", 1)
    );
  const [audioMasteringPresetId, setAudioMasteringPresetId] =
    useState<AudioMasteringPresetId>(
      (audioMasteringPresetsCatalog.find(
        (preset) => preset.id === "shorts_clean_voice"
      )?.id ??
        audioMasteringPresetsCatalog[0]?.id ??
        "shorts_clean_voice") as AudioMasteringPresetId
    );

  const orderedScenes = sortScenes(project.scenes);
  const videoAssets = assets.filter((asset) => asset.type === "VIDEO");
  const selectedVisualScene =
    orderedScenes.find((scene) => scene.id === visualSceneId) ?? orderedScenes[0] ?? null;
  const selectedVisualSceneEffectiveAssetId = selectedVisualScene
    ? getSceneEffectiveAssetId(selectedVisualScene)
    : null;
  const selectedVisualSceneEffectiveAssetLabel = selectedVisualScene
    ? getSceneEffectiveAssetLabel(selectedVisualScene)
    : "Sem visual efetivo";
  const selectedVisualSceneEffectiveAssetSource = selectedVisualScene
    ? getSceneEffectiveAssetSource(selectedVisualScene)
    : "missing";
  const selectedVisualSceneHasVisual = selectedVisualScene
    ? sceneHasEffectiveAsset(selectedVisualScene)
    : false;
  const sceneGeneratedImages = selectedVisualScene
    ? generatedImages.filter((item) => item.scene?.id === selectedVisualScene.id)
    : [];
  const sceneNarrations = selectedVisualScene
    ? generatedNarrations.filter((item) => item.scene?.id === selectedVisualScene.id)
    : [];
  const selectedSceneMicroclips = selectedVisualScene
    ? sortEditorialMicroclips(
        editorialMicroclips.filter(
          (microclip) => microclip.sceneId === selectedVisualScene.id
        )
      )
    : [];
  const totalMicroclipDuration = editorialMicroclips.reduce(
    (total, microclip) => total + microclip.durationSeconds,
    0
  );
  const currentSceneNarration =
    sceneNarrations.find((item) => item.isCurrentSceneNarration) ??
    sceneNarrations[0] ??
    null;
  const blueprintSceneMap = new Map(
    (blueprint?.scenes ?? []).map((scene) => [scene.sceneId, scene] as const)
  );
  const selectedWorkflowPack =
    workflowPacks.find((pack) => pack.id === visualWorkflowPackId) ??
    workflowPacks.find((pack) => pack.id === "cinematic_story") ??
    workflowPacks[0] ??
    null;
  const selectedQualityPreset =
    qualityPresets.find((preset) => preset.id === visualQualityPresetId) ??
    qualityPresets.find((preset) => preset.id === "standard") ??
    qualityPresets[0] ??
    null;
  const selectedAudioMasteringPreset =
    audioMasteringPresetsCatalog.find(
      (preset) => preset.id === audioMasteringPresetId
    ) ?? audioMasteringPresetsCatalog[0]!;
  const audioMasteringPreview = toAudioMasteringPreviewSummary(
    blueprint
      ? buildPremiumAudioMixPlan({
          audioPlan: blueprint.audio,
          audioMasteringPresetId,
          preferSidechainDucking: true,
          loudnormSupported: true
        })
      : null
  );
  const storyAnalysis = buildProjectStoryAnalysis({
    ...project,
    scenes: orderedScenes
  });
  const sceneInsightMap = new Map(
    storyAnalysis.sceneInsights.map((sceneInsight) => [
      sceneInsight.sceneId,
      sceneInsight
    ])
  );
  const totalDuration = storyAnalysis.analysis.totalDuration;
  const selectedChannel =
    channels.find((entry) => entry.id === projectForm.channelId) ?? project.channel;
  const effectiveTemplate =
    getTemplateById(projectForm.templateId) ??
    getTemplateById(selectedChannel.defaultTemplate) ??
    suggestTemplateByProject({
      title: projectForm.title,
      script: projectForm.script,
      templateId: projectForm.templateId || null,
      channel: selectedChannel
    });
  const activeTemplateId =
    projectForm.templateId || project.templateId || effectiveTemplate.id;
  const leadingEditingReferenceSuggestion =
    editingReferenceSuggestions[0] ?? null;
  const appliedEditingStyleSummary =
    blueprint?.editingStyleSummary ?? project.editingStyleSummary ?? null;
  const appliedEditingReferencePresetId =
    blueprint?.editingReferencePresetId ?? project.editingReferencePresetId ?? null;
  const appliedEditingReferencePresetName =
    blueprint?.editingReferencePresetName ??
    appliedEditingStyleSummary?.presetName ??
    null;
  const suggestedMusicPresetId = inferMusicUseCase(
    selectedChannel,
    activeTemplateId
  );
  const selectedMusicPreset =
    getMusicPresetById(projectForm.musicPresetId || project.musicPresetId || null) ??
    getMusicPresetById(suggestedMusicPresetId) ??
    musicPresetsCatalog[0]!;
  const selectedMusicAssetId =
    blueprint?.selectedMusicAssetId ?? project.backgroundMusicAssetId ?? null;
  const selectedMusicAsset = resolveAsset(assets, selectedMusicAssetId);
  const musicBeatSyncPlan = beatSyncPlan?.beatSyncPlan ?? blueprint?.beatSyncPlan ?? null;
  const musicWarnings =
    beatSyncPlan?.warnings ??
    blueprint?.musicWarnings ??
    (selectedMusicAsset?.musicProfile?.safetyWarning
      ? [selectedMusicAsset.musicProfile.safetyWarning]
      : []);
  const reelsFactoryTemplate = getReelsFactoryTemplateById(activeTemplateId);
  const isReelsFactoryProject = isReelsFactoryTemplateId(activeTemplateId);
  const effectiveProjectCaptionStyle =
    getCaptionStyleById(projectForm.defaultCaptionStyle) ??
    getCaptionStyleById(effectiveTemplate.defaultCaptionStyle) ??
    captionStylesCatalog[0]!;
  const selectedAsset = resolveAsset(assets, sceneForm.assetId || null);
  const selectedPresetPreview = resolveScenePresetPreview(
    sceneForm.visualPreset || null,
    sceneForm.emotion || null
  );
  const effectiveSceneCaptionStyle =
    getCaptionStyleById(sceneForm.captionStyle) ??
    effectiveProjectCaptionStyle;
  const effectiveSceneCaptionPosition =
    sceneForm.captionPosition || effectiveSceneCaptionStyle.position;
  const effectiveSceneCaptionLines =
    captionAnalysis?.scenes.find(
      (entry) => entry.sceneId === editingSceneId
    )?.splitLines ??
    (sceneForm.captionText.trim()
      ? sceneForm.captionText
          .trim()
          .match(new RegExp(`.{1,${effectiveSceneCaptionStyle.maxCharsPerLine}}`, "g")) ??
        [sceneForm.captionText.trim()]
      : []);
  const effectiveEmphasisWords = parseCommaList(sceneForm.captionEmphasisWords);
  const liveCaptionAnalysis = captionAnalysis;
  const liveProductionChecklist = productionChecklist?.checklist ?? null;
  const missingVisualCount =
    liveProductionChecklist?.missingVisuals ??
    liveProductionChecklist?.missingAssets ??
    storyAnalysis.analysis.missingVisuals ??
    storyAnalysis.analysis.missingAssets;
  const visualReadyCount =
    liveProductionChecklist?.visualReadyScenes ??
    Math.max(storyAnalysis.analysis.sceneCount - missingVisualCount, 0);
  const generatedVisualCount =
    liveProductionChecklist?.generatedVisualScenes ??
    orderedScenes.filter((scene) => isGeneratedAssetActive(scene)).length;
  const narrationReadyCount =
    blueprint?.scenes.filter((scene) => scene.narrationReady).length ??
    orderedScenes.filter(
      (scene) => Boolean(scene.generatedNarrationAssetId || project.voiceoverAssetId)
    ).length;
  const generatedNarrationCount =
    blueprint?.scenes.filter(
      (scene) =>
        (scene.effectiveNarrationSource ?? scene.narrationSource) === "generated"
    ).length ?? orderedScenes.filter((scene) => Boolean(scene.generatedNarrationAssetId)).length;
  const manualNarrationCount =
    blueprint?.scenes.filter(
      (scene) =>
        (scene.effectiveNarrationSource ?? scene.narrationSource) === "manual"
    ).length ??
    (project.voiceoverAssetId
      ? Math.max(orderedScenes.length - generatedNarrationCount, 0)
      : 0);
  const missingNarrationCount = Math.max(
    orderedScenes.length - narrationReadyCount,
    0
  );
  const microclipHeavyScenes = new Set(
    editorialMicroclips
      .map((microclip) => microclip.sceneId)
      .filter((sceneId): sceneId is string => Boolean(sceneId))
  );
  const reelsFactorySceneRecipes = orderedScenes.map((scene) => ({
    scene,
    recipe: parseReelsFactorySceneRecipe(scene.visualRecipe)
  }));
  const reelsFactoryRecommendedNextActions = readFactoryRecommendedActions(
    reelsFactorySceneRecipes.map((entry) => entry.recipe),
    Boolean(reelsFactoryTemplate?.allowsMicroclip)
  );
  const reelsFactoryOperationalChecklist = isReelsFactoryProject
    ? [
        {
          id: "narration",
          label: "Narracao",
          done:
            orderedScenes.length > 0 && narrationReadyCount >= orderedScenes.length,
          detail:
            narrationReadyCount >= orderedScenes.length && orderedScenes.length > 0
              ? "Todas as cenas ja possuem narracao efetiva."
              : `${narrationReadyCount}/${orderedScenes.length} cena(s) com narracao pronta.`,
          optional: false
        },
        {
          id: "visuals",
          label: "Visuais",
          done: orderedScenes.length > 0 && missingVisualCount === 0,
          detail:
            missingVisualCount === 0
              ? "Todas as cenas ja possuem visual efetivo."
              : `${missingVisualCount} cena(s) ainda sem visual efetivo.`,
          optional: false
        },
        {
          id: "microclip",
          label: "Microclip opcional",
          done:
            !reelsFactoryTemplate?.allowsMicroclip ||
            editorialMicroclips.length > 0,
          detail: reelsFactoryTemplate?.allowsMicroclip
            ? editorialMicroclips.length > 0
              ? `${editorialMicroclips.length} microclip(s) anexado(s).`
              : "Template aceita microclip, mas ele continua opcional."
            : "Este template nao precisa de microclip para seguir.",
          optional: true
        },
        {
          id: "mastering",
          label: "Mastering",
          done: Boolean(selectedAudioMasteringPreset.id),
          detail: `Preset ativo ${selectedAudioMasteringPreset.name}.`,
          optional: false
        },
        {
          id: "render",
          label: "Render",
          done: Boolean(liveProductionChecklist?.readyToRender),
          detail: liveProductionChecklist?.readyToRender
            ? "Checklist operacional ja libera render."
            : "Ainda faltam itens do checklist antes do render final.",
          optional: false
        }
      ]
    : [];
  const qualityAlerts = [
    ...new Set(
      [
        ...storyAnalysis.analysis.alerts,
        ...storyAnalysis.analysis.pacingWarnings,
        ...(liveCaptionAnalysis?.summary.alerts ?? []),
        ...(liveProductionChecklist?.alerts ?? []),
        ...(liveProductionChecklist?.warnings ?? []),
        !project.channelId || !project.channel
          ? "Projeto sem canal associado."
          : null
      ].filter((value): value is string => Boolean(value))
    )
  ];
  const filteredQualityAlerts = [
    ...new Set(
      qualityAlerts.filter((alert) =>
        filterContradictoryNarrativeNotice(alert, {
          climaxDetected:
            liveProductionChecklist?.climaxDetected ??
            storyAnalysis.analysis.climaxDetected,
          ctaDetected:
            liveProductionChecklist?.ctaDetected ??
            storyAnalysis.analysis.ctaDetected
        })
      )
    )
  ];

  useEffect(() => {
    let active = true;

    setBlueprint(null);
    setBlueprintSource(null);

    Promise.all([
      getProjectCaptionAnalysisSnapshot(project.id, project),
      getProjectProductionChecklistSnapshot(project.id, project)
    ]).then(([captionSnapshot, checklistSnapshot]) => {
      if (!active) {
        return;
      }

      setCaptionAnalysis(captionSnapshot.item);
      setCaptionAnalysisSource(captionSnapshot.source);
      setProductionChecklist(checklistSnapshot.item);
      setProductionChecklistSource(checklistSnapshot.source);
    });

    return () => {
      active = false;
    };
  }, [project]);

  useEffect(() => {
    if (!selectedVisualScene) {
      setNarrationTextDraft(project.script ?? "");
      return;
    }

    setNarrationTextDraft(
      selectedVisualScene.narrationText ??
        selectedVisualScene.captionText ??
        project.script ??
      ""
    );
  }, [project.script, selectedVisualScene]);

  useEffect(() => {
    const nextSceneId = selectedVisualScene?.id ?? "";

    if (editingMicroclipId) {
      return;
    }

    setEditorialMicroclipForm((current) => ({
      ...current,
      sceneId: nextSceneId,
      orderIndex: String(selectedSceneMicroclips.length + 1)
    }));
  }, [editingMicroclipId, selectedSceneMicroclips.length, selectedVisualScene?.id]);

  useEffect(() => {
    let active = true;

    async function loadEditorialMicroclips() {
      try {
        const items = await getEditorialMicroclipsForProjectRequest(project.id);

        if (!active) {
          return;
        }

        setEditorialMicroclips(sortEditorialMicroclips(items));
        setEditorialMicroclipsSource("api");
      } catch {
        if (!active) {
          return;
        }

        setEditorialMicroclips([]);
        setEditorialMicroclipsSource("mock");
      }
    }

    void loadEditorialMicroclips();

    return () => {
      active = false;
    };
  }, [project.id]);

  useEffect(() => {
    let active = true;

    async function loadBeatSyncPlan() {
      const snapshot = await getProjectBeatSyncPlanSnapshot({
        projectId: project.id,
        musicAssetId: project.backgroundMusicAssetId ?? null,
        musicPresetId:
          project.musicPresetId ?? projectForm.musicPresetId ?? null,
        reelDurationSeconds:
          totalDuration > 0 ? totalDuration : project.durationTarget ?? null
      });

      if (!active) {
        return;
      }

      setBeatSyncPlan(snapshot.item);
      setBeatSyncPlanSource(snapshot.source);
    }

    void loadBeatSyncPlan();

    return () => {
      active = false;
    };
  }, [
    project.id,
    project.backgroundMusicAssetId,
    project.durationTarget,
    project.musicPresetId,
    projectForm.musicPresetId,
    totalDuration
  ]);

  useEffect(() => {
    let active = true;

    async function loadEditingReferenceSuggestions() {
      const snapshot = await getEditingReferencePresetSuggestionsSnapshot(
        activeTemplateId
      );

      if (!active) {
        return;
      }

      setEditingReferenceSuggestions(snapshot.items);
      setEditingReferenceSuggestionsSource(snapshot.source);
    }

    void loadEditingReferenceSuggestions();

    return () => {
      active = false;
    };
  }, [activeTemplateId]);

  function resetSceneComposer(nextOrder?: number) {
    setEditingSceneId(null);
    setSceneForm(createEmptySceneForm(nextOrder ?? project.scenes.length + 1));
  }

  function resetEditorialMicroclipComposer(nextSceneId?: string) {
    setEditingMicroclipId(null);
    setEditorialMicroclipForm(
      createEmptyEditorialMicroclipForm(
        nextSceneId ?? selectedVisualScene?.id ?? "",
        selectedSceneMicroclips.length + 1
      )
    );
  }

  function startEditorialMicroclipEditing(microclip: EditorialMicroclip) {
    setEditingMicroclipId(microclip.id);
    setVisualSceneId(microclip.sceneId ?? selectedVisualScene?.id ?? "");
    setEditorialMicroclipForm(toEditorialMicroclipFormState(microclip));
  }

  async function handleProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildProjectPayload(projectForm);

    if (!payload.channelId) {
      setStatusMessage("Selecione um canal antes de salvar o projeto.");
      return;
    }

    try {
      const updated = await updateProjectRequest(project.id, payload);
      setProject({
        ...updated,
        scenes: sortScenes(updated.scenes)
      });
      setProjectForm(toProjectFormState(updated));
      setSource("api");
      setStatusMessage("Projeto atualizado na API local.");
      return;
    } catch (error) {
      const nextProject: StudioProject = {
        ...project,
        ...payload,
        channel: resolveChannel(channels, payload.channelId, project.channel),
        updatedAt: new Date().toISOString()
      };

      setProject(nextProject);
      setProjectForm(toProjectFormState(nextProject));
      setSource("mock");
      setStatusMessage(
        `${extractErrorMessage(error)} Projeto atualizado apenas nesta sessao.`
      );
    }
  }

  async function handleAutoSelectMusic() {
    const selectionSnapshot = await selectMusicForProjectSnapshot({
      templateId: activeTemplateId,
      musicPresetId: projectForm.musicPresetId || selectedMusicPreset.id,
      audioMasteringPresetId,
      tone: inferMusicTone(selectedChannel, activeTemplateId),
      durationSeconds: totalDuration > 0 ? totalDuration : project.durationTarget ?? 30,
      useCase: inferMusicUseCase(selectedChannel, activeTemplateId),
      allowUnknownLicense: false
    });
    const selectedRecord = selectionSnapshot.item.selectedMusicAsset;

    if (!selectedRecord) {
      setStatusMessage(
        selectionSnapshot.item.warnings[0] ??
          "Nenhuma musica local compativel foi encontrada para este projeto."
      );
      return;
    }

    const payload: ProjectPayload = {
      ...buildProjectPayload(projectForm),
      backgroundMusicAssetId: selectedRecord.asset.id,
      musicPresetId: selectionSnapshot.item.preset.id,
      musicVolume: selectionSnapshot.item.preset.defaultMusicVolume
    };

    try {
      const updated = await updateProjectRequest(project.id, payload);
      const nextProject = {
        ...updated,
        scenes: sortScenes(updated.scenes)
      };
      setProject(nextProject);
      setProjectForm(toProjectFormState(nextProject));
      setSource("api");
      setStatusMessage(
        `Musica ${selectedRecord.asset.filename} aplicada com preset ${selectionSnapshot.item.preset.id}.`
      );

      if (blueprintSource) {
        await loadBlueprintFor(nextProject);
      }

      return;
    } catch (error) {
      const nextProject: StudioProject = {
        ...project,
        ...payload,
        channel: resolveChannel(channels, payload.channelId, project.channel),
        updatedAt: new Date().toISOString()
      };

      setProject(nextProject);
      setProjectForm(toProjectFormState(nextProject));
      setSource("mock");
      setStatusMessage(
        `${extractErrorMessage(error)} Musica ${selectedRecord.asset.filename} aplicada apenas nesta sessao.`
      );

      if (blueprintSource) {
        await loadBlueprintFor(nextProject);
      }
    }
  }

  async function handleSceneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildScenePayload(sceneForm);

    try {
      if (editingSceneId) {
        const updatedScene = await updateSceneRequest(
          project.id,
          editingSceneId,
          payload
        );

        setProject((current) => ({
          ...current,
          scenes: replaceScene(current.scenes, updatedScene)
        }));
        setStatusMessage("Cena atualizada na API local.");
      } else {
        const createdScene = await createSceneRequest(project.id, payload);
        setProject((current) => ({
          ...current,
          scenes: sortScenes([...current.scenes, createdScene])
        }));
        setStatusMessage("Cena criada na API local.");
      }

      setSource("api");
      resetSceneComposer(project.scenes.length + (editingSceneId ? 1 : 2));
      return;
    } catch (error) {
      if (editingSceneId) {
        setProject((current) => ({
          ...current,
          scenes: applyLocalSceneUpdate(
            current.scenes,
            editingSceneId,
            payload,
            assets
          )
        }));
        setStatusMessage(
          `${extractErrorMessage(error)} Cena atualizada apenas nesta sessao.`
        );
      } else {
        setProject((current) => ({
          ...current,
          scenes: createLocalScene(payload, assets, current.scenes)
        }));
        setStatusMessage(
          `${extractErrorMessage(error)} Cena criada apenas nesta sessao.`
        );
      }

      setSource("mock");
      resetSceneComposer(project.scenes.length + (editingSceneId ? 1 : 2));
    }
  }

  async function loadBlueprintFor(nextProject: StudioProject) {
    setBlueprintLoading(true);

    const snapshot = await getProjectRenderBlueprintSnapshot(nextProject.id, nextProject);
    setBlueprint(snapshot.item);
    setBlueprintSource(snapshot.source);
    setBlueprintLoading(false);
  }

  async function handleLoadBlueprint() {
    await loadBlueprintFor(project);
  }

  async function refreshGeneratedImagesForScene(sceneId: string) {
    const nextItems = await getSceneGeneratedImagesRequest(sceneId);
    setGeneratedImages((current) => mergeSceneGeneratedImages(current, sceneId, nextItems));
    setGeneratedImagesSource("api");
    return nextItems;
  }

  async function refreshNarrationsForScene(sceneId: string) {
    const nextItems = await getSceneNarrationsRequest(sceneId);
    setGeneratedNarrations((current) => mergeSceneNarrations(current, sceneId, nextItems));
    setGeneratedNarrationsSource("api");
    return nextItems;
  }

  async function handleEditorialMicroclipSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      const payload = buildEditorialMicroclipPayload(
        project.id,
        editorialMicroclipForm
      );

      if (!payload.sceneId) {
        setStatusMessage("Selecione uma cena antes de salvar o microclip.");
        return;
      }

      if (!payload.assetId) {
        setStatusMessage("Selecione um asset de video para o microclip.");
        return;
      }

      if (!Number.isFinite(payload.startTimeSeconds) || !Number.isFinite(payload.endTimeSeconds)) {
        setStatusMessage("Informe tempos validos para o microclip.");
        return;
      }

      const saved = editingMicroclipId
        ? await updateEditorialMicroclipRequest(editingMicroclipId, payload)
        : await createEditorialMicroclipRequest(payload);

      setEditorialMicroclips((current) =>
        sortEditorialMicroclips(
          editingMicroclipId
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [...current, saved]
        )
      );
      setEditorialMicroclipsSource("api");
      await loadBlueprintFor(project);
      resetEditorialMicroclipComposer(payload.sceneId);
      setStatusMessage(
        editingMicroclipId
          ? "Microclip editorial atualizado na API local."
          : "Microclip editorial criado na API local."
      );
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleEditorialMicroclipDelete(microclipId: string) {
    try {
      await deleteEditorialMicroclipRequest(microclipId);
      setEditorialMicroclips((current) =>
        current.filter((microclip) => microclip.id !== microclipId)
      );
      setEditorialMicroclipsSource("api");
      if (editingMicroclipId === microclipId) {
        resetEditorialMicroclipComposer();
      }
      await loadBlueprintFor(project);
      setStatusMessage("Microclip editorial removido da API local.");
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleGenerateNarration() {
    if (!selectedVisualScene) {
      setStatusMessage("Selecione uma cena antes de gerar narracao.");
      return;
    }

    try {
      const result = await generateSceneNarrationRequest(selectedVisualScene.id, {
        provider: narrationProviderId,
        voicePackId: narrationVoicePackId || null,
        text: narrationTextDraft.trim() || null,
        language: project.channel.language ?? "pt-BR",
        autoAttach: true
      });
      const nextScene: ProjectScene =
        result.scene ??
        {
          ...selectedVisualScene,
          narrationText: narrationTextDraft.trim() || selectedVisualScene.narrationText,
          generatedNarrationAssetId:
            result.job.generatedAssetId ?? selectedVisualScene.generatedNarrationAssetId ?? null,
          generatedNarrationAsset:
            result.asset ?? selectedVisualScene.generatedNarrationAsset ?? null,
          narrationStatus: result.job.status,
          narrationProvider: result.job.provider,
          narrationVoicePackId: result.job.voicePackId,
          updatedAt: new Date().toISOString()
        };
      const nextProject: StudioProject = {
        ...project,
        scenes: replaceScene(project.scenes, nextScene)
      };

      setProject(nextProject);
      setSource("api");

      try {
        await refreshNarrationsForScene(selectedVisualScene.id);
      } catch {
        setGeneratedNarrations((current) =>
          sortNarrationItems([
            buildGeneratedNarrationItem(nextProject, nextScene, result.job, result.asset),
            ...current.filter((item) => item.job.id !== result.job.id)
          ])
        );
      }

      await loadBlueprintFor(nextProject);
      setStatusMessage(
        `Narracao ${result.job.provider} concluida com pack ${result.job.voicePackId ?? "auto"}.`
      );
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleGenerateVisual(provider: "mock-svg" | "comfyui-local") {
    if (!selectedVisualScene) {
      setStatusMessage("Selecione uma cena antes de gerar visual.");
      return;
    }

    try {
      const result = await generateSceneVisualRequest(selectedVisualScene.id, {
        provider,
        visualSourceMode: selectedVisualScene.visualSourceMode ?? "generated_only",
        characterProfileId: selectedVisualScene.characterProfileId ?? null,
        workflowPackId: selectedWorkflowPack?.id ?? null,
        qualityPresetId: selectedQualityPreset?.id ?? "standard",
        workflowId: visualWorkflowId || "txt2img-basic",
        seedMode: visualSeedMode as "random" | "fixed" | "reuse" | "increment",
        steps: selectedQualityPreset?.steps ?? null,
        cfg: selectedQualityPreset?.cfg ?? null,
        sampler: selectedQualityPreset?.sampler ?? null,
        scheduler: selectedQualityPreset?.scheduler ?? null,
        denoise: selectedQualityPreset?.denoise ?? null,
        width: selectedQualityPreset?.width ?? selectedWorkflowPack?.defaultWidth ?? 1080,
        height: selectedQualityPreset?.height ?? selectedWorkflowPack?.defaultHeight ?? 1920,
        seed: visualSeed.trim() ? Number(visualSeed) : null,
        autoAttach: true
      });

      setLastVisualJob(result.job);
      const nextScene: ProjectScene = {
        ...selectedVisualScene,
        generatedAssetId: result.job.generatedAssetId,
        generatedAsset: result.asset,
        visualPrompt: result.job.prompt,
        negativePrompt: result.job.negativePrompt,
        generationStatus: result.job.status,
        generationProvider: provider,
        generationSeed: result.job.seed,
        updatedAt: new Date().toISOString()
      };
      const nextProject: StudioProject = {
        ...project,
        scenes: replaceScene(project.scenes, nextScene)
      };

      setProject(nextProject);
      setSource("api");

      try {
        await refreshGeneratedImagesForScene(selectedVisualScene.id);
      } catch {
        setGeneratedImages((current) =>
          sortGeneratedImageItems([
            buildGeneratedImageGalleryItem(
              nextProject,
              nextScene,
              result.job,
              result.asset
            ),
            ...current.filter((item) => item.job.id !== result.job.id)
          ])
        );
      }

      await loadBlueprintFor(nextProject);
      setStatusMessage(
        `Hybrid Visual ${provider} concluiu. Pack ${selectedWorkflowPack?.id ?? "auto"} / quality ${selectedQualityPreset?.id ?? "standard"}.`
      );
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleReviewGeneratedImage(
    item: GeneratedImageGalleryItem,
    reviewStatus: "approved" | "rejected" | "favorite"
  ) {
    try {
      await markVisualGenerationJobReviewedRequest(item.job.id, reviewStatus, null);
      setGeneratedImages((current) =>
        current.map((entry) =>
          entry.job.id === item.job.id
            ? {
                ...entry,
                reviewStatus,
                reviewNotes: null,
                isFavorite: reviewStatus === "favorite",
                metadata: {
                  ...(entry.metadata ?? {}),
                  reviewStatus,
                  reviewNotes: null
                },
                job: {
                  ...entry.job,
                  metadata: {
                    ...(entry.job.metadata ?? {}),
                    reviewStatus,
                    reviewNotes: null
                  }
                }
              }
            : entry
        )
      );
      setGeneratedImagesSource("api");
      setStatusMessage(`Job ${item.job.id} marcado como ${reviewStatus}.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleUseGeneratedImage(item: GeneratedImageGalleryItem) {
    if (!item.scene?.id || !item.asset?.id) {
      setStatusMessage("Apenas imagens com cena associada podem ser promovidas.");
      return;
    }

    try {
      const result = await useGeneratedImageForSceneRequest(item.scene.id, item.asset.id);
      const nextProject: StudioProject = {
        ...project,
        scenes: replaceScene(project.scenes, result.scene)
      };

      setProject(nextProject);
      setSource("api");
      await refreshGeneratedImagesForScene(item.scene.id);
      await loadBlueprintFor(nextProject);
      setStatusMessage(`Cena ${result.scene.order} agora usa o asset ${item.asset.id}.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleUseNarration(item: GeneratedAudioGalleryItem) {
    if (!item.scene?.id || !item.asset?.id) {
      setStatusMessage("Apenas narracoes com cena associada podem ser aplicadas.");
      return;
    }

    try {
      const result = await useSceneNarrationRequest(item.scene.id, item.asset.id);
      const nextProject: StudioProject = {
        ...project,
        scenes: replaceScene(project.scenes, result.scene)
      };

      setProject(nextProject);
      setSource("api");
      await refreshNarrationsForScene(item.scene.id);
      await loadBlueprintFor(nextProject);
      setStatusMessage(`Cena ${result.scene.order} agora usa a narracao ${item.asset.id}.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  async function handleRegenerateGeneratedImage(
    item: GeneratedImageGalleryItem,
    seedMode: "reuse" | "random"
  ) {
    if (!item.scene?.id) {
      setStatusMessage("Regeneracao rapida exige uma cena associada.");
      return;
    }

    try {
      const result = await regenerateVisualGenerationJobRequest(item.job.id, {
        seedMode,
        workflowPackId: readGeneratedMetadataString(item, "workflowPackId"),
        qualityPresetId: readGeneratedMetadataString(item, "qualityPresetId")
      });
      const currentScene =
        project.scenes.find((scene) => scene.id === item.scene?.id) ?? null;

      if (!currentScene) {
        setStatusMessage("Cena nao encontrada para atualizar a timeline local.");
        return;
      }

      const nextScene: ProjectScene = {
        ...currentScene,
        generatedAssetId: result.job.generatedAssetId ?? currentScene.generatedAssetId ?? null,
        generatedAsset: result.asset ?? currentScene.generatedAsset ?? null,
        visualPrompt: result.job.prompt,
        negativePrompt: result.job.negativePrompt,
        generationStatus: result.job.status,
        generationProvider: result.job.provider,
        generationSeed: result.job.seed,
        updatedAt: new Date().toISOString()
      };
      const nextProject: StudioProject = {
        ...project,
        scenes: replaceScene(project.scenes, nextScene)
      };

      setLastVisualJob(result.job);
      setProject(nextProject);
      setSource("api");
      const refreshedItems = await refreshGeneratedImagesForScene(item.scene.id);
      const regeneratedItem = refreshedItems.find((entry) => entry.job.id === result.job.id);

      if (regeneratedItem) {
        setGeneratedImages((current) =>
          sortGeneratedImageItems([
            regeneratedItem,
            ...current.filter((entry) => entry.job.id !== regeneratedItem.job.id)
          ])
        );
      }

      await loadBlueprintFor(nextProject);
      setStatusMessage(`Regeneracao concluida com seed mode ${seedMode}.`);
    } catch (error) {
      setStatusMessage(extractErrorMessage(error));
    }
  }

  function startSceneEditing(scene: ProjectScene) {
    setEditingSceneId(scene.id);
    setSceneForm(toSceneFormState(scene));
    setStatusMessage(`Editando cena ${scene.order}.`);
  }

  async function handleSceneMove(sceneId: string, direction: -1 | 1) {
    const reorderedIds = moveSceneIds(project.scenes, sceneId, direction);

    if (!reorderedIds) {
      return;
    }

    try {
      const scenes = await reorderScenesRequest(project.id, {
        sceneIds: reorderedIds
      });

      setProject((current) => ({
        ...current,
        scenes: sortScenes(scenes)
      }));
      setSource("api");
      setStatusMessage("Timeline reordenada na API local.");
    } catch (error) {
      setProject((current) => ({
        ...current,
        scenes: reorderLocalScenes(current.scenes, reorderedIds)
      }));
      setSource("mock");
      setStatusMessage(
        `${extractErrorMessage(error)} Timeline reordenada apenas nesta sessao.`
      );
    }
  }

  async function handleSceneDelete(scene: ProjectScene) {
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(`Remover a cena "${scene.title}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteSceneRequest(project.id, scene.id);
      setProject((current) => ({
        ...current,
        scenes: removeScene(current.scenes, scene.id)
      }));
      setSource("api");
      setStatusMessage("Cena removida da API local.");
    } catch (error) {
      setProject((current) => ({
        ...current,
        scenes: removeScene(current.scenes, scene.id)
      }));
      setSource("mock");
      setStatusMessage(
        `${extractErrorMessage(error)} Cena removida apenas desta sessao.`
      );
    }

    if (editingSceneId === scene.id) {
      resetSceneComposer(project.scenes.length);
    }
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[1.12fr_0.88fr]">
      <section className="space-y-6">
        <article className="rounded-[1.9rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,207,112,0.12),transparent_28%),rgba(255,255,255,0.04)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Timeline Desk
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-white">
                {project.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-mist/68">
                Canal {project.channel?.name ?? "Sem canal"} - formato{" "}
                {project.format} - alvo {formatDuration(project.durationTarget)}
              </p>
              {isReelsFactoryProject && reelsFactoryTemplate ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#ffe28a]/25 bg-[#ffe28a]/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#fff2c9]">
                    Reels Factory
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-mist/70">
                    {reelsFactoryTemplate.id}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-mist/70">
                    workflow {reelsFactoryTemplate.recommendedWorkflowPackId}
                  </span>
                </div>
              ) : null}
            </div>
            <div
              className={`rounded-full border px-3 py-1 text-xs ${
                source === "api"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : "border-amber-400/30 bg-amber-400/10 text-amber-200"
              }`}
            >
              {source === "api" ? "API live" : "Mock mode"}
            </div>
          </div>

          <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
            {statusMessage}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Cenas
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {orderedScenes.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Duracao total
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {formatDuration(totalDuration)}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Template
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {effectiveTemplate.name}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Caption default
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {effectiveProjectCaptionStyle.name}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Sequence Track
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Timeline visual de cenas
              </h2>
            </div>
            <button
              type="button"
              onClick={() => resetSceneComposer(project.scenes.length + 1)}
              className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
            >
              Adicionar cena
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {orderedScenes.map((scene) => {
              const sceneInsight = sceneInsightMap.get(scene.id);
              const presetPreview = resolveScenePresetPreview(
                scene.visualPreset,
                scene.emotion
              );
              const effectiveCaptionStyle =
                getCaptionStyleById(scene.captionStyle) ??
                getCaptionStyleById(project.defaultCaptionStyle) ??
                getCaptionStyleById(effectiveTemplate.defaultCaptionStyle) ??
                effectiveProjectCaptionStyle;
              const analysisForScene =
                liveCaptionAnalysis?.scenes.find((entry) => entry.sceneId === scene.id) ??
                null;
              const sceneEffectiveLabel = getSceneEffectiveAssetLabel(scene);
              const sceneEffectiveSource = getSceneEffectiveAssetSource(scene);
              const sceneReadyVisual = sceneHasEffectiveAsset(scene);
              const blueprintScene = blueprintSceneMap.get(scene.id);
              const sceneNarrationReady =
                blueprintScene?.narrationReady ??
                Boolean(scene.generatedNarrationAssetId || project.voiceoverAssetId);
              const sceneNarrationSource =
                blueprintScene?.effectiveNarrationSource ??
                blueprintScene?.narrationSource ??
                (scene.generatedNarrationAssetId
                  ? "generated"
                  : project.voiceoverAssetId
                    ? "manual"
                    : "missing");
              const sceneNarrationDuration =
                blueprintScene?.narrationDurationSeconds ??
                scene.generatedNarrationAsset?.duration ??
                null;
              const sceneMicroclips = sortEditorialMicroclips(
                editorialMicroclips.filter(
                  (microclip) => microclip.sceneId === scene.id
                )
              );
              const sceneMicroclipDuration = sceneMicroclips.reduce(
                (total, microclip) => total + microclip.durationSeconds,
                0
              );
              const sceneFactoryRecipe = parseReelsFactorySceneRecipe(
                scene.visualRecipe
              );

              return (
                <article
                  key={scene.id}
                  id={`scene-${scene.id}`}
                  className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-signal">
                          Cena {scene.order}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-mist/70">
                          {formatRoleLabel(sceneInsight?.role ?? "context")}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-mist/70">
                          energia {scene.energyLevel ?? sceneInsight?.energyScore ?? 40}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-mist/70">
                          {presetPreview.effective.id}
                        </span>
                        {sceneMicroclips.length > 0 ? (
                          <span className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#fff0cb]">
                            microclip {sceneMicroclips.length}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold text-white">
                        {scene.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-mist/68">
                        {scene.narrationText ?? "Narracao ainda nao definida."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleSceneMove(scene.id, -1)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/78"
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSceneMove(scene.id, 1)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/78"
                      >
                        Descer
                      </button>
                      <button
                        type="button"
                        onClick={() => startSceneEditing(scene)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/78"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSceneDelete(scene)}
                        className="rounded-full border border-[#ff8b8b]/20 bg-[#ff8b8b]/10 px-4 py-2 text-sm text-[#ffd4d4]"
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-5">
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                        Visual efetivo
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {sceneEffectiveLabel}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
                            sceneReadyVisual
                              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                              : "border-[#ff8b8b]/20 bg-[#ff8b8b]/10 text-[#ffd4d4]"
                          }`}
                        >
                          {sceneReadyVisual ? "Effective Asset" : "Sem visual"}
                        </span>
                        {isBaseAssetActive(scene) ? (
                          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-mist/68">
                            Base Asset
                          </span>
                        ) : null}
                        {isGeneratedAssetActive(scene) ? (
                          <span className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#e2e8ff]">
                            Generated Asset
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-mist/55">
                        source {formatEffectiveVisualSourceLabel(sceneEffectiveSource)}
                      </p>
                      {sceneMicroclips.length > 0 ? (
                        <p className="mt-2 text-xs text-mist/55">
                          {sceneMicroclips.length} insert(s) / total{" "}
                          {formatDuration(sceneMicroclipDuration)}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                        Narracao
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {sceneNarrationReady ? "Narracao pronta" : "Sem narracao"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
                            sceneNarrationReady
                              ? "border-[#7be0ff]/25 bg-[#7be0ff]/10 text-[#d8f8ff]"
                              : "border-white/10 bg-black/20 text-mist/68"
                          }`}
                        >
                          {sceneNarrationReady ? "Narracao pronta" : "Sem narracao"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-mist/68">
                          {sceneNarrationSource}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-mist/55">
                        {blueprintScene?.narrationProvider ?? scene.narrationProvider ?? "provider n/a"} /{" "}
                        {blueprintScene?.narrationVoicePackId ?? scene.narrationVoicePackId ?? "voice pack n/a"} / duration{" "}
                        {formatDuration(sceneNarrationDuration)}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                        Legenda
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {effectiveCaptionStyle.name}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                        Duracao
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {formatDuration(scene.duration)}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                        Caption status
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {analysisForScene?.quality.readingSpeedStatus ?? "n/a"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-4">
                    <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                        Legenda
                      </p>
                      <p className="mt-3 text-sm leading-7 text-mist/68">
                        {scene.captionText ?? "Legenda ainda nao definida."}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                        Direcao visual
                      </p>
                      <p className="mt-3 text-sm font-medium text-white">
                        {presetPreview.effective.name}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-mist/68">
                        {presetPreview.effective.description}
                      </p>
                      <p className="mt-2 text-sm text-mist/68">
                        transicao{" "}
                        {scene.transition ?? presetPreview.effective.suggestedTransition}
                      </p>
                      {scene.visualPrompt ? (
                        <p className="mt-3 text-xs leading-6 text-mist/60">
                          {scene.visualPrompt}
                        </p>
                      ) : null}
                      {sceneFactoryRecipe ? (
                        <p className="mt-3 text-xs leading-6 text-mist/60">
                          workflow {sceneFactoryRecipe.suggestedWorkflowPackId ?? "n/a"} /
                          voice {sceneFactoryRecipe.suggestedVoicePackId ?? "n/a"} /
                          mastering{" "}
                          {sceneFactoryRecipe.suggestedAudioMasteringPresetId ?? "n/a"}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                        Story role
                      </p>
                      <p className="mt-3 text-sm font-medium text-white">
                        {formatRoleLabel(sceneInsight?.role ?? "context")}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-mist/68">
                        {sceneInsight?.reason ??
                          "Papel narrativo sera refinado conforme a timeline cresce."}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                        Editorial Microclips
                      </p>
                      <p className="mt-3 text-sm font-medium text-white">
                        {sceneMicroclips.length > 0
                          ? `${sceneMicroclips.length} insert(s)`
                          : "Sem microclips"}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-mist/68">
                        {sceneMicroclips.length > 0
                          ? `Duracao total ${formatDuration(sceneMicroclipDuration)} com prioridade editorial controlada.`
                          : "Use apenas inserts curtos para impacto ou evidencia, sem virar compilado."}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs uppercase tracking-[0.22em] text-mist/45">
                    Atualizado {formatDate(scene.updatedAt)}
                  </p>
                </article>
              );
            })}
          </div>
        </article>

        {liveCaptionAnalysis ? (
          <CaptionEnginePanel
            analysis={liveCaptionAnalysis}
            source={captionAnalysisSource}
          />
        ) : null}
      </section>

      <aside className="space-y-6">
        {isReelsFactoryProject && reelsFactoryTemplate ? (
          <article className="rounded-[1.9rem] border border-[#ffe28a]/20 bg-[#ffe28a]/8 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                  Reels Factory
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Factory template ativo no projeto
                </h2>
                <p className="mt-3 text-sm leading-7 text-mist/68">
                  {reelsFactoryTemplate.description}
                </p>
              </div>
              <span className="rounded-full border border-[#ffe28a]/25 bg-[#ffe28a]/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-[#fff2c9]">
                {reelsFactoryTemplate.id}
              </span>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Best for
                </p>
                <p className="mt-2 text-sm leading-7 text-white">
                  {reelsFactoryTemplate.bestFor}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Pack stack
                </p>
                <p className="mt-2 text-sm leading-7 text-white">
                  workflow {reelsFactoryTemplate.recommendedWorkflowPackId} / voice{" "}
                  {reelsFactoryTemplate.recommendedVoicePackId} / mastering{" "}
                  {selectedAudioMasteringPreset.id}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {reelsFactoryRecommendedNextActions.map((action) => (
                <span
                  key={action}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white"
                >
                  {formatFactoryActionLabel(action)}
                </span>
              ))}
            </div>

            <div className="mt-6 grid gap-3">
              {reelsFactoryOperationalChecklist.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-[1.2rem] border px-4 py-3 ${
                    item.done
                      ? "border-emerald-400/20 bg-emerald-400/10"
                      : item.optional
                        ? "border-white/10 bg-black/20"
                        : "border-amber-400/20 bg-amber-400/10"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-mist/70">
                      {item.done ? "ok" : item.optional ? "opcional" : "pendente"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-mist/65">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3">
              {reelsFactorySceneRecipes.map(({ scene, recipe }) => (
                <div
                  key={scene.id}
                  className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">
                      Cena {scene.order} - {scene.title}
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-mist/70">
                      {recipe?.suggestedWorkflowPackId ?? "workflow n/a"}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-mist/60">
                    {scene.visualPrompt ?? "Prompt visual ainda nao definido."}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-mist/60">
                    voice {recipe?.suggestedVoicePackId ?? "n/a"} / mastering{" "}
                    {recipe?.suggestedAudioMasteringPresetId ?? selectedAudioMasteringPreset.id}
                    {recipe?.microclipSlot?.label
                      ? ` / microclip ${recipe.microclipSlot.label}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ) : null}

        <StoryEnginePanel analysis={storyAnalysis} />

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Quality Panel
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Sanidade da timeline
          </h2>

          <div className="mt-6 grid gap-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Fonte de projeto
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                {source === "api" ? "API local" : "Mock local"}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Biblioteca
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                {assetsSource === "api" ? "assets live" : "assets mock"} -{" "}
                {channelsSource === "api" ? "channels live" : "channels mock"}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-mist/45">
                Checklist
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                {storyAnalysis.analysis.sceneCount} cenas - {visualReadyCount} com
                visual - {missingVisualCount} sem visual
              </p>
              <p className="mt-2 text-xs leading-6 text-mist/60">
                legenda pendente {storyAnalysis.analysis.missingCaptions} / generated
                ativos {generatedVisualCount} / narracoes prontas {narrationReadyCount} /
                generated {generatedNarrationCount} / manual {manualNarrationCount} /
                sem narracao {missingNarrationCount} / microclips {editorialMicroclips.length} /
                cenas com microclip {microclipHeavyScenes.size} / fonte {productionChecklistSource}
              </p>
              <p className="mt-2 text-xs leading-6 text-mist/60">
                duracao editorial total {formatDuration(totalMicroclipDuration)} / feed{" "}
                {editorialMicroclipsSource}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {filteredQualityAlerts.length > 0 ? (
              filteredQualityAlerts.map((alert) => (
                <div
                  key={alert}
                  className="rounded-[1.2rem] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
                >
                  {alert}
                </div>
              ))
            ) : (
              <div className="rounded-[1.2rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Nenhum alerta estrutural imediato detectado nesta timeline.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Project Template
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Template do projeto
          </h2>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Template</span>
              <select
                value={projectForm.templateId}
                onChange={(event) => {
                  const nextTemplateId = event.target.value;
                  const nextTemplate = getTemplateById(nextTemplateId);

                  setProjectForm((current) => ({
                    ...current,
                    templateId: nextTemplateId,
                    defaultCaptionStyle:
                      current.defaultCaptionStyle || nextTemplate?.defaultCaptionStyle || ""
                  }));
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Auto por canal/nicho</option>
                {templateCatalog.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.id}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">
                    {effectiveTemplate.name}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-mist/68">
                    {effectiveTemplate.description}
                  </p>
                </div>
                <span className="rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-signal">
                  {projectForm.templateId ? "manual" : "auto"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Nicho
                  </p>
                  <p className="mt-2 text-sm text-white">{effectiveTemplate.niche}</p>
                </div>
                <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Preset visual
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {effectiveTemplate.defaultVisualPreset}
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Legenda padrao
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {effectiveTemplate.defaultCaptionStyle}
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                    Musica e SFX
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {effectiveTemplate.musicMood} - {effectiveTemplate.sfxMood}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
            Project Inspector
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Metadados do projeto
          </h2>

          <form className="mt-6 space-y-4" onSubmit={handleProjectSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Titulo</span>
              <input
                required
                value={projectForm.title}
                onChange={(event) =>
                  setProjectForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Canal</span>
                <select
                  value={projectForm.channelId}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      channelId: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Status</span>
                <select
                  value={projectForm.status}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      status: event.target.value as ProjectStatus
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {projectStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Duracao alvo (s)
                </span>
                <input
                  value={projectForm.durationTarget}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      durationTarget: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Formato</span>
                <input
                  required
                  value={projectForm.format}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      format: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Caption default
                </span>
                <select
                  value={projectForm.defaultCaptionStyle}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      defaultCaptionStyle: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="">Auto pelo template</option>
                  {captionStylesCatalog.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name} - {style.id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Caption efetiva
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {effectiveProjectCaptionStyle.name}
                </p>
                <p className="mt-2 text-sm leading-7 text-mist/68">
                  {effectiveProjectCaptionStyle.description}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Music preset
                </span>
                <select
                  value={projectForm.musicPresetId}
                  onChange={(event) =>
                    setProjectForm((current) => ({
                      ...current,
                      musicPresetId: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="">Auto por nicho/template</option>
                  {musicPresetsCatalog.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} - {preset.id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Selecionada para o projeto
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {selectedMusicAsset?.filename ?? "Nenhuma musica aplicada"}
                </p>
                <p className="mt-2 text-sm leading-7 text-mist/68">
                  preset {selectedMusicPreset.id} / volume base{" "}
                  {selectedMusicPreset.defaultMusicVolume.toFixed(2)} / fonte{" "}
                  {beatSyncPlanSource}
                </p>
                <p className="mt-2 text-xs leading-6 text-mist/60">
                  {selectedMusicAsset?.musicProfile
                    ? `${selectedMusicAsset.musicProfile.mood} / ${selectedMusicAsset.musicProfile.genre} / ${selectedMusicAsset.musicProfile.energy}`
                    : "Sem perfil musical persistido para este asset."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleAutoSelectMusic();
                }}
                className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-4 py-2 text-sm font-medium text-[#d8f8ff]"
              >
                Selecionar musica automaticamente
              </button>
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.22em] text-mist/65">
                suggested {suggestedMusicPresetId}
              </span>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Script</span>
              <textarea
                rows={6}
                value={projectForm.script}
                onChange={(event) =>
                  setProjectForm((current) => ({
                    ...current,
                    script: event.target.value
                  }))
                }
                className="w-full rounded-[1.6rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <button
              type="submit"
              className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
            >
              Salvar projeto
            </button>
          </form>
        </article>

        <article className="rounded-[1.9rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Scene Composer
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {editingSceneId ? "Editar cena" : "Nova cena"}
              </h2>
            </div>
            {editingSceneId ? (
              <button
                type="button"
                onClick={() => resetSceneComposer(project.scenes.length + 1)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/78"
              >
                Cancelar
              </button>
            ) : null}
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSceneSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Ordem</span>
                <input
                  value={sceneForm.order}
                  onChange={(event) =>
                    setSceneForm((current) => ({
                      ...current,
                      order: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Emocao</span>
                <select
                  value={sceneForm.emotion}
                  onChange={(event) =>
                    setSceneForm((current) => ({
                      ...current,
                      emotion: event.target.value as EmotionTag | ""
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="">Sem emocao</option>
                  {emotionTags.map((emotion) => (
                    <option key={emotion} value={emotion}>
                      {emotion}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Titulo</span>
              <input
                required
                value={sceneForm.title}
                onChange={(event) =>
                  setSceneForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Asset</span>
              <select
                value={sceneForm.assetId}
                onChange={(event) =>
                  setSceneForm((current) => ({
                    ...current,
                    assetId: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Sem asset vinculado</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.filename} - {asset.type} - {asset.category}
                  </option>
                ))}
              </select>
            </label>

            {selectedAsset ? (
              <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/20">
                <AssetMediaPreview asset={selectedAsset} source={assetsSource} />
              </div>
            ) : (
              <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-black/20 px-4 py-5 text-sm text-mist/68">
                Vincule um asset para ver o preview desta cena.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Preset visual
                </span>
                <select
                  value={sceneForm.visualPreset}
                  onChange={(event) =>
                    setSceneForm((current) => ({
                      ...current,
                      visualPreset: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="">
                    Auto por emocao ({selectedPresetPreview.suggested.name})
                  </option>
                  {cinematicPresetsCatalog.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} - {preset.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Transicao
                </span>
                <input
                  value={sceneForm.transition}
                  onChange={(event) =>
                    setSceneForm((current) => ({
                      ...current,
                      transition: event.target.value
                    }))
                  }
                  placeholder={selectedPresetPreview.effective.suggestedTransition}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
                <span className="mt-2 block text-xs text-mist/55">
                  Sugerida: {selectedPresetPreview.effective.suggestedTransition}
                </span>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Caption style
                </span>
                <select
                  value={sceneForm.captionStyle}
                  onChange={(event) =>
                    setSceneForm((current) => ({
                      ...current,
                      captionStyle: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="">
                    Auto ({effectiveProjectCaptionStyle.name})
                  </option>
                  {captionStylesCatalog.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name} - {style.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Caption position
                </span>
                <select
                  value={sceneForm.captionPosition}
                  onChange={(event) =>
                    setSceneForm((current) => ({
                      ...current,
                      captionPosition: event.target.value as CaptionPosition | ""
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  <option value="">
                    Auto ({effectiveSceneCaptionStyle.position})
                  </option>
                  {captionPositions.map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <CinematicPresetCard
              preset={selectedPresetPreview.effective}
              eyebrow="Preset Preview"
              title="Direcao cinematografica da cena"
              modeLabel={
                selectedPresetPreview.mode === "manual"
                  ? "Preset manual"
                  : "Sugestao por emocao"
              }
            />

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Narracao
              </span>
              <textarea
                rows={4}
                value={sceneForm.narrationText}
                onChange={(event) =>
                  setSceneForm((current) => ({
                    ...current,
                    narrationText: event.target.value
                  }))
                }
                className="w-full rounded-[1.6rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Legenda</span>
              <textarea
                rows={3}
                value={sceneForm.captionText}
                onChange={(event) =>
                  setSceneForm((current) => ({
                    ...current,
                    captionText: event.target.value
                  }))
                }
                className="w-full rounded-[1.6rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Duracao (s)
                </span>
                <input
                  value={sceneForm.duration}
                  onChange={(event) =>
                    setSceneForm((current) => ({
                      ...current,
                      duration: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">
                  Energy level
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sceneForm.energyLevel || "60"}
                  onChange={(event) =>
                    setSceneForm((current) => ({
                      ...current,
                      energyLevel: event.target.value
                    }))
                  }
                  className="w-full accent-[#63ffe1]"
                />
                <span className="mt-2 block text-sm text-white">
                  {sceneForm.energyLevel || "60"}
                </span>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">
                Palavras em enfase
              </span>
              <input
                value={sceneForm.captionEmphasisWords}
                onChange={(event) =>
                  setSceneForm((current) => ({
                    ...current,
                    captionEmphasisWords: event.target.value
                  }))
                }
                placeholder="segredo, verdade, queda"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
              />
            </label>

            <CaptionFramePreview
              asset={selectedAsset}
              assetSource={assetsSource}
              captionLines={effectiveSceneCaptionLines}
              captionStyle={effectiveSceneCaptionStyle}
              captionPosition={effectiveSceneCaptionPosition}
              emphasisWords={effectiveEmphasisWords}
            />

            <button
              type="submit"
              className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#66f0cf]"
            >
              {editingSceneId ? "Salvar cena" : "Adicionar cena"}
            </button>
          </form>
        </article>

        <article className="rounded-[1.9rem] border border-[#ffcf70]/20 bg-[#ffcf70]/8 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Editorial Microclips
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Inserts curtos de apoio visual
              </h2>
              <p className="mt-3 text-sm leading-7 text-mist/68">
                Use no maximo dois microclips por projeto para prova visual,
                impacto ou referencia rapida sem transformar a timeline em
                compilado.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-mist/70">
              {editorialMicroclips.length}/2 microclips - {formatDuration(totalMicroclipDuration)}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Cena</span>
              <select
                value={editorialMicroclipForm.sceneId}
                onChange={(event) => {
                  setVisualSceneId(event.target.value);
                  setEditorialMicroclipForm((current) => ({
                    ...current,
                    sceneId: event.target.value
                  }));
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Selecione uma cena</option>
                {orderedScenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.order}. {scene.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Video asset</span>
              <select
                value={editorialMicroclipForm.assetId}
                onChange={(event) =>
                  setEditorialMicroclipForm((current) => ({
                    ...current,
                    assetId: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Selecione um video</option>
                {videoAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.filename}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Uso</span>
              <select
                value={editorialMicroclipForm.usageMode}
                onChange={(event) =>
                  setEditorialMicroclipForm((current) => ({
                    ...current,
                    usageMode: event.target.value as EditorialMicroclipUsageMode
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {editorialMicroclipUsageModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {formatTagLabel(mode)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Source</span>
              <select
                value={editorialMicroclipForm.sourceType}
                onChange={(event) =>
                  setEditorialMicroclipForm((current) => ({
                    ...current,
                    sourceType: event.target.value as EditorialMicroclipSourceType
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {editorialMicroclipSourceTypes.map((sourceType) => (
                  <option key={sourceType} value={sourceType}>
                    {formatTagLabel(sourceType)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <form onSubmit={handleEditorialMicroclipSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Label</span>
                <input
                  value={editorialMicroclipForm.label}
                  onChange={(event) =>
                    setEditorialMicroclipForm((current) => ({
                      ...current,
                      label: event.target.value
                    }))
                  }
                  placeholder="finalizacao curta, close de impacto, prova visual"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Text overlay</span>
                <input
                  value={editorialMicroclipForm.textOverlay}
                  onChange={(event) =>
                    setEditorialMicroclipForm((current) => ({
                      ...current,
                      textOverlay: event.target.value
                    }))
                  }
                  placeholder="finalizacao em um toque"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Start</span>
                <input
                  value={editorialMicroclipForm.startTimeSeconds}
                  onChange={(event) =>
                    setEditorialMicroclipForm((current) => ({
                      ...current,
                      startTimeSeconds: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">End</span>
                <input
                  value={editorialMicroclipForm.endTimeSeconds}
                  onChange={(event) =>
                    setEditorialMicroclipForm((current) => ({
                      ...current,
                      endTimeSeconds: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Callout</span>
                <select
                  value={editorialMicroclipForm.calloutStyle}
                  onChange={(event) =>
                    setEditorialMicroclipForm((current) => ({
                      ...current,
                      calloutStyle: event.target.value as EditorialMicroclipCalloutStyle
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {editorialMicroclipCalloutStyles.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">In</span>
                <select
                  value={editorialMicroclipForm.transitionIn}
                  onChange={(event) =>
                    setEditorialMicroclipForm((current) => ({
                      ...current,
                      transitionIn: event.target.value as EditorialMicroclipTransition
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {editorialMicroclipTransitions.map((transition) => (
                    <option key={transition} value={transition}>
                      {transition}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Out</span>
                <select
                  value={editorialMicroclipForm.transitionOut}
                  onChange={(event) =>
                    setEditorialMicroclipForm((current) => ({
                      ...current,
                      transitionOut: event.target.value as EditorialMicroclipTransition
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {editorialMicroclipTransitions.map((transition) => (
                    <option key={transition} value={transition}>
                      {transition}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Volume mode</span>
                <select
                  value={editorialMicroclipForm.volumeMode}
                  onChange={(event) =>
                    setEditorialMicroclipForm((current) => ({
                      ...current,
                      volumeMode: event.target.value as EditorialMicroclipVolumeMode
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {editorialMicroclipVolumeModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {formatTagLabel(mode)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-mist/65">Order</span>
                <input
                  value={editorialMicroclipForm.orderIndex}
                  onChange={(event) =>
                    setEditorialMicroclipForm((current) => ({
                      ...current,
                      orderIndex: event.target.value
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-mist/68">
                <input
                  type="checkbox"
                  checked={editorialMicroclipForm.narrationOverlay}
                  onChange={(event) =>
                    setEditorialMicroclipForm((current) => ({
                      ...current,
                      narrationOverlay: event.target.checked
                    }))
                  }
                  className="accent-[#63ffe1]"
                />
                Manter narração por cima do microclip
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-[#ffcf70] px-5 py-3 text-sm font-semibold text-[#1c1607] transition hover:bg-[#ffd98e]"
              >
                {editingMicroclipId ? "Salvar microclip" : "Adicionar microclip"}
              </button>
              <button
                type="button"
                onClick={() => resetEditorialMicroclipComposer()}
                className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-mist/75"
              >
                Limpar
              </button>
            </div>
          </form>

          <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Cena selecionada
            </p>
            <p className="mt-2 text-sm text-white">
              {selectedVisualScene
                ? `${selectedVisualScene.order}. ${selectedVisualScene.title}`
                : "Nenhuma cena selecionada"}
            </p>
            <p className="mt-2 text-xs leading-6 text-mist/60">
              {selectedSceneMicroclips.length} insert(s) / total{" "}
              {formatDuration(
                selectedSceneMicroclips.reduce(
                  (total, microclip) => total + microclip.durationSeconds,
                  0
                )
              )}{" "}
              / fonte {editorialMicroclipsSource}
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {selectedSceneMicroclips.length > 0 ? (
              selectedSceneMicroclips.map((microclip) => (
                <div
                  key={microclip.id}
                  className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-3 py-1 text-[11px] text-[#fff0cb]">
                      {microclip.usageMode}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-mist/70">
                      {microclip.volumeMode}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-medium text-white">
                    {microclip.label}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-mist/65">
                    {microclip.asset?.filename ?? microclip.assetId} / clip{" "}
                    {formatDuration(microclip.startTimeSeconds)} →{" "}
                    {formatDuration(microclip.endTimeSeconds)} / total{" "}
                    {formatDuration(microclip.durationSeconds)}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-mist/65">
                    overlay {microclip.textOverlay ?? "sem texto"} / narration{" "}
                    {microclip.narrationOverlay ? "on" : "off"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEditorialMicroclipEditing(microclip)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-mist/75"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleEditorialMicroclipDelete(microclip.id);
                      }}
                      className="rounded-full border border-[#ff8b8b]/20 bg-[#ff8b8b]/10 px-3 py-2 text-xs text-[#ffd4d4]"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/20 p-6 text-sm text-mist/55 md:col-span-2">
                Nenhum editorial microclip nesta cena ainda. Prefira inserts
                curtos de apoio, impacto ou referencia rapida.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[1.9rem] border border-[#92a7ff]/20 bg-[#92a7ff]/8 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Hybrid Visual
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Workflow Packs + Quality Presets
              </h2>
              <p className="mt-3 text-sm leading-7 text-mist/68">
                Escolha pack, qualidade e workflow para gerar visual render-ready
                com mock ou ComfyUI local.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/65">
              packs {workflowPacksSource} / quality {qualityPresetsSource}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Cena</span>
              <select
                value={selectedVisualScene?.id ?? ""}
                onChange={(event) => setVisualSceneId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {orderedScenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.order}. {scene.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Workflow pack</span>
              <select
                value={visualWorkflowPackId}
                onChange={(event) => {
                  const nextPack = workflowPacks.find(
                    (pack) => pack.id === event.target.value
                  );
                  setVisualWorkflowPackId(event.target.value);
                  if (nextPack) {
                    setVisualWorkflowId(nextPack.recommendedWorkflowId);
                    setVisualQualityPresetId(nextPack.defaultQualityPreset);
                    setVisualSeedMode(nextPack.defaultSeedStrategy);
                  }
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {workflowPacks.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name} - {pack.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Quality</span>
              <select
                value={visualQualityPresetId}
                onChange={(event) => setVisualQualityPresetId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {qualityPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Workflow</span>
              <input
                value={visualWorkflowId}
                onChange={(event) => setVisualWorkflowId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Seed mode</span>
              <select
                value={visualSeedMode}
                onChange={(event) => setVisualSeedMode(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {["random", "fixed", "reuse", "increment"].map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Seed opcional</span>
              <input
                value={visualSeed}
                onChange={(event) => setVisualSeed(event.target.value)}
                placeholder="auto"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Pack preview
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                {selectedWorkflowPack?.name ?? "Pack indisponivel"}
              </p>
              <p className="mt-3 text-sm leading-7 text-mist/68">
                {selectedWorkflowPack?.styleNotes ?? "Sem notas."}
              </p>
              <p className="mt-3 text-xs text-mist/55">
                prompt {selectedWorkflowPack?.recommendedPromptPackId ?? "auto"} /
                negative {selectedWorkflowPack?.recommendedNegativePromptPackId ?? "auto"}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Quality preview
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                {selectedQualityPreset?.name ?? "Standard"} -{" "}
                {selectedQualityPreset?.width ?? 1080}x{selectedQualityPreset?.height ?? 1920}
              </p>
              <p className="mt-3 text-sm leading-7 text-mist/68">
                steps {selectedQualityPreset?.steps ?? 20}, cfg{" "}
                {selectedQualityPreset?.cfg ?? 2.8}, sampler{" "}
                {selectedQualityPreset?.sampler ?? "auto"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void handleGenerateVisual("mock-svg");
              }}
              disabled={!selectedVisualScene}
              className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-4 py-2 text-xs text-[#d8f8ff] disabled:opacity-45"
            >
              Gerar mock com pack
            </button>
            <button
              type="button"
              onClick={() => {
                void handleGenerateVisual("comfyui-local");
              }}
              disabled={!selectedVisualScene}
              className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-4 py-2 text-xs text-[#e2e8ff] disabled:opacity-45"
            >
              Gerar com ComfyUI
            </button>
          </div>

          {lastVisualJob ? (
            <div className="mt-5 rounded-[1.2rem] border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/70">
                Ultimo job
              </p>
              <p className="mt-2 text-sm text-white">
                {lastVisualJob.id} - {lastVisualJob.status} - generatedAssetId{" "}
                {lastVisualJob.generatedAssetId ?? "pendente"}
              </p>
              <p className="mt-2 text-xs leading-6 text-mist/65">
                workflowPack {String(lastVisualJob.metadata?.workflowPackId ?? "n/a")} /
                quality {String(lastVisualJob.metadata?.qualityPresetId ?? "n/a")} /
                workflowOrigin {String(lastVisualJob.metadata?.workflowOrigin ?? "n/a")}
              </p>
            </div>
          ) : null}

          <div className="mt-6 rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Scene Gallery
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  {selectedVisualScene
                    ? `${selectedVisualScene.order}. ${selectedVisualScene.title}`
                    : "Selecione uma cena"}
                </h3>
                <p className="mt-2 text-sm leading-7 text-mist/68">
                  Visual atual {selectedVisualSceneEffectiveAssetId ?? "n/d"} -{" "}
                  {formatEffectiveVisualSourceLabel(
                    selectedVisualSceneEffectiveAssetSource
                  )}{" "}
                  / feed {generatedImagesSource}
                </p>
              </div>
              <a
                href="/generated-images"
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/75"
              >
                Abrir galeria completa
              </a>
            </div>

            {selectedVisualScene && selectedVisualSceneHasVisual ? (
              <div className="mt-5 rounded-[1.2rem] border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/70">
                  Imagem em uso
                </p>
                <p className="mt-2 text-sm text-white">
                  effectiveAssetId {selectedVisualSceneEffectiveAssetId ?? "n/a"}
                </p>
                <p className="mt-2 text-sm text-white">
                  {selectedVisualSceneEffectiveAssetLabel}
                </p>
                <p className="mt-2 text-xs leading-6 text-mist/70">
                  source{" "}
                  {formatEffectiveVisualSourceLabel(
                    selectedVisualSceneEffectiveAssetSource
                  )}{" "}
                  / mode {selectedVisualScene.visualSourceMode ?? "n/a"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-100">
                    Effective Asset
                  </span>
                  {selectedVisualScene && isBaseAssetActive(selectedVisualScene) ? (
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-mist/68">
                      Base Asset
                    </span>
                  ) : null}
                  {selectedVisualScene &&
                  isGeneratedAssetActive(selectedVisualScene) ? (
                    <span className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#e2e8ff]">
                      Generated Asset
                    </span>
                  ) : null}
                </div>
                {selectedVisualScene &&
                isGeneratedAssetActive(selectedVisualScene) ? (
                  <p className="mt-3 text-xs leading-6 text-mist/70">
                    Esta cena ja possui visual gerado ativo e deixa de entrar
                    nas pendencias do checklist.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {sceneGeneratedImages.length > 0 ? (
                sceneGeneratedImages.map((item) => (
                  <div
                    key={item.job.id}
                    className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.03]"
                  >
                    {item.asset ? (
                      <AssetMediaPreview asset={item.asset} source={source} />
                    ) : (
                      <div className="flex aspect-[9/16] items-center justify-center bg-black/30 px-5 text-sm text-mist/55">
                        Job sem preview disponivel
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-mist/70">
                          {item.job.status}
                        </span>
                        {item.isCurrentSceneGeneratedAsset ? (
                          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
                            current
                          </span>
                        ) : null}
                        {item.isSceneEffectiveAsset ? (
                          <span className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-3 py-1 text-[11px] text-[#d8f8ff]">
                            effective
                          </span>
                        ) : null}
                        {item.isFavorite ? (
                          <span className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-3 py-1 text-[11px] text-[#fff0cb]">
                            favorite
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-4 text-sm font-medium text-white">
                        asset {item.asset?.id ?? "n/a"}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-mist/65">
                        pack {readGeneratedMetadataString(item, "workflowPackId") ?? "n/a"} /
                        quality {readGeneratedMetadataString(item, "qualityPresetId") ?? "n/a"}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleUseGeneratedImage(item);
                          }}
                          disabled={!item.asset?.id}
                          className="rounded-full border border-signal/30 bg-signal/12 px-3 py-2 text-xs text-signal disabled:opacity-45"
                        >
                          Usar esta imagem
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleRegenerateGeneratedImage(item, "random");
                          }}
                          className="rounded-full border border-[#92a7ff]/25 bg-[#92a7ff]/10 px-3 py-2 text-xs text-[#e2e8ff]"
                        >
                          Regenerar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleReviewGeneratedImage(item, "favorite");
                          }}
                          className="rounded-full border border-[#ffcf70]/25 bg-[#ffcf70]/10 px-3 py-2 text-xs text-[#fff0cb]"
                        >
                          Favoritar
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/20 p-6 text-sm text-mist/55 md:col-span-2">
                  Nenhuma imagem gerada ainda para esta cena. Gere um mock ou use ComfyUI
                  para abrir o historico revisavel.
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-[1.9rem] border border-[#7be0ff]/20 bg-[#7be0ff]/8 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Local Narration
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Narração local por cena
              </h2>
              <p className="mt-3 text-sm leading-7 text-mist/68">
                Gere WAV offline com `mock-tts` ou use `windows-sapi-local`
                quando estiver habilitado no Windows.
              </p>
            </div>
            <a
              href="/generated-audio"
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-mist/75"
            >
              Abrir galeria completa
            </a>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Cena</span>
              <select
                value={selectedVisualScene?.id ?? ""}
                onChange={(event) => setVisualSceneId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {orderedScenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.order}. {scene.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Provider</span>
              <select
                value={narrationProviderId}
                onChange={(event) =>
                  setNarrationProviderId(
                    event.target.value as NarrationProviderDescriptor["id"]
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {narrationProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} - {provider.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/65">Voice pack</span>
              <select
                value={narrationVoicePackId}
                onChange={(event) => setNarrationVoicePackId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                {narrationVoicePacks.map((voicePack) => (
                  <option key={voicePack.id} value={voicePack.id}>
                    {voicePack.name} - {voicePack.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Provider feed
              </p>
              <p className="mt-2 text-sm text-white">
                providers {narrationProvidersSource} / voice packs {narrationVoicePacksSource}
              </p>
              <p className="mt-2 text-xs leading-6 text-mist/65">
                {narrationProviders.find((provider) => provider.id === narrationProviderId)
                  ?.description ?? "Provider local selecionado."}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Cena atual
              </p>
              <p className="mt-2 text-sm text-white">
                {selectedVisualScene?.generatedNarrationAssetId
                  ? "Narracao pronta"
                  : "Sem narracao gerada"}
              </p>
              <p className="mt-2 text-xs leading-6 text-mist/65">
                generatedNarrationAssetId {selectedVisualScene?.generatedNarrationAssetId ?? "n/a"}
              </p>
            </div>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-mist/65">Texto de narração</span>
            <textarea
              rows={5}
              value={narrationTextDraft}
              onChange={(event) => setNarrationTextDraft(event.target.value)}
              placeholder="Cole o texto ou aproveite a narracao da cena."
              className="w-full rounded-[1.6rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-signal/50"
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void handleGenerateNarration();
              }}
              disabled={!selectedVisualScene}
              className="rounded-full border border-[#7be0ff]/25 bg-[#7be0ff]/10 px-4 py-2 text-xs text-[#d8f8ff] disabled:opacity-45"
            >
              Gerar narração
            </button>
          </div>

          {currentSceneNarration?.asset ? (
            <div className="mt-5 overflow-hidden rounded-[1.35rem] border border-white/10">
              <AssetMediaPreview
                asset={currentSceneNarration.asset}
                source={generatedNarrationsSource}
              />
            </div>
          ) : null}

          {currentSceneNarration ? (
            <div className="mt-5 rounded-[1.2rem] border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/70">
                Ultima narracao
              </p>
              <p className="mt-2 text-sm text-white">
                {currentSceneNarration.job.id} - {currentSceneNarration.job.status}
              </p>
              <p className="mt-2 text-xs leading-6 text-mist/65">
                provider {currentSceneNarration.job.provider} / pack{" "}
                {currentSceneNarration.job.voicePackId ?? "n/a"} / duration{" "}
                {formatDuration(currentSceneNarration.job.durationSeconds)}
              </p>
              <p className="mt-2 text-xs leading-6 text-mist/65">
                asset {currentSceneNarration.asset?.id ?? currentSceneNarration.job.generatedAssetId ?? "n/a"} / path{" "}
                {currentSceneNarration.job.outputPath ?? "n/a"}
              </p>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {sceneNarrations.length > 0 ? (
              sceneNarrations.map((item) => (
                <div
                  key={item.job.id}
                  className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-mist/70">
                      {item.job.status}
                    </span>
                    {item.isCurrentSceneNarration ? (
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
                        em uso
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 text-sm font-medium text-white">
                    asset {item.asset?.id ?? item.job.generatedAssetId ?? "n/a"}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-mist/65">
                    {item.job.provider} / {item.job.voicePackId ?? "n/a"} /{" "}
                    {formatDuration(item.job.durationSeconds)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleUseNarration(item);
                      }}
                      disabled={!item.asset?.id}
                      className="rounded-full border border-signal/30 bg-signal/12 px-3 py-2 text-xs text-signal disabled:opacity-45"
                    >
                      Usar esta narração
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/20 p-6 text-sm text-mist/55 md:col-span-2">
                Nenhuma narracao gerada ainda para esta cena. Gere um WAV mock
                para validar o pipeline local.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[1.9rem] border border-[#f4c67a]/20 bg-[#f4c67a]/8 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Editing Reference Presets
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Direcao editorial guiada por referencias locais
              </h2>
              <p className="mt-3 text-sm leading-7 text-mist/68">
                Use reels de referencia locais apenas para extrair padroes de
                ritmo, transicao, captions, narracao e energia sem copiar o
                conteudo original.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/65">
                template {activeTemplateId}
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/65">
                source {editingReferenceSuggestionsSource}
              </span>
              <a
                href="/editing-references"
                className="rounded-full border border-[#f4c67a]/30 bg-[#f4c67a]/12 px-4 py-2 text-xs text-[#ffefc8]"
              >
                Abrir biblioteca de referencias
              </a>
            </div>
          </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Preset aplicado
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {appliedEditingReferencePresetName ??
                    leadingEditingReferenceSuggestion?.preset.name ??
                    "Sem preset editorial aplicado"}
                </p>
                <p className="mt-2 text-sm leading-7 text-mist/68">
                  {appliedEditingStyleSummary
                    ? "O projeto ja carrega um preset editorial persistido e o blueprint usa esse resumo para ritmo, caption, narracao, audio e microclip."
                    : leadingEditingReferenceSuggestion?.preset.description ??
                      "Cadastre uma referencia local e gere um preset para orientar cortes, captions e audio do projeto."}
                </p>
                {appliedEditingStyleSummary ? (
                  <>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                        applied
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-mist/70">
                        presetId {appliedEditingReferencePresetId ?? "n/a"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-mist/70">
                        useCase {appliedEditingStyleSummary.useCase}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-mist/70">
                        pace {formatDuration(appliedEditingStyleSummary.cutPace)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-mist/70">
                        zoom {appliedEditingStyleSummary.zoomStyle}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-mist/70">
                        caption {appliedEditingStyleSummary.captionStyle}
                      </span>
                    </div>
                    <p className="mt-4 text-xs leading-6 text-mist/60">
                      transicao {appliedEditingStyleSummary.transitionStyle} / flash{" "}
                      {appliedEditingStyleSummary.flashStyle} / hook{" "}
                      {appliedEditingStyleSummary.hookStyle} / notes{" "}
                      {appliedEditingStyleSummary.notes ?? "n/d"}
                    </p>
                  </>
                ) : leadingEditingReferenceSuggestion ? (
                  <>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#f4c67a]/25 bg-[#f4c67a]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#ffefc8]">
                        {leadingEditingReferenceSuggestion.origin}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-mist/70">
                        useCase {leadingEditingReferenceSuggestion.preset.useCase}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-mist/70">
                        pace {formatDuration(leadingEditingReferenceSuggestion.preset.cutPace)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-mist/70">
                        zoom {leadingEditingReferenceSuggestion.preset.zoomStyle}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-mist/70">
                        caption {leadingEditingReferenceSuggestion.preset.captionStyle}
                      </span>
                    </div>
                    <p className="mt-4 text-xs leading-6 text-mist/60">
                      {leadingEditingReferenceSuggestion.reason}
                    </p>
                  </>
                ) : null}
              </div>

              <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                  Aplicacao ativa
                </p>
                <div className="mt-3 space-y-3 text-sm text-mist/72">
                  <p>
                    Narracao:{" "}
                    <span className="text-white">
                      {appliedEditingStyleSummary?.narrationStyle ??
                        leadingEditingReferenceSuggestion?.preset.narrationStyle ??
                        "n/d"}
                    </span>
                  </p>
                  <p>
                    Musica:{" "}
                    <span className="text-white">
                      {appliedEditingStyleSummary?.musicStyle ??
                        leadingEditingReferenceSuggestion?.preset.musicStyle ??
                        "n/d"}
                    </span>
                  </p>
                  <p>
                    SFX:{" "}
                    <span className="text-white">
                      {appliedEditingStyleSummary?.sfxStyle ??
                        leadingEditingReferenceSuggestion?.preset.sfxStyle ??
                        "n/d"}
                    </span>
                  </p>
                  <p>
                    Microclip:{" "}
                    <span className="text-white">
                      {appliedEditingStyleSummary?.microclipPlacement ??
                        leadingEditingReferenceSuggestion?.preset.microclipPlacement ??
                        "n/d"}
                    </span>
                  </p>
                  <p>
                    Audio mastering:{" "}
                    <span className="text-white">
                      {appliedEditingStyleSummary?.recommendedAudioMasteringPresetId ??
                        leadingEditingReferenceSuggestion?.preset.recommendedAudioMasteringPresetId ??
                        "n/d"}
                    </span>
                  </p>
                  <p>
                    Voice pack:{" "}
                    <span className="text-white">
                      {appliedEditingStyleSummary?.recommendedNarrationVoicePackId ??
                        leadingEditingReferenceSuggestion?.preset.recommendedNarrationVoicePackId ??
                        "n/d"}
                    </span>
                  </p>
                  <p>
                    Shot target:{" "}
                    <span className="text-white">
                      {formatDuration(
                        appliedEditingStyleSummary?.defaultShotDurationSeconds ??
                          leadingEditingReferenceSuggestion?.preset.defaultShotDurationSeconds ??
                          null
                      )}
                    </span>
                  </p>
                  <p>
                    CTA / hook:{" "}
                    <span className="text-white">
                      {(appliedEditingStyleSummary?.hookStyle ??
                        leadingEditingReferenceSuggestion?.preset.hookStyle ??
                        "n/d") +
                        " / " +
                        (appliedEditingStyleSummary?.ctaStyle ??
                          leadingEditingReferenceSuggestion?.preset.ctaStyle ??
                          "n/d")}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {editingReferenceSuggestions.length > 0 ? (
                editingReferenceSuggestions.slice(0, 3).map((suggestion) => (
                  <div
                    key={`${suggestion.origin}-${suggestion.preset.slug}`}
                    className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">
                        {suggestion.preset.name}
                      </p>
                      {appliedEditingReferencePresetId === suggestion.preset.id ? (
                        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">
                          current
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs leading-6 text-mist/65">
                      {suggestion.preset.transitionStyle} / {suggestion.preset.flashStyle} /{" "}
                      {suggestion.preset.hookStyle} / CTA {suggestion.preset.ctaStyle}
                    </p>
                  <p className="mt-3 text-xs leading-6 text-mist/60">
                    templates {suggestion.preset.recommendedTemplates.join(", ") || "n/d"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/20 p-6 text-sm text-mist/55 md:col-span-3">
                Nenhum preset editorial sugerido para o template atual. Cadastre
                uma referencia local em `/editing-references` para criar um
                preset reutilizavel do seu nicho.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[1.9rem] border border-[#7be0ff]/20 bg-[#7be0ff]/8 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist/55">
                Music Library
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Preset musical e Beat Sync
              </h2>
              <p className="mt-3 text-sm leading-7 text-mist/68">
                Selecao local de musica autorizada com plano ritmico para cortes,
                flashes e microclips.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-mist/65">
              beat sync {beatSyncPlanSource}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Music preset efetivo
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                {selectedMusicPreset.name}
              </p>
              <p className="mt-2 text-xs leading-6 text-mist/65">
                {selectedMusicPreset.id} / bpm{" "}
                {selectedMusicPreset.bpmRange
                  ? `${selectedMusicPreset.bpmRange.min}-${selectedMusicPreset.bpmRange.max}`
                  : "livre"}{" "}
                / mastering {selectedMusicPreset.recommendedAudioMasteringPresetId}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
                Asset musical atual
              </p>
              <p className="mt-2 text-sm font-medium text-white">
                {selectedMusicAsset?.filename ?? "Sem musica aplicada"}
              </p>
              <p className="mt-2 text-xs leading-6 text-mist/65">
                assetId {selectedMusicAsset?.id ?? "n/a"} / license{" "}
                {selectedMusicAsset?.musicProfile?.licenseStatus ?? "n/a"} / bpm{" "}
                {selectedMusicAsset?.musicProfile?.bpm ?? "n/a"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-mist/45">
              Beat Sync Plan
            </p>
            <p className="mt-2 text-sm text-white">
              confidence {(musicBeatSyncPlan?.confidence ?? 0).toFixed(2)} / cut
              times {musicBeatSyncPlan?.suggestedCutTimes.length ?? 0} / flashes{" "}
              {musicBeatSyncPlan?.suggestedFlashTimes.length ?? 0} / SFX cues{" "}
              {musicBeatSyncPlan?.suggestedSfxCues.length ?? 0}
            </p>
            <p className="mt-2 text-xs leading-6 text-mist/65">
              intro {formatDuration(musicBeatSyncPlan?.introBeatTime ?? null)} /
              climax {formatDuration(musicBeatSyncPlan?.climaxBeatTime ?? null)} /
              outro {formatDuration(musicBeatSyncPlan?.outroBeatTime ?? null)}
            </p>
            <p className="mt-2 text-xs leading-6 text-mist/60">
              beat markers {musicBeatSyncPlan?.beatMarkersUsed.length ?? 0} / cues{" "}
              {(beatSyncPlan?.beatSyncPlan?.suggestedSfxCues ?? []).length} / music
              warnings {musicWarnings.length}
            </p>
          </div>

          {musicWarnings.length > 0 ? (
            <div className="mt-4 space-y-2">
              {musicWarnings.map((warning) => (
                <div
                  key={warning}
                  className="rounded-[1rem] border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
                >
                  {warning}
                </div>
              ))}
            </div>
          ) : null}
        </article>

        <RenderJobsPanel
          projectId={project.id}
          selectedAudioMasteringPresetId={selectedAudioMasteringPreset.id}
          onSelectAudioMasteringPreset={setAudioMasteringPresetId}
          audioMasteringPreview={audioMasteringPreview}
        />

        <RenderBlueprintPanel
          blueprint={blueprint}
          source={blueprintSource}
          loading={blueprintLoading}
          onLoad={handleLoadBlueprint}
          audioMasteringPreview={audioMasteringPreview}
        />
      </aside>
    </div>
  );
}
