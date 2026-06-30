import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import { summarizeVisualGenerationJob } from "@reelforge/hybrid-visual-engine";
import { parseSerializedTags, type StudioAsset } from "../../assets/domain/asset.js";
import type { CharacterReferenceType } from "../../characters/domain/character.js";
import type { VisualGenerationJobRepository } from "../application/visual-generation-job-repository.js";
import type {
  CreateVisualGenerationJobInput,
  UpdateVisualGenerationJobInput,
  VisualGenerationJob,
  VisualGenerationJobFilters
} from "../domain/visual-generation.js";

interface PrismaVisualGenerationJobRepositoryOptions {
  prismaClient?: typeof defaultPrisma;
}

function toIsoString(value: Date) {
  return value.toISOString();
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

const visualJobInclude = {
  generatedAsset: true,
  characterProfile: {
    include: {
      references: {
        include: {
          asset: true
        },
        orderBy: {
          createdAt: "desc" as const
        }
      }
    }
  }
};

function mapJob(job: {
  id: string;
  videoProjectId: string | null;
  sceneId: string | null;
  characterProfileId: string | null;
  researchAssetRequirementId: string | null;
  status: string;
  provider: string;
  visualSourceMode: string | null;
  prompt: string;
  negativePrompt: string | null;
  stylePreset: string | null;
  seed: number | null;
  width: number;
  height: number;
  outputPath: string | null;
  generatedAssetId: string | null;
  errorMessage: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  generatedAsset: Parameters<typeof mapAsset>[0] | null;
  characterProfile:
    | {
        id: string;
        name: string;
        slug: string;
        franchise: string | null;
        category: string | null;
        description: string | null;
        basePrompt: string | null;
        negativePrompt: string | null;
        styleNotes: string | null;
        defaultVisualStyle: string | null;
        referenceStrength: number;
        preferredProvider: string;
        tags: string;
        createdAt: Date;
        updatedAt: Date;
        references: Array<{
          id: string;
          characterProfileId: string;
          assetId: string | null;
          sourcePath: string | null;
          title: string | null;
          notes: string | null;
          referenceType: string;
          strength: number;
          createdAt: Date;
          updatedAt: Date;
          asset: Parameters<typeof mapAsset>[0] | null;
        }>;
      }
    | null;
}): VisualGenerationJob {
  return {
    id: job.id,
    videoProjectId: job.videoProjectId,
    sceneId: job.sceneId,
    characterProfileId: job.characterProfileId,
    characterProfile: job.characterProfile
      ? {
          id: job.characterProfile.id,
          name: job.characterProfile.name,
          slug: job.characterProfile.slug,
          franchise: job.characterProfile.franchise,
          category: job.characterProfile.category,
          description: job.characterProfile.description,
          basePrompt: job.characterProfile.basePrompt,
          negativePrompt: job.characterProfile.negativePrompt,
          styleNotes: job.characterProfile.styleNotes,
          defaultVisualStyle: job.characterProfile.defaultVisualStyle,
          referenceStrength: job.characterProfile.referenceStrength,
          preferredProvider: job.characterProfile.preferredProvider,
          tags: parseSerializedTags(job.characterProfile.tags),
          createdAt: toIsoString(job.characterProfile.createdAt),
          updatedAt: toIsoString(job.characterProfile.updatedAt),
          references: job.characterProfile.references.map((reference) => ({
            id: reference.id,
            characterProfileId: reference.characterProfileId,
            assetId: reference.assetId,
            asset: reference.asset ? mapAsset(reference.asset) : null,
            sourcePath: reference.sourcePath,
            title: reference.title,
            notes: reference.notes,
            referenceType: reference.referenceType as CharacterReferenceType,
            strength: reference.strength,
            createdAt: toIsoString(reference.createdAt),
            updatedAt: toIsoString(reference.updatedAt)
          }))
        }
      : null,
    researchAssetRequirementId: job.researchAssetRequirementId,
    status: job.status as VisualGenerationJob["status"],
    provider: job.provider as VisualGenerationJob["provider"],
    visualSourceMode: job.visualSourceMode as VisualGenerationJob["visualSourceMode"],
    prompt: job.prompt,
    negativePrompt: job.negativePrompt,
    stylePreset: job.stylePreset,
    seed: job.seed,
    width: job.width,
    height: job.height,
    outputPath: job.outputPath,
    generatedAssetId: job.generatedAssetId,
    generatedAsset: job.generatedAsset ? mapAsset(job.generatedAsset) : null,
    errorMessage: job.errorMessage,
    metadata: job.metadata ? (JSON.parse(job.metadata) as Record<string, unknown>) : null,
    summary: summarizeVisualGenerationJob({
      id: job.id,
      sceneId: job.sceneId,
      videoProjectId: job.videoProjectId,
      characterProfileId: job.characterProfileId,
      status: job.status as VisualGenerationJob["status"],
      provider: job.provider as VisualGenerationJob["provider"],
      visualSourceMode: job.visualSourceMode,
      stylePreset: job.stylePreset,
      generatedAssetId: job.generatedAssetId,
      outputPath: job.outputPath,
      errorMessage: job.errorMessage
    }),
    createdAt: toIsoString(job.createdAt),
    updatedAt: toIsoString(job.updatedAt),
    startedAt: job.startedAt ? toIsoString(job.startedAt) : null,
    completedAt: job.completedAt ? toIsoString(job.completedAt) : null
  };
}

function serializeJobUpdate(input: UpdateVisualGenerationJobInput) {
  const data: Record<string, unknown> = {};

  if ("videoProjectId" in input) data.videoProjectId = input.videoProjectId;
  if ("sceneId" in input) data.sceneId = input.sceneId;
  if ("characterProfileId" in input) data.characterProfileId = input.characterProfileId;
  if ("researchAssetRequirementId" in input) {
    data.researchAssetRequirementId = input.researchAssetRequirementId;
  }
  if ("status" in input) data.status = input.status;
  if ("provider" in input) data.provider = input.provider;
  if ("visualSourceMode" in input) data.visualSourceMode = input.visualSourceMode;
  if ("prompt" in input) data.prompt = input.prompt;
  if ("negativePrompt" in input) data.negativePrompt = input.negativePrompt;
  if ("stylePreset" in input) data.stylePreset = input.stylePreset;
  if ("seed" in input) data.seed = input.seed;
  if ("width" in input) data.width = input.width;
  if ("height" in input) data.height = input.height;
  if ("outputPath" in input) data.outputPath = input.outputPath;
  if ("generatedAssetId" in input) data.generatedAssetId = input.generatedAssetId;
  if ("errorMessage" in input) data.errorMessage = input.errorMessage;
  if ("metadata" in input) data.metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  if ("startedAt" in input) data.startedAt = input.startedAt ? new Date(input.startedAt) : null;
  if ("completedAt" in input) {
    data.completedAt = input.completedAt ? new Date(input.completedAt) : null;
  }

  return data;
}

export function createPrismaVisualGenerationJobRepository({
  prismaClient = defaultPrisma
}: PrismaVisualGenerationJobRepositoryOptions = {}): VisualGenerationJobRepository {
  return {
    async list(filters: VisualGenerationJobFilters = {}) {
      const jobs = await prismaClient.visualGenerationJob.findMany({
        where: {
          ...(filters.videoProjectId ? { videoProjectId: filters.videoProjectId } : {}),
          ...(filters.sceneId ? { sceneId: filters.sceneId } : {}),
          ...(filters.researchAssetRequirementId
            ? { researchAssetRequirementId: filters.researchAssetRequirementId }
            : {}),
          ...(filters.characterProfileId
            ? { characterProfileId: filters.characterProfileId }
            : {}),
          ...(filters.status ? { status: filters.status } : {})
        },
        orderBy: {
          createdAt: "desc"
        },
        include: visualJobInclude
      });

      return jobs.map(mapJob);
    },
    async getById(id: string) {
      const job = await prismaClient.visualGenerationJob.findUnique({
        where: { id },
        include: visualJobInclude
      });

      return job ? mapJob(job) : null;
    },
    async create(input: CreateVisualGenerationJobInput) {
      const job = await prismaClient.visualGenerationJob.create({
        data: {
          videoProjectId: input.videoProjectId,
          sceneId: input.sceneId,
          characterProfileId: input.characterProfileId,
          researchAssetRequirementId: input.researchAssetRequirementId,
          status: input.status,
          provider: input.provider,
          visualSourceMode: input.visualSourceMode,
          prompt: input.prompt,
          negativePrompt: input.negativePrompt,
          stylePreset: input.stylePreset,
          seed: input.seed,
          width: input.width,
          height: input.height,
          outputPath: input.outputPath,
          generatedAssetId: input.generatedAssetId,
          errorMessage: input.errorMessage,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          startedAt: input.startedAt ? new Date(input.startedAt) : null,
          completedAt: input.completedAt ? new Date(input.completedAt) : null
        },
        include: visualJobInclude
      });

      return mapJob(job);
    },
    async update(id: string, input: UpdateVisualGenerationJobInput) {
      const existing = await prismaClient.visualGenerationJob.findUnique({
        where: { id }
      });

      if (!existing) {
        return null;
      }

      const job = await prismaClient.visualGenerationJob.update({
        where: { id },
        data: serializeJobUpdate(input),
        include: visualJobInclude
      });

      return mapJob(job);
    }
  };
}

