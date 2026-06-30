import { ValidationError } from "../../../shared/errors.js";
import {
  normalizeOptionalAssetCategoryValue,
  normalizeOptionalCopyrightRiskValue,
  normalizeOptionalEmotionTagValue,
  normalizeOptionalString,
  parseTagInput,
  type AssetCategory,
  type CopyrightRisk,
  type EmotionTag
} from "../../assets/domain/asset.js";
import {
  normalizeOptionalIntakeMediaTypeValue,
  type IntakeMediaType
} from "../../intake/domain/intake.js";

export const mediaCollectorProviderIds = [
  "manual-url",
  "wikimedia-commons",
  "nasa-media",
  "internet-archive",
  "pexels",
  "pixabay",
  "unsplash"
] as const;

export type MediaCollectorProviderId =
  (typeof mediaCollectorProviderIds)[number];

export interface MediaCollectorProviderDescriptor {
  id: MediaCollectorProviderId;
  name: string;
  description: string;
  requiresApiKey: boolean;
  apiKeyEnv: string | null;
  configured: boolean;
  experimental: boolean;
  supportedMediaTypes: IntakeMediaType[];
}

export interface CreateMediaCollectionRequestInput {
  name: string;
  channelId: string | null;
  projectId: string | null;
  dossierId: string | null;
  assetRequirementId: string | null;
  provider: MediaCollectorProviderId;
  query: string | null;
  targetCount: number | null;
  mediaType: IntakeMediaType | null;
  notes: string | null;
}

export interface CreateManualUrlCandidateInput {
  collectionId: string | null;
  name: string | null;
  channelId: string | null;
  projectId: string | null;
  dossierId: string | null;
  assetRequirementId: string | null;
  title: string;
  sourceUrl: string;
  mediaType: IntakeMediaType;
  category: AssetCategory | null;
  franchise: string | null;
  character: string | null;
  emotion: EmotionTag | null;
  tags: string[];
  copyrightRisk: CopyrightRisk | null;
  recommendedUse: string | null;
  sourceAuthor: string | null;
  sourceLicense: string | null;
  sourceLicenseUrl: string | null;
  usageNotes: string | null;
}

export interface MediaCollectionSearchSummary {
  collectionId: string;
  candidatesCreated: number;
  candidatesSkipped: number;
}

export interface CreateMediaCollectionsForProjectSummary {
  projectId: string;
  missingSceneCount: number;
  collectionsCreated: number;
  collectionIds: string[];
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Expected a JSON object.");
  }

  return payload as Record<string, unknown>;
}

function ensureRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalNumber(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number or null.`);
  }

  return value;
}

function normalizeOptionalPositiveInteger(value: unknown, fieldName: string) {
  const parsed = normalizeOptionalNumber(value, fieldName);

  if (parsed === undefined) {
    return undefined;
  }

  if (parsed === null) {
    return null;
  }

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`${fieldName} must be a positive integer or null.`);
  }

  return parsed;
}

export function normalizeMediaCollectorProviderId(
  value: unknown,
  fieldName = "provider"
): MediaCollectorProviderId {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be one of: ${mediaCollectorProviderIds.join(", ")}.`
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!mediaCollectorProviderIds.includes(normalized as MediaCollectorProviderId)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${mediaCollectorProviderIds.join(", ")}.`
    );
  }

  return normalized as MediaCollectorProviderId;
}

export function validateCreateMediaCollectionRequestInput(
  payload: unknown
): CreateMediaCollectionRequestInput {
  const record = asRecord(payload);

  return {
    name: ensureRequiredString(record.name, "name"),
    channelId: normalizeOptionalString(record.channelId, "channelId") ?? null,
    projectId: normalizeOptionalString(record.projectId, "projectId") ?? null,
    dossierId: normalizeOptionalString(record.dossierId, "dossierId") ?? null,
    assetRequirementId:
      normalizeOptionalString(record.assetRequirementId, "assetRequirementId") ??
      null,
    provider: normalizeMediaCollectorProviderId(record.provider),
    query: normalizeOptionalString(record.query, "query") ?? null,
    targetCount:
      normalizeOptionalPositiveInteger(record.targetCount, "targetCount") ?? null,
    mediaType:
      normalizeOptionalIntakeMediaTypeValue(record.mediaType, "mediaType") ??
      null,
    notes: normalizeOptionalString(record.notes, "notes") ?? null
  };
}

function isLikelyLocalPath(value: string) {
  return (
    /^[a-zA-Z]:\\/u.test(value) ||
    value.startsWith("\\\\") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("storage/")
  );
}

export function normalizeDirectMediaSource(value: unknown) {
  const source = ensureRequiredString(value, "sourceUrl");

  if (isLikelyLocalPath(source)) {
    return source;
  }

  try {
    const url = new URL(source);

    if (!["http:", "https:", "file:"].includes(url.protocol)) {
      throw new ValidationError(
        "sourceUrl must use http, https, file or a local path."
      );
    }

    return source;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    throw new ValidationError(
      "sourceUrl must be a valid direct URL or a local file path."
    );
  }
}

export function validateCreateManualUrlCandidateInput(
  payload: unknown
): CreateManualUrlCandidateInput {
  const record = asRecord(payload);
  const sourceLicense =
    normalizeOptionalString(record.sourceLicense, "sourceLicense") ?? null;
  const usageNotes =
    normalizeOptionalString(record.usageNotes, "usageNotes") ?? null;

  if (!sourceLicense && !usageNotes) {
    throw new ValidationError(
      "Provide sourceLicense or usageNotes for manual-url candidates."
    );
  }

  return {
    collectionId:
      normalizeOptionalString(record.collectionId, "collectionId") ?? null,
    name: normalizeOptionalString(record.name, "name") ?? null,
    channelId: normalizeOptionalString(record.channelId, "channelId") ?? null,
    projectId: normalizeOptionalString(record.projectId, "projectId") ?? null,
    dossierId: normalizeOptionalString(record.dossierId, "dossierId") ?? null,
    assetRequirementId:
      normalizeOptionalString(record.assetRequirementId, "assetRequirementId") ??
      null,
    title: ensureRequiredString(record.title, "title"),
    sourceUrl: normalizeDirectMediaSource(record.sourceUrl),
    mediaType:
      normalizeOptionalIntakeMediaTypeValue(record.mediaType, "mediaType") ??
      (() => {
        throw new ValidationError("mediaType is required.");
      })(),
    category:
      normalizeOptionalAssetCategoryValue(record.category, "category") ?? null,
    franchise: normalizeOptionalString(record.franchise, "franchise") ?? null,
    character: normalizeOptionalString(record.character, "character") ?? null,
    emotion:
      normalizeOptionalEmotionTagValue(record.emotion, "emotion") ?? null,
    tags: parseTagInput(record.tags),
    copyrightRisk:
      normalizeOptionalCopyrightRiskValue(
        record.copyrightRisk,
        "copyrightRisk"
      ) ?? null,
    recommendedUse:
      normalizeOptionalString(record.recommendedUse, "recommendedUse") ?? null,
    sourceAuthor:
      normalizeOptionalString(record.sourceAuthor, "sourceAuthor") ?? null,
    sourceLicense,
    sourceLicenseUrl:
      normalizeOptionalString(record.sourceLicenseUrl, "sourceLicenseUrl") ??
      null,
    usageNotes
  };
}

