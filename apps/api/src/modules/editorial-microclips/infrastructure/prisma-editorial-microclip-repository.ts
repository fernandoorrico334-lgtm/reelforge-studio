import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import { parseSerializedTags, type StudioAsset } from "../../assets/domain/asset.js";
import type { EditorialMicroclipRepository } from "../application/editorial-microclip-repository.js";
import type {
  CreateEditorialMicroclipInput,
  EditorialMicroclip,
  UpdateEditorialMicroclipInput
} from "../domain/editorial-microclip.js";

interface PrismaEditorialMicroclipRepositoryOptions {
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

function mapMicroclip(clip: {
  id: string;
  projectId: string;
  sceneId: string | null;
  assetId: string;
  label: string;
  sourceType: EditorialMicroclip["sourceType"];
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  usageMode: EditorialMicroclip["usageMode"];
  narrationOverlay: boolean;
  textOverlay: string | null;
  calloutStyle: EditorialMicroclip["calloutStyle"];
  transitionIn: EditorialMicroclip["transitionIn"];
  transitionOut: EditorialMicroclip["transitionOut"];
  volumeMode: EditorialMicroclip["volumeMode"];
  orderIndex: number;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
  asset: Parameters<typeof mapAsset>[0] | null;
}): EditorialMicroclip {
  return {
    id: clip.id,
    projectId: clip.projectId,
    sceneId: clip.sceneId,
    assetId: clip.assetId,
    asset: clip.asset ? mapAsset(clip.asset) : null,
    label: clip.label,
    sourceType: clip.sourceType,
    startTimeSeconds: clip.startTimeSeconds,
    endTimeSeconds: clip.endTimeSeconds,
    durationSeconds: clip.durationSeconds,
    usageMode: clip.usageMode,
    narrationOverlay: clip.narrationOverlay,
    textOverlay: clip.textOverlay,
    calloutStyle: clip.calloutStyle,
    transitionIn: clip.transitionIn,
    transitionOut: clip.transitionOut,
    volumeMode: clip.volumeMode,
    orderIndex: clip.orderIndex,
    metadata: clip.metadata
      ? (JSON.parse(clip.metadata) as Record<string, unknown>)
      : null,
    createdAt: toIsoString(clip.createdAt),
    updatedAt: toIsoString(clip.updatedAt)
  };
}

function serializeUpdate(input: UpdateEditorialMicroclipInput) {
  const data: Record<string, unknown> = {};

  if ("sceneId" in input) data.sceneId = input.sceneId;
  if ("assetId" in input) data.assetId = input.assetId;
  if ("label" in input) data.label = input.label;
  if ("sourceType" in input) data.sourceType = input.sourceType;
  if ("startTimeSeconds" in input) data.startTimeSeconds = input.startTimeSeconds;
  if ("endTimeSeconds" in input) data.endTimeSeconds = input.endTimeSeconds;
  if ("durationSeconds" in input) data.durationSeconds = input.durationSeconds;
  if ("usageMode" in input) data.usageMode = input.usageMode;
  if ("narrationOverlay" in input) data.narrationOverlay = input.narrationOverlay;
  if ("textOverlay" in input) data.textOverlay = input.textOverlay;
  if ("calloutStyle" in input) data.calloutStyle = input.calloutStyle;
  if ("transitionIn" in input) data.transitionIn = input.transitionIn;
  if ("transitionOut" in input) data.transitionOut = input.transitionOut;
  if ("volumeMode" in input) data.volumeMode = input.volumeMode;
  if ("orderIndex" in input) data.orderIndex = input.orderIndex;
  if ("metadata" in input) {
    data.metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  }

  return data;
}

export function createPrismaEditorialMicroclipRepository({
  prismaClient = defaultPrisma
}: PrismaEditorialMicroclipRepositoryOptions = {}): EditorialMicroclipRepository {
  return {
    async listByProjectId(projectId) {
      const clips = await prismaClient.editorialMicroclip.findMany({
        where: { projectId },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        include: {
          asset: true
        }
      });

      return clips.map(mapMicroclip);
    },
    async getById(id) {
      const clip = await prismaClient.editorialMicroclip.findUnique({
        where: { id },
        include: {
          asset: true
        }
      });

      return clip ? mapMicroclip(clip) : null;
    },
    async create(input: CreateEditorialMicroclipInput) {
      const clip = await prismaClient.editorialMicroclip.create({
        data: {
          projectId: input.projectId,
          sceneId: input.sceneId,
          assetId: input.assetId,
          label: input.label,
          sourceType: input.sourceType,
          startTimeSeconds: input.startTimeSeconds,
          endTimeSeconds: input.endTimeSeconds,
          durationSeconds: input.durationSeconds,
          usageMode: input.usageMode,
          narrationOverlay: input.narrationOverlay,
          textOverlay: input.textOverlay,
          calloutStyle: input.calloutStyle,
          transitionIn: input.transitionIn,
          transitionOut: input.transitionOut,
          volumeMode: input.volumeMode,
          orderIndex: input.orderIndex,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null
        },
        include: {
          asset: true
        }
      });

      return mapMicroclip(clip);
    },
    async update(id, input) {
      const existing = await prismaClient.editorialMicroclip.findUnique({
        where: { id }
      });

      if (!existing) {
        return null;
      }

      const clip = await prismaClient.editorialMicroclip.update({
        where: { id },
        data: serializeUpdate(input),
        include: {
          asset: true
        }
      });

      return mapMicroclip(clip);
    },
    async delete(id) {
      const existing = await prismaClient.editorialMicroclip.findUnique({
        where: { id },
        select: { id: true }
      });

      if (!existing) {
        return false;
      }

      await prismaClient.editorialMicroclip.delete({
        where: { id }
      });

      return true;
    },
    async countByProjectId(projectId) {
      return prismaClient.editorialMicroclip.count({
        where: { projectId }
      });
    }
  };
}
