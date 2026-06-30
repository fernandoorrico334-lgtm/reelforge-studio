import { getCinematicPresetById } from "@reelforge/cinematic-engine";
import { ValidationError } from "../../../shared/errors.js";
import type { StudioAsset } from "../../assets/domain/asset.js";
import {
  normalizeOptionalEmotionTagValue,
  normalizeOptionalNumber,
  normalizeOptionalString,
  parseSerializedTags,
  parseTagInput,
  type EmotionTag
} from "../../assets/domain/asset.js";
import type { StudioChannel } from "../../channels/domain/channel.js";
import {
  projectStatuses,
  type ProjectStatus,
  type VisualGenerationProvider,
  type VisualGenerationStatus,
  type VisualSourceMode
} from "../../projects/domain/project.js";

export const researchDossierStatuses = [
  "draft",
  "researching",
  "ready_for_review",
  "completed",
  "failed"
] as const;

export type ResearchDossierStatus = (typeof researchDossierStatuses)[number];

export const researchSourceTypes = [
  "web_page",
  "wikipedia",
  "wikidata",
  "archive",
  "document",
  "manual_note",
  "book",
  "article",
  "official_record",
  "other"
] as const;

export type ResearchSourceType = (typeof researchSourceTypes)[number];

export const researchSourceStatuses = [
  "candidate",
  "approved",
  "rejected",
  "imported",
  "failed"
] as const;

export type ResearchSourceStatus = (typeof researchSourceStatuses)[number];

export const researchFactTypes = [
  "date",
  "person",
  "place",
  "event",
  "quote",
  "context",
  "statistic",
  "allegation",
  "uncertainty",
  "other"
] as const;

export type ResearchFactType = (typeof researchFactTypes)[number];

export const researchConfidenceLevels = [
  "confirmed",
  "likely",
  "disputed",
  "uncertain"
] as const;

export type ResearchConfidence = (typeof researchConfidenceLevels)[number];

export const researchHookTypes = [
  "mystery",
  "shock",
  "question",
  "contrast",
  "timeline",
  "character",
  "revelation",
  "warning",
  "other"
] as const;

export type ResearchHookType = (typeof researchHookTypes)[number];

export const researchAssetMediaTypes = [
  "image",
  "video",
  "audio",
  "music",
  "sfx",
  "overlay",
  "document",
  "map",
  "text_card"
] as const;

export type ResearchAssetMediaType = (typeof researchAssetMediaTypes)[number];

export const researchOutlineRoles = [
  "hook",
  "context",
  "tension",
  "climax",
  "resolution",
  "cta"
] as const;

export type ResearchOutlineRole = (typeof researchOutlineRoles)[number];

