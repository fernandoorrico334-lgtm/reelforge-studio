import {
  buildReelsFactoryProjectScript,
  generateReelsFactoryPreview,
  getReelsFactoryTemplateById,
  getReelsFactoryTemplates,
  type ReelsFactoryPreview
} from "@reelforge/story-engine/reels-factory";
import { buildEditingStyleSummaryFromPreset } from "@reelforge/editing-reference-engine";
import { getTemplateById } from "@reelforge/templates";
import { NotFoundError } from "../../../shared/errors.js";
import type { ChannelRepository } from "../../channels/application/channel-repository.js";
import type { EditingReferenceRepository } from "../../editing-references/application/editing-reference-repository.js";
import type { StudioChannel } from "../../channels/domain/channel.js";
import type { ProjectRepository } from "../../projects/application/project-repository.js";
import type {
  CreateProjectInput,
  CreateSceneInput
} from "../../projects/domain/project.js";
import type {
  ReelsFactoryBatchInput,
  ReelsFactoryBatchProjectResult,
  ReelsFactoryBatchResponse,
  ReelsFactoryCreateProjectResponse,
  ReelsFactoryPreviewInput
} from "../domain/reels-factory.js";

const sportsChannelKeywords = [
  "futebol",
  "copa",
  "sports",
  "esporte",
  "bola",
  "match",
  "reels factory"
] as const;

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase();
}

function isSportsBiasedChannel(channel: StudioChannel) {
  const combined = normalizeText(
    [channel.name, channel.niche, channel.visualStyle, channel.narrativeTone]
      .filter(Boolean)
      .join(" ")
  );

  return sportsChannelKeywords.some((keyword) => combined.includes(keyword));
}

async function resolveFactoryChannel(
  channelRepository: ChannelRepository,
  explicitChannelId: string | null | undefined
) {
  if (explicitChannelId) {
    const explicitChannel = await channelRepository.getById(explicitChannelId);

    if (!explicitChannel) {
      throw new NotFoundError(`Channel '${explicitChannelId}' was not found.`);
    }

    return explicitChannel;
  }

  const channels = await channelRepository.list();

  if (channels.length === 0) {
    throw new NotFoundError(
      "No channel is available. Create at least one channel before using the Reels Factory."
    );
  }

  return channels.find(isSportsBiasedChannel) ?? channels[0]!;
}

function buildSceneVisualRecipe(
  preview: ReelsFactoryPreview,
  scene: ReelsFactoryPreview["scenes"][number]
) {
  return JSON.stringify({
    source: "reels-factory",
    templateId: preview.templateId,
    tone: preview.tone,
    durationSeconds: preview.durationSeconds,
    suggestedWorkflowPackId: scene.suggestedWorkflowPackId,
    suggestedVoicePackId: scene.suggestedVoicePackId,
    suggestedAudioMasteringPresetId: scene.suggestedAudioMasteringPresetId,
    suggestedVisualPresetId: scene.suggestedVisualPresetId,
    microclipSlot: scene.microclipSlot,
    hashtags: preview.hashtags,
    shortDescription: preview.shortDescription,
    caption: preview.caption,
    recommendedNextActions: preview.recommendedNextActions
  });
}

function buildProjectInput(
  channelId: string,
  preview: ReelsFactoryPreview
): CreateProjectInput {
  const resolvedTemplate = getTemplateById(preview.templateId);

  return {
    title: preview.title,
    status: "SCENE_PLANNING" as const,
    channelId,
    script: buildReelsFactoryProjectScript(preview),
    durationTarget: preview.durationSeconds,
    format: "9:16",
    templateId: preview.templateId,
    editingReferencePresetId: preview.editingReferencePresetId ?? null,
    editingStyleSummary:
      (preview.editingStyleSummary as CreateProjectInput["editingStyleSummary"]) ??
      null,
    defaultCaptionStyle: resolvedTemplate?.defaultCaptionStyle ?? null,
    backgroundMusicAssetId: null,
    voiceoverAssetId: null,
    audioMood: null,
    musicVolume: 0.18,
    voiceVolume: 1,
    sfxVolume: 0.7,
    enableAudioDucking: true,
    duckingLevel: 0.35,
    musicPresetId:
      preview.editingStyleSummary?.recommendedMusicPresetId ?? null
  };
}

