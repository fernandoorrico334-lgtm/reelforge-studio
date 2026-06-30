import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import type { AssetRepository } from "../application/asset-repository.js";
import {
  parseSerializedTags,
  type AssetListFilters,
  type CreateAssetInput,
  type StudioAsset,
  type UpdateAssetInput
} from "../domain/asset.js";

interface PrismaAssetRepositoryOptions {
  prismaClient?: typeof defaultPrisma;
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
    downloadedAt: asset.downloadedAt?.toISOString() ?? null,
    collectionId: asset.collectionId,
    usageNotes: asset.usageNotes,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString()
  };
}

function serializeUpdateAssetInput(input: UpdateAssetInput) {
  const { tags, ...data } = input;

  if (Object.prototype.hasOwnProperty.call(input, "tags")) {
    return {
      ...data,
      tags: JSON.stringify(tags ?? [])
    };
  }

  return data;
}

export function createPrismaAssetRepository({
  prismaClient = defaultPrisma
}: PrismaAssetRepositoryOptions = {}): AssetRepository {
  return {
    async list(filters: AssetListFilters = {}) {
      const assets = await prismaClient.asset.findMany({
        where: {
          ...(filters.type ? { type: filters.type } : {}),
          ...(filters.category ? { category: filters.category } : {}),
          ...(filters.emotion ? { emotion: filters.emotion } : {}),
          ...(filters.copyrightRisk
            ? { copyrightRisk: filters.copyrightRisk }
            : {}),
          ...(filters.search
            ? {
                OR: [
                  { filename: { contains: filters.search } },
                  { originalName: { contains: filters.search } },
                  { path: { contains: filters.search } },
                  { franchise: { contains: filters.search } },
                  { character: { contains: filters.search } },
                  { tags: { contains: filters.search } }
                ]
              }
            : {})
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return assets.map(mapAsset);
    },
    async getById(id) {
      const asset = await prismaClient.asset.findUnique({
        where: { id }
      });

      return asset ? mapAsset(asset) : null;
    },
    async create(input: CreateAssetInput) {
      const asset = await prismaClient.asset.create({
        data: {
          ...input,
          tags: JSON.stringify(input.tags)
        }
      });

      return mapAsset(asset);
    },
    async update(id: string, input: UpdateAssetInput) {
      const existing = await prismaClient.asset.findUnique({
        where: { id }
      });

      if (!existing) {
        return null;
      }

      const asset = await prismaClient.asset.update({
        where: { id },
        data: serializeUpdateAssetInput(input)
      });

      return mapAsset(asset);
    },
    async delete(id: string) {
      const existing = await prismaClient.asset.findUnique({
        where: { id }
      });

      if (!existing) {
        return false;
      }

      await prismaClient.asset.delete({
        where: { id }
      });

      return true;
    }
  };
}

