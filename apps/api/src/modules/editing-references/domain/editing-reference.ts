import {
  editingReferenceBeatIntensities,
  editingReferenceCaptionStyles,
  editingReferenceCategories,
  editingReferenceCtaStyles,
  editingReferenceFlashStyles,
  editingReferenceHookStyles,
  editingReferenceMicroclipPlacements,
  editingReferenceMusicStyles,
  editingReferenceNarrationStyles,
  editingReferencePacingOptions,
  editingReferenceSfxStyles,
  editingReferenceSourceTypes,
  editingReferenceStatuses,
  editingReferenceTransitionStyles,
  editingReferenceZoomStyles,
  type EditingReferenceBeatIntensity,
  type EditingReferenceCaptionStyle,
  type EditingReferenceCategory,
  type EditingReferenceCtaStyle,
  type EditingReferenceFlashStyle,
  type EditingReferenceHookStyle,
  type EditingReferenceMicroclipPlacement,
  type EditingReferenceMusicStyle,
  type EditingReferenceNarrationStyle,
  type EditingReferencePacing,
  type EditingReferencePresetRecord,
  type EditingReferenceRecord,
  type EditingReferenceSfxStyle,
  type EditingReferenceSourceType,
  type EditingReferenceStatus,
  type EditingReferenceTransitionStyle,
  type EditingReferenceZoomStyle
} from "@reelforge/editing-reference-engine";
import { ValidationError } from "../../../shared/errors.js";
import type { StudioAsset } from "../../assets/domain/asset.js";

export {
  editingReferenceBeatIntensities,
  editingReferenceCaptionStyles,
  editingReferenceCategories,
  editingReferenceCtaStyles,
  editingReferenceFlashStyles,
  editingReferenceHookStyles,
  editingReferenceMicroclipPlacements,
  editingReferenceMusicStyles,
  editingReferenceNarrationStyles,
  editingReferencePacingOptions,
  editingReferenceSfxStyles,
  editingReferenceSourceTypes,
  editingReferenceStatuses,
  editingReferenceTransitionStyles,
  editingReferenceZoomStyles
};

export type {
  EditingReferenceBeatIntensity,
  EditingReferenceCaptionStyle,
  EditingReferenceCategory,
  EditingReferenceCtaStyle,
  EditingReferenceFlashStyle,
  EditingReferenceHookStyle,
  EditingReferenceMicroclipPlacement,
  EditingReferenceMusicStyle,
  EditingReferenceNarrationStyle,
  EditingReferencePacing,
  EditingReferenceSfxStyle,
  EditingReferenceSourceType,
  EditingReferenceStatus,
  EditingReferenceTransitionStyle,
  EditingReferenceZoomStyle
};

export interface EditingReference extends EditingReferenceRecord {
  asset: StudioAsset | null;
}

export interface EditingReferencePreset extends EditingReferencePresetRecord {
  reference: EditingReference | null;
}

export interface EditingReferenceFilters {
  category?: EditingReferenceCategory;
  status?: EditingReferenceStatus;
  sourceType?: EditingReferenceSourceType;
}

export interface EditingReferencePresetFilters {
  useCase?: EditingReferenceCategory;
  referenceId?: string;
  templateId?: string;
}

export interface CreateEditingReferenceInput {
  title: string;
  description: string | null;
  assetId: string | null;
  localPath: string | null;
  sourceType: EditingReferenceSourceType;
  category: EditingReferenceCategory;
  status: EditingReferenceStatus;
  durationSeconds: number | null;
  averageCutPaceSeconds: number | null;
  beatIntensity: EditingReferenceBeatIntensity;
  pacing: EditingReferencePacing;
  zoomStyle: EditingReferenceZoomStyle;
  flashStyle: EditingReferenceFlashStyle;
  transitionStyle: EditingReferenceTransitionStyle;
  captionStyle: EditingReferenceCaptionStyle;
  narrationStyle: EditingReferenceNarrationStyle;
  musicStyle: EditingReferenceMusicStyle;
  sfxStyle: EditingReferenceSfxStyle;
  hookStyle: EditingReferenceHookStyle;
  ctaStyle: EditingReferenceCtaStyle;
  microclipPlacement: EditingReferenceMicroclipPlacement;
  visualStyleNotes: string | null;
  audioStyleNotes: string | null;
  editingStyleNotes: string | null;
  analysisWarnings: string[];
}

