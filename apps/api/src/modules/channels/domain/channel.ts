import { getAudioMoodPresetById, type AudioMoodPresetId } from "@reelforge/audio-engine";
import { getCaptionStyleById, type CaptionStyleId } from "@reelforge/caption-engine";
import {
  getCinematicPresetById,
  type CinematicPresetId
} from "@reelforge/cinematic-engine";
import { getTemplateById, type TemplateId } from "@reelforge/templates";
import {
  assetCategories,
  normalizeOptionalNumber,
  normalizeOptionalString,
  parseTagInput,
  type AssetCategory
} from "../../assets/domain/asset.js";
import {
  defaultRenderMode,
  defaultRenderQuality,
  normalizeOptionalRenderMode,
  normalizeOptionalRenderQuality,
  type RenderMode,
  type RenderQuality
} from "../../render-jobs/domain/render-job.js";
import { ValidationError } from "../../../shared/errors.js";

export interface StudioChannel {
  id: string;
  name: string;
  niche: string;
  language: string;
  visualStyle: string | null;
  narrativeTone: string | null;
  defaultTemplate: TemplateId | null;
  defaultRenderMode: RenderMode;
  defaultRenderQuality: RenderQuality;
  defaultAudioMood: AudioMoodPresetId | null;
  defaultCaptionStyle: CaptionStyleId | null;
  defaultVisualPreset: CinematicPresetId | null;
  defaultMusicAssetId: string | null;
  defaultVoiceoverAssetId: string | null;
  defaultDurationTarget: number | null;
  defaultSceneDuration: number;
  preferredAssetCategories: AssetCategory[];
  preferredAssetTags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelInput {
  name: string;
  niche: string;
  language: string;
  visualStyle: string | null;
  narrativeTone: string | null;
  defaultTemplate: TemplateId | null;
  defaultRenderMode: RenderMode;
  defaultRenderQuality: RenderQuality;
  defaultAudioMood: AudioMoodPresetId | null;
  defaultCaptionStyle: CaptionStyleId | null;
  defaultVisualPreset: CinematicPresetId | null;
  defaultMusicAssetId: string | null;
  defaultVoiceoverAssetId: string | null;
  defaultDurationTarget: number | null;
  defaultSceneDuration: number;
  preferredAssetCategories: AssetCategory[];
  preferredAssetTags: string[];
}

export type UpdateChannelInput = Partial<CreateChannelInput>;

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Expected a JSON object.");
  }

  return payload as Record<string, unknown>;
}

function readRequiredString(
  record: Record<string, unknown>,
  field: keyof CreateChannelInput
): string {
  const value = record[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalString(
  record: Record<string, unknown>,
  field: keyof CreateChannelInput
) {
  return normalizeOptionalString(record[field], String(field));
}

function normalizeOptionalTemplateId(
  value: unknown,
  fieldName = "defaultTemplate"
): TemplateId | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const resolvedTemplate = getTemplateById(value);

  if (!resolvedTemplate) {
    throw new ValidationError(`${fieldName} must match a known template id.`);
  }

  return resolvedTemplate.id;
}

function normalizeOptionalAudioMood(
  value: unknown,
  fieldName = "defaultAudioMood"
): AudioMoodPresetId | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const resolvedPreset = getAudioMoodPresetById(value);

  if (!resolvedPreset) {
    throw new ValidationError(`${fieldName} must match a known audio mood id.`);
  }

  return resolvedPreset.id;
}

function normalizeOptionalCaptionStyle(
  value: unknown,
  fieldName = "defaultCaptionStyle"
): CaptionStyleId | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const resolvedStyle = getCaptionStyleById(value);

  if (!resolvedStyle) {
    throw new ValidationError(`${fieldName} must match a known caption style id.`);
  }

  return resolvedStyle.id;
}

function normalizeOptionalVisualPreset(
  value: unknown,
  fieldName = "defaultVisualPreset"
): CinematicPresetId | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const resolvedPreset = getCinematicPresetById(value);

  if (!resolvedPreset) {
    throw new ValidationError(`${fieldName} must match a known cinematic preset id.`);
  }

  return resolvedPreset.id;
}

function normalizeOptionalPositiveInteger(
  value: unknown,
  fieldName: string
): number | null | undefined {
  const parsed = normalizeOptionalNumber(value, fieldName);

  if (parsed === undefined || parsed === null) {
    return parsed;
  }

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer or null.`);
  }

  return parsed;
}

function normalizeOptionalPositiveNumber(
  value: unknown,
  fieldName: string
): number | null | undefined {
  const parsed = normalizeOptionalNumber(value, fieldName);

  if (parsed === undefined || parsed === null) {
    return parsed;
  }

  if (parsed <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number or null.`);
  }

  return Math.round(parsed * 100) / 100;
}

function parsePreferredAssetCategories(
  value: unknown,
  fieldName = "preferredAssetCategories"
): AssetCategory[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const rawValues = parseTagInput(value).map((entry) =>
    entry.trim().replaceAll("-", "_").replaceAll(" ", "_").toUpperCase()
  );

  for (const rawValue of rawValues) {
    if (!assetCategories.includes(rawValue as AssetCategory)) {
      throw new ValidationError(
        `${fieldName} must contain only known asset categories.`
      );
    }
  }

  return rawValues as AssetCategory[];
}

