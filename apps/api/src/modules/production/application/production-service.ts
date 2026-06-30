import { getAudioMoodPresetById } from "@reelforge/audio-engine";
import {
  buildProductionChecklist,
  createScenesFromScript,
  suggestAssetsForScene,
  type ProductionChecklist,
  type StoryAssetSuggestion
} from "@reelforge/story-engine";
import { NotFoundError } from "../../../shared/errors.js";
import type { AssetRepository } from "../../assets/application/asset-repository.js";
import type { StudioAsset } from "../../assets/domain/asset.js";
import type { ChannelRepository } from "../../channels/application/channel-repository.js";
import type { StudioChannel } from "../../channels/domain/channel.js";
import {
  createProjectScene,
  createVideoProject,
  getVideoProjectById,
  updateProjectScene,
  updateVideoProject
} from "../../projects/application/project-service.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type { StudioProject } from "../../projects/domain/project.js";
import type { CreateProductionFromScriptInput } from "../domain/production.js";

function toChecklistProject(project: StudioProject) {
  return {
    id: project.id,
    title: project.title,
    channelId: project.channelId,
    script: project.script,
    durationTarget: project.durationTarget,
    templateId: project.templateId,
    defaultCaptionStyle: project.defaultCaptionStyle,
    backgroundMusicAssetId: project.backgroundMusicAssetId,
    voiceoverAssetId: project.voiceoverAssetId,
    audioMood: project.audioMood,
    scenes: project.scenes.map((scene) => ({
      id: scene.id,
      order: scene.order,
      title: scene.title,
      duration: scene.duration,
      captionText: scene.captionText,
      assetId: scene.assetId,
      visualPreset: scene.visualPreset,
      emotion: scene.emotion
    }))
  };
}

function toChecklistChannel(channel: StudioChannel | null) {
  if (!channel) {
    return null;
  }

  return {
    defaultTemplate: channel.defaultTemplate,
    defaultRenderMode: channel.defaultRenderMode,
    defaultRenderQuality: channel.defaultRenderQuality,
    defaultAudioMood: channel.defaultAudioMood,
    defaultCaptionStyle: channel.defaultCaptionStyle,
    defaultVisualPreset: channel.defaultVisualPreset,
    defaultMusicAssetId: channel.defaultMusicAssetId,
    defaultVoiceoverAssetId: channel.defaultVoiceoverAssetId,
    defaultDurationTarget: channel.defaultDurationTarget,
    defaultSceneDuration: channel.defaultSceneDuration
  };
}

function toSuggestionAsset(asset: StudioAsset) {
  return {
    id: asset.id,
    filename: asset.filename,
    type: asset.type,
    category: asset.category,
    franchise: asset.franchise,
    character: asset.character,
    emotion: asset.emotion,
    tags: asset.tags,
    recommendedUse: asset.recommendedUse
  };
}

function toSuggestionChannel(channel: StudioChannel) {
  return {
    name: channel.name,
    niche: channel.niche,
    narrativeTone: channel.narrativeTone,
    preferredAssetCategories: channel.preferredAssetCategories,
    preferredAssetTags: channel.preferredAssetTags
  };
}

function mapSuggestion(
  assetSuggestions: StoryAssetSuggestion[],
  assetMap: Map<string, StudioAsset>
) {
  return assetSuggestions.map((suggestion) => ({
    ...suggestion,
    asset: assetMap.get(suggestion.assetId) ?? null
  }));
}

async function requireChannel(
  channelRepository: ChannelRepository,
  channelId: string
) {
  const channel = await channelRepository.getById(channelId);

  if (!channel) {
    throw new NotFoundError(`Channel '${channelId}' was not found.`);
  }

  return channel;
}

function buildChecklist(
  project: StudioProject,
  channel: StudioChannel | null
): ProductionChecklist {
  return buildProductionChecklist(
    toChecklistProject(project),
    toChecklistChannel(channel)
  );
}

async function buildProjectAssetSuggestions(
  project: StudioProject,
  channel: StudioChannel,
  assetRepository: AssetRepository
) {
  const assets = await assetRepository.list();
  const assetMap = new Map(assets.map((asset) => [asset.id, asset] as const));

  return project.scenes
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((scene, index, orderedScenes) => {
      const recentlyUsedAssetIds = orderedScenes
        .slice(0, index)
        .map((entry) => entry.assetId)
        .filter((assetId): assetId is string => Boolean(assetId));
      const suggestions = suggestAssetsForScene(
        {
          id: scene.id,
          order: scene.order,
          title: scene.title,
          narrationText: scene.narrationText,
          captionText: scene.captionText,
          emotion: scene.emotion,
          suggestedRole: null
        },
        assets.map(toSuggestionAsset),
        toSuggestionChannel(channel),
        {
          limit: 5,
          recentlyUsedAssetIds
        }
      );

      return {
        sceneId: scene.id,
        order: scene.order,
        title: scene.title,
        emotion: scene.emotion,
        currentAssetId: scene.assetId,
        currentAsset: scene.asset,
        suggestions: mapSuggestion(suggestions, assetMap)
      };
    });
}