export type UpdateEditingReferenceInput = Partial<CreateEditingReferenceInput>;

export interface CreateEditingReferencePresetInput {
  referenceId: string | null;
  name: string;
  slug: string;
  description: string;
  useCase: EditingReferenceCategory;
  cutPace: number | null;
  pacing: EditingReferencePacing;
  zoomStyle: EditingReferenceZoomStyle;
  flashStyle: EditingReferenceFlashStyle;
  transitionStyle: EditingReferenceTransitionStyle;
  captionStyle: EditingReferenceCaptionStyle;
  narrationStyle: EditingReferenceNarrationStyle;
  musicStyle: EditingReferenceMusicStyle;
  sfxStyle: EditingReferenceSfxStyle;
  hookStyle: EditingReferenceHookStyle;
  ctaStyle: EditingReferenceCtaStyle;
  microclipPlacement: EditingReferenceMicroclipPlacement;
  recommendedTemplates: string[];
  recommendedMusicPresetId: string | null;
  recommendedAudioMasteringPresetId: string | null;
  recommendedNarrationVoicePackId: string | null;
  defaultShotDurationSeconds: number | null;
  notes: string | null;
}

export type UpdateEditingReferencePresetInput =
  Partial<CreateEditingReferencePresetInput>;

export interface BuildEditingReferencePresetPayload {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  recommendedTemplates?: string[];
  recommendedMusicPresetId?: string | null;
  recommendedAudioMasteringPresetId?: string | null;
  recommendedNarrationVoicePackId?: string | null;
  defaultShotDurationSeconds?: number | null;
  notes?: string | null;
}

export interface EditingReferenceSuggestion {
  templateId: string;
  preset: EditingReferencePreset;
  origin: "saved" | "catalog";
  reason: string;
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

function readOptionalNumber(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative number or null.`);
  }

  return Math.round(value * 1000) / 1000;
}

function normalizeValue<T extends readonly string[]>(
  value: unknown,
  options: T,
  fieldName: string
): T[number] {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be one of: ${options.join(", ")}.`);
  }

  const normalized = value.trim().toLowerCase().replaceAll("-", "_");

  if (!options.includes(normalized)) {
    throw new ValidationError(`${fieldName} must be one of: ${options.join(", ")}.`);
  }

  return normalized as T[number];
}

function normalizeOptionalValue<T extends readonly string[]>(
  value: unknown,
  options: T,
  fieldName: string
): T[number] | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return normalizeValue(value, options, fieldName);
}

function normalizeStringList(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  throw new ValidationError(
    `${fieldName} must be a comma-separated string, string array or null.`
  );
}

function validateReferenceSourceRequirements(input: {
  sourceType: EditingReferenceSourceType;
  assetId: string | null;
  localPath: string | null;
}) {
  if (input.sourceType === "asset_library" && !input.assetId) {
    throw new ValidationError(
      "assetId is required when sourceType is asset_library."
    );
  }

  if (input.sourceType === "local_file" && !input.localPath) {
    throw new ValidationError(
      "localPath is required when sourceType is local_file."
    );
  }
}

function createReferenceDefaults(): Omit<CreateEditingReferenceInput, "title"> {
  return {
    description: null,
    assetId: null,
    localPath: null,
    sourceType: "local_file",
    category: "generic",
    status: "draft",
    durationSeconds: null,
    averageCutPaceSeconds: null,
    beatIntensity: "medium",
    pacing: "medium",
    zoomStyle: "subtle",
    flashStyle: "none",
    transitionStyle: "cut",
    captionStyle: "lower_clean",
    narrationStyle: "calm",
    musicStyle: "none",
    sfxStyle: "none",
    hookStyle: "curiosity",
    ctaStyle: "short",
    microclipPlacement: "none",
    visualStyleNotes: null,
    audioStyleNotes: null,
    editingStyleNotes: null,
    analysisWarnings: []
  };
}

