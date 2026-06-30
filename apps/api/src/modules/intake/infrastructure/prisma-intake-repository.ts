import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import type { IntakeRepository } from "../application/intake-repository.js";
import type {
  CreateMediaCandidateInput,
  CreateMediaCollectionInput,
  MediaCandidate,
  MediaCandidateListFilters,
  MediaCollectionListFilters,
  MediaCollection,
  UpdateMediaCandidateInput,
  UpdateMediaCollectionInput
} from "../domain/intake.js";
import { parseIntakeSerializedTags } from "../domain/intake.js";

interface PrismaIntakeRepositoryOptions {
  prismaClient?: typeof defaultPrisma;
}

function toIsoString(value: Date) {
  return value.toISOString();
}

function mapCollection(collection: {
  id: string;
  name: string;
  channelId: string | null;
  projectId: string | null;
  dossierId: string | null;
  assetRequirementId: string | null;
  provider: string;
  query: string | null;
  sourcePath: string | null;
  mediaType: MediaCollection["mediaType"];
  status: MediaCollection["status"];
  targetCount: number | null;
  importedCount: number;
  rejectedCount: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  candidates?: Array<{ status: MediaCandidate["status"] }>;
}): MediaCollection {
  const candidateStatuses = collection.candidates ?? [];

  return {
    id: collection.id,
    name: collection.name,
    channelId: collection.channelId,
    projectId: collection.projectId,
    dossierId: collection.dossierId,
    assetRequirementId: collection.assetRequirementId,
    provider: collection.provider,
    query: collection.query,
    sourcePath: collection.sourcePath,
    mediaType: collection.mediaType,
    status: collection.status,
    targetCount: collection.targetCount,
    importedCount: collection.importedCount,
    rejectedCount: collection.rejectedCount,
    notes: collection.notes,
    candidateCount: candidateStatuses.length,
    pendingCount: candidateStatuses.filter((candidate) => candidate.status === "pending").length,
    approvedCount: candidateStatuses.filter((candidate) => candidate.status === "approved").length,
    failedCount: candidateStatuses.filter((candidate) => candidate.status === "failed").length,
    createdAt: toIsoString(collection.createdAt),
    updatedAt: toIsoString(collection.updatedAt)
  };
}

