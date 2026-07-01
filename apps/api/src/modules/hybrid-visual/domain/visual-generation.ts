import type { StudioAsset } from "../../assets/domain/asset.js";
import { normalizeOptionalNumber, normalizeOptionalString } from "../../assets/domain/asset.js";
import type { CharacterProfile } from "../../characters/domain/character.js";
import type {
  ProjectScene,
  ProjectStatus,
  VisualGenerationProvider,
  VisualGenerationStatus,
  VisualSourceMode
} from "../../projects/domain/project.js";
import {
  visualGenerationProviders,
  visualGenerationStatuses,
  visualSourceModes,
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

export const visualReviewStatuses = ["approved", "rejected", "favorite"] as const;

export type VisualReviewStatus = (typeof visualReviewStatuses)[number];

export interface GeneratedImageGalleryFilters {
  projectId?: string;
  sceneId?: string;
  characterProfileId?: string;
  workflowPackId?: string;
  qualityPresetId?: string;
  status?: VisualGenerationStatus;
  provider?: VisualGenerationProvider;
  sourceProvider?: string;
}

export interface GeneratedImageGalleryProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  channelId: string;
  channelName: string;
  format: string;
  templateId: string | null;
}

export interface GeneratedImageGallerySceneSummary {
  id: string;
  order: number;
  title: string;
  videoProjectId: string;
  captionText: string | null;
  duration: number | null;
  emotion: ProjectScene["emotion"];
  assetId: string | null;
  generatedAssetId: string | null;
  visualSourceMode: VisualSourceMode | null;
  generationStatus: VisualGenerationStatus | null;
  generationProvider: VisualGenerationProvider | null;
}

export interface GeneratedImageGalleryItem {
  job: VisualGenerationJob;
  asset: StudioAsset | null;
  scene: GeneratedImageGallerySceneSummary | null;
  project: GeneratedImageGalleryProjectSummary | null;
  metadata: Record<string, unknown> | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  isCurrentSceneGeneratedAsset: boolean;
  isSceneEffectiveAsset: boolean;
  reviewStatus: VisualReviewStatus | null;
  reviewNotes: string | null;
  isFavorite: boolean;
}

export interface MarkVisualGenerationJobReviewedInput {
  reviewStatus: VisualReviewStatus;
  notes: string | null;
}

export interface RegenerateVisualGenerationJobInput {
  seedMode: "random" | "fixed" | "reuse" | "increment" | null;
  qualityPresetId: string | null;
  workflowPackId: string | null;
}

export interface UseGeneratedImageForSceneResponse {
  scene: ProjectScene;
  projectId: string;
  assetId: string;
  selectedJobId: string | null;
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
  workflowPackId: string | null;
  qualityPresetId: string | null;
  workflowId: string | null;
  seedMode: string | null;
  steps: number | null;
  cfg: number | null;
  sampler: string | null;
  scheduler: string | null;
  denoise: number | null;
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

export function normalizeOptionalVisualGenerationProviderValue(
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

export function normalizeOptionalIdentifierValue(
  value: unknown,
  fieldName: string
) {
  const parsed = normalizeOptionalString(value, fieldName);

  if (parsed === undefined || parsed === null) {
    return null;
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(parsed)) {
    throw new ValidationError(
      `${fieldName} must use only letters, numbers, '.', '_' or '-'.`
    );
  }

  return parsed;
}

function normalizeOptionalSeedMode(
  value: unknown,
  fieldName = "seedMode"
): "random" | "fixed" | "reuse" | "increment" | null {
  const parsed = normalizeOptionalIdentifierValue(value, fieldName);

  if (!parsed) {
    return null;
  }

  const modes = ["random", "fixed", "reuse", "increment"] as const;

  if (!(modes as readonly string[]).includes(parsed)) {
    throw new ValidationError(`${fieldName} must be one of: ${modes.join(", ")}.`);
  }

  return parsed as (typeof modes)[number];
}

function normalizeVisualReviewStatusValue(
  value: unknown,
  fieldName = "reviewStatus"
): VisualReviewStatus {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
  }

  const normalized = normalizeEnumToken(value);

  if (!visualReviewStatuses.includes(normalized as VisualReviewStatus)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${visualReviewStatuses.join(", ")}.`
    );
  }

  return normalized as VisualReviewStatus;
}

function normalizeOptionalGenerationNumber(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
) {
  const parsed = normalizeOptionalNumber(value, fieldName);

  if (parsed === undefined || parsed === null) {
    return null;
  }

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}.`);
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
    workflowPackId: normalizeOptionalIdentifierValue(record.workflowPackId, "workflowPackId"),
    qualityPresetId: normalizeOptionalIdentifierValue(record.qualityPresetId, "qualityPresetId"),
    workflowId: normalizeOptionalIdentifierValue(record.workflowId, "workflowId"),
    seedMode: normalizeOptionalSeedMode(record.seedMode, "seedMode"),
    steps: normalizeOptionalGenerationNumber(record.steps, "steps", 1, 80),
    cfg: normalizeOptionalGenerationNumber(record.cfg, "cfg", 0, 30),
    sampler: normalizeOptionalString(record.sampler, "sampler") ?? null,
    scheduler: normalizeOptionalString(record.scheduler, "scheduler") ?? null,
    denoise: normalizeOptionalGenerationNumber(record.denoise, "denoise", 0, 1),
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

export function validateMarkVisualGenerationJobReviewedInput(
  payload: unknown
): MarkVisualGenerationJobReviewedInput {
  const record = asRecord(payload);

  return {
    reviewStatus: normalizeVisualReviewStatusValue(record.reviewStatus),
    notes: normalizeOptionalString(record.notes, "notes") ?? null
  };
}

export function validateRegenerateVisualGenerationJobInput(
  payload: unknown
): RegenerateVisualGenerationJobInput {
  const record = asRecord(payload);

  return {
    seedMode: normalizeOptionalSeedMode(record.seedMode, "seedMode"),
    qualityPresetId:
      normalizeOptionalIdentifierValue(record.qualityPresetId, "qualityPresetId"),
    workflowPackId:
      normalizeOptionalIdentifierValue(record.workflowPackId, "workflowPackId")
  };
}

