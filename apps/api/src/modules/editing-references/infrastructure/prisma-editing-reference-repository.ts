import { prisma } from "../../../infrastructure/database/prisma-client.js";
import type { EditingReferenceRepository } from "../application/editing-reference-repository.js";
import type {
  CreateEditingReferenceInput,
  CreateEditingReferencePresetInput,
  EditingReference,
  EditingReferenceFilters,
  EditingReferencePreset,
  EditingReferencePresetFilters,
  UpdateEditingReferenceInput,
  UpdateEditingReferencePresetInput
} from "../domain/editing-reference.js";
import {
  parseSerializedTags,
  type StudioAsset
} from "../../assets/domain/asset.js";

function parseStringList(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

function serializeStringList(value: string[] | undefined) {
  if (!value) {
    return undefined;
  }

  return JSON.stringify(value);
}

function toStudioAsset(record: any): StudioAsset {
  return {
    id: record.id,
    filename: record.filename,
    originalName: record.originalName,
    path: record.path,
    type: record.type,
    category: record.category,
    franchise: record.franchise ?? null,
    character: record.character ?? null,
    emotion: record.emotion ?? null,
    tags: parseSerializedTags(record.tags),
    licenseType: record.licenseType,
    copyrightRisk: record.copyrightRisk,
    recommendedUse: record.recommendedUse ?? null,
    duration: record.duration ?? null,
    width: record.width ?? null,
    height: record.height ?? null,
    mimeType: record.mimeType ?? null,
    extension: record.extension ?? null,
    fileSize: record.fileSize ?? null,
    sourceProvider: record.sourceProvider ?? null,
    sourceUrl: record.sourceUrl ?? null,
    sourceAuthor: record.sourceAuthor ?? null,
    sourceLicense: record.sourceLicense ?? null,
    sourceLicenseUrl: record.sourceLicenseUrl ?? null,
    downloadedAt: record.downloadedAt?.toISOString?.() ?? null,
    collectionId: record.collectionId ?? null,
    usageNotes: record.usageNotes ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toEditingReference(record: any): EditingReference {
  return {
    id: record.id,
    title: record.title,
    description: record.description ?? null,
    assetId: record.assetId ?? null,
    localPath: record.localPath ?? null,
    sourceType: record.sourceType,
    category: record.category,
    status: record.status,
    durationSeconds: record.durationSeconds ?? null,
    averageCutPaceSeconds: record.averageCutPaceSeconds ?? null,
    beatIntensity: record.beatIntensity,
    pacing: record.pacing,
    zoomStyle: record.zoomStyle,
    flashStyle: record.flashStyle,
    transitionStyle: record.transitionStyle,
    captionStyle: record.captionStyle,
    narrationStyle: record.narrationStyle,
    musicStyle: record.musicStyle,
    sfxStyle: record.sfxStyle,
    hookStyle: record.hookStyle,
    ctaStyle: record.ctaStyle,
    microclipPlacement: record.microclipPlacement,
    visualStyleNotes: record.visualStyleNotes ?? null,
    audioStyleNotes: record.audioStyleNotes ?? null,
    editingStyleNotes: record.editingStyleNotes ?? null,
    analysisWarnings: parseStringList(record.analysisWarnings),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    asset: record.asset ? toStudioAsset(record.asset) : null
  };
}

function toEditingReferencePreset(record: any): EditingReferencePreset {
  return {
    id: record.id,
    referenceId: record.referenceId ?? null,
    name: record.name,
    slug: record.slug,
    description: record.description,
    useCase: record.useCase,
    cutPace: record.cutPace ?? null,
    pacing: record.pacing,
    zoomStyle: record.zoomStyle,
    flashStyle: record.flashStyle,
    transitionStyle: record.transitionStyle,
    captionStyle: record.captionStyle,
    narrationStyle: record.narrationStyle,
    musicStyle: record.musicStyle,
    sfxStyle: record.sfxStyle,
    hookStyle: record.hookStyle,
    ctaStyle: record.ctaStyle,
    microclipPlacement: record.microclipPlacement,
    recommendedTemplates: parseStringList(record.recommendedTemplates),
    recommendedMusicPresetId: record.recommendedMusicPresetId ?? null,
    recommendedAudioMasteringPresetId:
      record.recommendedAudioMasteringPresetId ?? null,
    recommendedNarrationVoicePackId:
      record.recommendedNarrationVoicePackId ?? null,
    defaultShotDurationSeconds: record.defaultShotDurationSeconds ?? null,
    notes: record.notes ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    reference: record.reference ? toEditingReference(record.reference) : null
  };
}

const referenceInclude = {
  asset: true
} as const;

const presetInclude = {
  reference: {
    include: referenceInclude
  }
} as const;

function buildReferenceWhere(filters: EditingReferenceFilters) {
  return {
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.sourceType ? { sourceType: filters.sourceType } : {})
  };
}

export function createPrismaEditingReferenceRepository(): EditingReferenceRepository {
  return {
    async listReferences(filters = {}) {
      const items = await prisma.editingReference.findMany({
        where: buildReferenceWhere(filters),
        orderBy: {
          createdAt: "desc"
        },
        include: referenceInclude
      });

      return items.map(toEditingReference);
    },

    async getReferenceById(id) {
      const item = await prisma.editingReference.findUnique({
        where: { id },
        include: referenceInclude
      });

      return item ? toEditingReference(item) : null;
    },

    async createReference(input) {
      const item = await prisma.editingReference.create({
        data: {
          ...input,
          analysisWarnings: JSON.stringify(input.analysisWarnings)
        },
        include: referenceInclude
      });

      return toEditingReference(item);
    },

    async updateReference(id, input) {
      const data: any = { ...input };

      if (input.analysisWarnings !== undefined) {
        data.analysisWarnings = JSON.stringify(input.analysisWarnings);
      }

      const item = await prisma.editingReference.update({
        where: { id },
        data,
        include: referenceInclude
      }).catch((error) => {
        if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
          return null;
        }

        throw error;
      });

      return item ? toEditingReference(item) : null;
    },

    async deleteReference(id) {
      const result = await prisma.editingReference.delete({
        where: { id }
      }).catch((error) => {
        if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
          return null;
        }

        throw error;
      });

      return Boolean(result);
    },

    async listPresets(filters = {}) {
      const items = await prisma.editingReferencePreset.findMany({
        where: {
          ...(filters.useCase ? { useCase: filters.useCase } : {}),
          ...(filters.referenceId ? { referenceId: filters.referenceId } : {})
        },
        orderBy: {
          createdAt: "desc"
        },
        include: presetInclude
      });
      const normalized = items.map(toEditingReferencePreset);

      if (!filters.templateId) {
        return normalized;
      }

      return normalized.filter((item) =>
        item.recommendedTemplates.includes(filters.templateId!)
      );
    },

    async getPresetById(id) {
      const item = await prisma.editingReferencePreset.findUnique({
        where: { id },
        include: presetInclude
      });

      return item ? toEditingReferencePreset(item) : null;
    },

    async getPresetBySlug(slug) {
      const item = await prisma.editingReferencePreset.findUnique({
        where: { slug },
        include: presetInclude
      });

      return item ? toEditingReferencePreset(item) : null;
    },

    async createPreset(input) {
      const item = await prisma.editingReferencePreset.create({
        data: {
          ...input,
          recommendedTemplates: JSON.stringify(input.recommendedTemplates)
        },
        include: presetInclude
      });

      return toEditingReferencePreset(item);
    },

    async updatePreset(id, input) {
      const data: any = { ...input };

      if (input.recommendedTemplates !== undefined) {
        data.recommendedTemplates = JSON.stringify(input.recommendedTemplates);
      }

      const item = await prisma.editingReferencePreset.update({
        where: { id },
        data,
        include: presetInclude
      }).catch((error) => {
        if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
          return null;
        }

        throw error;
      });

      return item ? toEditingReferencePreset(item) : null;
    },

    async deletePreset(id) {
      const result = await prisma.editingReferencePreset.delete({
        where: { id }
      }).catch((error) => {
        if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
          return null;
        }

        throw error;
      });

      return Boolean(result);
    }
  };
}
