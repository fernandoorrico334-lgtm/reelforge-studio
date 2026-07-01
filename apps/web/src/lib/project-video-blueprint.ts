import { buildAudioMixPlan } from "@reelforge/audio-engine";
import {
  buildProjectCaptionAnalysis,
  buildRenderBlueprint,
  type BlueprintProjectInput,
  type ProjectCaptionAnalysis,
  type RenderBlueprint as EngineRenderBlueprint
} from "@reelforge/video-engine";
import type {
  ProjectAudioPlanResponse,
  RenderBlueprintResponse,
  StudioAsset,
  StudioProject
} from "./studio-types";

function resolveAssetById(assets: StudioAsset[], assetId: string | null) {
  if (!assetId) {
    return null;
  }

  return assets.find((asset) => asset.id === assetId) ?? null;
}

function mapBlueprintAsset(asset: StudioAsset | null) {
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    filename: asset.filename,
    originalName: asset.originalName,
    path: asset.path,
    type: asset.type,
    category: asset.category,
    franchise: asset.franchise,
    character: asset.character,
    emotion: asset.emotion,
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
    extension: asset.extension,
    sourceProvider: asset.sourceProvider
  };
}

function toBlueprintProjectInput(
  project: StudioProject,
  assetsCatalog: StudioAsset[] = []
): BlueprintProjectInput {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    channelId: project.channelId,
    channel: {
      id: project.channel.id,
      name: project.channel.name,
      niche: project.channel.niche,
      language: project.channel.language,
      visualStyle: project.channel.visualStyle,
      narrativeTone: project.channel.narrativeTone,
      defaultTemplate: project.channel.defaultTemplate,
      defaultRenderMode: project.channel.defaultRenderMode,
      defaultRenderQuality: project.channel.defaultRenderQuality,
      defaultAudioMood: project.channel.defaultAudioMood,
      defaultCaptionStyle: project.channel.defaultCaptionStyle,
      defaultVisualPreset: project.channel.defaultVisualPreset,
      defaultMusicAssetId: project.channel.defaultMusicAssetId,
      defaultVoiceoverAssetId: project.channel.defaultVoiceoverAssetId,
      defaultDurationTarget: project.channel.defaultDurationTarget,
      defaultSceneDuration: project.channel.defaultSceneDuration,
      preferredAssetCategories: [...project.channel.preferredAssetCategories],
      preferredAssetTags: [...project.channel.preferredAssetTags],
      createdAt: project.channel.createdAt,
      updatedAt: project.channel.updatedAt
    },
    script: project.script,
    durationTarget: project.durationTarget,
    format: project.format,
    templateId: project.templateId ?? null,
    defaultCaptionStyle: project.defaultCaptionStyle ?? null,
    backgroundMusicAssetId: project.backgroundMusicAssetId ?? null,
    backgroundMusicAsset: mapBlueprintAsset(
      resolveAssetById(assetsCatalog, project.backgroundMusicAssetId ?? null)
    ),
    voiceoverAssetId: project.voiceoverAssetId ?? null,
    voiceoverAsset: mapBlueprintAsset(
      resolveAssetById(assetsCatalog, project.voiceoverAssetId ?? null)
    ),
    audioMood: project.audioMood ?? null,
    musicVolume: project.musicVolume ?? 0.18,
    voiceVolume: project.voiceVolume ?? 1,
    sfxVolume: project.sfxVolume ?? 0.7,
    enableAudioDucking: project.enableAudioDucking ?? false,
    duckingLevel: project.duckingLevel ?? 0.35,
    scenes: [...project.scenes].map((scene) => ({
      id: scene.id,
      order: scene.order,
      title: scene.title,
      narrationText: scene.narrationText,
      captionText: scene.captionText,
      duration: scene.duration,
      emotion: scene.emotion,
      assetId: scene.assetId,
      asset: mapBlueprintAsset(scene.asset),
      generatedAssetId: scene.generatedAssetId ?? null,
      generatedAsset: mapBlueprintAsset(scene.generatedAsset ?? null),
      generatedNarrationAssetId: scene.generatedNarrationAssetId ?? null,
      generatedNarrationAsset: mapBlueprintAsset(
        scene.generatedNarrationAsset ??
          resolveAssetById(assetsCatalog, scene.generatedNarrationAssetId ?? null)
      ),
      narrationStatus: scene.narrationStatus ?? null,
      narrationProvider: scene.narrationProvider ?? null,
      narrationVoicePackId: scene.narrationVoicePackId ?? null,
      sfxAssetId: scene.sfxAssetId ?? null,
      sfxAsset: mapBlueprintAsset(
        resolveAssetById(assetsCatalog, scene.sfxAssetId ?? null)
      ),
      sfxStartTime: scene.sfxStartTime ?? 0,
      sfxVolume: scene.sfxVolume ?? 0.7,
      visualPreset: scene.visualPreset,
      visualSourceMode: scene.visualSourceMode ?? null,
      transition: scene.transition ?? null,
      captionStyle: scene.captionStyle ?? null,
      captionPosition: scene.captionPosition ?? null,
      captionEmphasisWords: [...(scene.captionEmphasisWords ?? [])],
      energyLevel: scene.energyLevel ?? null
    }))
  };
}

