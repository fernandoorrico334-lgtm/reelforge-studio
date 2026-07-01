import { summarizeNarrationJob } from "@reelforge/narration-engine";
import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import { parseSerializedTags, type StudioAsset } from "../../assets/domain/asset.js";
import type { NarrationJobRepository } from "../application/narration-job-repository.js";
import type {
  CreateNarrationJobInput,
  NarrationJob,
  NarrationJobFilters,
  UpdateNarrationJobInput
} from "../domain/narration.js";

interface PrismaNarrationJobRepositoryOptions {
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

const narrationJobInclude = {
  generatedAsset: true
} as const;

function mapJob(job: {
  id: string;
  videoProjectId: string | null;
  sceneId: string | null;
  provider: string;
  voicePackId: string | null;
  language: string;
  status: string;
  text: string;
  outputPath: string | null;
  generatedAssetId: string | null;
  durationSeconds: number | null;
  sampleRate: number | null;
  errorMessage: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  generatedAsset: Parameters<typeof mapAsset>[0] | null;
}): NarrationJob {
  return {
    id: job.id,
    videoProjectId: job.videoProjectId,
    sceneId: job.sceneId,
    provider: job.provider as NarrationJob["provider"],
    voicePackId: job.voicePackId,
    language: job.language,
    status: job.status as NarrationJob["status"],
    text: job.text,
    outputPath: job.outputPath,
    generatedAssetId: job.generatedAssetId,
    generatedAsset: job.generatedAsset ? mapAsset(job.generatedAsset) : null,
    durationSeconds: job.durationSeconds,
    sampleRate: job.sampleRate,
    errorMessage: job.errorMessage,
    metadata: job.metadata ? (JSON.parse(job.metadata) as Record<string, unknown>) : null,
    summary: summarizeNarrationJob({
      id: job.id,
      sceneId: job.sceneId,
      videoProjectId: job.videoProjectId,
      provider: job.provider,
      voicePackId: job.voicePackId,
      status: job.status,
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

function serializeUpdate(input: UpdateNarrationJobInput) {
  const data: Record<string, unknown> = {};

  if ("videoProjectId" in input) data.videoProjectId = input.videoProjectId;
  if ("sceneId" in input) data.sceneId = input.sceneId;
  if ("provider" in input) data.provider = input.provider;
  if ("voicePackId" in input) data.voicePackId = input.voicePackId;
  if ("language" in input) data.language = input.language;
  if ("status" in input) data.status = input.status;
  if ("text" in input) data.text = input.text;
  if ("outputPath" in input) data.outputPath = input.outputPath;
  if ("generatedAssetId" in input) data.generatedAssetId = input.generatedAssetId;
  if ("durationSeconds" in input) data.durationSeconds = input.durationSeconds;
  if ("sampleRate" in input) data.sampleRate = input.sampleRate;
  if ("errorMessage" in input) data.errorMessage = input.errorMessage;
  if ("metadata" in input) {
    data.metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  }
  if ("startedAt" in input) {
    data.startedAt = input.startedAt ? new Date(input.startedAt) : null;
  }
  if ("completedAt" in input) {
    data.completedAt = input.completedAt ? new Date(input.completedAt) : null;
  }

  return data;
}

export function createPrismaNarrationJobRepository({
  prismaClient = defaultPrisma
}: PrismaNarrationJobRepositoryOptions = {}): NarrationJobRepository {
  return {
    async list(filters: NarrationJobFilters = {}) {
      const jobs = await prismaClient.narrationJob.findMany({
        where: {
          ...(filters.videoProjectId ? { videoProjectId: filters.videoProjectId } : {}),
          ...(filters.sceneId ? { sceneId: filters.sceneId } : {}),
          ...(filters.provider ? { provider: filters.provider } : {}),
          ...(filters.voicePackId ? { voicePackId: filters.voicePackId } : {}),
          ...(filters.status ? { status: filters.status } : {})
        },
        include: narrationJobInclude,
        orderBy: {
          createdAt: "desc"
        }
      });

      return jobs.map(mapJob);
    },
    async getById(id: string) {
      const job = await prismaClient.narrationJob.findUnique({
        where: { id },
        include: narrationJobInclude
      });

      return job ? mapJob(job) : null;
    },
    async create(input: CreateNarrationJobInput) {
      const job = await prismaClient.narrationJob.create({
        data: {
          videoProjectId: input.videoProjectId,
          sceneId: input.sceneId,
          provider: input.provider,
          voicePackId: input.voicePackId,
          language: input.language,
          status: input.status,
          text: input.text,
          outputPath: input.outputPath,
          generatedAssetId: input.generatedAssetId,
          durationSeconds: input.durationSeconds,
          sampleRate: input.sampleRate,
          errorMessage: input.errorMessage,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          startedAt: input.startedAt ? new Date(input.startedAt) : null,
          completedAt: input.completedAt ? new Date(input.completedAt) : null
        },
        include: narrationJobInclude
      });

      return mapJob(job);
    },
    async update(id: string, input: UpdateNarrationJobInput) {
      const job = await prismaClient.narrationJob.update({
        where: { id },
        data: serializeUpdate(input),
        include: narrationJobInclude
      });

      return mapJob(job);
    }
  };
}