function createPresetDefaults(): Omit<
  CreateEditingReferencePresetInput,
  "name" | "slug" | "description"
> {
  return {
    referenceId: null,
    useCase: "generic",
    cutPace: null,
    pacing: "medium",
    zoomStyle: "subtle",
    flashStyle: "none",
    transitionStyle: "cut",
    captionStyle: "lower_clean",
    narrationStyle: "calm",
    musicStyle: "none",
    sfxStyle: "none",
    hookStyle: "curiosity",
    ctaStyle: "short",
    microclipPlacement: "none",
    recommendedTemplates: [],
    recommendedMusicPresetId: null,
    recommendedAudioMasteringPresetId: null,
    recommendedNarrationVoicePackId: null,
    defaultShotDurationSeconds: null,
    notes: null
  };
}

export function validateEditingReferenceFilters(
  payload: Record<string, string | undefined>
): EditingReferenceFilters {
  const filters: EditingReferenceFilters = {};

  if (payload.category) {
    filters.category = normalizeValue(
      payload.category,
      editingReferenceCategories,
      "category"
    );
  }

  if (payload.status) {
    filters.status = normalizeValue(
      payload.status,
      editingReferenceStatuses,
      "status"
    );
  }

  if (payload.sourceType) {
    filters.sourceType = normalizeValue(
      payload.sourceType,
      editingReferenceSourceTypes,
      "sourceType"
    );
  }

  return filters;
}

export function validateEditingReferencePresetFilters(
  payload: Record<string, string | undefined>
): EditingReferencePresetFilters {
  const filters: EditingReferencePresetFilters = {};

  if (payload.useCase) {
    filters.useCase = normalizeValue(
      payload.useCase,
      editingReferenceCategories,
      "useCase"
    );
  }

  if (typeof payload.referenceId === "string" && payload.referenceId.trim()) {
    filters.referenceId = payload.referenceId.trim();
  }

  if (typeof payload.templateId === "string" && payload.templateId.trim()) {
    filters.templateId = payload.templateId.trim();
  }

  return filters;
}

