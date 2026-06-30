import { ValidationError } from "../../../shared/errors.js";

export const assetTypes = [
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "MUSIC",
  "SFX",
  "OVERLAY",
  "DOCUMENT",
  "FONT"
] as const;

export type AssetType = (typeof assetTypes)[number];

export const assetCategories = [
  "CHARACTER",
  "BACKGROUND",
  "PANEL",
  "SCREENSHOT",
  "COVER",
  "BROLL",
  "REFERENCE",
  "TRACK",
  "EFFECT",
  "OVERLAY",
  "TYPOGRAPHY",
  "OTHER"
] as const;

export type AssetCategory = (typeof assetCategories)[number];

export const copyrightRisks = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "UNKNOWN"
] as const;

export type CopyrightRisk = (typeof copyrightRisks)[number];

export const emotionTags = [
  "NEUTRAL",
  "CURIOUS",
  "EPIC",
  "MYSTERIOUS",
  "DARK",
  "TENSE",
  "JOYFUL",
  "SAD"
] as const;

export type EmotionTag = (typeof emotionTags)[number];

export interface StudioAsset {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  type: AssetType;
  category: AssetCategory;
  franchise: string | null;
  character: string | null;
  emotion: EmotionTag | null;
  tags: string[];
  licenseType: string;
  copyrightRisk: CopyrightRisk;
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
  downloadedAt: string | null;
  collectionId: string | null;
  usageNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetListFilters {
  type?: AssetType;
  category?: AssetCategory;
  emotion?: EmotionTag;
  copyrightRisk?: CopyrightRisk;
  search?: string;
}

export interface CreateAssetInput {
  filename: string;
  originalName: string;
  path: string;
  type: AssetType;
  category: AssetCategory;
  franchise: string | null;
  character: string | null;
  emotion: EmotionTag | null;
  tags: string[];
  licenseType: string;
  copyrightRisk: CopyrightRisk;
  recommendedUse: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  extension: string | null;
  fileSize: number | null;
  sourceProvider?: string | null;
  sourceUrl?: string | null;
  sourceAuthor?: string | null;
  sourceLicense?: string | null;
  sourceLicenseUrl?: string | null;
  downloadedAt?: string | null;
  collectionId?: string | null;
  usageNotes?: string | null;
}

export type UpdateAssetInput = Partial<CreateAssetInput>;

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Expected a JSON object.");
  }

  return payload as Record<string, unknown>;
}

function readRequiredString(
  record: Record<string, unknown>,
  field: keyof CreateAssetInput
): string {
  return ensureRequiredString(record[field], String(field));
}

function ensureRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalString(
  record: Record<string, unknown>,
  field: keyof CreateAssetInput
): string | null | undefined {
  return normalizeOptionalString(record[field], String(field));
}

export function normalizeOptionalString(
  value: unknown,
  fieldName: string
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readOptionalNumber(
  record: Record<string, unknown>,
  field: keyof CreateAssetInput
): number | null | undefined {
  return normalizeOptionalNumber(record[field], String(field));
}

export function normalizeOptionalNumber(
  value: unknown,
  fieldName: string
): number | null | undefined {
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

function isEnumValue<T extends string>(
  enumValues: readonly T[],
  value: unknown
): value is T {
  return typeof value === "string" && enumValues.includes(value as T);
}

function normalizeEnumCandidate(value: string) {
  return value.trim().replaceAll("-", "_").replaceAll(" ", "_").toUpperCase();
}

function normalizeEnumValue<T extends string>(
  enumValues: readonly T[],
  value: unknown,
  fieldName: string
): T {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be one of: ${enumValues.join(", ")}.`
    );
  }

  const normalized = normalizeEnumCandidate(value);

  if (!isEnumValue(enumValues, normalized)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${enumValues.join(", ")}.`
    );
  }

  return normalized;
}

function normalizeOptionalEnumValue<T extends string>(
  enumValues: readonly T[],
  value: unknown,
  fieldName: string
): T | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return normalizeEnumValue(enumValues, value, fieldName);
}

export function normalizeAssetTypeValue(value: unknown, fieldName = "type") {
  return normalizeEnumValue(assetTypes, value, fieldName);
}

