import type { StudioAsset } from "../../assets/domain/asset.js";
import { normalizeOptionalNumber, normalizeOptionalString } from "../../assets/domain/asset.js";
import type { CharacterProfile } from "../../characters/domain/character.js";
import {
  visualGenerationProviders,
  visualGenerationStatuses,
  visualSourceModes,
  type VisualGenerationProvider,
  type VisualGenerationStatus,
  type VisualSourceMode
} from "../../projects/domain/project.js";
import { ValidationError } from "../../../shared/errors.js";

export interface VisualGenerationJob {
  id: string;
  videoProjectId: string | null;
  sceneId: string | null;
  characterProfileId: string | null;
  characterProfile: CharacterProfile | null;
  researchAssetRequirementId: string | null;
  status: VisualGenerationStatus;
  provider: VisualGenerationProvider;
  visualSourceMode: VisualSourceMode | null;
  prompt: string;
  negativePrompt: string | null;
  stylePreset: string | null;
  seed: number | null;
  width: number;
  height: number;
  outputPath: string | null;
  generatedAssetId: string | null;
  generatedAsset: StudioAsset | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  summary: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface VisualGenerationJobFilters {
  videoProjectId?: string;
  sceneId?: string;
  researchAssetRequirementId?: string;
  characterProfileId?: string;
  status?: VisualGenerationStatus;
}

export interface CreateVisualGenerationJobInput {
  videoProjectId: string | null;
  sceneId: string | null;
  characterProfileId: string | null;
  researchAssetRequirementId: string | null;
  status: VisualGenerationStatus;
  provider: VisualGenerationProvider;
  visualSourceMode: VisualSourceMode | null;
  prompt: string;
  negativePrompt: string | null;
  stylePreset: string | null;
  seed: number | null;
  width: number;
  height: number;
  outputPath: string | null;
  generatedAssetId: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
}

export type UpdateVisualGenerationJobInput = Partial<CreateVisualGenerationJobInput>;

export interface GenerateVisualRequestInput {
  provider: VisualGenerationProvider;
  visualSourceMode: VisualSourceMode | null;
  characterProfileId: string | null;
  width: number;
  height: number;
  seed: number | null;
  autoAttach: boolean;
}

export interface GenerateMissingVisualsInput extends GenerateVisualRequestInput {
  maxScenes: number;
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Expected a JSON object.");
  }

  return payload as Record<string, unknown>;
}

function normalizeOptionalBoolean(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "boolean") {
    throw new ValidationError(`${fieldName} must be a boolean or null.`);
  }

  return value;
}

function normalizeEnumToken(value: string) {
  return value.trim().replaceAll(" ", "_").replaceAll("-", "_").toLowerCase();
}

function normalizeVisualGenerationProviderToken(value: string) {
  return value.trim().replaceAll(" ", "-").replaceAll("_", "-").toLowerCase();
}

function normalizeOptionalVisualSourceModeValue(
  value: unknown,
  fieldName = "visualSourceMode"
): VisualSourceMode | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const normalized = normalizeEnumToken(value);

  if (!visualSourceModes.includes(normalized as VisualSourceMode)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${visualSourceModes.join(", ")}.`
    );
  }

  return normalized as VisualSourceMode;
}

function normalizeOptionalVisualGenerationProviderValue(
  value: unknown,
  fieldName = "provider"
): VisualGenerationProvider | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const normalized = normalizeVisualGenerationProviderToken(value);

  if (!visualGenerationProviders.includes(normalized as VisualGenerationProvider)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${visualGenerationProviders.join(", ")}.`
    );
  }

  return normalized as VisualGenerationProvider;
}

export function normalizeOptionalVisualGenerationStatusValue(
  value: unknown,
  fieldName = "status"
): VisualGenerationStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const normalized = normalizeEnumToken(value);

  if (!visualGenerationStatuses.includes(normalized as VisualGenerationStatus)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${visualGenerationStatuses.join(", ")}.`
    );
  }

  return normalized as VisualGenerationStatus;
}

function normalizeSize(value: unknown, fieldName: string, fallback: number) {
  const parsed = normalizeOptionalNumber(value, fieldName);

  if (parsed === undefined || parsed === null) {
    return fallback;
  }

  if (!Number.isInteger(parsed) || parsed < 128 || parsed > 4096) {
    throw new ValidationError(`${fieldName} must be an integer between 128 and 4096.`);
  }

  return parsed;
}

function normalizeSeed(value: unknown, fieldName = "seed") {
  const parsed = normalizeOptionalNumber(value, fieldName);

  if (parsed === undefined || parsed === null) {
    return null;
  }

  if (!Number.isInteger(parsed)) {
    throw new ValidationError(`${fieldName} must be an integer or null.`);
  }

  return parsed;
}

function normalizeMaxScenes(value: unknown, fieldName = "maxScenes") {
  const parsed = normalizeOptionalNumber(value, fieldName);

  if (parsed === undefined || parsed === null) {
    return 8;
  }

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) {
    throw new ValidationError(`${fieldName} must be an integer between 1 and 24.`);
  }

  return parsed;
}

export function validateGenerateVisualRequestInput(payload: unknown): GenerateVisualRequestInput {
  const record = asRecord(payload);

  return {
    provider:
      normalizeOptionalVisualGenerationProviderValue(record.provider, "provider") ??
      "mock-svg",
    visualSourceMode:
      normalizeOptionalVisualSourceModeValue(record.visualSourceMode) ?? null,
    characterProfileId:
      normalizeOptionalString(record.characterProfileId, "characterProfileId") ?? null,
    width: normalizeSize(record.width, "width", 1080),
    height: normalizeSize(record.height, "height", 1920),
    seed: normalizeSeed(record.seed),
    autoAttach: normalizeOptionalBoolean(record.autoAttach, "autoAttach") ?? true
  };
}

export function validateGenerateMissingVisualsInput(
  payload: unknown
): GenerateMissingVisualsInput {
  const record = asRecord(payload);
  const base = validateGenerateVisualRequestInput(payload);

  return {
    ...base,
    maxScenes: normalizeMaxScenes(record.maxScenes)
  };
}

