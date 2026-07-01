import type { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import { parseSerializedTags, type StudioAsset } from "../../assets/domain/asset.js";
import type { StudioChannel } from "../../channels/domain/channel.js";
import type { ProjectRepository } from "../application/project-repository.js";
import type {
  CreateProjectInput,
  CreateSceneInput,
  ProjectScene,
  StudioProject,
  UpdateProjectInput,
  UpdateSceneInput
} from "../domain/project.js";

interface PrismaProjectRepositoryOptions {
  prismaClient?: typeof defaultPrisma;
}

type PrismaProjectExecutor = Pick<typeof defaultPrisma, "scene" | "videoProject">;

function toIsoString(value: Date): string {
  return value.toISOString();
}

function normalizeCaptionPosition(value: string | null) {
  switch (value) {
    case "top":
    case "center":
    case "lower-third":
    case "bottom":
    case "split":
      return value;
    default:
      return null;
  }
}

function mapChannel(channel: {
  id: string;
  name: string;
  niche: string;
  language: string;
  visualStyle: string | null;
  narrativeTone: string | null;
  defaultTemplate: string | null;
  defaultRenderMode: StudioChannel["defaultRenderMode"];
  defaultRenderQuality: StudioChannel["defaultRenderQuality"];
  defaultAudioMood: string | null;
  defaultCaptionStyle: string | null;
  defaultVisualPreset: string | null;
  defaultMusicAssetId: string | null;
  defaultVoiceoverAssetId: string | null;
  defaultDurationTarget: number | null;
  defaultSceneDuration: number;
  preferredAssetCategories: string;
  preferredAssetTags: string;
  createdAt: Date;
  updatedAt: Date;
}): StudioChannel {
  return {
    id: channel.id,
    name: channel.name,
    niche: channel.niche,
    language: channel.language,
    visualStyle: channel.visualStyle,
    narrativeTone: channel.narrativeTone,
    defaultTemplate: channel.defaultTemplate as StudioChannel["defaultTemplate"],
    defaultRenderMode: channel.defaultRenderMode,
    defaultRenderQuality: channel.defaultRenderQuality,
    defaultAudioMood: channel.defaultAudioMood as StudioChannel["defaultAudioMood"],
    defaultCaptionStyle:
      channel.defaultCaptionStyle as StudioChannel["defaultCaptionStyle"],
    defaultVisualPreset:
      channel.defaultVisualPreset as StudioChannel["defaultVisualPreset"],
    defaultMusicAssetId: channel.defaultMusicAssetId,
    defaultVoiceoverAssetId: channel.defaultVoiceoverAssetId,
    defaultDurationTarget: channel.defaultDurationTarget,
    defaultSceneDuration: channel.defaultSceneDuration,
    preferredAssetCategories:
      parseSerializedTags(channel.preferredAssetCategories) as StudioChannel["preferredAssetCategories"],
    preferredAssetTags: parseSerializedTags(channel.preferredAssetTags),
    createdAt: toIsoString(channel.createdAt),
    updatedAt: toIsoString(channel.updatedAt)
  };
}

function mapAsset(asset: {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  type: StudioAsset["type"];
  category: StudioAsset["category"];
  franchise: string | null;
  character: string | null;
  emotion: StudioAsset["emotion"];
  tags: string;
  licenseType: string;
  copyrightRisk: StudioAsset["copyrightRisk"];
  recommendedUse: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  extension: string | null;
  fileSize: number | null;
  sourceProvider: string | null;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  sourceLicense: string | null;
  sourceLicenseUrl: string | null;
  downloadedAt: Date | null;
  collectionId: string | null;
  usageNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): StudioAsset {
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
    tags: parseSerializedTags(asset.tags),
    licenseType: asset.licenseType,
    copyrightRisk: asset.copyrightRisk,
    recommendedUse: asset.recommendedUse,
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
    extension: asset.extension,
    fileSize: asset.fileSize,
    sourceProvider: asset.sourceProvider,
    sourceUrl: asset.sourceUrl,
    sourceAuthor: asset.sourceAuthor,
    sourceLicense: asset.sourceLicense,
    sourceLicenseUrl: asset.sourceLicenseUrl,
    downloadedAt: asset.downloadedAt ? toIsoString(asset.downloadedAt) : null,
    collectionId: asset.collectionId,
    usageNotes: asset.usageNotes,
    createdAt: toIsoString(asset.createdAt),
    updatedAt: toIsoString(asset.updatedAt)
  };
}

function mapScene(scene: {
  id: string;
  order: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  duration: number | null;
  emotion: ProjectScene["emotion"];
  assetId: string | null;
  generatedAssetId: string | null;
  generatedNarrationAssetId: string | null;
  characterProfileId: string | null;
  sfxAssetId: string | null;
  sfxStartTime: number;
  sfxVolume: number;
  visualPreset: string | null;
  visualSourceMode: ProjectScene["visualSourceMode"];
  visualPrompt: string | null;
  negativePrompt: string | null;
  visualRecipe: string | null;
  generationStatus: ProjectScene["generationStatus"];
  generationProvider: string | null;
  generationSeed: number | null;
  transition: string | null;
  captionStyle: string | null;
  captionPosition: string | null;
  captionEmphasisWords: string | null;
  energyLevel: number | null;
  narrationStatus: ProjectScene["narrationStatus"];
  narrationProvider: string | null;
  narrationVoicePackId: string | null;
  createdAt: Date;
  updatedAt: Date;
  asset: Parameters<typeof mapAsset>[0] | null;
  generatedAsset: Parameters<typeof mapAsset>[0] | null;
  generatedNarrationAsset: Parameters<typeof mapAsset>[0] | null;
}): ProjectScene {
  return {
    id: scene.id,
    order: scene.order,
    title: scene.title,
    narrationText: scene.narrationText,
    captionText: scene.captionText,
    duration: scene.duration,
    emotion: scene.emotion,
    assetId: scene.assetId,
    asset: scene.asset ? mapAsset(scene.asset) : null,
    generatedAssetId: scene.generatedAssetId,
    generatedAsset: scene.generatedAsset ? mapAsset(scene.generatedAsset) : null,
    generatedNarrationAssetId: scene.generatedNarrationAssetId,
    generatedNarrationAsset: scene.generatedNarrationAsset
      ? mapAsset(scene.generatedNarrationAsset)
      : null,
    characterProfileId: scene.characterProfileId,
    sfxAssetId: scene.sfxAssetId,
    sfxStartTime: scene.sfxStartTime,
    sfxVolume: scene.sfxVolume,
    visualPreset: scene.visualPreset,
    visualSourceMode: scene.visualSourceMode,
    visualPrompt: scene.visualPrompt,
    negativePrompt: scene.negativePrompt,
    visualRecipe: scene.visualRecipe,
    generationStatus: scene.generationStatus,
    generationProvider:
      scene.generationProvider as ProjectScene["generationProvider"],
    generationSeed: scene.generationSeed,
    transition: scene.transition,
    captionStyle: scene.captionStyle,
    captionPosition: normalizeCaptionPosition(scene.captionPosition),
    captionEmphasisWords: parseSerializedTags(scene.captionEmphasisWords ?? "[]"),
    energyLevel: scene.energyLevel,
    narrationStatus: scene.narrationStatus,
    narrationProvider:
      scene.narrationProvider as ProjectScene["narrationProvider"],
    narrationVoicePackId: scene.narrationVoicePackId,
    createdAt: toIsoString(scene.createdAt),
    updatedAt: toIsoString(scene.updatedAt)
  };
}

function mapProject(project: {
  id: string;
  title: string;
  status: StudioProject["status"];
  channelId: string;
  script: string | null;
  durationTarget: number | null;
  format: string;
  templateId: string | null;
  defaultCaptionStyle: string | null;
  backgroundMusicAssetId: string | null;
  voiceoverAssetId: string | null;
  audioMood: string | null;
  musicVolume: number;
  voiceVolume: number;
  sfxVolume: number;
  enableAudioDucking: boolean;
  duckingLevel: number;
  createdAt: Date;
  updatedAt: Date;
  channel: Parameters<typeof mapChannel>[0];
  scenes: Array<Parameters<typeof mapScene>[0]>;
}): StudioProject {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    channelId: project.channelId,
    channel: mapChannel(project.channel),
    script: project.script,
    durationTarget: project.durationTarget,
    format: project.format,
    templateId: project.templateId,
    defaultCaptionStyle: project.defaultCaptionStyle,
    backgroundMusicAssetId: project.backgroundMusicAssetId,
    voiceoverAssetId: project.voiceoverAssetId,
    audioMood: project.audioMood,
    musicVolume: project.musicVolume,
    voiceVolume: project.voiceVolume,
    sfxVolume: project.sfxVolume,
    enableAudioDucking: project.enableAudioDucking,
    duckingLevel: project.duckingLevel,
    createdAt: toIsoString(project.createdAt),
    updatedAt: toIsoString(project.updatedAt),
    scenes: project.scenes.map(mapScene)
  };
}

