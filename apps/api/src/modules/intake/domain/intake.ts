import { ValidationError } from "../../../shared/errors.js";
import {
  normalizeOptionalAssetCategoryValue,
  normalizeOptionalCopyrightRiskValue,
  normalizeOptionalEmotionTagValue,
  normalizeOptionalString,
  parseSerializedTags,
  parseTagInput,
  type AssetCategory,
  type CopyrightRisk,
  type EmotionTag
} from "../../assets/domain/asset.js";

export const mediaCollectionStatuses = [
  "draft",
  "scanning",
  "ready_for_review",
  "importing",
  "completed",
  "failed"
] as const;

export type MediaCollectionStatus =
  (typeof mediaCollectionStatuses)[number];

export const mediaCandidateStatuses = [
  "pending",
  "approved",
  "rejected",
  "imported",
  "failed"
] as const;

export type MediaCandidateStatus = (typeof mediaCandidateStatuses)[number];

export const intakeMediaTypes = [
  "image",
  "video",
  "audio",
  "music",
  "sfx",
  "overlay",
  "document",
  "reference"
] as const;

export type IntakeMediaType = (typeof intakeMediaTypes)[number];

export interface MediaCollection {
  id: string;
  name: string;
  channelId: string | null;
  projectId: string | null;
  dossierId: string | null;
  assetRequirementId: string | null;
  provider: string;
  query: string | null;
  sourcePath: string | null;
  mediaType: IntakeMediaType | null;
  status: MediaCollectionStatus;
  targetCount: number | null;
  importedCount: number;
  rejectedCount: number;
  notes: string | null;
  candidateCount: number;
  pendingCount: number;
  approvedCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaCandidate {
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
  mediaType: IntakeMediaType;
  detectedType: string | null;
  suggestedCategory: AssetCategory | null;
  suggestedTags: string[];
  suggestedCharacter: string | null;
  suggestedProject: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number | null;
  extension: string | null;
  mimeType: string | null;
  category: AssetCategory | null;
  franchise: string | null;
  character: string | null;
  emotion: EmotionTag | null;
  tags: string[];
  copyrightRisk: CopyrightRisk | null;
  recommendedUse: string | null;
  usageNotes: string | null;
  status: MediaCandidateStatus;
  assetId: string | null;
  errorMessage: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeCollectionDetail {
  collection: MediaCollection;
  candidates: MediaCandidate[];
}

export interface MediaCollectionListFilters {
  channelId?: string;
  projectId?: string;
  dossierId?: string;
  assetRequirementId?: string;
  provider?: string;
}

export interface CreateMediaCollectionInput {
  name: string;
  channelId: string | null;
  projectId: string | null;
  dossierId: string | null;
  assetRequirementId: string | null;
  provider: string;
  query: string | null;
  sourcePath: string | null;
  mediaType: IntakeMediaType | null;
  status: MediaCollectionStatus;
  targetCount: number | null;
  importedCount: number;
  rejectedCount: number;
  notes: string | null;
}

export interface UpdateMediaCollectionInput {
  name?: string;
  channelId?: string | null;
  projectId?: string | null;
  dossierId?: string | null;
  assetRequirementId?: string | null;
  query?: string | null;
  sourcePath?: string | null;
  mediaType?: IntakeMediaType | null;
  status?: MediaCollectionStatus;
  targetCount?: number | null;
  importedCount?: number;
  rejectedCount?: number;
  notes?: string | null;
}

export interface CreateMediaCandidateInput {
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
  mediaType: IntakeMediaType;
  detectedType: string | null;
  suggestedCategory: AssetCategory | null;
  suggestedTags: string[];
  suggestedCharacter: string | null;
  suggestedProject: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number | null;
  extension: string | null;
  mimeType: string | null;
  category: AssetCategory | null;
  franchise: string | null;
  character: string | null;
  emotion: EmotionTag | null;
  tags: string[];
  copyrightRisk: CopyrightRisk | null;
  recommendedUse: string | null;
  usageNotes: string | null;
  status: MediaCandidateStatus;
  assetId: string | null;
  errorMessage: string | null;
  contentHash: string | null;
}

export interface UpdateMediaCandidateInput {
  previewUrl?: string | null;
  downloadUrl?: string | null;
  sourceUrl?: string | null;
  sourceAuthor?: string | null;
  sourceLicense?: string | null;
  sourceLicenseUrl?: string | null;
  mediaType?: IntakeMediaType;
  detectedType?: string | null;
  suggestedCategory?: AssetCategory | null;
  suggestedTags?: string[];
  suggestedCharacter?: string | null;
  suggestedProject?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  fileSize?: number | null;
  extension?: string | null;
  mimeType?: string | null;
  category?: AssetCategory | null;
  franchise?: string | null;
  character?: string | null;
  emotion?: EmotionTag | null;
  tags?: string[];
  copyrightRisk?: CopyrightRisk | null;
  recommendedUse?: string | null;
  usageNotes?: string | null;
  status?: MediaCandidateStatus;
  assetId?: string | null;
  errorMessage?: string | null;
  contentHash?: string | null;
}

export interface MediaCandidateListFilters {
  collectionId?: string;
  status?: MediaCandidateStatus;
  provider?: string;
  mediaType?: IntakeMediaType;
  category?: AssetCategory;
  character?: string;
  suggestedProject?: string;
}

export interface IntakeFolderDescriptor {
  id: string;
  label: string;
  relativePath: string;
  absolutePath: string;
}

export interface IntakeFoldersResponse {
  rootPath: string;
  folders: IntakeFolderDescriptor[];
}

export interface ScanInboxSummary {
  collection: MediaCollection;
  candidatesCreated: number;
  candidatesSkipped: number;
  createdCandidateIds: string[];
  candidates: MediaCandidate[];
}

export interface IntakeImportError {
  candidateId: string;
  title: string;
  message: string;
}

export interface ImportApprovedSummary {
  collectionIds: string[];
  candidateIds: string[];
  assetIds: string[];
  importedCount: number;
  failedCount: number;
  errors: IntakeImportError[];
}

function isEnumValue<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Expected a JSON object.");
  }

