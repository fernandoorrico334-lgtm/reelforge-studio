import { ValidationError } from "../../../shared/errors.js";
import {
  projectStatuses,
  type ProjectStatus
} from "../../projects/domain/project.js";

export interface CreateProductionFromScriptInput {
  title: string;
  channelId: string;
  script: string;
  durationTarget: number | null;
  sceneDuration: number | null;
  format: string;
  status: ProjectStatus;
  applyChannelDefaults: boolean;
  autoCreateScenes: boolean;
  autoSuggestAssets: boolean;
  autoAssignAssets: boolean;
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Expected a JSON object.");
  }

  return payload as Record<string, unknown>;
}

function readRequiredString(
  record: Record<string, unknown>,
  fieldName: string
) {
  const value = record[fieldName];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalPositiveNumber(
  record: Record<string, unknown>,
  fieldName: string
) {
  const value = record[fieldName];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number or null.`);
  }

  return Math.round(value * 100) / 100;
}

function readOptionalBoolean(
  record: Record<string, unknown>,
  fieldName: string
) {
  const value = record[fieldName];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new ValidationError(`${fieldName} must be a boolean.`);
  }

  return value;
}

function normalizeProjectStatus(value: unknown): ProjectStatus {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `status must be one of: ${projectStatuses.join(", ")}.`
    );
  }

  const normalized = value.trim().replaceAll("-", "_").toUpperCase();

  if (!projectStatuses.includes(normalized as ProjectStatus)) {
    throw new ValidationError(
      `status must be one of: ${projectStatuses.join(", ")}.`
    );
  }

  return normalized as ProjectStatus;
}

export function validateCreateProductionFromScriptInput(
  payload: unknown
): CreateProductionFromScriptInput {
  const record = asRecord(payload);

  return {
    title: readRequiredString(record, "title"),
    channelId: readRequiredString(record, "channelId"),
    script: readRequiredString(record, "script"),
    durationTarget: readOptionalPositiveNumber(record, "durationTarget"),
    sceneDuration: readOptionalPositiveNumber(record, "sceneDuration"),
    format:
      typeof record.format === "string" && record.format.trim().length > 0
        ? record.format.trim()
        : "9:16",
    status:
      "status" in record
        ? normalizeProjectStatus(record.status)
        : "SCENE_PLANNING",
    applyChannelDefaults:
      readOptionalBoolean(record, "applyChannelDefaults") ?? true,
    autoCreateScenes: readOptionalBoolean(record, "autoCreateScenes") ?? true,
    autoSuggestAssets:
      readOptionalBoolean(record, "autoSuggestAssets") ??
      readOptionalBoolean(record, "autoAssignAssets") ??
      true,
    autoAssignAssets: readOptionalBoolean(record, "autoAssignAssets") ?? true
  };
}
