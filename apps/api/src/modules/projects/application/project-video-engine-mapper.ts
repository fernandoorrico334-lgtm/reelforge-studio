import type {
  BlueprintAssetInput,
  BlueprintProjectInput,
  BlueprintSceneInput
} from "@reelforge/video-engine";
import type { StudioAsset } from "../../assets/domain/asset.js";
import type { ProjectScene, StudioProject } from "../domain/project.js";

interface ProjectAudioAssetMap {
  backgroundMusicAsset: StudioAsset | null;
  voiceoverAsset: StudioAsset | null;
  sceneSfxAssets: Record<string, StudioAsset | null>;
}

function mapAsset(asset: StudioAsset | null): BlueprintAssetInput | null {
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
    extension: asset.extension
  };
}

function mapScene(scene: ProjectScene): BlueprintSceneInput {
  return {
    id: scene.id,
    order: scene.order,
    title: scene.title,
    narrationText: scene.narrationText,
    captionText: scene.captionText,
    duration: scene.duration,
    emotion: scene.emotion,
    assetId: scene.assetId,
    asset: mapAsset(scene.asset),
    generatedAssetId: scene.generatedAssetId,
    generatedAsset: mapAsset(scene.generatedAsset),
    sfxAssetId: scene.sfxAssetId,
    sfxAsset: null,
    sfxStartTime: scene.sfxStartTime,
    sfxVolume: scene.sfxVolume,
    visualPreset: scene.visualPreset,
    transition: scene.transition,
    captionStyle: scene.captionStyle,
    captionPosition: scene.captionPosition,
    captionEmphasisWords: [...scene.captionEmphasisWords],
    energyLevel: scene.energyLevel
  };
}

export function mapProjectToBlueprintInput(
  project: StudioProject,
  audioAssets?: ProjectAudioAssetMap
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
    templateId: project.templateId,
    defaultCaptionStyle: project.defaultCaptionStyle,
    backgroundMusicAssetId: project.backgroundMusicAssetId,
    backgroundMusicAsset: mapAsset(audioAssets?.backgroundMusicAsset ?? null),
    voiceoverAssetId: project.voiceoverAssetId,
    voiceoverAsset: mapAsset(audioAssets?.voiceoverAsset ?? null),
    audioMood: project.audioMood,
    musicVolume: project.musicVolume,
    voiceVolume: project.voiceVolume,
    sfxVolume: project.sfxVolume,
    enableAudioDucking: project.enableAudioDucking,
    duckingLevel: project.duckingLevel,
    scenes: [...project.scenes]
      .sort((left, right) => left.order - right.order)
      .map((scene) => ({
        ...mapScene(scene),
        sfxAsset: mapAsset(audioAssets?.sceneSfxAssets[scene.id] ?? null)
      }))
  };
}