export interface ResearchLinkedMediaCollection {
  id: string;
  name: string;
  provider: string;
  query: string | null;
  mediaType: string | null;
  status: string;
  targetCount: number | null;
  importedCount: number;
  rejectedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchDossier {
  id: string;
  channelId: string | null;
  channel: StudioChannel | null;
  title: string;
  topic: string;
  niche: string | null;
  tone: string | null;
  targetDuration: number | null;
  status: ResearchDossierStatus;
  summary: string | null;
  narrativeAngle: string | null;
  editorialNotes: string | null;
  safetyNotes: string | null;
  sourceCount: number;
  approvedSourceCount: number;
  factCount: number;
  timelineCount: number;
  outlineSceneCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchSource {
  id: string;
  dossierId: string;
  title: string;
  url: string | null;
  provider: string;
  sourceType: ResearchSourceType;
  author: string | null;
  publishedAt: string | null;
  accessedAt: string | null;
  reliabilityScore: number | null;
  citationText: string | null;
  rawTextPath: string | null;
  excerpt: string | null;
  notes: string | null;
  status: ResearchSourceStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchFact {
  id: string;
  dossierId: string;
  sourceId: string | null;
  claim: string;
  factType: ResearchFactType;
  confidence: ResearchConfidence;
  dateValue: string | null;
  people: string[];
  places: string[];
  tags: string[];
  notes: string | null;
  source: ResearchSource | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchTimelineEvent {
  id: string;
  dossierId: string;
  sourceId: string | null;
  title: string;
  description: string;
  dateValue: string | null;
  order: number | null;
  location: string | null;
  people: string[];
  confidence: ResearchConfidence;
  source: ResearchSource | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchHook {
  id: string;
  dossierId: string;
  text: string;
  hookType: ResearchHookType;
  strengthScore: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchAssetRequirement {
  id: string;
  dossierId: string;
  sceneRole: ResearchOutlineRole | null;
  description: string;
  mediaType: ResearchAssetMediaType;
  suggestedTags: string[];
  emotion: EmotionTag | null;
  priority: number | null;
  fulfilledAssetId: string | null;
  fulfilledAsset: StudioAsset | null;
  visualSourceMode: VisualSourceMode | null;
  characterProfileId: string | null;
  generatedAssetId: string | null;
  generatedAsset: StudioAsset | null;
  visualPrompt: string | null;
  generationStatus: VisualGenerationStatus | null;
  generationProvider: VisualGenerationProvider | null;
  mediaCollections: ResearchLinkedMediaCollection[];
  createdAt: string;
  updatedAt: string;
}

export interface ResearchOutlineScene {
  id: string;
  dossierId: string;
  order: number;
  role: ResearchOutlineRole;
  title: string;
  narrationDraft: string;
  captionDraft: string | null;
  emotion: EmotionTag | null;
  visualPreset: string | null;
  assetRequirementId: string | null;
  assetRequirement: ResearchAssetRequirement | null;
  estimatedDuration: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchDossierDetail {
  dossier: ResearchDossier;
  sources: ResearchSource[];
  facts: ResearchFact[];
  timeline: ResearchTimelineEvent[];
  hooks: ResearchHook[];
  assetRequirements: ResearchAssetRequirement[];
  outline: ResearchOutlineScene[];
}

export interface CreateResearchDossierInput {
  channelId: string | null;
  title: string;
  topic: string;
  niche: string | null;
  tone: string | null;
  targetDuration: number | null;
  status: ResearchDossierStatus;
  summary: string | null;
  narrativeAngle: string | null;
  editorialNotes: string | null;
  safetyNotes: string | null;
}

export type UpdateResearchDossierInput = Partial<CreateResearchDossierInput>;

export interface CreateResearchSourceInput {
  dossierId: string;
  title: string;
  url: string | null;
  provider: string;
  sourceType: ResearchSourceType;
  author: string | null;
  publishedAt: string | null;
  accessedAt: string | null;
  reliabilityScore: number | null;
  citationText: string | null;
  rawTextPath: string | null;
  excerpt: string | null;
  notes: string | null;
  status: ResearchSourceStatus;
  errorMessage: string | null;
}

export type UpdateResearchSourceInput = Partial<
  Omit<CreateResearchSourceInput, "dossierId">
>;

export interface CreateResearchFactInput {
  dossierId: string;
  sourceId: string | null;
  claim: string;
  factType: ResearchFactType;
  confidence: ResearchConfidence;
  dateValue: string | null;
  people: string[];
  places: string[];
  tags: string[];
  notes: string | null;
}

export interface CreateResearchTimelineEventInput {
  dossierId: string;
  sourceId: string | null;
  title: string;
  description: string;
  dateValue: string | null;
  order: number | null;
  location: string | null;
  people: string[];
  confidence: ResearchConfidence;
}

export interface CreateResearchHookInput {
  dossierId: string;
  text: string;
  hookType: ResearchHookType;
  strengthScore: number | null;
  notes: string | null;
}

export interface CreateResearchAssetRequirementInput {
  dossierId: string;
  ref: string | null;
  sceneRole: ResearchOutlineRole | null;
  description: string;
  mediaType: ResearchAssetMediaType;
  suggestedTags: string[];
  emotion: EmotionTag | null;
  priority: number | null;
  fulfilledAssetId: string | null;
  visualSourceMode: VisualSourceMode | null;
  characterProfileId: string | null;
  generatedAssetId: string | null;
  visualPrompt: string | null;
  generationStatus: VisualGenerationStatus | null;
  generationProvider: VisualGenerationProvider | null;
}

export type UpdateResearchAssetRequirementInput = Partial<
  Omit<CreateResearchAssetRequirementInput, "dossierId" | "ref">
>;

export interface CreateResearchOutlineSceneInput {
  dossierId: string;
  order: number;
  role: ResearchOutlineRole;
  title: string;
  narrationDraft: string;
  captionDraft: string | null;
  emotion: EmotionTag | null;
  visualPreset: string | null;
  assetRequirementRef: string | null;
  estimatedDuration: number | null;
}

export interface ReplaceResearchArtifactsInput {
  dossierPatch: Pick<
    UpdateResearchDossierInput,
    "status" | "summary" | "narrativeAngle" | "editorialNotes" | "safetyNotes"
  >;
  facts: Omit<CreateResearchFactInput, "dossierId">[];
  timelineEvents: Omit<CreateResearchTimelineEventInput, "dossierId">[];
  hooks: Omit<CreateResearchHookInput, "dossierId">[];
  assetRequirements: Omit<CreateResearchAssetRequirementInput, "dossierId">[];
  outlineScenes: Omit<CreateResearchOutlineSceneInput, "dossierId">[];
}

export interface ManualResearchSourceInput {
  title: string;
  url: string | null;
  provider: string | null;
  sourceType: ResearchSourceType;
  author: string | null;
  publishedAt: string | null;
  citationText: string | null;
  excerpt: string | null;
  notes: string | null;
  reliabilityScore: number | null;
}

export interface ResearchUrlFetchInput {
  url: string;
  title: string | null;
  notes: string | null;
}

export interface ResearchConnectorSearchInput {
  query: string | null;
  limit: number;
}

export interface CreateProductionFromResearchInput {
  title: string | null;
  status: ProjectStatus;
  format: string;
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Expected a JSON object.");
  }

  return payload as Record<string, unknown>;
}

function normalizeEnumValue<T extends string>(
  values: readonly T[],
  value: unknown,
  fieldName: string
): T {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be one of: ${values.join(", ")}.`
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!values.includes(normalized as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${values.join(", ")}.`
    );
  }

  return normalized as T;
}

function normalizeOptionalEnumValue<T extends string>(
  values: readonly T[],
  value: unknown,
  fieldName: string
): T | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return normalizeEnumValue(values, value, fieldName);
}

function ensureRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalPositiveInteger(
  value: unknown,
  fieldName: string
) {
  const parsed = normalizeOptionalNumber(value, fieldName);

  if (parsed === undefined) {
    return undefined;
  }

  if (parsed === null) {
    return null;
  }

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`${fieldName} must be a positive integer or null.`);
  }

  return parsed;
}

function normalizeOptionalScore(value: unknown, fieldName: string) {
  const parsed = normalizeOptionalNumber(value, fieldName);

  if (parsed === undefined) {
    return undefined;
  }

  if (parsed === null) {
    return null;
  }

  const rounded = Math.round(parsed);

  if (rounded < 0 || rounded > 100) {
    throw new ValidationError(`${fieldName} must be between 0 and 100.`);
  }

  return rounded;
}

function normalizeOptionalRawString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  return normalizeOptionalString(value, fieldName) ?? null;
}

