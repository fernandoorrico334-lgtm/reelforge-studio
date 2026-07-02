import { ValidationError } from "../../../shared/errors.js";
import type { StudioAsset } from "../../assets/domain/asset.js";

export const editorialMicroclipSourceTypes = [
  "local_clip",
  "uploaded_clip",
  "library_clip"
] as const;

export type EditorialMicroclipSourceType =
  (typeof editorialMicroclipSourceTypes)[number];

export const editorialMicroclipUsageModes = [
  "supporting_evidence",
  "impact_moment",
  "quick_reference"
] as const;

export type EditorialMicroclipUsageMode =
  (typeof editorialMicroclipUsageModes)[number];

export const editorialMicroclipCalloutStyles = [
  "none",
  "minimal",
  "bold"
] as const;

export type EditorialMicroclipCalloutStyle =
  (typeof editorialMicroclipCalloutStyles)[number];

export const editorialMicroclipTransitions = [
  "cut",
  "flash",
  "whoosh"
] as const;

export type EditorialMicroclipTransition =
  (typeof editorialMicroclipTransitions)[number];

export const editorialMicroclipVolumeModes = [
  "mute_original",
  "low_original",
  "keep_original"
] as const;

export type EditorialMicroclipVolumeMode =
  (typeof editorialMicroclipVolumeModes)[number];

export interface EditorialMicroclip {
  id: string;
  projectId: string;
  sceneId: string | null;
  assetId: string;
  asset: StudioAsset | null;
  label: string;
  sourceType: EditorialMicroclipSourceType;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  usageMode: EditorialMicroclipUsageMode;
  narrationOverlay: boolean;
  textOverlay: string | null;
  calloutStyle: EditorialMicroclipCalloutStyle;
  transitionIn: EditorialMicroclipTransition;
  transitionOut: EditorialMicroclipTransition;
  volumeMode: EditorialMicroclipVolumeMode;
  orderIndex: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEditorialMicroclipInput {
  projectId: string;
  sceneId: string | null;
  assetId: string;
  label: string;
  sourceType: EditorialMicroclipSourceType;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  usageMode: EditorialMicroclipUsageMode;
  narrationOverlay: boolean;
  textOverlay: string | null;
  calloutStyle: EditorialMicroclipCalloutStyle;
  transitionIn: EditorialMicroclipTransition;
  transitionOut: EditorialMicroclipTransition;
  volumeMode: EditorialMicroclipVolumeMode;
  orderIndex: number;
  metadata: Record<string, unknown> | null;
}

export type UpdateEditorialMicroclipInput = Partial<
  Omit<CreateEditorialMicroclipInput, "projectId">
>;

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Expected a JSON object.");
  }

  return payload as Record<string, unknown>;
}

function readRequiredString(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalString(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string or null.`);
  }

  return value.trim() || null;
}

function readOptionalBoolean(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new ValidationError(`${field} must be a boolean.`);
  }

  return value;
}

function readOptionalInteger(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (value === undefined) {
    return undefined;
  }

  if (
    value === null ||
    typeof value !== "number" ||
    Number.isNaN(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new ValidationError(`${field} must be a non-negative integer.`);
  }

  return value;
}

function readRequiredNumber(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative number.`);
  }

  return Math.round(value * 1000) / 1000;
}

function readOptionalNumber(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative number or null.`);
  }

  return Math.round(value * 1000) / 1000;
}

function readOptionalMetadata(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object or null.`);
  }

  return value as Record<string, unknown>;
}