export async function getVideoProjectProductionChecklist(
  projectRepository: ProjectRepository,
  channelRepository: ChannelRepository,
  projectId: string
) {
  const project = await getVideoProjectById(projectRepository, projectId);
  const channel = await channelRepository.getById(project.channelId);

  return {
    projectId,
    checklist: buildChecklist(project, channel)
  };
}

export async function getVideoProjectAssetSuggestions(
  projectRepository: ProjectRepository,
  channelRepository: ChannelRepository,
  assetRepository: AssetRepository,
  projectId: string
) {
  const project = await getVideoProjectById(projectRepository, projectId);
  const channel = await requireChannel(channelRepository, project.channelId);

  return {
    projectId,
    channelId: channel.id,
    scenes: await buildProjectAssetSuggestions(project, channel, assetRepository)
  };
}

export async function applyChannelDefaultsToProject(
  projectRepository: ProjectRepository,
  channelRepository: ChannelRepository,
  assetRepository: AssetRepository,
  projectId: string
) {
  const project = await getVideoProjectById(projectRepository, projectId);
  const channel = await requireChannel(channelRepository, project.channelId);
  const projectPatch: Parameters<typeof updateVideoProject>[4] = {};

  if (!project.templateId && channel.defaultTemplate) {
    projectPatch.templateId = channel.defaultTemplate;
  }

  if (!project.defaultCaptionStyle && channel.defaultCaptionStyle) {
    projectPatch.defaultCaptionStyle = channel.defaultCaptionStyle;
  }

  if (!project.backgroundMusicAssetId && channel.defaultMusicAssetId) {
    projectPatch.backgroundMusicAssetId = channel.defaultMusicAssetId;
  }

  if (!project.voiceoverAssetId && channel.defaultVoiceoverAssetId) {
    projectPatch.voiceoverAssetId = channel.defaultVoiceoverAssetId;
  }

  if (!project.audioMood && channel.defaultAudioMood) {
    projectPatch.audioMood = channel.defaultAudioMood;
  }

  if (!project.durationTarget && channel.defaultDurationTarget) {
    projectPatch.durationTarget = channel.defaultDurationTarget;
  }

  const projectFieldsApplied = Object.keys(projectPatch);

  if (projectFieldsApplied.length > 0) {
    await updateVideoProject(
      projectRepository,
      channelRepository,
      assetRepository,
      projectId,
      projectPatch
    );
  }

  let scenesUpdated = 0;

  for (const scene of project.scenes) {
    const scenePatch: Parameters<typeof updateProjectScene>[4] = {};

    if (
      (scene.duration === null || scene.duration === undefined) &&
      channel.defaultSceneDuration
    ) {
      scenePatch.duration = channel.defaultSceneDuration;
    }

    if (!scene.visualPreset && channel.defaultVisualPreset) {
      scenePatch.visualPreset = channel.defaultVisualPreset;
    }

    if (Object.keys(scenePatch).length > 0) {
      await updateProjectScene(
        projectRepository,
        assetRepository,
        projectId,
        scene.id,
        scenePatch
      );
      scenesUpdated += 1;
    }
  }

  const updatedProject = await getVideoProjectById(projectRepository, projectId);

  return {
    project: updatedProject,
    projectFieldsApplied,
    scenesUpdated,
    checklist: buildChecklist(updatedProject, channel)
  };
}