function serializeCreateProjectInput(
  input: CreateProjectInput
): Prisma.VideoProjectUncheckedCreateInput {
  return {
    title: input.title,
    status: input.status,
    channelId: input.channelId,
    script: input.script,
    durationTarget: input.durationTarget,
    format: input.format,
    templateId: input.templateId,
    defaultCaptionStyle: input.defaultCaptionStyle,
    backgroundMusicAssetId: input.backgroundMusicAssetId,
    voiceoverAssetId: input.voiceoverAssetId,
    audioMood: input.audioMood,
    musicVolume: input.musicVolume ?? 0.18,
    voiceVolume: input.voiceVolume ?? 1,
    sfxVolume: input.sfxVolume ?? 0.7,
    enableAudioDucking: input.enableAudioDucking ?? false,
    duckingLevel: input.duckingLevel ?? 0.35
  };
}

function serializeUpdateProjectInput(
  input: UpdateProjectInput
): Prisma.VideoProjectUncheckedUpdateInput {
  const data: Prisma.VideoProjectUncheckedUpdateInput = {};

  if ("title" in input) data.title = input.title;
  if ("status" in input) data.status = input.status;
  if ("channelId" in input) data.channelId = input.channelId;
  if ("script" in input) data.script = input.script;
  if ("durationTarget" in input) data.durationTarget = input.durationTarget;
  if ("format" in input) data.format = input.format;
  if ("templateId" in input) data.templateId = input.templateId;
  if ("defaultCaptionStyle" in input) data.defaultCaptionStyle = input.defaultCaptionStyle;
  if ("backgroundMusicAssetId" in input) {
    data.backgroundMusicAssetId = input.backgroundMusicAssetId;
  }
  if ("voiceoverAssetId" in input) {
    data.voiceoverAssetId = input.voiceoverAssetId;
  }
  if ("audioMood" in input) data.audioMood = input.audioMood;
  if ("musicVolume" in input) data.musicVolume = input.musicVolume ?? 0.18;
  if ("voiceVolume" in input) data.voiceVolume = input.voiceVolume ?? 1;
  if ("sfxVolume" in input) data.sfxVolume = input.sfxVolume ?? 0.7;
  if ("enableAudioDucking" in input) {
    data.enableAudioDucking = input.enableAudioDucking ?? false;
  }
  if ("duckingLevel" in input) data.duckingLevel = input.duckingLevel ?? 0.35;

  return data;
}

