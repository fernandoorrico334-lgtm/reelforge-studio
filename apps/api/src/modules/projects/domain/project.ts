import {
  captionPositions,
  getCaptionStyleById,
  type CaptionPosition
} from "@reelforge/caption-engine";
import { getAudioMoodPresetById } from "@reelforge/audio-engine";
import { getTemplateById } from "@reelforge/templates";
import {
  normalizeOptionalEmotionTagValue,
  normalizeOptionalNumber,
  normalizeOptionalString,
  parseSerializedTags,
  type EmotionTag,
  type StudioAsset
} from "../../assets/domain/asset.js";
import type { StudioChannel } from "../../channels/domain/channel.js";
import { ValidationError } from "../../../shared/errors.js";

export const projectStatuses = [
  "DRAFT",
  "SCRIPTING",
  "SCENE_PLANNING",
  "READY_FOR_EDIT"
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export const visualSourceModes = [
  "asset_only",
  "generated_only",
  "hybrid_overlay",
  "fallback_generated",
  "mixed_sequence"
] as const;

export type VisualSourceMode = (typeof visualSourceModes)[number];

export const visualGenerationProviders = [
  "mock-svg",
  "manual",
  "comfyui-local",
  "stable-diffusion-local",
  "other"
] as const;

export type VisualGenerationProvider =
  (typeof visualGenerationProviders)[number];

export const visualGenerationStatuses = [
  "draft",
  "queued",
  "generating",
  "completed",
  "failed",
  "cancelled"
] as const;

export type VisualGenerationStatus =
  (typeof visualGenerationStatuses)[number];

export const narrationProviders = [
  "mock-tts",
  "windows-sapi-local",
  "manual",
  "other"
] as const;

export type NarrationProvider = (typeof narrationProviders)[number];

export const narrationStatuses = [
  "draft",
  "queued",
  "generating",
  "completed",
  "failed",
  "cancelled"
] as const;

export type NarrationStatus = (typeof narrationStatuses)[number];

export interface ProjectScene {
  id: string;
  order: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  duration: number | null;
  emotion: EmotionTag | null;
  assetId: string | null;
  asset: StudioAsset | null;
  generatedAssetId: string | null;
  generatedAsset: StudioAsset | null;
  generatedNarrationAssetId: string | null;
  generatedNarrationAsset: StudioAsset | null;
  characterProfileId: string | null;
  sfxAssetId: string | null;
  sfxStartTime: number;
  sfxVolume: number;
  visualPreset: string | null;
  visualSourceMode: VisualSourceMode | null;
  visualPrompt: string | null;
  negativePrompt: string | null;
  visualRecipe: string | null;
  generationStatus: VisualGenerationStatus | null;
  generationProvider: VisualGenerationProvider | null;
  generationSeed: number | null;
  transition: string | null;
  captionStyle: string | null;
  captionPosition: CaptionPosition | null;
  captionEmphasisWords: string[];
  energyLevel: number | null;
  narrationStatus: NarrationStatus | null;
  narrationProvider: NarrationProvider | null;
  narrationVoicePackId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudioProject {
  id: string;
  title: string;
  status: ProjectStatus;
  channelId: string;
  channel: StudioChannel;
  script: string | null;
  durationTarget: number | null;
  format: string;
  templateId: string | null;
  defaultCaptionStyle: string | null;
  backgroundMusicAssetId: string | null;
  voiceoverAssetId: string | null;
  audioMood: string | null;
  musicVolume: number;
  voiceVolume: number;
  sfxVolume: number;
  enableAudioDucking: boolean;
  duckingLevel: number;
  createdAt: string;
  updatedAt: string;
  scenes: ProjectScene[];
}

export interface CreateProjectInput {
  title: string;
  status: ProjectStatus;
  channelId: string;
  script: string | null;
  durationTarget: number | null;
  format: string;
  templateId: string | null;
  defaultCaptionStyle: string | null;
  backgroundMusicAssetId: string | null;
  voiceoverAssetId: string | null;
  audioMood: string | null;
  musicVolume: number | null;
  voiceVolume: number | null;
  sfxVolume: number | null;
  enableAudioDucking: boolean | null;
  duckingLevel: number | null;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export interface CreateSceneInput {
  order?: number;
  title: string;
  narrationText: string | null;
  captionText: string | null;
  duration: number | null;
  emotion: EmotionTag | null;
  assetId: string | null;
  generatedAssetId: string | null;
  generatedNarrationAssetId: string | null;
  characterProfileId: string | null;
  sfxAssetId: string | null;
  sfxStartTime: number | null;
  sfxVolume: number | null;
  visualPreset: string | null;
  visualSourceMode: VisualSourceMode | null;
  visualPrompt: string | null;
  negativePrompt: string | null;
  visualRecipe: string | null;
  generationStatus: VisualGenerationStatus | null;
  generationProvider: VisualGenerationProvider | null;
  generationSeed: number | null;
  transition: string | null;
  captionStyle: string | null;
  captionPosition: CaptionPosition | null;
  captionEmphasisWords: string[];
  energyLevel: number | null;
  narrationStatus: NarrationStatus | null;
  narrationProvider: NarrationProvider | null;
  narrationVoicePackId: string | null;
}

export type UpdateSceneInput = Partial<CreateSceneInput>;

export interface ReorderScenesInput {
  sceneIds: string[];
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Expected a JSON object.");
  }

  return payload as Record<string, unknown>;
}

function ensureRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function readRequiredString(
  record: Record<string, unknown>,
  field: keyof CreateProjectInput | keyof CreateSceneInput
) {
  return ensureRequiredString(record[field], String(field));
}

function readOptionalString(
  record: Record<string, unknown>,
  field: keyof CreateProjectInput | keyof CreateSceneInput
) {
  return normalizeOptionalString(record[field], String(field));
}

function readOptionalNumber(
  record: Record<string, unknown>,
  field: keyof CreateProjectInput | keyof CreateSceneInput
) {
  return normalizeOptionalNumber(record[field], String(field));
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

function normalizeEnumCandidate(value: string) {
  return value.trim().replaceAll("-", "_").replaceAll(" ", "_").toUpperCase();
}

function normalizeProjectStatusValue(
  value: unknown,
  fieldName = "status"
): ProjectStatus {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be one of: ${projectStatuses.join(", ")}.`
    );
  }

  const normalized = normalizeEnumCandidate(value);

  if (!projectStatuses.includes(normalized as ProjectStatus)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${projectStatuses.join(", ")}.`
    );
  }

  return normalized as ProjectStatus;
}

function normalizeOptionalTemplateId(
  value: unknown,
  fieldName = "templateId"
) {
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
  fieldName = "audioMood"
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const resolvedMood = getAudioMoodPresetById(value);

  if (!resolvedMood) {
    throw new ValidationError(`${fieldName} must match a known audio mood id.`);
  }

  return resolvedMood.id;
}

function normalizeOptionalCaptionStyleId(
  value: unknown,
  fieldName = "captionStyle"
) {
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

function normalizeOptionalCaptionPositionValue(
  value: unknown,
  fieldName = "captionPosition"
): CaptionPosition | null | undefined {
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

  if (!captionPositions.includes(normalized as CaptionPosition)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${captionPositions.join(", ")}.`
    );
  }

  return normalized as CaptionPosition;
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

  const normalized = value.trim().toLowerCase().replaceAll("-", "_");

  if (!visualSourceModes.includes(normalized as VisualSourceMode)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${visualSourceModes.join(", ")}.`
    );
  }

  return normalized as VisualSourceMode;
}

function normalizeOptionalVisualGenerationProviderValue(
  value: unknown,
  fieldName = "generationProvider"
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

  const normalized = value.trim().toLowerCase();

  if (
    !visualGenerationProviders.includes(
      normalized as VisualGenerationProvider
    )
  ) {
    throw new ValidationError(
      `${fieldName} must be one of: ${visualGenerationProviders.join(", ")}.`
    );
  }

  return normalized as VisualGenerationProvider;
}

function normalizeOptionalVisualGenerationStatusValue(
  value: unknown,
  fieldName = "generationStatus"
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

  const normalized = value.trim().toLowerCase();

  if (!visualGenerationStatuses.includes(normalized as VisualGenerationStatus)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${visualGenerationStatuses.join(", ")}.`
    );
  }

  return normalized as VisualGenerationStatus;
}

function normalizeOptionalNarrationProviderValue(
  value: unknown,
  fieldName = "narrationProvider"
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

  const normalized = value.trim().toLowerCase();

  if (!narrationProviders.includes(normalized as NarrationProvider)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${narrationProviders.join(", ")}.`
    );
  }

  return normalized as NarrationProvider;
}