export function normalizeOptionalAssetTypeValue(
  value: unknown,
  fieldName = "type"
) {
  return normalizeOptionalEnumValue(assetTypes, value, fieldName);
}

export function normalizeAssetCategoryValue(
  value: unknown,
  fieldName = "category"
) {
  return normalizeEnumValue(assetCategories, value, fieldName);
}

export function normalizeOptionalAssetCategoryValue(
  value: unknown,
  fieldName = "category"
) {
  return normalizeOptionalEnumValue(assetCategories, value, fieldName);
}

export function normalizeEmotionTagValue(
  value: unknown,
  fieldName = "emotion"
) {
  return normalizeEnumValue(emotionTags, value, fieldName);
}

export function normalizeOptionalEmotionTagValue(
  value: unknown,
  fieldName = "emotion"
) {
  return normalizeOptionalEnumValue(emotionTags, value, fieldName);
}

export function normalizeCopyrightRiskValue(
  value: unknown,
  fieldName = "copyrightRisk"
) {
  return normalizeEnumValue(copyrightRisks, value, fieldName);
}

export function normalizeOptionalCopyrightRiskValue(
  value: unknown,
  fieldName = "copyrightRisk"
) {
  return normalizeOptionalEnumValue(copyrightRisks, value, fieldName);
}