function normalizeOptionalTagList(value: unknown, fieldName: string) {
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

function normalizeProjectStatusValue(value: unknown, fieldName: string): ProjectStatus {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be one of: ${projectStatuses.join(", ")}.`
    );
  }

  const normalized = value.trim().replaceAll("-", "_").toUpperCase();

  if (!projectStatuses.includes(normalized as ProjectStatus)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${projectStatuses.join(", ")}.`
    );
  }

  return normalized as ProjectStatus;
}

function normalizeOptionalVisualPreset(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const preset = getCinematicPresetById(value);

  if (!preset) {
    throw new ValidationError(`${fieldName} must match a known cinematic preset id.`);
  }

  return preset.id;
}

export function parseSerializedResearchTags(input: string | null | undefined) {
  return parseSerializedTags(input ?? "[]");
}

export function normalizeResearchDossierStatusValue(
  value: unknown,
  fieldName = "status"
) {
  return normalizeEnumValue(researchDossierStatuses, value, fieldName);
}

export function normalizeResearchSourceTypeValue(
  value: unknown,
  fieldName = "sourceType"
) {
  return normalizeEnumValue(researchSourceTypes, value, fieldName);
}

export function normalizeResearchSourceStatusValue(
  value: unknown,
  fieldName = "status"
) {
  return normalizeEnumValue(researchSourceStatuses, value, fieldName);
}

export function normalizeResearchConfidenceValue(
  value: unknown,
  fieldName = "confidence"
) {
  return normalizeEnumValue(researchConfidenceLevels, value, fieldName);
}

export function normalizeResearchFactTypeValue(
  value: unknown,
  fieldName = "factType"
) {
  return normalizeEnumValue(researchFactTypes, value, fieldName);
}

export function normalizeResearchHookTypeValue(
  value: unknown,
  fieldName = "hookType"
) {
  return normalizeEnumValue(researchHookTypes, value, fieldName);
}

export function normalizeResearchAssetMediaTypeValue(
  value: unknown,
  fieldName = "mediaType"
) {
  return normalizeEnumValue(researchAssetMediaTypes, value, fieldName);
}

export function normalizeOptionalResearchOutlineRoleValue(
  value: unknown,
  fieldName = "sceneRole"
) {
  return normalizeOptionalEnumValue(researchOutlineRoles, value, fieldName);
}