function normalizeOptionalNarrationStatusValue(
  value: unknown,
  fieldName = "narrationStatus"
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

function normalizeOptionalEnergyLevel(
  value: unknown,
  fieldName = "energyLevel"
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number between 0 and 100.`);
  }

  const rounded = Math.round(value);

  if (rounded < 0 || rounded > 100) {
    throw new ValidationError(`${fieldName} must be a number between 0 and 100.`);
  }

  return rounded;
}

function normalizeOptionalUnitInterval(
  value: unknown,
  fieldName: string
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number between 0 and 1.`);
  }

  if (value < 0 || value > 1) {
    throw new ValidationError(`${fieldName} must be a number between 0 and 1.`);
  }

  return Math.round(value * 1000) / 1000;
}

function normalizeOptionalNonNegativeNumber(
  value: unknown,
  fieldName: string
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new ValidationError(`${fieldName} must be a non-negative number.`);
  }

  return Math.round(value * 1000) / 1000;
}

function normalizeOptionalInteger(
  value: unknown,
  fieldName: string
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ValidationError(`${fieldName} must be an integer or null.`);
  }

  return value;
}

function normalizeOptionalWordList(
  value: unknown,
  fieldName = "captionEmphasisWords"
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return parseSerializedTags(value);
  }

  throw new ValidationError(
    `${fieldName} must be a string, string array or null.`
  );
}