  return payload as Record<string, unknown>;
}

function normalizeEnumValue<T extends string>(
  values: readonly T[],
  value: unknown,
  fieldName: string
): T {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be one of: ${values.join(", ")}.`
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!isEnumValue(values, normalized)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${values.join(", ")}.`
    );
  }

  return normalized;
}

function normalizeOptionalEnumValue<T extends string>(
  values: readonly T[],
  value: unknown,
  fieldName: string
): T | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return normalizeEnumValue(values, value, fieldName);
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

export function normalizeMediaCollectionStatusValue(
  value: unknown,
  fieldName = "status"
) {
  return normalizeEnumValue(mediaCollectionStatuses, value, fieldName);
}

export function normalizeMediaCandidateStatusValue(
  value: unknown,
  fieldName = "status"
) {
  return normalizeEnumValue(mediaCandidateStatuses, value, fieldName);
}

export function normalizeOptionalMediaCandidateStatusValue(
  value: unknown,
  fieldName = "status"
) {
  return normalizeOptionalEnumValue(mediaCandidateStatuses, value, fieldName);
}

export function normalizeIntakeMediaTypeValue(
  value: unknown,
  fieldName = "mediaType"
) {
  return normalizeEnumValue(intakeMediaTypes, value, fieldName);
}

export function normalizeOptionalIntakeMediaTypeValue(
  value: unknown,
  fieldName = "mediaType"
) {
  return normalizeOptionalEnumValue(intakeMediaTypes, value, fieldName);
}

export function validateMediaCandidateFilters(
  rawFilters: Record<string, string | undefined>
): MediaCandidateListFilters {
  const filters: MediaCandidateListFilters = {};

  if (rawFilters.collectionId?.trim()) {
    filters.collectionId = rawFilters.collectionId.trim();
  }

  if (rawFilters.status?.trim()) {
    filters.status = normalizeMediaCandidateStatusValue(
      rawFilters.status,
      "status filter"
    );
  }

  if (rawFilters.provider?.trim()) {
    filters.provider = rawFilters.provider.trim();
  }

  if (rawFilters.mediaType?.trim()) {
    filters.mediaType = normalizeIntakeMediaTypeValue(
      rawFilters.mediaType,
      "mediaType filter"
    );
  }

  if (rawFilters.category?.trim()) {
    const category = normalizeOptionalAssetCategoryValue(
      rawFilters.category,
      "category filter"
    );

    if (category) {
      filters.category = category;
    }
  }

  if (rawFilters.character?.trim()) {
    filters.character = rawFilters.character.trim();
  }

  if (rawFilters.suggestedProject?.trim()) {
    filters.suggestedProject = rawFilters.suggestedProject.trim();
  }

  return filters;
}

