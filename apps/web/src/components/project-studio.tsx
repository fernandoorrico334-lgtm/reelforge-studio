"use client";

import {
  getCaptionStyleById,
  getCaptionStyles
} from "@reelforge/caption-engine";
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
import { StoryEnginePanel } from "./story-engine-panel";
import {
  createSceneRequest,
  deleteSceneRequest,
  generateSceneVisualRequest,
  getProjectCaptionAnalysisSnapshot,
  getProjectProductionChecklistSnapshot,
  getProjectRenderBlueprintSnapshot,
  getSceneGeneratedImagesRequest,
  markVisualGenerationJobReviewedRequest,
  regenerateVisualGenerationJobRequest,
  reorderScenesRequest,
  useGeneratedImageForSceneRequest,
  updateProjectRequest,
  updateSceneRequest
} from "../lib/studio-api";
import {
  buildProjectStoryAnalysis,
  cinematicPresetsCatalog,
  resolveScenePresetPreview
} from "../lib/project-story-analysis";
import type {
  CaptionPosition,
  CaptionStyleId,
  ComfyWorkflowPack,
  DataSource,
  EmotionTag,
  GeneratedImageGalleryItem,
  ImageQualityPreset,
  ProjectCaptionAnalysisResponse,
  ProjectPayload,
  ProjectProductionChecklistResponse,
  ProjectScene,
  ProjectStatus,
  RenderBlueprintResponse,
  ScenePayload,
  StudioAsset,
  StudioChannel,
  StudioProject,
  VisualGenerationJob
} from "../lib/studio-types";
import { captionPositions, emotionTags, projectStatuses } from "../lib/studio-types";
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

const captionStylesCatalog = getCaptionStyles();
const templateCatalog = getTemplates();

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

function toProjectFormState(project: StudioProject): ProjectFormState {
  return {
    title: project.title,
    status: project.status,
    channelId: project.channelId,
    script: project.script ?? "",
    durationTarget: project.durationTarget?.toString() ?? "",
    format: project.format,
    templateId: project.templateId ?? "",
    defaultCaptionStyle: project.defaultCaptionStyle ?? ""
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
    defaultCaptionStyle: form.defaultCaptionStyle || null
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
  initialGeneratedImagesSource
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

  const orderedScenes = sortScenes(project.scenes);
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

  function resetSceneComposer(nextOrder?: number) {
    setEditingSceneId(null);
    setSceneForm(createEmptySceneForm(nextOrder ?? project.scenes.length + 1));
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

              return (
                <article
                  key={scene.id}
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

                  <div className="mt-4 grid gap-4 xl:grid-cols-4">
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

                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
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
                ativos {generatedVisualCount} / fonte {productionChecklistSource}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {qualityAlerts.length > 0 ? (
              qualityAlerts.map((alert) => (
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

        <RenderBlueprintPanel
          blueprint={blueprint}
          source={blueprintSource}
          loading={blueprintLoading}
          onLoad={handleLoadBlueprint}
        />
      </aside>
    </div>
  );
}