function readOptionalOrder(
  record: Record<string, unknown>,
  field: "order"
): number | undefined {
  const value = record[field];

  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    Number.isNaN(value) ||
    value < 1
  ) {
    throw new ValidationError(`${field} must be a positive integer.`);
  }

  return value;
}

function validateSceneIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError("sceneIds must be a non-empty array of ids.");
  }

  const sceneIds = value.map((entry) => ensureRequiredString(entry, "sceneIds"));

  if (new Set(sceneIds).size !== sceneIds.length) {
    throw new ValidationError("sceneIds must not contain duplicate ids.");
  }

  return sceneIds;
}

export function validateCreateProjectInput(
  payload: unknown
): CreateProjectInput {
  const record = asRecord(payload);

  return {
    title: readRequiredString(record, "title"),
    status:
      "status" in record ? normalizeProjectStatusValue(record.status) : "DRAFT",
    channelId: readRequiredString(record, "channelId"),
    script: readOptionalString(record, "script") ?? null,
    durationTarget: readOptionalNumber(record, "durationTarget") ?? null,
    format: readOptionalString(record, "format") ?? "9:16",
    templateId: normalizeOptionalTemplateId(record.templateId) ?? null,
    defaultCaptionStyle:
      normalizeOptionalCaptionStyleId(
        record.defaultCaptionStyle,
        "defaultCaptionStyle"
      ) ?? null,
    backgroundMusicAssetId: readOptionalString(record, "backgroundMusicAssetId") ?? null,
    voiceoverAssetId: readOptionalString(record, "voiceoverAssetId") ?? null,
    audioMood: normalizeOptionalAudioMood(record.audioMood) ?? null,
    musicVolume: normalizeOptionalUnitInterval(record.musicVolume, "musicVolume") ?? 0.18,
    voiceVolume: normalizeOptionalUnitInterval(record.voiceVolume, "voiceVolume") ?? 1,
    sfxVolume: normalizeOptionalUnitInterval(record.sfxVolume, "sfxVolume") ?? 0.7,
    enableAudioDucking:
      normalizeOptionalBoolean(record.enableAudioDucking, "enableAudioDucking") ?? false,
    duckingLevel:
      normalizeOptionalUnitInterval(record.duckingLevel, "duckingLevel") ?? 0.35
  };
}

export function validateUpdateProjectInput(
  payload: unknown
): UpdateProjectInput {
  const record = asRecord(payload);
  const update: UpdateProjectInput = {};

  if ("title" in record) {
    update.title = readRequiredString(record, "title");
  }

  if ("status" in record) {
    update.status = normalizeProjectStatusValue(record.status);
  }

  if ("channelId" in record) {
    update.channelId = readRequiredString(record, "channelId");
  }

  if ("script" in record) {
    update.script = readOptionalString(record, "script") ?? null;
  }

  if ("durationTarget" in record) {
    update.durationTarget = readOptionalNumber(record, "durationTarget") ?? null;
  }

  if ("format" in record) {
    update.format = readRequiredString(record, "format");
  }

  if ("templateId" in record) {
    update.templateId = normalizeOptionalTemplateId(record.templateId) ?? null;
  }

  if ("defaultCaptionStyle" in record) {
    update.defaultCaptionStyle =
      normalizeOptionalCaptionStyleId(
        record.defaultCaptionStyle,
        "defaultCaptionStyle"
      ) ?? null;
  }

  if ("backgroundMusicAssetId" in record) {
    update.backgroundMusicAssetId =
      readOptionalString(record, "backgroundMusicAssetId") ?? null;
  }

  if ("voiceoverAssetId" in record) {
    update.voiceoverAssetId =
      readOptionalString(record, "voiceoverAssetId") ?? null;
  }

  if ("audioMood" in record) {
    update.audioMood = normalizeOptionalAudioMood(record.audioMood) ?? null;
  }

  if ("musicVolume" in record) {
    update.musicVolume =
      normalizeOptionalUnitInterval(record.musicVolume, "musicVolume") ?? null;
  }

  if ("voiceVolume" in record) {
    update.voiceVolume =
      normalizeOptionalUnitInterval(record.voiceVolume, "voiceVolume") ?? null;
  }

  if ("sfxVolume" in record) {
    update.sfxVolume =
      normalizeOptionalUnitInterval(record.sfxVolume, "sfxVolume") ?? null;
  }

  if ("enableAudioDucking" in record) {
    update.enableAudioDucking =
      normalizeOptionalBoolean(record.enableAudioDucking, "enableAudioDucking") ?? false;
  }

  if ("duckingLevel" in record) {
    update.duckingLevel =
      normalizeOptionalUnitInterval(record.duckingLevel, "duckingLevel") ?? null;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError(
      "At least one video project field must be provided for update."
    );
  }

  return update;
}