function parsePreferredAssetTags(
  value: unknown,
  fieldName = "preferredAssetTags"
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    return parseTagInput(value);
  } catch {
    throw new ValidationError(
      `${fieldName} must be a string, string array or null.`
    );
  }
}

export function validateCreateChannelInput(
  payload: unknown
): CreateChannelInput {
  const record = asRecord(payload);

  return {
    name: readRequiredString(record, "name"),
    niche: readRequiredString(record, "niche"),
    language: readRequiredString(record, "language"),
    visualStyle: readOptionalString(record, "visualStyle") ?? null,
    narrativeTone: readOptionalString(record, "narrativeTone") ?? null,
    defaultTemplate: normalizeOptionalTemplateId(record.defaultTemplate) ?? null,
    defaultRenderMode:
      normalizeOptionalRenderMode(record.defaultRenderMode, "defaultRenderMode") ??
      defaultRenderMode,
    defaultRenderQuality:
      normalizeOptionalRenderQuality(
        record.defaultRenderQuality,
        "defaultRenderQuality"
      ) ?? defaultRenderQuality,
    defaultAudioMood:
      normalizeOptionalAudioMood(record.defaultAudioMood) ?? null,
    defaultCaptionStyle:
      normalizeOptionalCaptionStyle(record.defaultCaptionStyle) ?? null,
    defaultVisualPreset:
      normalizeOptionalVisualPreset(record.defaultVisualPreset) ?? null,
    defaultMusicAssetId: readOptionalString(record, "defaultMusicAssetId") ?? null,
    defaultVoiceoverAssetId:
      readOptionalString(record, "defaultVoiceoverAssetId") ?? null,
    defaultDurationTarget:
      normalizeOptionalPositiveInteger(
        record.defaultDurationTarget,
        "defaultDurationTarget"
      ) ?? null,
    defaultSceneDuration:
      normalizeOptionalPositiveNumber(
        record.defaultSceneDuration,
        "defaultSceneDuration"
      ) ?? 4,
    preferredAssetCategories:
      parsePreferredAssetCategories(record.preferredAssetCategories) ?? [],
    preferredAssetTags: parsePreferredAssetTags(record.preferredAssetTags) ?? []
  };
}

export function validateUpdateChannelInput(
  payload: unknown
): UpdateChannelInput {
  const record = asRecord(payload);
  const update: UpdateChannelInput = {};

  if ("name" in record) {
    update.name = readRequiredString(record, "name");
  }

  if ("niche" in record) {
    update.niche = readRequiredString(record, "niche");
  }

  if ("language" in record) {
    update.language = readRequiredString(record, "language");
  }

  if ("visualStyle" in record) {
    update.visualStyle = readOptionalString(record, "visualStyle") ?? null;
  }

  if ("narrativeTone" in record) {
    update.narrativeTone =
      readOptionalString(record, "narrativeTone") ?? null;
  }

  if ("defaultTemplate" in record) {
    update.defaultTemplate =
      normalizeOptionalTemplateId(record.defaultTemplate) ?? null;
  }

  if ("defaultRenderMode" in record) {
    update.defaultRenderMode =
      normalizeOptionalRenderMode(
        record.defaultRenderMode,
        "defaultRenderMode"
      ) ?? defaultRenderMode;
  }

  if ("defaultRenderQuality" in record) {
    update.defaultRenderQuality =
      normalizeOptionalRenderQuality(
        record.defaultRenderQuality,
        "defaultRenderQuality"
      ) ?? defaultRenderQuality;
  }

  if ("defaultAudioMood" in record) {
    update.defaultAudioMood =
      normalizeOptionalAudioMood(record.defaultAudioMood) ?? null;
  }

  if ("defaultCaptionStyle" in record) {
    update.defaultCaptionStyle =
      normalizeOptionalCaptionStyle(record.defaultCaptionStyle) ?? null;
  }

  if ("defaultVisualPreset" in record) {
    update.defaultVisualPreset =
      normalizeOptionalVisualPreset(record.defaultVisualPreset) ?? null;
  }

  if ("defaultMusicAssetId" in record) {
    update.defaultMusicAssetId =
      readOptionalString(record, "defaultMusicAssetId") ?? null;
  }

  if ("defaultVoiceoverAssetId" in record) {
    update.defaultVoiceoverAssetId =
      readOptionalString(record, "defaultVoiceoverAssetId") ?? null;
  }

  if ("defaultDurationTarget" in record) {
    update.defaultDurationTarget =
      normalizeOptionalPositiveInteger(
        record.defaultDurationTarget,
        "defaultDurationTarget"
      ) ?? null;
  }

  if ("defaultSceneDuration" in record) {
    update.defaultSceneDuration =
      normalizeOptionalPositiveNumber(
        record.defaultSceneDuration,
        "defaultSceneDuration"
      ) ?? 4;
  }

  if ("preferredAssetCategories" in record) {
    update.preferredAssetCategories =
      parsePreferredAssetCategories(record.preferredAssetCategories) ?? [];
  }

  if ("preferredAssetTags" in record) {
    update.preferredAssetTags =
      parsePreferredAssetTags(record.preferredAssetTags) ?? [];
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError(
      "At least one channel field must be provided for update."
    );
  }

  return update;
}