function serializeCreateSceneInput(
  input: Omit<CreateSceneInput, "order">
): Omit<
  Prisma.SceneUncheckedCreateInput,
  "id" | "videoProjectId" | "order" | "createdAt" | "updatedAt"
> {
  return {
    title: input.title,
    narrationText: input.narrationText,
    captionText: input.captionText,
    duration: input.duration,
    emotion: input.emotion,
    assetId: input.assetId,
    generatedAssetId: input.generatedAssetId,
    generatedNarrationAssetId: input.generatedNarrationAssetId,
    characterProfileId: input.characterProfileId,
    sfxAssetId: input.sfxAssetId,
    sfxStartTime: input.sfxStartTime ?? 0,
    sfxVolume: input.sfxVolume ?? 0.7,
    visualPreset: input.visualPreset,
    visualSourceMode: input.visualSourceMode,
    visualPrompt: input.visualPrompt,
    negativePrompt: input.negativePrompt,
    visualRecipe: input.visualRecipe,
    generationStatus: input.generationStatus,
    generationProvider: input.generationProvider,
    generationSeed: input.generationSeed,
    transition: input.transition,
    captionStyle: input.captionStyle,
    captionPosition: input.captionPosition,
    captionEmphasisWords: JSON.stringify(input.captionEmphasisWords ?? []),
    energyLevel: input.energyLevel,
    narrationStatus: input.narrationStatus,
    narrationProvider: input.narrationProvider,
    narrationVoicePackId: input.narrationVoicePackId
  };
}