function normalizeEffectiveAssetSource(
  source:
    | "project_asset"
    | "generated_asset"
    | "fallback_generated"
    | "missing"
): RenderBlueprintResponse["scenes"][number]["effectiveAssetSource"] {
  switch (source) {
    case "project_asset":
      return "asset";
    case "generated_asset":
      return "generated";
    case "fallback_generated":
      return "fallback_generated";
    default:
      return "placeholder";
  }
}

function inferRenderReadyVisual(
  scene: EngineRenderBlueprint["scenes"][number]
): boolean {
  if (!scene.effectiveAsset) {
    return false;
  }

  if (scene.effectiveAssetSource === "generated_asset") {
    return true;
  }

  const extension = scene.effectiveAsset.extension?.toLowerCase() ?? "";
  const mimeType = scene.effectiveAsset.mimeType?.toLowerCase() ?? "";

  return (
    ["png", "jpg", "jpeg", "webp", "bmp"].includes(extension) ||
    mimeType.startsWith("image/")
  );
}

function normalizeRenderBlueprintResponse(
  blueprint: EngineRenderBlueprint
): RenderBlueprintResponse {
  return {
    ...blueprint,
    scenes: blueprint.scenes.map((scene) => {
      const effectiveAssetSource = normalizeEffectiveAssetSource(
        scene.effectiveAssetSource
      );

      return {
        ...scene,
        assetId: scene.assetId ?? (effectiveAssetSource === "asset" ? scene.effectiveAssetId : null),
        asset: scene.asset ?? null,
        generatedAssetId:
          scene.generatedAssetId ??
          (effectiveAssetSource === "generated" ? scene.effectiveAssetId : null),
        generatedAsset:
          scene.generatedAsset ??
          (effectiveAssetSource === "generated" ? scene.effectiveAsset : null),
        effectiveVisualSource: effectiveAssetSource,
        effectiveAssetSource,
        visualSourceMode: scene.visualSourceMode ?? null,
        effectiveAssetReason: scene.effectiveAsset
          ? effectiveAssetSource === "generated"
            ? "Visual gerado promovido como asset efetivo."
            : effectiveAssetSource === "fallback_generated"
              ? "Blueprint resolveu a cena via estrategia de fallback visual."
            : "Asset do projeto usado como fonte efetiva."
          : "Cena sem asset efetivo associado.",
        renderReadyVisual: inferRenderReadyVisual(scene)
      };
    })
  } as RenderBlueprintResponse;
}

export function buildLocalProjectCaptionAnalysis(
  project: StudioProject,
  assetsCatalog: StudioAsset[] = []
): ProjectCaptionAnalysis {
  return buildProjectCaptionAnalysis(toBlueprintProjectInput(project, assetsCatalog));
}

export function buildLocalAudioPlan(
  project: StudioProject,
  assetsCatalog: StudioAsset[] = []
): ProjectAudioPlanResponse {
  const audioAssets = [
    resolveAssetById(assetsCatalog, project.backgroundMusicAssetId ?? null),
    resolveAssetById(assetsCatalog, project.voiceoverAssetId ?? null),
    ...project.scenes.map((scene) =>
      resolveAssetById(assetsCatalog, scene.generatedNarrationAssetId ?? null)
    ),
    ...project.scenes.map((scene) =>
      resolveAssetById(assetsCatalog, scene.sfxAssetId ?? null)
    )
  ]
    .filter((asset): asset is StudioAsset => asset !== null)
    .map((asset) => ({
      id: asset.id,
      filename: asset.filename,
      path: asset.path,
      type: asset.type,
      duration: asset.duration,
      mimeType: asset.mimeType,
      extension: asset.extension
    }));

  return buildAudioMixPlan(
    {
      id: project.id,
      title: project.title,
      durationTarget: project.durationTarget,
      backgroundMusicAssetId: project.backgroundMusicAssetId ?? null,
      voiceoverAssetId: project.voiceoverAssetId ?? null,
      audioMood: project.audioMood ?? null,
      musicVolume: project.musicVolume ?? null,
      voiceVolume: project.voiceVolume ?? null,
      sfxVolume: project.sfxVolume ?? null,
      enableAudioDucking: project.enableAudioDucking ?? null,
      duckingLevel: project.duckingLevel ?? null
    },
    project.scenes.map((scene) => ({
      id: scene.id,
      order: scene.order,
      title: scene.title,
      duration: scene.duration,
      sfxAssetId: scene.sfxAssetId ?? null,
      sfxStartTime: scene.sfxStartTime ?? null,
      sfxVolume: scene.sfxVolume ?? null
    })),
    [...new Map(audioAssets.map((asset) => [asset.id, asset] as const)).values()]
  );
}

export function buildLocalRenderBlueprint(
  project: StudioProject,
  assetsCatalog: StudioAsset[] = []
): RenderBlueprintResponse {
  return normalizeRenderBlueprintResponse(
    buildRenderBlueprint(toBlueprintProjectInput(project, assetsCatalog))
  );
}