export async function createProductionFromScript(
  projectRepository: ProjectRepository,
  channelRepository: ChannelRepository,
  assetRepository: AssetRepository,
  input: CreateProductionFromScriptInput
) {
  const channel = await requireChannel(channelRepository, input.channelId);
  const effectiveDurationTarget =
    input.durationTarget ??
    (input.applyChannelDefaults ? channel.defaultDurationTarget : null) ??
    30;
  const effectiveSceneDuration =
    input.sceneDuration ??
    (input.applyChannelDefaults ? channel.defaultSceneDuration : null) ??
    4;
  const audioMoodPreset = input.applyChannelDefaults
    ? getAudioMoodPresetById(channel.defaultAudioMood)
    : null;
  const sceneDrafts = createScenesFromScript(input.script, {
    durationTarget: effectiveDurationTarget,
    defaultSceneDuration: effectiveSceneDuration,
    defaultVisualPreset:
      input.applyChannelDefaults ? channel.defaultVisualPreset : null,
    defaultCaptionStyle:
      input.applyChannelDefaults ? channel.defaultCaptionStyle : null
  });

  const createdProject = await createVideoProject(
    projectRepository,
    channelRepository,
    assetRepository,
    {
      title: input.title,
      status: input.status,
      channelId: channel.id,
      script: input.script,
      durationTarget: effectiveDurationTarget,
      format: input.format,
      templateId: input.applyChannelDefaults ? channel.defaultTemplate : null,
      defaultCaptionStyle: input.applyChannelDefaults
        ? channel.defaultCaptionStyle
        : null,
      backgroundMusicAssetId: input.applyChannelDefaults
        ? channel.defaultMusicAssetId
        : null,
      voiceoverAssetId: input.applyChannelDefaults
        ? channel.defaultVoiceoverAssetId
        : null,
      audioMood: input.applyChannelDefaults ? channel.defaultAudioMood : null,
      musicVolume: audioMoodPreset?.recommendedMusicVolume ?? 0.18,
      voiceVolume: audioMoodPreset?.recommendedVoiceVolume ?? 1,
      sfxVolume: audioMoodPreset?.recommendedSfxVolume ?? 0.7,
      enableAudioDucking:
        input.applyChannelDefaults &&
        Boolean(channel.defaultMusicAssetId && channel.defaultVoiceoverAssetId) &&
        audioMoodPreset?.duckingStrategy === "bed_under_voice",
      duckingLevel: 0.35
    }
  );

  const assets = await assetRepository.list();
  const assetMap = new Map(assets.map((asset) => [asset.id, asset] as const));
  const recentlyUsedAssetIds: string[] = [];
  const createdScenes = [];

  for (const sceneDraft of input.autoCreateScenes ? sceneDrafts : []) {
    const assetSuggestions = suggestAssetsForScene(
      {
        id: sceneDraft.id,
        order: sceneDraft.order,
        title: sceneDraft.title,
        narrationText: sceneDraft.narrationText,
        captionText: sceneDraft.captionText,
        emotion: sceneDraft.emotion,
        suggestedRole: sceneDraft.suggestedRole
      },
      assets.map(toSuggestionAsset),
      toSuggestionChannel(channel),
      {
        limit: 5,
        recentlyUsedAssetIds
      }
    );
    const chosenAssetId =
      input.autoSuggestAssets === false ? null : assetSuggestions[0]?.assetId ?? null;

    if (chosenAssetId) {
      recentlyUsedAssetIds.push(chosenAssetId);
    }

    const createdScene = await createProjectScene(
      projectRepository,
      assetRepository,
      createdProject.id,
      {
        order: sceneDraft.order,
        title: sceneDraft.title,
        narrationText: sceneDraft.narrationText,
        captionText: sceneDraft.captionText,
        duration: sceneDraft.duration,
        emotion: sceneDraft.emotion,
        assetId: chosenAssetId,
        generatedAssetId: null,
        characterProfileId: null,
        sfxAssetId: null,
        sfxStartTime: 0,
        sfxVolume: 0.7,
        visualPreset: sceneDraft.suggestedPresetId,
        visualSourceMode: null,
        visualPrompt: null,
        negativePrompt: null,
        visualRecipe: null,
        generationStatus: null,
        generationProvider: null,
        generationSeed: null,
        transition: sceneDraft.transitionHint,
        captionStyle: sceneDraft.captionStyle,
        captionPosition: null,
        captionEmphasisWords: [],
        energyLevel: sceneDraft.energyLevel
      }
    );

    createdScenes.push({
      sceneId: createdScene.id,
      draft: sceneDraft,
      selectedAssetId: chosenAssetId,
      suggestions: mapSuggestion(assetSuggestions, assetMap)
    });
  }

  const hydratedProject = await getVideoProjectById(
    projectRepository,
    createdProject.id
  );

  return {
    project: hydratedProject,
    checklist: buildChecklist(hydratedProject, channel),
    scenesCreated: createdScenes.length,
    autoAssignedAssets: createdScenes.filter((scene) => scene.selectedAssetId).length,
    scenes: createdScenes
  };
}