export function validateCreateEditingReferenceInput(
  payload: unknown
): CreateEditingReferenceInput {
  const record = asRecord(payload);
  const defaults = createReferenceDefaults();
  const input: CreateEditingReferenceInput = {
    ...defaults,
    title: ensureRequiredString(record.title, "title"),
    description: readOptionalString(record, "description") ?? defaults.description,
    assetId: readOptionalString(record, "assetId") ?? defaults.assetId,
    localPath: readOptionalString(record, "localPath") ?? defaults.localPath,
    sourceType:
      normalizeOptionalValue(
        record.sourceType,
        editingReferenceSourceTypes,
        "sourceType"
      ) ?? defaults.sourceType,
    category:
      normalizeOptionalValue(
        record.category,
        editingReferenceCategories,
        "category"
      ) ?? defaults.category,
    status:
      normalizeOptionalValue(
        record.status,
        editingReferenceStatuses,
        "status"
      ) ?? defaults.status,
    durationSeconds:
      readOptionalNumber(record, "durationSeconds") ?? defaults.durationSeconds,
    averageCutPaceSeconds:
      readOptionalNumber(record, "averageCutPaceSeconds") ??
      defaults.averageCutPaceSeconds,
    beatIntensity:
      normalizeOptionalValue(
        record.beatIntensity,
        editingReferenceBeatIntensities,
        "beatIntensity"
      ) ?? defaults.beatIntensity,
    pacing:
      normalizeOptionalValue(
        record.pacing,
        editingReferencePacingOptions,
        "pacing"
      ) ?? defaults.pacing,
    zoomStyle:
      normalizeOptionalValue(
        record.zoomStyle,
        editingReferenceZoomStyles,
        "zoomStyle"
      ) ?? defaults.zoomStyle,
    flashStyle:
      normalizeOptionalValue(
        record.flashStyle,
        editingReferenceFlashStyles,
        "flashStyle"
      ) ?? defaults.flashStyle,
    transitionStyle:
      normalizeOptionalValue(
        record.transitionStyle,
        editingReferenceTransitionStyles,
        "transitionStyle"
      ) ?? defaults.transitionStyle,
    captionStyle:
      normalizeOptionalValue(
        record.captionStyle,
        editingReferenceCaptionStyles,
        "captionStyle"
      ) ?? defaults.captionStyle,
    narrationStyle:
      normalizeOptionalValue(
        record.narrationStyle,
        editingReferenceNarrationStyles,
        "narrationStyle"
      ) ?? defaults.narrationStyle,
    musicStyle:
      normalizeOptionalValue(
        record.musicStyle,
        editingReferenceMusicStyles,
        "musicStyle"
      ) ?? defaults.musicStyle,
    sfxStyle:
      normalizeOptionalValue(
        record.sfxStyle,
        editingReferenceSfxStyles,
        "sfxStyle"
      ) ?? defaults.sfxStyle,
    hookStyle:
      normalizeOptionalValue(
        record.hookStyle,
        editingReferenceHookStyles,
        "hookStyle"
      ) ?? defaults.hookStyle,
    ctaStyle:
      normalizeOptionalValue(
        record.ctaStyle,
        editingReferenceCtaStyles,
        "ctaStyle"
      ) ?? defaults.ctaStyle,
    microclipPlacement:
      normalizeOptionalValue(
        record.microclipPlacement,
        editingReferenceMicroclipPlacements,
        "microclipPlacement"
      ) ?? defaults.microclipPlacement,
    visualStyleNotes:
      readOptionalString(record, "visualStyleNotes") ?? defaults.visualStyleNotes,
    audioStyleNotes:
      readOptionalString(record, "audioStyleNotes") ?? defaults.audioStyleNotes,
    editingStyleNotes:
      readOptionalString(record, "editingStyleNotes") ?? defaults.editingStyleNotes,
    analysisWarnings: normalizeStringList(record.analysisWarnings, "analysisWarnings")
  };

  validateReferenceSourceRequirements(input);
  return input;
}

export function validateUpdateEditingReferenceInput(
  payload: unknown
): UpdateEditingReferenceInput {
  const record = asRecord(payload);
  const update: UpdateEditingReferenceInput = {};

  if ("title" in record) {
    update.title = ensureRequiredString(record.title, "title");
  }

  if ("description" in record) {
    update.description = readOptionalString(record, "description") ?? null;
  }

  if ("assetId" in record) {
    update.assetId = readOptionalString(record, "assetId") ?? null;
  }

  if ("localPath" in record) {
    update.localPath = readOptionalString(record, "localPath") ?? null;
  }

  if ("sourceType" in record) {
    update.sourceType = normalizeValue(
      record.sourceType,
      editingReferenceSourceTypes,
      "sourceType"
    );
  }

  if ("category" in record) {
    update.category = normalizeValue(
      record.category,
      editingReferenceCategories,
      "category"
    );
  }

  if ("status" in record) {
    update.status = normalizeValue(
      record.status,
      editingReferenceStatuses,
      "status"
    );
  }

  const numericFields = [
    "durationSeconds",
    "averageCutPaceSeconds"
  ] as const;

  for (const field of numericFields) {
    if (field in record) {
      update[field] = readOptionalNumber(record, field) ?? null;
    }
  }

  const enumFields = [
    ["beatIntensity", editingReferenceBeatIntensities],
    ["pacing", editingReferencePacingOptions],
    ["zoomStyle", editingReferenceZoomStyles],
    ["flashStyle", editingReferenceFlashStyles],
    ["transitionStyle", editingReferenceTransitionStyles],
    ["captionStyle", editingReferenceCaptionStyles],
    ["narrationStyle", editingReferenceNarrationStyles],
    ["musicStyle", editingReferenceMusicStyles],
    ["sfxStyle", editingReferenceSfxStyles],
    ["hookStyle", editingReferenceHookStyles],
    ["ctaStyle", editingReferenceCtaStyles],
    ["microclipPlacement", editingReferenceMicroclipPlacements]
  ] as const;

  for (const [field, options] of enumFields) {
    if (field in record) {
      (update as Record<string, unknown>)[field] =
        normalizeValue(record[field], options, field);
    }
  }

  const textFields = [
    "visualStyleNotes",
    "audioStyleNotes",
    "editingStyleNotes"
  ] as const;

  for (const field of textFields) {
    if (field in record) {
      update[field] = readOptionalString(record, field) ?? null;
    }
  }

  if ("analysisWarnings" in record) {
    update.analysisWarnings = normalizeStringList(
      record.analysisWarnings,
      "analysisWarnings"
    );
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError(
      "At least one editing reference field must be provided for update."
    );
  }

  return update;
}

