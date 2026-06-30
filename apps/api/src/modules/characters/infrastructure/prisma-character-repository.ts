import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import type { StudioAsset } from "../../assets/domain/asset.js";
import { parseSerializedTags } from "../../assets/domain/asset.js";
import type { CharacterRepository } from "../application/character-repository.js";
import type {
  CharacterProfile,
  CharacterReference,
  CreateCharacterProfileInput,
  CreateCharacterReferenceInput,
  UpdateCharacterProfileInput,
  UpdateCharacterReferenceInput
} from "../domain/character.js";

interface PrismaCharacterRepositoryOptions {
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

function mapReference(reference: {
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
}): CharacterReference {
  return {
    id: reference.id,
    characterProfileId: reference.characterProfileId,
    assetId: reference.assetId,
    asset: reference.asset ? mapAsset(reference.asset) : null,
    sourcePath: reference.sourcePath,
    title: reference.title,
    notes: reference.notes,
    referenceType: reference.referenceType as CharacterReference["referenceType"],
    strength: reference.strength,
    createdAt: toIsoString(reference.createdAt),
    updatedAt: toIsoString(reference.updatedAt)
  };
}

const characterInclude = {
  references: {
    orderBy: {
      createdAt: "desc" as const
    },
    include: {
      asset: true
    }
  }
};

function mapProfile(profile: {
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
  references: Array<Parameters<typeof mapReference>[0]>;
}): CharacterProfile {
  return {
    id: profile.id,
    name: profile.name,
    slug: profile.slug,
    franchise: profile.franchise,
    category: profile.category,
    description: profile.description,
    basePrompt: profile.basePrompt,
    negativePrompt: profile.negativePrompt,
    styleNotes: profile.styleNotes,
    defaultVisualStyle: profile.defaultVisualStyle,
    referenceStrength: profile.referenceStrength,
    preferredProvider: profile.preferredProvider,
    tags: parseSerializedTags(profile.tags),
    createdAt: toIsoString(profile.createdAt),
    updatedAt: toIsoString(profile.updatedAt),
    references: profile.references.map(mapReference)
  };
}

function serializeProfileUpdate(input: UpdateCharacterProfileInput) {
  const data: Record<string, unknown> = {};

  if ("name" in input) data.name = input.name;
  if ("slug" in input) data.slug = input.slug;
  if ("franchise" in input) data.franchise = input.franchise;
  if ("category" in input) data.category = input.category;
  if ("description" in input) data.description = input.description;
  if ("basePrompt" in input) data.basePrompt = input.basePrompt;
  if ("negativePrompt" in input) data.negativePrompt = input.negativePrompt;
  if ("styleNotes" in input) data.styleNotes = input.styleNotes;
  if ("defaultVisualStyle" in input) data.defaultVisualStyle = input.defaultVisualStyle;
  if ("referenceStrength" in input) data.referenceStrength = input.referenceStrength ?? 0.75;
  if ("preferredProvider" in input) data.preferredProvider = input.preferredProvider ?? "mock-svg";
  if ("tags" in input) data.tags = JSON.stringify(input.tags ?? []);

  return data;
}

function serializeReferenceUpdate(input: UpdateCharacterReferenceInput) {
  const data: Record<string, unknown> = {};

  if ("assetId" in input) data.assetId = input.assetId;
  if ("sourcePath" in input) data.sourcePath = input.sourcePath;
  if ("title" in input) data.title = input.title;
  if ("notes" in input) data.notes = input.notes;
  if ("referenceType" in input) data.referenceType = input.referenceType ?? "other";
  if ("strength" in input) data.strength = input.strength ?? 0.75;

  return data;
}

export function createPrismaCharacterRepository({
  prismaClient = defaultPrisma
}: PrismaCharacterRepositoryOptions = {}): CharacterRepository {
  return {
    async list() {
      const profiles = await prismaClient.characterProfile.findMany({
        orderBy: {
          createdAt: "desc"
        },
        include: characterInclude
      });

      return profiles.map(mapProfile);
    },
    async getById(id: string) {
      const profile = await prismaClient.characterProfile.findUnique({
        where: { id },
        include: characterInclude
      });

      return profile ? mapProfile(profile) : null;
    },
    async getBySlug(slug: string) {
      const profile = await prismaClient.characterProfile.findUnique({
        where: { slug },
        include: characterInclude
      });

      return profile ? mapProfile(profile) : null;
    },
    async create(input: CreateCharacterProfileInput) {
      const profile = await prismaClient.characterProfile.create({
        data: {
          name: input.name,
          slug: input.slug,
          franchise: input.franchise,
          category: input.category,
          description: input.description,
          basePrompt: input.basePrompt,
          negativePrompt: input.negativePrompt,
          styleNotes: input.styleNotes,
          defaultVisualStyle: input.defaultVisualStyle,
          referenceStrength: input.referenceStrength ?? 0.75,
          preferredProvider: input.preferredProvider ?? "mock-svg",
          tags: JSON.stringify(input.tags)
        },
        include: characterInclude
      });

      return mapProfile(profile);
    },
    async update(id: string, input: UpdateCharacterProfileInput) {
      const existing = await prismaClient.characterProfile.findUnique({
        where: { id }
      });

      if (!existing) {
        return null;
      }

      const profile = await prismaClient.characterProfile.update({
        where: { id },
        data: serializeProfileUpdate(input),
        include: characterInclude
      });

      return mapProfile(profile);
    },
    async delete(id: string) {
      const existing = await prismaClient.characterProfile.findUnique({
        where: { id }
      });

      if (!existing) {
        return false;
      }

      await prismaClient.characterProfile.delete({
        where: { id }
      });

      return true;
    },
    async listReferences(characterProfileId: string) {
      const references = await prismaClient.characterReference.findMany({
        where: { characterProfileId },
        orderBy: {
          createdAt: "desc"
        },
        include: {
          asset: true
        }
      });

      return references.map(mapReference);
    },
    async getReferenceById(characterProfileId: string, referenceId: string) {
      const reference = await prismaClient.characterReference.findFirst({
        where: {
          id: referenceId,
          characterProfileId
        },
        include: {
          asset: true
        }
      });

      return reference ? mapReference(reference) : null;
    },
    async createReference(characterProfileId: string, input: CreateCharacterReferenceInput) {
      const profile = await prismaClient.characterProfile.findUnique({
        where: { id: characterProfileId }
      });

      if (!profile) {
        return null;
      }

      const reference = await prismaClient.characterReference.create({
        data: {
          characterProfileId,
          assetId: input.assetId,
          sourcePath: input.sourcePath,
          title: input.title,
          notes: input.notes,
          referenceType: input.referenceType,
          strength: input.strength ?? profile.referenceStrength
        },
        include: {
          asset: true
        }
      });

      return mapReference(reference);
    },
    async updateReference(
      characterProfileId: string,
      referenceId: string,
      input: UpdateCharacterReferenceInput
    ) {
      const existing = await prismaClient.characterReference.findFirst({
        where: {
          id: referenceId,
          characterProfileId
        }
      });

      if (!existing) {
        return null;
      }

      const reference = await prismaClient.characterReference.update({
        where: { id: referenceId },
        data: serializeReferenceUpdate(input),
        include: {
          asset: true
        }
      });

      return mapReference(reference);
    },
    async deleteReference(characterProfileId: string, referenceId: string) {
      const existing = await prismaClient.characterReference.findFirst({
        where: {
          id: referenceId,
          characterProfileId
        }
      });

      if (!existing) {
        return false;
      }

      await prismaClient.characterReference.delete({
        where: { id: referenceId }
      });

      return true;
    }
  };
}