export function validateCreateSceneInput(payload: unknown): CreateSceneInput {
  const record = asRecord(payload);
  const order = readOptionalOrder(record, "order");

  return {
    ...(typeof order === "number" ? { order } : {}),
    title: readRequiredString(record, "title"),
    narrationText: readOptionalString(record, "narrationText") ?? null,
    captionText: readOptionalString(record, "captionText") ?? null,
    duration: readOptionalNumber(record, "duration") ?? null,
    emotion: normalizeOptionalEmotionTagValue(record.emotion) ?? null,
    assetId: readOptionalString(record, "assetId") ?? null,
    generatedAssetId: readOptionalString(record, "generatedAssetId") ?? null,
    generatedNarrationAssetId:
      readOptionalString(record, "generatedNarrationAssetId") ?? null,
    characterProfileId:
      readOptionalString(record, "characterProfileId") ?? null,
    sfxAssetId: readOptionalString(record, "sfxAssetId") ?? null,
    sfxStartTime:
      normalizeOptionalNonNegativeNumber(record.sfxStartTime, "sfxStartTime") ?? 0,
    sfxVolume: normalizeOptionalUnitInterval(record.sfxVolume, "sfxVolume") ?? 0.7,
    visualPreset: readOptionalString(record, "visualPreset") ?? null,
    visualSourceMode:
      normalizeOptionalVisualSourceModeValue(
        record.visualSourceMode,
        "visualSourceMode"
      ) ?? null,
    visualPrompt: readOptionalString(record, "visualPrompt") ?? null,
    negativePrompt: readOptionalString(record, "negativePrompt") ?? null,
    visualRecipe: readOptionalString(record, "visualRecipe") ?? null,
    generationStatus:
      normalizeOptionalVisualGenerationStatusValue(
        record.generationStatus,
        "generationStatus"
      ) ?? null,
    generationProvider:
      normalizeOptionalVisualGenerationProviderValue(
        record.generationProvider,
        "generationProvider"
      ) ?? null,
    generationSeed:
      normalizeOptionalInteger(record.generationSeed, "generationSeed") ?? null,
    transition: readOptionalString(record, "transition") ?? null,
    captionStyle:
      normalizeOptionalCaptionStyleId(record.captionStyle, "captionStyle") ?? null,
    captionPosition:
      normalizeOptionalCaptionPositionValue(
        record.captionPosition,
        "captionPosition"
      ) ?? null,
    captionEmphasisWords:
      normalizeOptionalWordList(
        record.captionEmphasisWords,
        "captionEmphasisWords"
      ) ?? [],
    energyLevel: normalizeOptionalEnergyLevel(record.energyLevel) ?? null,
    narrationStatus:
      normalizeOptionalNarrationStatusValue(
        record.narrationStatus,
        "narrationStatus"
      ) ?? null,
    narrationProvider:
      normalizeOptionalNarrationProviderValue(
        record.narrationProvider,
        "narrationProvider"
      ) ?? null,
    narrationVoicePackId:
      readOptionalString(record, "narrationVoicePackId") ?? null
  };
}