export function validateCreateEditingReferencePresetInput(
  payload: unknown
): CreateEditingReferencePresetInput {
  const record = asRecord(payload);
  const defaults = createPresetDefaults();

  return {
    ...defaults,
    referenceId: readOptionalString(record, "referenceId") ?? defaults.referenceId,
    name: ensureRequiredString(record.name, "name"),
    slug: ensureRequiredString(record.slug, "slug"),
    description: ensureRequiredString(record.description, "description"),
    useCase:
      normalizeOptionalValue(
        record.useCase,
        editingReferenceCategories,
        "useCase"
      ) ?? defaults.useCase,
    cutPace: readOptionalNumber(record, "cutPace") ?? defaults.cutPace,
    pacing:
      normalizeOptionalValue(
        record.pacing,
        editingReferencePacingOptions,
        "pacing"
      ) ?? defaults.pacing,
    zoomStyle:
      normalizeOptionalValue(
        record.zoomStyle,
        editingReferenceZoomStyles,
        "zoomStyle"
      ) ?? defaults.zoomStyle,
    flashStyle:
      normalizeOptionalValue(
        record.flashStyle,
        editingReferenceFlashStyles,
        "flashStyle"
      ) ?? defaults.flashStyle,
    transitionStyle:
      normalizeOptionalValue(
        record.transitionStyle,
        editingReferenceTransitionStyles,
        "transitionStyle"
      ) ?? defaults.transitionStyle,
    captionStyle:
      normalizeOptionalValue(
        record.captionStyle,
        editingReferenceCaptionStyles,
        "captionStyle"
      ) ?? defaults.captionStyle,
    narrationStyle:
      normalizeOptionalValue(
        record.narrationStyle,
        editingReferenceNarrationStyles,
        "narrationStyle"
      ) ?? defaults.narrationStyle,
    musicStyle:
      normalizeOptionalValue(
        record.musicStyle,
        editingReferenceMusicStyles,
        "musicStyle"
      ) ?? defaults.musicStyle,
    sfxStyle:
      normalizeOptionalValue(
        record.sfxStyle,
        editingReferenceSfxStyles,
        "sfxStyle"
      ) ?? defaults.sfxStyle,
    hookStyle:
      normalizeOptionalValue(
        record.hookStyle,
        editingReferenceHookStyles,
        "hookStyle"
      ) ?? defaults.hookStyle,
    ctaStyle:
      normalizeOptionalValue(
        record.ctaStyle,
        editingReferenceCtaStyles,
        "ctaStyle"
      ) ?? defaults.ctaStyle,
    microclipPlacement:
      normalizeOptionalValue(
        record.microclipPlacement,
        editingReferenceMicroclipPlacements,
        "microclipPlacement"
      ) ?? defaults.microclipPlacement,
    recommendedTemplates: normalizeStringList(
      record.recommendedTemplates,
      "recommendedTemplates"
    ),
    recommendedMusicPresetId:
      readOptionalString(record, "recommendedMusicPresetId") ??
      defaults.recommendedMusicPresetId,
    recommendedAudioMasteringPresetId:
      readOptionalString(record, "recommendedAudioMasteringPresetId") ??
      defaults.recommendedAudioMasteringPresetId,
    recommendedNarrationVoicePackId:
      readOptionalString(record, "recommendedNarrationVoicePackId") ??
      defaults.recommendedNarrationVoicePackId,
    defaultShotDurationSeconds:
      readOptionalNumber(record, "defaultShotDurationSeconds") ??
      defaults.defaultShotDurationSeconds,
    notes: readOptionalString(record, "notes") ?? defaults.notes
  };
}

