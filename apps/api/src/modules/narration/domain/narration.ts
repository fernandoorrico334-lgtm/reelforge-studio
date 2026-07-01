import type {
  NarrationProviderId,
  NarrationProviderDescriptor,
  VoicePack
} from "@reelforge/narration-engine";
import {
  narrationProviderIds
} from "@reelforge/narration-engine";
import type { StudioAsset } from "../../assets/domain/asset.js";
import {
  normalizeOptionalNumber,
  normalizeOptionalString
} from "../../assets/domain/asset.js";
import type {
  NarrationProvider,
  NarrationStatus,
  ProjectScene,
  ProjectStatus
} from "../../projects/domain/project.js";
import { narrationProviders, narrationStatuses } from "../../projects/domain/project.js";
import { ValidationError } from "../../../shared/errors.js";

export interface NarrationJob {
  id: string;
  videoProjectId: string | null;
  sceneId: string | null;
  provider: NarrationProvider;
  voicePackId: string | null;
  language: string;
  status: NarrationStatus;
  text: string;
  outputPath: string | null;
  generatedAssetId: string | null;
  generatedAsset: StudioAsset | null;
  durationSeconds: number | null;
  sampleRate: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  summary: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface NarrationJobFilters {
  videoProjectId?: string;
  sceneId?: string;
  provider?: NarrationProvider;
  voicePackId?: string;
  status?: NarrationStatus;
}

export interface GeneratedNarrationProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  channelId: string;
  channelName: string;
  format: string;
}

export interface GeneratedNarrationSceneSummary {
  id: string;
  order: number;
  title: string;
  videoProjectId: string;
  narrationText: string | null;
  duration: number | null;
  generatedNarrationAssetId: string | null;
  narrationStatus: NarrationStatus | null;
  narrationProvider: NarrationProvider | null;
  narrationVoicePackId: string | null;
}

export interface GeneratedNarrationGalleryItem {
  job: NarrationJob;
  asset: StudioAsset | null;
  scene: GeneratedNarrationSceneSummary | null;
  project: GeneratedNarrationProjectSummary | null;
  metadata: Record<string, unknown> | null;
  previewUrl: string | null;
  isCurrentSceneNarration: boolean;
  isSceneEffectiveNarration: boolean;
}

export interface GeneratedNarrationGalleryFilters {
  projectId?: string;
  sceneId?: string;
  provider?: NarrationProvider;
  voicePackId?: string;
  status?: NarrationStatus;
}

export interface CreateNarrationJobInput {
  videoProjectId: string | null;
  sceneId: string | null;
  provider: NarrationProvider;
  voicePackId: string | null;
  language: string;
  status: NarrationStatus;
  text: string;
  outputPath: string | null;
  generatedAssetId: string | null;
  durationSeconds: number | null;
  sampleRate: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
}

export type UpdateNarrationJobInput = Partial<CreateNarrationJobInput>;

export interface GenerateNarrationRequestInput {
  provider: "mock-tts" | "windows-sapi-local";
  voicePackId: string | null;
  text: string | null;
  language: string | null;
  autoAttach: boolean;
}

export interface GenerateNarrationResponse {
  job: NarrationJob;
  asset: StudioAsset | null;
  scene: ProjectScene | null;
}

export interface UseNarrationForSceneResponse {
  scene: ProjectScene;
  projectId: string;
  assetId: string;
  selectedJobId: string | null;
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

function normalizeNarrationProviderToken(value: string) {
  return value.trim().replaceAll("_", "-").toLowerCase();
}

export function normalizeOptionalNarrationProviderValue(
  value: unknown,
  fieldName = "provider"
): NarrationProvider | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const normalized = normalizeNarrationProviderToken(value);

  if (!narrationProviders.includes(normalized as NarrationProvider)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${narrationProviders.join(", ")}.`
    );
  }

  return normalized as NarrationProvider;
}

export function normalizeOptionalNarrationStatusValue(
  value: unknown,
  fieldName = "status"
): NarrationStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const normalized = value.trim().toLowerCase();

  if (!narrationStatuses.includes(normalized as NarrationStatus)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${narrationStatuses.join(", ")}.`
    );
  }

  return normalized as NarrationStatus;
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

function normalizeOptionalVoicePackId(
  value: unknown,
  fieldName = "voicePackId"
) {
  const parsed = normalizeOptionalString(value, fieldName);

  if (parsed === undefined || parsed === null) {
    return null;
  }

  return parsed;
}

export function validateGenerateNarrationRequestInput(
  payload: unknown
): GenerateNarrationRequestInput {
  const record = asRecord(payload);
  const provider =
    normalizeOptionalNarrationProviderValue(record.provider, "provider") ??
    "mock-tts";

  if (
    provider !== "mock-tts" &&
    provider !== "windows-sapi-local"
  ) {
    throw new ValidationError(
      `provider must be one of: ${narrationProviderIds.join(", ")}.`
    );
  }

  return {
    provider,
    voicePackId: normalizeOptionalVoicePackId(record.voicePackId, "voicePackId"),
    text: normalizeOptionalString(record.text, "text") ?? null,
    language: normalizeOptionalString(record.language, "language") ?? null,
    autoAttach:
      normalizeOptionalBoolean(record.autoAttach, "autoAttach") ?? true
  };
}

export function validateNarrationJobFilters(
  query: URLSearchParams
): NarrationJobFilters {
  const filters: NarrationJobFilters = {};
  const videoProjectId =
    normalizeOptionalString(query.get("projectId"), "projectId") ?? undefined;
  const sceneId =
    normalizeOptionalString(query.get("sceneId"), "sceneId") ?? undefined;
  const provider =
    normalizeOptionalNarrationProviderValue(query.get("provider"), "provider") ??
    undefined;
  const voicePackId =
    normalizeOptionalString(query.get("voicePackId"), "voicePackId") ?? undefined;
  const status =
    normalizeOptionalNarrationStatusValue(query.get("status"), "status") ??
    undefined;

  if (videoProjectId) {
    filters.videoProjectId = videoProjectId;
  }

  if (sceneId) {
    filters.sceneId = sceneId;
  }

  if (provider) {
    filters.provider = provider;
  }

  if (voicePackId) {
    filters.voicePackId = voicePackId;
  }

  if (status) {
    filters.status = status;
  }

  return filters;
}

export type NarrationProvidersSnapshot = NarrationProviderDescriptor[];
export type NarrationVoicePacksSnapshot = VoicePack[];

export function validateNarrationJobId(id: string) {
  return ensureRequiredString(id, "id");
}

export function validateSceneId(id: string) {
  return ensureRequiredString(id, "sceneId");
}

export function validateAssetId(id: string) {
  return ensureRequiredString(id, "assetId");
}