function buildSceneInput(
  preview: ReelsFactoryPreview,
  scene: ReelsFactoryPreview["scenes"][number]
): Omit<CreateSceneInput, "order"> {
  const emotion: CreateSceneInput["emotion"] =
    scene.role === "hook" || scene.role === "impactMoment"
      ? "EPIC"
      : scene.role === "cta"
        ? "CURIOUS"
        : scene.role === "conclusion"
          ? "NEUTRAL"
          : "TENSE";

  return {
    title: scene.title,
    narrationText: scene.narrationText,
    captionText: scene.onScreenText,
    duration: scene.durationSeconds,
    emotion,
    assetId: null,
    generatedAssetId: null,
    generatedNarrationAssetId: null,
    characterProfileId: null,
    sfxAssetId: null,
    sfxStartTime: 0,
    sfxVolume: 0.7,
    visualPreset: scene.suggestedVisualPresetId,
    visualSourceMode: "generated_only" as const,
    visualPrompt: scene.visualPrompt,
    negativePrompt: null,
    visualRecipe: buildSceneVisualRecipe(preview, scene),
    generationStatus: null,
    generationProvider: null,
    generationSeed: null,
    transition: scene.transition,
    captionStyle: scene.captionStyleId,
    captionPosition: "lower-third" as const,
    captionEmphasisWords: [],
    energyLevel: scene.energyLevel,
    narrationStatus: null,
    narrationProvider: null,
    narrationVoicePackId: scene.suggestedVoicePackId
  };
}

export async function listReelsFactoryTemplates() {
  return getReelsFactoryTemplates();
}

export async function getReelsFactoryTemplate(templateId: string) {
  const template = getReelsFactoryTemplateById(templateId);

  if (!template) {
    throw new NotFoundError(`Reels Factory template '${templateId}' was not found.`);
  }

  return template;
}

export async function previewReelsFactory(
  input: ReelsFactoryPreviewInput,
  editingReferenceRepository?: EditingReferenceRepository
) {
  const preset =
    input.editingReferencePresetId && editingReferenceRepository
      ? await editingReferenceRepository.getPresetById(
          input.editingReferencePresetId
        )
      : null;

  return generateReelsFactoryPreview({
    ...input,
    editingStyleSummary: preset ? buildEditingStyleSummaryFromPreset(preset) : null
  });
}

export async function createReelsFactoryProject(
  projectRepository: ProjectRepository,
  channelRepository: ChannelRepository,
  input: ReelsFactoryPreviewInput,
  editingReferenceRepository?: EditingReferenceRepository
): Promise<ReelsFactoryCreateProjectResponse> {
  const channel = await resolveFactoryChannel(channelRepository, input.channelId);
  const preview = await previewReelsFactory(input, editingReferenceRepository);
  const createdProject = await projectRepository.create(
    buildProjectInput(channel.id, preview)
  );

  for (const scene of preview.scenes) {
    await projectRepository.createScene(
      createdProject.id,
      buildSceneInput(preview, scene)
    );
  }

  const project = await projectRepository.getById(createdProject.id);

  if (!project) {
    throw new NotFoundError(
      `Video project '${createdProject.id}' was not found after creation.`
    );
  }

  return {
    projectId: project.id,
    title: project.title,
    scenesCreated: preview.scenes.length,
    project,
    preview,
    recommendedNextActions: [...preview.recommendedNextActions]
  };
}

export async function createReelsFactoryBatch(
  projectRepository: ProjectRepository,
  channelRepository: ChannelRepository,
  input: ReelsFactoryBatchInput,
  editingReferenceRepository?: EditingReferenceRepository
): Promise<ReelsFactoryBatchResponse> {
  const projects: ReelsFactoryBatchProjectResult[] = [];
  const failures: ReelsFactoryBatchResponse["failures"] = [];

  for (const item of input.items) {
    try {
      const result = await createReelsFactoryProject(
        projectRepository,
        channelRepository,
        {
          channelId: input.channelId ?? null,
          topic: item.topic,
          subject: item.subject,
          angle: item.angle,
          templateId: input.templateId,
          editingReferencePresetId: input.editingReferencePresetId ?? null,
          tone: input.tone,
          durationSeconds: input.durationSeconds,
          language: input.language,
          includeMicroclip: input.includeMicroclip
        },
        editingReferenceRepository
      );

      projects.push({
        projectId: result.projectId,
        title: result.title,
        scenesCreated: result.scenesCreated,
        topic: item.topic
      });
    } catch (error) {
      failures.push({
        topic: item.topic,
        error:
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Failed to create batch project."
      });
    }
  }

  return {
    projects,
    failures,
    totalCreated: projects.length
  };
}
