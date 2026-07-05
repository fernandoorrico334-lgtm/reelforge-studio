import type { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "../../../infrastructure/database/prisma-client.js";
import type { ProductionDiscoveryRepository } from "../application/production-discovery-repository.js";
import {
  parseJsonArray,
  serializeJson,
  type CreateProductionDiscoveryPackageInput,
  type ProductionDiscoveryPackage,
  type ProductionDiscoveryStatus,
  type UpdateProductionDiscoveryPackageInput
} from "../domain/production-discovery.js";

interface PrismaProductionDiscoveryRepositoryOptions {
  prismaClient?: typeof defaultPrisma;
}

type ProductionDiscoveryRecord = {
  id: string;
  topic: string;
  niche: string;
  title: string;
  angle: string | null;
  language: string;
  tone: string | null;
  targetDurationSeconds: number | null;
  status: ProductionDiscoveryStatus;
  researchDossierId: string | null;
  mediaCollectionIds: string;
  suggestedTemplateId: string | null;
  suggestedEditingReferencePresetId: string | null;
  suggestedMusicPresetId: string | null;
  suggestedAudioMasteringPresetId: string | null;
  suggestedWorkflowPackId: string | null;
  summary: string | null;
  outline: string;
  assetRequirements: string;
  mediaCandidatesSummary: string;
  warnings: string;
  createdProjectId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toIsoString(value: Date) {
  return value.toISOString();
}

function mapPackage(record: ProductionDiscoveryRecord): ProductionDiscoveryPackage {
  return {
    id: record.id,
    topic: record.topic,
    niche: record.niche,
    title: record.title,
    angle: record.angle,
    language: record.language,
    tone: record.tone,
    targetDurationSeconds: record.targetDurationSeconds,
    status: record.status,
    researchDossierId: record.researchDossierId,
    mediaCollectionIds: parseJsonArray<string>(record.mediaCollectionIds, []),
    suggestedTemplateId: record.suggestedTemplateId,
    suggestedEditingReferencePresetId: record.suggestedEditingReferencePresetId,
    suggestedMusicPresetId: record.suggestedMusicPresetId,
    suggestedAudioMasteringPresetId: record.suggestedAudioMasteringPresetId,
    suggestedWorkflowPackId: record.suggestedWorkflowPackId,
    summary: record.summary,
    outline: parseJsonArray<Record<string, unknown>>(record.outline, []),
    assetRequirements: parseJsonArray<Record<string, unknown>>(record.assetRequirements, []),
    mediaCandidatesSummary: parseJsonArray<Record<string, unknown>>(record.mediaCandidatesSummary, []),
    warnings: parseJsonArray<string>(record.warnings, []),
    createdProjectId: record.createdProjectId,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt)
  };
}

function serializeCreate(
  input: CreateProductionDiscoveryPackageInput
): Prisma.ProductionDiscoveryPackageUncheckedCreateInput {
  return {
    ...input,
    mediaCollectionIds: serializeJson(input.mediaCollectionIds),
    outline: serializeJson(input.outline),
    assetRequirements: serializeJson(input.assetRequirements),
    mediaCandidatesSummary: serializeJson(input.mediaCandidatesSummary),
    warnings: serializeJson(input.warnings)
  };
}

function serializeUpdate(
  input: UpdateProductionDiscoveryPackageInput
): Prisma.ProductionDiscoveryPackageUncheckedUpdateInput {
  const data: Record<string, unknown> = { ...input };

  for (const key of [
    "mediaCollectionIds",
    "outline",
    "assetRequirements",
    "mediaCandidatesSummary",
    "warnings"
  ]) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      data[key] = serializeJson(data[key]);
    }
  }

  return data as Prisma.ProductionDiscoveryPackageUncheckedUpdateInput;
}

export function createPrismaProductionDiscoveryRepository({
  prismaClient = defaultPrisma
}: PrismaProductionDiscoveryRepositoryOptions = {}): ProductionDiscoveryRepository {
  return {
    async list() {
      const items = await prismaClient.productionDiscoveryPackage.findMany({
        orderBy: { createdAt: "desc" }
      });
      return items.map((item) => mapPackage(item as ProductionDiscoveryRecord));
    },
    async getById(id) {
      const item = await prismaClient.productionDiscoveryPackage.findUnique({
        where: { id }
      });
      return item ? mapPackage(item as ProductionDiscoveryRecord) : null;
    },
    async create(input) {
      const item = await prismaClient.productionDiscoveryPackage.create({
        data: serializeCreate(input)
      });
      return mapPackage(item as ProductionDiscoveryRecord);
    },
    async update(id, input) {
      const existing = await prismaClient.productionDiscoveryPackage.findUnique({
        where: { id }
      });
      if (!existing) {
        return null;
      }

      const item = await prismaClient.productionDiscoveryPackage.update({
        where: { id },
        data: serializeUpdate(input)
      });
      return mapPackage(item as ProductionDiscoveryRecord);
    }
  };
}