export function validateUpdateMediaCandidateInput(
  payload: unknown
): UpdateMediaCandidateInput {
  const record = asRecord(payload);
  const update: UpdateMediaCandidateInput = {};

  if ("previewUrl" in record) {
    update.previewUrl = normalizeOptionalString(record.previewUrl, "previewUrl") ?? null;
  }

  if ("downloadUrl" in record) {
    update.downloadUrl =
      normalizeOptionalString(record.downloadUrl, "downloadUrl") ?? null;
  }

  if ("sourceUrl" in record) {
    update.sourceUrl = normalizeOptionalString(record.sourceUrl, "sourceUrl") ?? null;
  }

  if ("sourceAuthor" in record) {
    update.sourceAuthor =
      normalizeOptionalString(record.sourceAuthor, "sourceAuthor") ?? null;
  }

  if ("sourceLicense" in record) {
    update.sourceLicense =
      normalizeOptionalString(record.sourceLicense, "sourceLicense") ?? null;
  }

  if ("sourceLicenseUrl" in record) {
    update.sourceLicenseUrl =
      normalizeOptionalString(record.sourceLicenseUrl, "sourceLicenseUrl") ?? null;
  }

  if ("mediaType" in record) {
    update.mediaType = normalizeIntakeMediaTypeValue(record.mediaType);
  }

  if ("detectedType" in record) {
    update.detectedType =
      normalizeOptionalString(record.detectedType, "detectedType") ?? null;
  }

  if ("suggestedCategory" in record) {
    update.suggestedCategory =
      normalizeOptionalAssetCategoryValue(
        record.suggestedCategory,
        "suggestedCategory"
      ) ?? null;
  }

  if ("suggestedTags" in record) {
    update.suggestedTags = parseTagInput(record.suggestedTags);
  }

  if ("suggestedCharacter" in record) {
    update.suggestedCharacter =
      normalizeOptionalString(record.suggestedCharacter, "suggestedCharacter") ??
      null;
  }

  if ("suggestedProject" in record) {
    update.suggestedProject =
      normalizeOptionalString(record.suggestedProject, "suggestedProject") ?? null;
  }

  if ("width" in record) {
    update.width = normalizeOptionalNumber(record.width, "width") ?? null;
  }

  if ("height" in record) {
    update.height = normalizeOptionalNumber(record.height, "height") ?? null;
  }

  if ("duration" in record) {
    update.duration =
      normalizeOptionalNumber(record.duration, "duration") ?? null;
  }

  if ("fileSize" in record) {
    update.fileSize =
      normalizeOptionalNumber(record.fileSize, "fileSize") ?? null;
  }

  if ("extension" in record) {
    update.extension =
      normalizeOptionalString(record.extension, "extension") ?? null;
  }

  if ("mimeType" in record) {
    update.mimeType = normalizeOptionalString(record.mimeType, "mimeType") ?? null;
  }

  if ("category" in record) {
    update.category =
      normalizeOptionalAssetCategoryValue(record.category, "category") ?? null;
  }

  if ("franchise" in record) {
    update.franchise =
      normalizeOptionalString(record.franchise, "franchise") ?? null;
  }

  if ("character" in record) {
    update.character =
      normalizeOptionalString(record.character, "character") ?? null;
  }

  if ("emotion" in record) {
    update.emotion =
      normalizeOptionalEmotionTagValue(record.emotion, "emotion") ?? null;
  }

  if ("tags" in record) {
    update.tags = parseTagInput(record.tags);
  }

  if ("copyrightRisk" in record) {
    update.copyrightRisk =
      normalizeOptionalCopyrightRiskValue(
        record.copyrightRisk,
        "copyrightRisk"
      ) ?? null;
  }

  if ("recommendedUse" in record) {
    update.recommendedUse =
      normalizeOptionalString(record.recommendedUse, "recommendedUse") ?? null;
  }

  if ("usageNotes" in record) {
    update.usageNotes =
      normalizeOptionalString(record.usageNotes, "usageNotes") ?? null;
  }

  if ("status" in record) {
    update.status = normalizeMediaCandidateStatusValue(record.status);
  }

  if ("assetId" in record) {
    update.assetId = normalizeOptionalString(record.assetId, "assetId") ?? null;
  }

  if ("errorMessage" in record) {
    update.errorMessage =
      normalizeOptionalString(record.errorMessage, "errorMessage") ?? null;
  }

  if ("contentHash" in record) {
    update.contentHash =
      normalizeOptionalString(record.contentHash, "contentHash") ?? null;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError(
      "At least one intake candidate field must be provided for update."
    );
  }

  return update;
}

export function parseIntakeSerializedTags(input: string | null | undefined) {
  return parseSerializedTags(input ?? "[]");
}