function serializeUpdateSceneInput(
  input: Omit<UpdateSceneInput, "order">
): Prisma.SceneUncheckedUpdateInput {
  const data: Prisma.SceneUncheckedUpdateInput = {};

  if ("title" in input) {
    data.title = input.title;
  }

  if ("narrationText" in input) {
    data.narrationText = input.narrationText;
  }

  if ("captionText" in input) {
    data.captionText = input.captionText;
  }

  if ("duration" in input) {
    data.duration = input.duration;
  }

  if ("emotion" in input) {
    data.emotion = input.emotion;
  }

  if ("assetId" in input) {
    data.assetId = input.assetId;
  }

  if ("generatedAssetId" in input) {
    data.generatedAssetId = input.generatedAssetId;
  }

  if ("generatedNarrationAssetId" in input) {
    data.generatedNarrationAssetId = input.generatedNarrationAssetId;
  }

  if ("characterProfileId" in input) {
    data.characterProfileId = input.characterProfileId;
  }

  if ("sfxAssetId" in input) {
    data.sfxAssetId = input.sfxAssetId;
  }

  if ("sfxStartTime" in input) {
    data.sfxStartTime = input.sfxStartTime ?? 0;
  }

  if ("sfxVolume" in input) {
    data.sfxVolume = input.sfxVolume ?? 0.7;
  }

  if ("visualPreset" in input) {
    data.visualPreset = input.visualPreset;
  }

  if ("visualSourceMode" in input) {
    data.visualSourceMode = input.visualSourceMode;
  }

  if ("visualPrompt" in input) {
    data.visualPrompt = input.visualPrompt;
  }

  if ("negativePrompt" in input) {
    data.negativePrompt = input.negativePrompt;
  }

  if ("visualRecipe" in input) {
    data.visualRecipe = input.visualRecipe;
  }

  if ("generationStatus" in input) {
    data.generationStatus = input.generationStatus;
  }

  if ("generationProvider" in input) {
    data.generationProvider = input.generationProvider;
  }

  if ("generationSeed" in input) {
    data.generationSeed = input.generationSeed;
  }

  if ("transition" in input) {
    data.transition = input.transition;
  }

  if ("captionStyle" in input) {
    data.captionStyle = input.captionStyle;
  }

  if ("captionPosition" in input) {
    data.captionPosition = input.captionPosition;
  }

  if ("captionEmphasisWords" in input) {
    data.captionEmphasisWords = JSON.stringify(input.captionEmphasisWords ?? []);
  }

  if ("energyLevel" in input) {
    data.energyLevel = input.energyLevel;
  }

  if ("narrationStatus" in input) {
    data.narrationStatus = input.narrationStatus;
  }

  if ("narrationProvider" in input) {
    data.narrationProvider = input.narrationProvider;
  }

  if ("narrationVoicePackId" in input) {
    data.narrationVoicePackId = input.narrationVoicePackId;
  }

  return data;
}

const projectInclude = {
  channel: true,
  scenes: {
    orderBy: {
      order: "asc" as const
    },
    include: {
      asset: true,
      generatedAsset: true,
      generatedNarrationAsset: true
    }
  }
} as const;

const sceneInclude = {
  asset: true,
  generatedAsset: true,
  generatedNarrationAsset: true
} as const;

async function applySceneOrder(
  prismaClient: PrismaProjectExecutor,
  projectId: string,
  sceneIds: string[]
) {
  const offset = sceneIds.length + 1000;

  for (const [index, sceneId] of sceneIds.entries()) {
    await prismaClient.scene.update({
      where: { id: sceneId },
      data: {
        order: offset + index
      }
    });
  }

  for (const [index, sceneId] of sceneIds.entries()) {
    await prismaClient.scene.update({
      where: { id: sceneId },
      data: {
        order: index + 1
      }
    });
  }

  const scenes = await prismaClient.scene.findMany({
    where: {
      videoProjectId: projectId
    },
    orderBy: {
      order: "asc"
    },
    include: sceneInclude
  });

  return scenes.map(mapScene);
}