function normalizeValue<T extends readonly string[]>(
  value: unknown,
  options: T,
  field: string
): T[number] {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be one of: ${options.join(", ")}.`);
  }

  const normalized = value.trim().toLowerCase().replaceAll("-", "_");

  if (!options.includes(normalized)) {
    throw new ValidationError(`${field} must be one of: ${options.join(", ")}.`);
  }

  return normalized as T[number];
}

function normalizeOptionalValue<T extends readonly string[]>(
  value: unknown,
  options: T,
  field: string
): T[number] | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return normalizeValue(value, options, field);
}

export function validateCreateEditorialMicroclipInput(
  payload: unknown
): CreateEditorialMicroclipInput {
  const record = asRecord(payload);

  return {
    projectId: readRequiredString(record, "projectId"),
    sceneId: readOptionalString(record, "sceneId") ?? null,
    assetId: readRequiredString(record, "assetId"),
    label: readRequiredString(record, "label"),
    sourceType: normalizeValue(
      record.sourceType ?? "library_clip",
      editorialMicroclipSourceTypes,
      "sourceType"
    ),
    startTimeSeconds: readRequiredNumber(record, "startTimeSeconds"),
    endTimeSeconds: readRequiredNumber(record, "endTimeSeconds"),
    durationSeconds: 0,
    usageMode: normalizeValue(
      record.usageMode ?? "supporting_evidence",
      editorialMicroclipUsageModes,
      "usageMode"
    ),
    narrationOverlay: readOptionalBoolean(record, "narrationOverlay") ?? true,
    textOverlay: readOptionalString(record, "textOverlay") ?? null,
    calloutStyle:
      normalizeOptionalValue(
        record.calloutStyle,
        editorialMicroclipCalloutStyles,
        "calloutStyle"
      ) ?? "none",
    transitionIn:
      normalizeOptionalValue(
        record.transitionIn,
        editorialMicroclipTransitions,
        "transitionIn"
      ) ?? "cut",
    transitionOut:
      normalizeOptionalValue(
        record.transitionOut,
        editorialMicroclipTransitions,
        "transitionOut"
      ) ?? "cut",
    volumeMode:
      normalizeOptionalValue(
        record.volumeMode,
        editorialMicroclipVolumeModes,
        "volumeMode"
      ) ?? "mute_original",
    orderIndex: readOptionalInteger(record, "orderIndex") ?? 1,
    metadata: readOptionalMetadata(record, "metadata") ?? null
  };
}

export function validateUpdateEditorialMicroclipInput(
  payload: unknown
): UpdateEditorialMicroclipInput {
  const record = asRecord(payload);
  const update: UpdateEditorialMicroclipInput = {};

  if ("sceneId" in record) {
    update.sceneId = readOptionalString(record, "sceneId") ?? null;
  }

  if ("assetId" in record) {
    update.assetId = readRequiredString(record, "assetId");
  }

  if ("label" in record) {
    update.label = readRequiredString(record, "label");
  }

  if ("sourceType" in record) {
    update.sourceType = normalizeValue(
      record.sourceType,
      editorialMicroclipSourceTypes,
      "sourceType"
    );
  }

  if ("startTimeSeconds" in record) {
    update.startTimeSeconds = readRequiredNumber(record, "startTimeSeconds");
  }

  if ("endTimeSeconds" in record) {
    update.endTimeSeconds = readRequiredNumber(record, "endTimeSeconds");
  }

  if ("usageMode" in record) {
    update.usageMode = normalizeValue(
      record.usageMode,
      editorialMicroclipUsageModes,
      "usageMode"
    );
  }

  if ("narrationOverlay" in record) {
    update.narrationOverlay = readOptionalBoolean(record, "narrationOverlay") ?? true;
  }

  if ("textOverlay" in record) {
    update.textOverlay = readOptionalString(record, "textOverlay") ?? null;
  }

  if ("calloutStyle" in record) {
    update.calloutStyle =
      normalizeOptionalValue(
        record.calloutStyle,
        editorialMicroclipCalloutStyles,
        "calloutStyle"
      ) ?? "none";
  }

  if ("transitionIn" in record) {
    update.transitionIn =
      normalizeOptionalValue(
        record.transitionIn,
        editorialMicroclipTransitions,
        "transitionIn"
      ) ?? "cut";
  }

  if ("transitionOut" in record) {
    update.transitionOut =
      normalizeOptionalValue(
        record.transitionOut,
        editorialMicroclipTransitions,
        "transitionOut"
      ) ?? "cut";
  }

  if ("volumeMode" in record) {
    update.volumeMode =
      normalizeOptionalValue(
        record.volumeMode,
        editorialMicroclipVolumeModes,
        "volumeMode"
      ) ?? "mute_original";
  }

  if ("orderIndex" in record) {
    update.orderIndex = readOptionalInteger(record, "orderIndex") ?? 1;
  }

  if ("metadata" in record) {
    update.metadata = readOptionalMetadata(record, "metadata") ?? null;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError(
      "At least one editorial microclip field must be provided for update."
    );
  }

  return update;
}

export function mergeEditorialMicroclipMetadata(
  metadata: Record<string, unknown> | null,
  warnings: string[]
) {
  return {
    ...(metadata ?? {}),
    warnings: [...new Set(warnings)]
  };
}