export function validateUpdateSceneInput(payload: unknown): UpdateSceneInput {
  const record = asRecord(payload);
  const update: UpdateSceneInput = {};

  if ("order" in record) {
    const order = readOptionalOrder(record, "order");

    if (typeof order === "number") {
      update.order = order;
    }
  }

  if ("title" in record) {
    update.title = readRequiredString(record, "title");
  }

  if ("narrationText" in record) {
    update.narrationText = readOptionalString(record, "narrationText") ?? null;
  }

  if ("captionText" in record) {
    update.captionText = readOptionalString(record, "captionText") ?? null;
  }

  if ("duration" in record) {
    update.duration = readOptionalNumber(record, "duration") ?? null;
  }

  if ("emotion" in record) {
    update.emotion = normalizeOptionalEmotionTagValue(record.emotion) ?? null;
  }

  if ("assetId" in record) {
    update.assetId = readOptionalString(record, "assetId") ?? null;
  }

  if ("generatedAssetId" in record) {
    update.generatedAssetId =
      readOptionalString(record, "generatedAssetId") ?? null;
  }

  if ("generatedNarrationAssetId" in record) {
    update.generatedNarrationAssetId =
      readOptionalString(record, "generatedNarrationAssetId") ?? null;
  }

  if ("characterProfileId" in record) {
    update.characterProfileId =
      readOptionalString(record, "characterProfileId") ?? null;
  }

  if ("sfxAssetId" in record) {
    update.sfxAssetId = readOptionalString(record, "sfxAssetId") ?? null;
  }

  if ("sfxStartTime" in record) {
    update.sfxStartTime =
      normalizeOptionalNonNegativeNumber(record.sfxStartTime, "sfxStartTime") ?? null;
  }

  if ("sfxVolume" in record) {
    update.sfxVolume =
      normalizeOptionalUnitInterval(record.sfxVolume, "sfxVolume") ?? null;
  }

  if ("visualPreset" in record) {
    update.visualPreset = readOptionalString(record, "visualPreset") ?? null;
  }

  if ("visualSourceMode" in record) {
    update.visualSourceMode =
      normalizeOptionalVisualSourceModeValue(
        record.visualSourceMode,
        "visualSourceMode"
      ) ?? null;
  }

  if ("visualPrompt" in record) {
    update.visualPrompt = readOptionalString(record, "visualPrompt") ?? null;
  }

  if ("negativePrompt" in record) {
    update.negativePrompt =
      readOptionalString(record, "negativePrompt") ?? null;
  }

  if ("visualRecipe" in record) {
    update.visualRecipe = readOptionalString(record, "visualRecipe") ?? null;
  }

  if ("generationStatus" in record) {
    update.generationStatus =
      normalizeOptionalVisualGenerationStatusValue(
        record.generationStatus,
        "generationStatus"
      ) ?? null;
  }

  if ("generationProvider" in record) {
    update.generationProvider =
      normalizeOptionalVisualGenerationProviderValue(
        record.generationProvider,
        "generationProvider"
      ) ?? null;
  }

  if ("generationSeed" in record) {
    update.generationSeed =
      normalizeOptionalInteger(record.generationSeed, "generationSeed") ?? null;
  }

  if ("transition" in record) {
    update.transition = readOptionalString(record, "transition") ?? null;
  }

  if ("captionStyle" in record) {
    update.captionStyle =
      normalizeOptionalCaptionStyleId(record.captionStyle, "captionStyle") ?? null;
  }

  if ("captionPosition" in record) {
    update.captionPosition =
      normalizeOptionalCaptionPositionValue(
        record.captionPosition,
        "captionPosition"
      ) ?? null;
  }

  if ("captionEmphasisWords" in record) {
    update.captionEmphasisWords =
      normalizeOptionalWordList(
        record.captionEmphasisWords,
        "captionEmphasisWords"
      ) ?? [];
  }

  if ("energyLevel" in record) {
    update.energyLevel = normalizeOptionalEnergyLevel(record.energyLevel) ?? null;
  }

  if ("narrationStatus" in record) {
    update.narrationStatus =
      normalizeOptionalNarrationStatusValue(
        record.narrationStatus,
        "narrationStatus"
      ) ?? null;
  }

  if ("narrationProvider" in record) {
    update.narrationProvider =
      normalizeOptionalNarrationProviderValue(
        record.narrationProvider,
        "narrationProvider"
      ) ?? null;
  }

  if ("narrationVoicePackId" in record) {
    update.narrationVoicePackId =
      readOptionalString(record, "narrationVoicePackId") ?? null;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError(
      "At least one scene field must be provided for update."
    );
  }

  return update;
}

export function validateReorderScenesInput(
  payload: unknown
): ReorderScenesInput {
  const record = asRecord(payload);

  return {
    sceneIds: validateSceneIds(record.sceneIds)
  };
}