export function createPrismaProjectRepository({
  prismaClient = defaultPrisma
}: PrismaProjectRepositoryOptions = {}): ProjectRepository {
  return {
    async list() {
      const projects = await prismaClient.videoProject.findMany({
        include: {
          channel: true,
          scenes: {
            orderBy: {
              order: "asc"
            },
            include: {
              asset: true,
              generatedAsset: true,
              generatedNarrationAsset: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return projects.map(mapProject);
    },
    async getById(id) {
      const project = await prismaClient.videoProject.findUnique({
        where: { id },
        include: projectInclude
      });

      return project ? mapProject(project) : null;
    },
    async create(input: CreateProjectInput) {
      const created = await prismaClient.videoProject.create({
        data: serializeCreateProjectInput(input)
      });

      const project = await prismaClient.videoProject.findUnique({
        where: {
          id: created.id
        },
        include: projectInclude
      });

      return mapProject(project as NonNullable<typeof project>);
    },
    async update(id: string, input: UpdateProjectInput) {
      const existing = await prismaClient.videoProject.findUnique({
        where: { id }
      });

      if (!existing) {
        return null;
      }

      await prismaClient.videoProject.update({
        where: { id },
        data: serializeUpdateProjectInput(input)
      });

      const project = await prismaClient.videoProject.findUnique({
        where: { id },
        include: projectInclude
      });

      return project ? mapProject(project) : null;
    },
    async delete(id: string) {
      const existing = await prismaClient.videoProject.findUnique({
        where: { id }
      });

      if (!existing) {
        return false;
      }

      await prismaClient.videoProject.delete({
        where: { id }
      });

      return true;
    },
    async listScenes(projectId) {
      const scenes = await prismaClient.scene.findMany({
        where: {
          videoProjectId: projectId
        },
        orderBy: {
          order: "asc"
        },
        include: sceneInclude
      });

      return scenes.map(mapScene);
    },
    async getSceneById(projectId, sceneId) {
      const scene = await prismaClient.scene.findFirst({
        where: {
          id: sceneId,
          videoProjectId: projectId
        },
        include: sceneInclude
      });

      return scene ? mapScene(scene) : null;
    },
    async createScene(projectId, input) {
      return prismaClient.$transaction(async (transaction: PrismaProjectExecutor) => {
        const project = await transaction.videoProject.findUnique({
          where: {
            id: projectId
          }
        });

        if (!project) {
          return null;
        }

        const lastScene = await transaction.scene.findFirst({
          where: {
            videoProjectId: projectId
          },
          orderBy: {
            order: "desc"
          }
        });

        const createdScene = await transaction.scene.create({
          data: {
            ...serializeCreateSceneInput(input),
            videoProjectId: projectId,
            order: (lastScene?.order ?? 0) + 1
          },
        });

        const scene = await transaction.scene.findUnique({
          where: {
            id: createdScene.id
          },
          include: sceneInclude
        });

        return scene ? mapScene(scene) : null;
      });
    },
    async updateScene(projectId, sceneId, input: Omit<UpdateSceneInput, "order">) {
      const existing = await prismaClient.scene.findFirst({
        where: {
          id: sceneId,
          videoProjectId: projectId
        }
      });

      if (!existing) {
        return null;
      }

      const scene = await prismaClient.scene.update({
        where: {
          id: sceneId
        },
        data: serializeUpdateSceneInput(input),
        include: sceneInclude
      });

      return mapScene(scene);
    },
    async deleteScene(projectId, sceneId) {
      return prismaClient.$transaction(async (transaction: PrismaProjectExecutor) => {
        const existing = await transaction.scene.findFirst({
          where: {
            id: sceneId,
            videoProjectId: projectId
          }
        });

        if (!existing) {
          return false;
        }

        await transaction.scene.delete({
          where: {
            id: sceneId
          }
        });

        const remaining = await transaction.scene.findMany({
          where: {
            videoProjectId: projectId
          },
          orderBy: {
            order: "asc"
          }
        });

        await applySceneOrder(
          transaction,
          projectId,
          remaining.map((scene: { id: string }) => scene.id)
        );

        return true;
      });
    },
    async reorderScenes(projectId, sceneIds) {
      return prismaClient.$transaction(async (transaction: PrismaProjectExecutor) =>
        applySceneOrder(transaction, projectId, sceneIds)
      );
    },
    async count() {
      return prismaClient.videoProject.count();
    }
  };
}