export function parseSerializedTags(input: string): string[] {
  try {
    const parsed = JSON.parse(input);

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function parseTagInput(value: unknown): string[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return parseSerializedTags(value);
  }

  throw new ValidationError("tags must be an array of strings or a string.");
}

export function validateAssetFilters(
  rawFilters: Record<string, string | undefined>
): AssetListFilters {
  const filters: AssetListFilters = {};

  if (rawFilters.type) {
    filters.type = normalizeAssetTypeValue(rawFilters.type, "type filter");
  }

  if (rawFilters.category) {
    filters.category = normalizeAssetCategoryValue(
      rawFilters.category,
      "category filter"
    );
  }

  if (rawFilters.emotion) {
    filters.emotion = normalizeEmotionTagValue(
      rawFilters.emotion,
      "emotion filter"
    );
  }

  if (rawFilters.copyrightRisk) {
    filters.copyrightRisk = normalizeCopyrightRiskValue(
      rawFilters.copyrightRisk,
      "copyrightRisk filter"
    );
  }

  if (rawFilters.search?.trim()) {
    filters.search = rawFilters.search.trim();
  }

  return filters;
}

export function validateCreateAssetInput(payload: unknown): CreateAssetInput {
  const record = asRecord(payload);

  return {
    filename: readRequiredString(record, "filename"),
    originalName: readRequiredString(record, "originalName"),
    path: readRequiredString(record, "path"),
    type: normalizeAssetTypeValue(record.type),
    category: normalizeAssetCategoryValue(record.category),
    franchise: readOptionalString(record, "franchise") ?? null,
    character: readOptionalString(record, "character") ?? null,
    emotion: normalizeOptionalEmotionTagValue(record.emotion) ?? null,
    tags: parseTagInput(record.tags),
    licenseType: readRequiredString(record, "licenseType"),
    copyrightRisk: normalizeCopyrightRiskValue(record.copyrightRisk),
    recommendedUse: readOptionalString(record, "recommendedUse") ?? null,
    duration: readOptionalNumber(record, "duration") ?? null,
    width: readOptionalNumber(record, "width") ?? null,
    height: readOptionalNumber(record, "height") ?? null,
    mimeType: readOptionalString(record, "mimeType") ?? null,
    extension: readOptionalString(record, "extension") ?? null,
    fileSize: readOptionalNumber(record, "fileSize") ?? null,
    sourceProvider: readOptionalString(record, "sourceProvider") ?? null,
    sourceUrl: readOptionalString(record, "sourceUrl") ?? null,
    sourceAuthor: readOptionalString(record, "sourceAuthor") ?? null,
    sourceLicense: readOptionalString(record, "sourceLicense") ?? null,
    sourceLicenseUrl: readOptionalString(record, "sourceLicenseUrl") ?? null,
    downloadedAt: readOptionalString(record, "downloadedAt") ?? null,
    collectionId: readOptionalString(record, "collectionId") ?? null,
    usageNotes: readOptionalString(record, "usageNotes") ?? null
  };
}

export function validateUpdateAssetInput(payload: unknown): UpdateAssetInput {
  const record = asRecord(payload);
  const update: UpdateAssetInput = {};

  if ("filename" in record) {
    update.filename = readRequiredString(record, "filename");
  }

  if ("originalName" in record) {
    update.originalName = readRequiredString(record, "originalName");
  }

  if ("path" in record) {
    update.path = readRequiredString(record, "path");
  }

  if ("type" in record) {
    update.type = normalizeAssetTypeValue(record.type);
  }

  if ("category" in record) {
    update.category = normalizeAssetCategoryValue(record.category);
  }

  if ("franchise" in record) {
    update.franchise = readOptionalString(record, "franchise") ?? null;
  }

  if ("character" in record) {
    update.character = readOptionalString(record, "character") ?? null;
  }

  if ("emotion" in record) {
    update.emotion = normalizeOptionalEmotionTagValue(record.emotion) ?? null;
  }

  if ("tags" in record) {
    update.tags = parseTagInput(record.tags);
  }

  if ("licenseType" in record) {
    update.licenseType = readRequiredString(record, "licenseType");
  }

  if ("copyrightRisk" in record) {
    update.copyrightRisk = normalizeCopyrightRiskValue(record.copyrightRisk);
  }

  if ("recommendedUse" in record) {
    update.recommendedUse =
      readOptionalString(record, "recommendedUse") ?? null;
  }

  if ("duration" in record) {
    update.duration = readOptionalNumber(record, "duration") ?? null;
  }

  if ("width" in record) {
    update.width = readOptionalNumber(record, "width") ?? null;
  }

  if ("height" in record) {
    update.height = readOptionalNumber(record, "height") ?? null;
  }

  if ("mimeType" in record) {
    update.mimeType = readOptionalString(record, "mimeType") ?? null;
  }

  if ("extension" in record) {
    update.extension = readOptionalString(record, "extension") ?? null;
  }

  if ("fileSize" in record) {
    update.fileSize = readOptionalNumber(record, "fileSize") ?? null;
  }

  if ("sourceProvider" in record) {
    update.sourceProvider =
      readOptionalString(record, "sourceProvider") ?? null;
  }

  if ("sourceUrl" in record) {
    update.sourceUrl = readOptionalString(record, "sourceUrl") ?? null;
  }

  if ("sourceAuthor" in record) {
    update.sourceAuthor = readOptionalString(record, "sourceAuthor") ?? null;
  }

  if ("sourceLicense" in record) {
    update.sourceLicense =
      readOptionalString(record, "sourceLicense") ?? null;
  }

  if ("sourceLicenseUrl" in record) {
    update.sourceLicenseUrl =
      readOptionalString(record, "sourceLicenseUrl") ?? null;
  }

  if ("downloadedAt" in record) {
    update.downloadedAt = readOptionalString(record, "downloadedAt") ?? null;
  }

  if ("collectionId" in record) {
    update.collectionId = readOptionalString(record, "collectionId") ?? null;
  }

  if ("usageNotes" in record) {
    update.usageNotes = readOptionalString(record, "usageNotes") ?? null;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError(
      "At least one asset field must be provided for update."
    );
  }

  return update;
}

export function matchesAssetFilters(
  asset: StudioAsset,
  filters: AssetListFilters
): boolean {
  if (filters.type && asset.type !== filters.type) {
    return false;
  }

  if (filters.category && asset.category !== filters.category) {
    return false;
  }

  if (filters.emotion && asset.emotion !== filters.emotion) {
    return false;
  }

  if (filters.copyrightRisk && asset.copyrightRisk !== filters.copyrightRisk) {
    return false;
  }

  if (filters.search) {
    const query = filters.search.toLowerCase();
    const haystack = [
      asset.filename,
      asset.originalName,
      asset.path,
      asset.franchise ?? "",
      asset.character ?? "",
      asset.mimeType ?? "",
      asset.extension ?? "",
      asset.sourceProvider ?? "",
      asset.sourceUrl ?? "",
      asset.sourceAuthor ?? "",
      asset.sourceLicense ?? "",
      asset.usageNotes ?? "",
      asset.tags.join(" ")
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(query)) {
      return false;
    }
  }

  return true;
}