export function validateCreateResearchDossierInput(
  payload: unknown
): CreateResearchDossierInput {
  const record = asRecord(payload);

  return {
    channelId: normalizeOptionalRawString(record.channelId, "channelId") ?? null,
    title: ensureRequiredString(record.title, "title"),
    topic: ensureRequiredString(record.topic, "topic"),
    niche: normalizeOptionalRawString(record.niche, "niche") ?? null,
    tone: normalizeOptionalRawString(record.tone, "tone") ?? null,
    targetDuration:
      normalizeOptionalPositiveInteger(record.targetDuration, "targetDuration") ?? null,
    status:
      "status" in record
        ? normalizeResearchDossierStatusValue(record.status)
        : "draft",
    summary: normalizeOptionalRawString(record.summary, "summary") ?? null,
    narrativeAngle:
      normalizeOptionalRawString(record.narrativeAngle, "narrativeAngle") ?? null,
    editorialNotes:
      normalizeOptionalRawString(record.editorialNotes, "editorialNotes") ?? null,
    safetyNotes:
      normalizeOptionalRawString(record.safetyNotes, "safetyNotes") ?? null
  };
}

export function validateUpdateResearchDossierInput(
  payload: unknown
): UpdateResearchDossierInput {
  const record = asRecord(payload);
  const update: UpdateResearchDossierInput = {};

  if ("channelId" in record) {
    update.channelId = normalizeOptionalRawString(record.channelId, "channelId") ?? null;
  }

  if ("title" in record) {
    update.title = ensureRequiredString(record.title, "title");
  }

  if ("topic" in record) {
    update.topic = ensureRequiredString(record.topic, "topic");
  }

  if ("niche" in record) {
    update.niche = normalizeOptionalRawString(record.niche, "niche") ?? null;
  }

  if ("tone" in record) {
    update.tone = normalizeOptionalRawString(record.tone, "tone") ?? null;
  }

  if ("targetDuration" in record) {
    update.targetDuration =
      normalizeOptionalPositiveInteger(record.targetDuration, "targetDuration") ?? null;
  }

  if ("status" in record) {
    update.status = normalizeResearchDossierStatusValue(record.status);
  }

  if ("summary" in record) {
    update.summary = normalizeOptionalRawString(record.summary, "summary") ?? null;
  }

  if ("narrativeAngle" in record) {
    update.narrativeAngle =
      normalizeOptionalRawString(record.narrativeAngle, "narrativeAngle") ?? null;
  }

  if ("editorialNotes" in record) {
    update.editorialNotes =
      normalizeOptionalRawString(record.editorialNotes, "editorialNotes") ?? null;
  }

  if ("safetyNotes" in record) {
    update.safetyNotes =
      normalizeOptionalRawString(record.safetyNotes, "safetyNotes") ?? null;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError(
      "At least one research dossier field must be provided for update."
    );
  }

  return update;
}

export function validateManualResearchSourceInput(
  payload: unknown
): ManualResearchSourceInput {
  const record = asRecord(payload);

  return {
    title: ensureRequiredString(record.title, "title"),
    url: normalizeOptionalRawString(record.url, "url") ?? null,
    provider: normalizeOptionalRawString(record.provider, "provider") ?? null,
    sourceType:
      "sourceType" in record
        ? normalizeResearchSourceTypeValue(record.sourceType)
        : "manual_note",
    author: normalizeOptionalRawString(record.author, "author") ?? null,
    publishedAt: normalizeOptionalRawString(record.publishedAt, "publishedAt") ?? null,
    citationText: normalizeOptionalRawString(record.citationText, "citationText") ?? null,
    excerpt: normalizeOptionalRawString(record.excerpt, "excerpt") ?? null,
    notes: normalizeOptionalRawString(record.notes, "notes") ?? null,
    reliabilityScore:
      normalizeOptionalScore(record.reliabilityScore, "reliabilityScore") ?? null
  };
}

export function validateResearchUrlFetchInput(
  payload: unknown
): ResearchUrlFetchInput {
  const record = asRecord(payload);

  return {
    url: ensureRequiredString(record.url, "url"),
    title: normalizeOptionalRawString(record.title, "title") ?? null,
    notes: normalizeOptionalRawString(record.notes, "notes") ?? null
  };
}

export function validateResearchConnectorSearchInput(
  payload: unknown
): ResearchConnectorSearchInput {
  const record = asRecord(payload);

  return {
    query: normalizeOptionalRawString(record.query, "query") ?? null,
    limit: normalizeOptionalPositiveInteger(record.limit, "limit") ?? 5
  };
}

