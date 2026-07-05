import { ValidationError } from "../../../shared/errors.js";

export const productionDiscoveryStatuses = [
  "draft",
  "researching",
  "media_searching",
  "ready_for_review",
  "project_created",
  "failed"
] as const;

export type ProductionDiscoveryStatus =
  (typeof productionDiscoveryStatuses)[number];

export interface ProductionDiscoveryPackage {
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
  mediaCollectionIds: string[];
  suggestedTemplateId: string | null;
  suggestedEditingReferencePresetId: string | null;
  suggestedMusicPresetId: string | null;
  suggestedAudioMasteringPresetId: string | null;
  suggestedWorkflowPackId: string | null;
  summary: string | null;
  outline: Record<string, unknown>[];
  assetRequirements: Record<string, unknown>[];
  mediaCandidatesSummary: Record<string, unknown>[];
  warnings: string[];
  createdProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductionDiscoveryPackageInput {
  topic: string;
  niche: string;
  title: string;
  angle: string | null;
  language: string;
  tone: string | null;
  targetDurationSeconds: number | null;
  status: ProductionDiscoveryStatus;
  researchDossierId: string | null;
  mediaCollectionIds: string[];
  suggestedTemplateId: string | null;
  suggestedEditingReferencePresetId: string | null;
  suggestedMusicPresetId: string | null;
  suggestedAudioMasteringPresetId: string | null;
  suggestedWorkflowPackId: string | null;
  summary: string | null;
  outline: Record<string, unknown>[];
  assetRequirements: Record<string, unknown>[];
  mediaCandidatesSummary: Record<string, unknown>[];
  warnings: string[];
  createdProjectId: string | null;
}

export type UpdateProductionDiscoveryPackageInput =
  Partial<CreateProductionDiscoveryPackageInput>;

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
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string or null.`);
  }

  return value.trim();
}

function readOptionalNumber(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new ValidationError(`${field} must be a number or null.`);
  }

  return Math.round(numberValue);
}

export function validateCreateDiscoveryInput(payload: unknown) {
  const record = asRecord(payload);

  return {
    topic: readRequiredString(record, "topic"),
    niche: readOptionalString(record, "niche") ?? "generic",
    angle: readOptionalString(record, "angle"),
    language: readOptionalString(record, "language") ?? "pt-BR",
    tone: readOptionalString(record, "tone"),
    targetDurationSeconds: readOptionalNumber(record, "targetDurationSeconds") ?? 35
  };
}

export function parseJsonArray<T>(value: string | null | undefined, fallback: T[]): T[] {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function serializeJson(value: unknown) {
  return JSON.stringify(value ?? []);
}
