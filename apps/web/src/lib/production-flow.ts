import { getAudioMoodPresetById } from "@reelforge/audio-engine";
import {
  buildProductionChecklist,
  createScenesFromScript,
  suggestAssetsForScene
} from "@reelforge/story-engine";
import {
  getSceneEffectiveAssetId,
  getSceneEffectiveAssetSource,
  sceneHasEffectiveAsset
} from "./effective-assets";
import type {
  ApplyChannelDefaultsResponse,
  AssetSuggestionMatch,
  CreateProductionFromScriptPayload,
  CreateProductionFromScriptResponse,
  ProjectAssetSuggestionsResponse,
  ProjectProductionChecklistResponse,
  ProjectScene,
  StudioAsset,
  StudioChannel,
  StudioProject
} from "./studio-types";

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function sortScenes(scenes: ProjectScene[]) {
  return [...scenes].sort((left, right) => left.order - right.order);
}

function buildSuggestionMatches(
  suggestions: ReturnType<typeof suggestAssetsForScene>,
  assetMap: Map<string, StudioAsset>
): AssetSuggestionMatch[] {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    asset: assetMap.get(suggestion.assetId) ?? null
  }));
}

function buildChecklist(project: StudioProject) {
  return buildProductionChecklist(
    {
      id: project.id,
      title: project.title,
      channelId: project.channelId,
      script: project.script,
      durationTarget: project.durationTarget,
      templateId: project.templateId ?? null,
      defaultCaptionStyle: project.defaultCaptionStyle ?? null,
      backgroundMusicAssetId: project.backgroundMusicAssetId ?? null,
      voiceoverAssetId: project.voiceoverAssetId ?? null,
      audioMood: project.audioMood ?? null,
      scenes: project.scenes.map((scene) => ({
        id: scene.id,
        order: scene.order,
        title: scene.title,
        duration: scene.duration,
        captionText: scene.captionText,
        assetId: scene.assetId,
        generatedAssetId: scene.generatedAssetId ?? null,
        visualSourceMode: scene.visualSourceMode ?? null,
        effectiveAssetId: getSceneEffectiveAssetId(scene),
        visualPreset: scene.visualPreset,
        emotion: scene.emotion
      }))
    },
    {
      defaultTemplate: project.channel.defaultTemplate,
      defaultRenderMode: project.channel.defaultRenderMode,
      defaultRenderQuality: project.channel.defaultRenderQuality,
      defaultAudioMood: project.channel.defaultAudioMood,
      defaultCaptionStyle: project.channel.defaultCaptionStyle,
      defaultVisualPreset: project.channel.defaultVisualPreset,
      defaultMusicAssetId: project.channel.defaultMusicAssetId,
      defaultVoiceoverAssetId: project.channel.defaultVoiceoverAssetId,
      defaultDurationTarget: project.channel.defaultDurationTarget,
      defaultSceneDuration: project.channel.defaultSceneDuration
    }
  );
}

export function buildLocalProductionChecklist(
  project: StudioProject
): ProjectProductionChecklistResponse {
  return {
    projectId: project.id,
    checklist: buildChecklist(project)
  };
}

export function buildLocalProjectAssetSuggestions(
  project: StudioProject,
  assets: StudioAsset[]
): ProjectAssetSuggestionsResponse {
  const assetMap = new Map(assets.map((asset) => [asset.id, asset] as const));

  return {
    projectId: project.id,
    channelId: project.channelId,
    scenes: sortScenes(project.scenes).map((scene, index, orderedScenes) => {
      const effectiveAssetId = getSceneEffectiveAssetId(scene);
      const effectiveAssetSource = getSceneEffectiveAssetSource(scene);
      const recentlyUsedAssetIds = orderedScenes
        .slice(0, index)
        .map((entry) => getSceneEffectiveAssetId(entry))
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
        assets.map((asset) => ({
          id: asset.id,
          filename: asset.filename,
          type: asset.type,
          category: asset.category,
          franchise: asset.franchise,
          character: asset.character,
          emotion: asset.emotion,
          tags: asset.tags,
          recommendedUse: asset.recommendedUse
        })),
        {
          name: project.channel.name,
          niche: project.channel.niche,
          narrativeTone: project.channel.narrativeTone,
          preferredAssetCategories: project.channel.preferredAssetCategories,
          preferredAssetTags: project.channel.preferredAssetTags
        },
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
        currentAssetId: effectiveAssetId,
        currentAsset:
          effectiveAssetSource === "generated"
            ? scene.generatedAsset ?? null
            : scene.asset ?? scene.generatedAsset ?? null,
        hasEffectiveVisual: sceneHasEffectiveAsset(scene),
        effectiveAssetId,
        effectiveAssetSource,
        generatedVisualReady:
          effectiveAssetSource === "generated" ||
          (effectiveAssetSource === "fallback" && !scene.assetId),
        suggestions: buildSuggestionMatches(suggestions, assetMap)
      };
    })
  };
}