function mapCandidate(candidate: {
  id: string;
  collectionId: string;
  provider: string;
  originalPath: string | null;
  title: string;
  previewUrl: string | null;
  downloadUrl: string | null;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  sourceLicense: string | null;
  sourceLicenseUrl: string | null;
  mediaType: MediaCandidate["mediaType"];
  detectedType: string | null;
  suggestedCategory: MediaCandidate["suggestedCategory"];
  suggestedTags: string;
  suggestedCharacter: string | null;
  suggestedProject: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number | null;
  extension: string | null;
  mimeType: string | null;
  category: MediaCandidate["category"];
  franchise: string | null;
  character: string | null;
  emotion: MediaCandidate["emotion"];
  tags: string;
  copyrightRisk: MediaCandidate["copyrightRisk"];
  recommendedUse: string | null;
  usageNotes: string | null;
  status: MediaCandidate["status"];
  assetId: string | null;
  errorMessage: string | null;
  contentHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MediaCandidate {
  return {
    id: candidate.id,
    collectionId: candidate.collectionId,
    provider: candidate.provider,
    originalPath: candidate.originalPath,
    title: candidate.title,
    previewUrl: candidate.previewUrl,
    downloadUrl: candidate.downloadUrl,
    sourceUrl: candidate.sourceUrl,
    sourceAuthor: candidate.sourceAuthor,
    sourceLicense: candidate.sourceLicense,
    sourceLicenseUrl: candidate.sourceLicenseUrl,
    mediaType: candidate.mediaType,
    detectedType: candidate.detectedType,
    suggestedCategory: candidate.suggestedCategory,
    suggestedTags: parseIntakeSerializedTags(candidate.suggestedTags),
    suggestedCharacter: candidate.suggestedCharacter,
    suggestedProject: candidate.suggestedProject,
    width: candidate.width,
    height: candidate.height,
    duration: candidate.duration,
    fileSize: candidate.fileSize,
    extension: candidate.extension,
    mimeType: candidate.mimeType,
    category: candidate.category,
    franchise: candidate.franchise,
    character: candidate.character,
    emotion: candidate.emotion,
    tags: parseIntakeSerializedTags(candidate.tags),
    copyrightRisk: candidate.copyrightRisk,
    recommendedUse: candidate.recommendedUse,
    usageNotes: candidate.usageNotes,
    status: candidate.status,
    assetId: candidate.assetId,
    errorMessage: candidate.errorMessage,
    contentHash: candidate.contentHash,
    createdAt: toIsoString(candidate.createdAt),
    updatedAt: toIsoString(candidate.updatedAt)
  };
}

function serializeCollectionUpdate(input: UpdateMediaCollectionInput) {
  return input;
}

function serializeCandidateCreate(input: CreateMediaCandidateInput) {
  return {
    ...input,
    suggestedTags: JSON.stringify(input.suggestedTags),
    tags: JSON.stringify(input.tags)
  };
}

function serializeCandidateUpdate(input: UpdateMediaCandidateInput) {
  const data: Record<string, unknown> = { ...input };

  if (Object.prototype.hasOwnProperty.call(input, "suggestedTags")) {
    data.suggestedTags = JSON.stringify(input.suggestedTags ?? []);
  }

  if (Object.prototype.hasOwnProperty.call(input, "tags")) {
    data.tags = JSON.stringify(input.tags ?? []);
  }

  return data;
}

export function createPrismaIntakeRepository({
  prismaClient = defaultPrisma
}: PrismaIntakeRepositoryOptions = {}): IntakeRepository {
  return {
    async listCollections(filters: MediaCollectionListFilters = {}) {
      const collections = await prismaClient.mediaCollection.findMany({
        where: {
          ...(filters.channelId ? { channelId: filters.channelId } : {}),
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
          ...(filters.dossierId ? { dossierId: filters.dossierId } : {}),
          ...(filters.assetRequirementId
            ? { assetRequirementId: filters.assetRequirementId }
            : {}),
          ...(filters.provider ? { provider: filters.provider } : {})
        },
        include: {
          candidates: {
            select: {
              status: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return collections.map(mapCollection);
    },
    async getCollectionById(id) {
      const collection = await prismaClient.mediaCollection.findUnique({
        where: { id },
        include: {
          candidates: {
            select: {
              status: true
            }
          }
        }
      });

      return collection ? mapCollection(collection) : null;
    },
    async createCollection(input: CreateMediaCollectionInput) {
      const collection = await prismaClient.mediaCollection.create({
        data: input,
        include: {
          candidates: {
            select: {
              status: true
            }
          }
        }
      });

      return mapCollection(collection);
    },
    async updateCollection(id, input) {
      const existing = await prismaClient.mediaCollection.findUnique({
        where: { id }
      });

      if (!existing) {
        return null;
      }

      const collection = await prismaClient.mediaCollection.update({
        where: { id },
        data: serializeCollectionUpdate(input),
        include: {
          candidates: {
            select: {
              status: true
            }
          }
        }
      });

      return mapCollection(collection);
    },
    async listCandidates(filters: MediaCandidateListFilters = {}) {
      const candidates = await prismaClient.mediaCandidate.findMany({
        where: {
          ...(filters.collectionId ? { collectionId: filters.collectionId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.provider ? { provider: filters.provider } : {}),
          ...(filters.mediaType ? { mediaType: filters.mediaType } : {}),
          ...(filters.category ? { category: filters.category } : {}),
          ...(filters.character ? { character: filters.character } : {}),
          ...(filters.suggestedProject
            ? { suggestedProject: filters.suggestedProject }
            : {})
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return candidates.map(mapCandidate);
    },
    async getCandidateById(id) {
      const candidate = await prismaClient.mediaCandidate.findUnique({
        where: { id }
      });

      return candidate ? mapCandidate(candidate) : null;
    },
    async createCandidate(input: CreateMediaCandidateInput) {
      const candidate = await prismaClient.mediaCandidate.create({
        data: serializeCandidateCreate(input)
      });

      return mapCandidate(candidate);
    },
    async updateCandidate(id, input) {
      const existing = await prismaClient.mediaCandidate.findUnique({
        where: { id }
      });

      if (!existing) {
        return null;
      }

      const candidate = await prismaClient.mediaCandidate.update({
        where: { id },
        data: serializeCandidateUpdate(input)
      });

      return mapCandidate(candidate);
    }
  };
}

