import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import type { AssetRepository } from "../application/asset-repository.js";
import {
  parseSerializedTags,
  type AssetListFilters,
  type CreateAssetInput,
  type StudioAsset,
  type UpdateAssetInput
} from "../domain/asset.js";
import type {
  MusicAssetProfile,
  SfxAssetProfile
} from "@reelforge/audio-engine";

interface PrismaAssetRepositoryOptions {
  prismaClient?: typeof defaultPrisma;
}

function parseJsonValue<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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
  musicProfile?: {
    assetId: string;
    title: string;
    artist: string | null;
    sourceType: MusicAssetProfile["sourceType"];
    licenseStatus: MusicAssetProfile["licenseStatus"];
    mood: MusicAssetProfile["mood"];
    genre: MusicAssetProfile["genre"];
    bpm: number | null;
    bpmConfidence: number;
    energy: MusicAssetProfile["energy"];
    useCase: MusicAssetProfile["useCase"];
    durationSeconds: number | null;
    loudness: number | null;
    beatMarkers: string;
    energyTimeline: string;
    notes: string | null;
    safetyWarning: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  sfxProfile?: {
    assetId: string;
    title: string;
    category: SfxAssetProfile["category"];
    intensity: SfxAssetProfile["intensity"];
    durationSeconds: number | null;
    useCase: SfxAssetProfile["useCase"];
    licenseStatus: SfxAssetProfile["licenseStatus"];
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
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
    musicProfile: asset.musicProfile
      ? {
          assetId: asset.musicProfile.assetId,
          title: asset.musicProfile.title,
          artist: asset.musicProfile.artist,
          sourceType: asset.musicProfile.sourceType,
          licenseStatus: asset.musicProfile.licenseStatus,
          mood: asset.musicProfile.mood,
          genre: asset.musicProfile.genre,
          bpm: asset.musicProfile.bpm,
          bpmConfidence: asset.musicProfile.bpmConfidence,
          energy: asset.musicProfile.energy,
          useCase: asset.musicProfile.useCase,
          durationSeconds: asset.musicProfile.durationSeconds,
          loudness: asset.musicProfile.loudness,
          beatMarkers: parseJsonValue(asset.musicProfile.beatMarkers, []),
          energyTimeline: parseJsonValue(asset.musicProfile.energyTimeline, []),
          notes: asset.musicProfile.notes,
          safetyWarning: asset.musicProfile.safetyWarning,
          createdAt: asset.musicProfile.createdAt.toISOString(),
          updatedAt: asset.musicProfile.updatedAt.toISOString()
        }
      : null,
    sfxProfile: asset.sfxProfile
      ? {
          assetId: asset.sfxProfile.assetId,
          title: asset.sfxProfile.title,
          category: asset.sfxProfile.category,
          intensity: asset.sfxProfile.intensity,
          durationSeconds: asset.sfxProfile.durationSeconds,
          useCase: asset.sfxProfile.useCase,
          licenseStatus: asset.sfxProfile.licenseStatus,
          notes: asset.sfxProfile.notes,
          createdAt: asset.sfxProfile.createdAt.toISOString(),
          updatedAt: asset.sfxProfile.updatedAt.toISOString()
        }
      : null,
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
        },
        include: {
          musicProfile: true,
          sfxProfile: true
        }
      });

      return assets.map(mapAsset);
    },
    async getById(id) {
      const asset = await prismaClient.asset.findUnique({
        where: { id },
        include: {
          musicProfile: true,
          sfxProfile: true
        }
      });

      return asset ? mapAsset(asset) : null;
    },
    async create(input: CreateAssetInput) {
      const asset = await prismaClient.asset.create({
        data: {
          ...input,
          tags: JSON.stringify(input.tags)
        },
        include: {
          musicProfile: true,
          sfxProfile: true
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
        data: serializeUpdateAssetInput(input),
        include: {
          musicProfile: true,
          sfxProfile: true
        }
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