export function validateCreateProductionFromResearchInput(
  payload: unknown
): CreateProductionFromResearchInput {
  const record = asRecord(payload);

  return {
    title: normalizeOptionalRawString(record.title, "title") ?? null,
    status:
      "status" in record
        ? normalizeProjectStatusValue(record.status, "status")
        : "SCENE_PLANNING",
    format: normalizeOptionalRawString(record.format, "format") ?? "9:16"
  };
}

export function validateCreateResearchSourceInput(
  input: ManualResearchSourceInput,
  dossierId: string
): CreateResearchSourceInput {
  return {
    dossierId,
    title: input.title,
    url: input.url,
    provider: input.provider ?? "manual",
    sourceType: input.sourceType,
    author: input.author,
    publishedAt: input.publishedAt,
    accessedAt: new Date().toISOString(),
    reliabilityScore: input.reliabilityScore,
    citationText: input.citationText,
    rawTextPath: null,
    excerpt: input.excerpt,
    notes: input.notes,
    status: "candidate",
    errorMessage: null
  };
}

export function normalizeResearchSourceUpdateInput(
  input: UpdateResearchSourceInput
): UpdateResearchSourceInput {
  return input;
}

export function buildResearchSafetyWarningList(
  summary: string | null,
  outlineNarrations: string[]
) {
  const warnings: string[] = [];
  const combined = `${summary ?? ""} ${outlineNarrations.join(" ")}`.toLowerCase();

  if (combined.includes("sangue") || combined.includes("mutila") || combined.includes("corpo")) {
    warnings.push(
      "O outline usa linguagem potencialmente grafica; revise o tom para manter distanciamento editorial."
    );
  }

  if (
    combined.includes("genio do crime") ||
    combined.includes("brilhante assassino") ||
    combined.includes("lenda criminosa")
  ) {
    warnings.push(
      "Ha sinais de possivel glorificacao do criminoso; reescreva com foco em impacto e responsabilidade."
    );
  }

  return warnings;
}

export function parseResearchOptionalArray(
  value: string | null | undefined
): string[] {
  return parseSerializedTags(value ?? "[]");
}

export function stringifyResearchArray(values: string[] | null | undefined) {
  return JSON.stringify(values ?? []);
}

export function validateInternalResearchAssetRequirementInput(
  input: Omit<CreateResearchAssetRequirementInput, "dossierId">
): Omit<CreateResearchAssetRequirementInput, "dossierId"> {
  return {
    ref: input.ref ?? null,
    sceneRole: input.sceneRole ?? null,
    description: ensureRequiredString(input.description, "description"),
    mediaType: normalizeResearchAssetMediaTypeValue(input.mediaType, "mediaType"),
    suggestedTags: normalizeOptionalTagList(input.suggestedTags, "suggestedTags") ?? [],
    emotion: normalizeOptionalEmotionTagValue(input.emotion, "emotion") ?? null,
    priority: normalizeOptionalPositiveInteger(input.priority, "priority") ?? null,
    fulfilledAssetId:
      normalizeOptionalRawString(input.fulfilledAssetId, "fulfilledAssetId") ?? null,
    visualSourceMode: input.visualSourceMode ?? null,
    characterProfileId:
      normalizeOptionalRawString(input.characterProfileId, "characterProfileId") ?? null,
    generatedAssetId:
      normalizeOptionalRawString(input.generatedAssetId, "generatedAssetId") ?? null,
    visualPrompt:
      normalizeOptionalRawString(input.visualPrompt, "visualPrompt") ?? null,
    generationStatus: input.generationStatus ?? null,
    generationProvider: input.generationProvider ?? null
  };
}

export function validateInternalResearchOutlineSceneInput(
  input: Omit<CreateResearchOutlineSceneInput, "dossierId">
): Omit<CreateResearchOutlineSceneInput, "dossierId"> {
  return {
    order: normalizeOptionalPositiveInteger(input.order, "order") ?? 1,
    role: normalizeEnumValue(researchOutlineRoles, input.role, "role"),
    title: ensureRequiredString(input.title, "title"),
    narrationDraft: ensureRequiredString(input.narrationDraft, "narrationDraft"),
    captionDraft: normalizeOptionalRawString(input.captionDraft, "captionDraft") ?? null,
    emotion: normalizeOptionalEmotionTagValue(input.emotion, "emotion") ?? null,
    visualPreset: normalizeOptionalVisualPreset(input.visualPreset, "visualPreset") ?? null,
    assetRequirementRef:
      normalizeOptionalRawString(input.assetRequirementRef, "assetRequirementRef") ?? null,
    estimatedDuration:
      normalizeOptionalNumber(input.estimatedDuration, "estimatedDuration") ?? null
  };
}