export function validateUpdateEditingReferencePresetInput(
  payload: unknown
): UpdateEditingReferencePresetInput {
  const record = asRecord(payload);
  const update: UpdateEditingReferencePresetInput = {};

  const stringFields = [
    "referenceId",
    "name",
    "slug",
    "description",
    "recommendedMusicPresetId",
    "recommendedAudioMasteringPresetId",
    "recommendedNarrationVoicePackId",
    "notes"
  ] as const;

  for (const field of stringFields) {
    if (field in record) {
      (update as Record<string, unknown>)[field] =
        field === "name" || field === "slug" || field === "description"
          ? ensureRequiredString(record[field], field)
          : readOptionalString(record, field) ?? null;
    }
  }

  if ("useCase" in record) {
    update.useCase = normalizeValue(
      record.useCase,
      editingReferenceCategories,
      "useCase"
    );
  }

  if ("cutPace" in record) {
    update.cutPace = readOptionalNumber(record, "cutPace") ?? null;
  }

  if ("defaultShotDurationSeconds" in record) {
    update.defaultShotDurationSeconds =
      readOptionalNumber(record, "defaultShotDurationSeconds") ?? null;
  }

  const enumFields = [
    ["pacing", editingReferencePacingOptions],
    ["zoomStyle", editingReferenceZoomStyles],
    ["flashStyle", editingReferenceFlashStyles],
    ["transitionStyle", editingReferenceTransitionStyles],
    ["captionStyle", editingReferenceCaptionStyles],
    ["narrationStyle", editingReferenceNarrationStyles],
    ["musicStyle", editingReferenceMusicStyles],
    ["sfxStyle", editingReferenceSfxStyles],
    ["hookStyle", editingReferenceHookStyles],
    ["ctaStyle", editingReferenceCtaStyles],
    ["microclipPlacement", editingReferenceMicroclipPlacements]
  ] as const;

  for (const [field, options] of enumFields) {
    if (field in record) {
      (update as Record<string, unknown>)[field] =
        normalizeValue(record[field], options, field);
    }
  }

  if ("recommendedTemplates" in record) {
    update.recommendedTemplates = normalizeStringList(
      record.recommendedTemplates,
      "recommendedTemplates"
    );
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError(
      "At least one editing reference preset field must be provided for update."
    );
  }

  return update;
}

export function validateBuildEditingReferencePresetPayload(
  payload: unknown
): BuildEditingReferencePresetPayload {
  const record = asRecord(payload);
  const output: BuildEditingReferencePresetPayload = {};

  if ("name" in record) {
    output.name = readOptionalString(record, "name") ?? null;
  }

  if ("slug" in record) {
    output.slug = readOptionalString(record, "slug") ?? null;
  }

  if ("description" in record) {
    output.description = readOptionalString(record, "description") ?? null;
  }

  if ("recommendedTemplates" in record) {
    output.recommendedTemplates = normalizeStringList(
      record.recommendedTemplates,
      "recommendedTemplates"
    );
  }

  if ("recommendedMusicPresetId" in record) {
    output.recommendedMusicPresetId =
      readOptionalString(record, "recommendedMusicPresetId") ?? null;
  }

  if ("recommendedAudioMasteringPresetId" in record) {
    output.recommendedAudioMasteringPresetId =
      readOptionalString(record, "recommendedAudioMasteringPresetId") ?? null;
  }

  if ("recommendedNarrationVoicePackId" in record) {
    output.recommendedNarrationVoicePackId =
      readOptionalString(record, "recommendedNarrationVoicePackId") ?? null;
  }

  if ("defaultShotDurationSeconds" in record) {
    output.defaultShotDurationSeconds =
      readOptionalNumber(record, "defaultShotDurationSeconds") ?? null;
  }

  if ("notes" in record) {
    output.notes = readOptionalString(record, "notes") ?? null;
  }

  return output;
}