export function applyLocalChannelDefaultsToProject(
  project: StudioProject,
  assets: StudioAsset[]
): ApplyChannelDefaultsResponse {
  const nextProject: StudioProject = {
    ...project,
    templateId: project.templateId ?? project.channel.defaultTemplate,
    defaultCaptionStyle:
      project.defaultCaptionStyle ?? project.channel.defaultCaptionStyle,
    backgroundMusicAssetId:
      project.backgroundMusicAssetId ?? project.channel.defaultMusicAssetId,
    voiceoverAssetId:
      project.voiceoverAssetId ?? project.channel.defaultVoiceoverAssetId,
    audioMood: project.audioMood ?? project.channel.defaultAudioMood,
    durationTarget:
      project.durationTarget ?? project.channel.defaultDurationTarget,
    scenes: sortScenes(
      project.scenes.map((scene) => ({
        ...scene,
        duration: scene.duration ?? project.channel.defaultSceneDuration,
        visualPreset: scene.visualPreset ?? project.channel.defaultVisualPreset
      }))
    )
  };

  return {
    project: nextProject,
    projectFieldsApplied: [
      !project.templateId && project.channel.defaultTemplate ? "templateId" : null,
      !project.defaultCaptionStyle && project.channel.defaultCaptionStyle
        ? "defaultCaptionStyle"
        : null,
      !project.backgroundMusicAssetId && project.channel.defaultMusicAssetId
        ? "backgroundMusicAssetId"
        : null,
      !project.voiceoverAssetId && project.channel.defaultVoiceoverAssetId
        ? "voiceoverAssetId"
        : null,
      !project.audioMood && project.channel.defaultAudioMood ? "audioMood" : null,
      !project.durationTarget && project.channel.defaultDurationTarget
        ? "durationTarget"
        : null
    ].filter((value): value is string => Boolean(value)),
    scenesUpdated: nextProject.scenes.filter(
      (scene, index) =>
        scene.duration !== project.scenes[index]?.duration ||
        scene.visualPreset !== project.scenes[index]?.visualPreset
    ).length,
    checklist: buildChecklist(nextProject)
  };
}

export function createLocalProductionFromScript(
  payload: CreateProductionFromScriptPayload,
  channels: StudioChannel[],
  assets: StudioAsset[]
): CreateProductionFromScriptResponse | null {
  const channel = channels.find((entry) => entry.id === payload.channelId);

  if (!channel) {
    return null;
  }

  const moodPreset = getAudioMoodPresetById(channel.defaultAudioMood);
  const durationTarget =
    payload.durationTarget ?? channel.defaultDurationTarget ?? 30;
  const sceneDuration =
    payload.sceneDuration ?? channel.defaultSceneDuration ?? 4;
  const draftScenes = createScenesFromScript(payload.script, {
    durationTarget,
    defaultSceneDuration: sceneDuration
  });
  const assetMap = new Map(assets.map((asset) => [asset.id, asset] as const));
  const recentlyUsedAssetIds: string[] = [];
  const now = new Date().toISOString();

  const scenes = draftScenes.map((draft) => {
    const suggestions = suggestAssetsForScene(
      {
        id: draft.id,
        order: draft.order,
        title: draft.title,
        narrationText: draft.narrationText,
        captionText: draft.captionText,
        emotion: draft.emotion,
        suggestedRole: draft.suggestedRole
      },
      assets.map((asset) => ({
        id: asset.id,
        filename: asset.filename,
        type: asset.type,
        category: asset.category,
        franchise: asset.franchise,
        character: asset.character,
        emotion: asset.emotion,
        tags: asset.tags,
        recommendedUse: asset.recommendedUse
      })),
      {
        name: channel.name,
        niche: channel.niche,
        narrativeTone: channel.narrativeTone,
        preferredAssetCategories: channel.preferredAssetCategories,
        preferredAssetTags: channel.preferredAssetTags
      },
      {
        limit: 5,
        recentlyUsedAssetIds
      }
    );
    const selectedAssetId =
      payload.autoAssignAssets === false ? null : suggestions[0]?.assetId ?? null;

    if (selectedAssetId) {
      recentlyUsedAssetIds.push(selectedAssetId);
    }

    return {
      draft,
      selectedAssetId,
      suggestions: buildSuggestionMatches(suggestions, assetMap)
    };
  });

  const localProject: StudioProject = {
    id: createLocalId("project"),
    title: payload.title,
    status: payload.status,
    channelId: channel.id,
    channel,
    script: payload.script,
    durationTarget,
    format: payload.format,
    templateId: channel.defaultTemplate,
    defaultCaptionStyle: channel.defaultCaptionStyle,
    backgroundMusicAssetId: channel.defaultMusicAssetId,
    voiceoverAssetId: channel.defaultVoiceoverAssetId,
    audioMood: channel.defaultAudioMood,
    musicVolume: moodPreset?.recommendedMusicVolume ?? 0.18,
    voiceVolume: moodPreset?.recommendedVoiceVolume ?? 1,
    sfxVolume: moodPreset?.recommendedSfxVolume ?? 0.7,
    enableAudioDucking:
      Boolean(channel.defaultMusicAssetId && channel.defaultVoiceoverAssetId) &&
      moodPreset?.duckingStrategy === "bed_under_voice",
    duckingLevel: 0.35,
    createdAt: now,
    updatedAt: now,
    scenes: scenes.map(({ draft, selectedAssetId }) => ({
      id: createLocalId("scene"),
      order: draft.order,
      title: draft.title,
      narrationText: draft.narrationText,
      captionText: draft.captionText,
      duration: draft.duration,
      emotion: draft.emotion,
      assetId: selectedAssetId,
      asset: selectedAssetId ? assetMap.get(selectedAssetId) ?? null : null,
      sfxAssetId: null,
      sfxStartTime: 0,
      sfxVolume: 0.7,
      visualPreset: draft.suggestedPresetId,
      transition: draft.transitionHint,
      captionStyle: null,
      captionPosition: null,
      captionEmphasisWords: [],
      energyLevel: draft.energyLevel,
      createdAt: now,
      updatedAt: now
    }))
  };

  return {
    project: localProject,
    checklist: buildChecklist(localProject),
    scenesCreated: localProject.scenes.length,
    autoAssignedAssets: scenes.filter((scene) => scene.selectedAssetId).length,
    scenes: scenes.map((scene, index) => ({
      sceneId: localProject.scenes[index]?.id ?? scene.draft.id,
      draft: scene.draft,
      selectedAssetId: scene.selectedAssetId,
      suggestions: scene.suggestions
    }))
  };
}
