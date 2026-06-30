import { ValidationError } from "../../../shared/errors.js";
import type { StudioAsset } from "../../assets/domain/asset.js";
import {
  normalizeOptionalNumber,
  normalizeOptionalString,
  parseSerializedTags,
  parseTagInput
} from "../../assets/domain/asset.js";

export const characterReferenceTypes = [
  "face",
  "full_body",
  "pose",
  "outfit",
  "style",
  "expression",
  "other"
] as const;

export type CharacterReferenceType = (typeof characterReferenceTypes)[number];

export interface CharacterReference {
  id: string;
  characterProfileId: string;
  assetId: string | null;
  asset: StudioAsset | null;
  sourcePath: string | null;
  title: string | null;
  notes: string | null;
  referenceType: CharacterReferenceType;
  strength: number;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  slug: string;
  franchise: string | null;
  category: string | null;
  description: string | null;
  basePrompt: string | null;
  negativePrompt: string | null;
  styleNotes: string | null;
  defaultVisualStyle: string | null;
  referenceStrength: number;
  preferredProvider: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  references: CharacterReference[];
}

export interface CreateCharacterProfileInput {
  name: string;
  slug: string;
  franchise: string | null;
  category: string | null;
  description: string | null;
  basePrompt: string | null;
  negativePrompt: string | null;
  styleNotes: string | null;
  defaultVisualStyle: string | null;
  referenceStrength: number | null;
  preferredProvider: string | null;
  tags: string[];
}

export type UpdateCharacterProfileInput = Partial<CreateCharacterProfileInput>;

export interface CreateCharacterReferenceInput {
  assetId: string | null;
  sourcePath: string | null;
  title: string | null;
  notes: string | null;
  referenceType: CharacterReferenceType;
  strength: number | null;
}

export type UpdateCharacterReferenceInput = Partial<CreateCharacterReferenceInput>;

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

function normalizeSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRequiredSlug(value: unknown, fieldName: string) {
  const slug = normalizeSlug(ensureRequiredString(value, fieldName));

  if (!slug) {
    throw new ValidationError(`${fieldName} must contain letters or numbers.`);
  }

  return slug;
}

function normalizeOptionalStrength(value: unknown, fieldName: string) {
  const parsed = normalizeOptionalNumber(value, fieldName);

  if (parsed === undefined) {
    return undefined;
  }

  if (parsed === null) {
    return null;
  }

  if (parsed < 0 || parsed > 1) {
    throw new ValidationError(`${fieldName} must be between 0 and 1.`);
  }

  return Math.round(parsed * 1000) / 1000;
}

function normalizeReferenceType(
  value: unknown,
  fieldName = "referenceType"
): CharacterReferenceType {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be one of: ${characterReferenceTypes.join(", ")}.`
    );
  }

  const normalized = value.trim().toLowerCase().replaceAll("-", "_");

  if (!characterReferenceTypes.includes(normalized as CharacterReferenceType)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${characterReferenceTypes.join(", ")}.`
    );
  }

  return normalized as CharacterReferenceType;
}

function normalizeOptionalReferenceType(
  value: unknown,
  fieldName = "referenceType"
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return normalizeReferenceType(value, fieldName);
}

export function buildCharacterProfileBasePrompt(
  profile: Pick<
    CharacterProfile,
    | "name"
    | "description"
    | "styleNotes"
    | "defaultVisualStyle"
    | "tags"
    | "negativePrompt"
  >,
  references: Array<Pick<CharacterReference, "title" | "notes" | "referenceType">>
) {
  const fragments = [
    profile.description,
    profile.styleNotes,
    profile.defaultVisualStyle,
    profile.tags.length > 0 ? `tags: ${profile.tags.join(", ")}` : null,
    references.length > 0
      ? `reference cues: ${references
          .map((reference) =>
            [reference.referenceType, reference.title, reference.notes]
              .filter(Boolean)
              .join(" - ")
          )
          .slice(0, 4)
          .join(" | ")}`
      : null
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean);

  const basePrompt = fragments.length
    ? [
        `Original character visual profile inspired by user-provided references for ${profile.name}.`,
        ...fragments
      ].join(" ")
    : `Original character visual profile for ${profile.name}.`;

  const negativePrompt =
    profile.negativePrompt?.trim() ||
    "brand logos, franchise names, watermark, low detail, distorted anatomy";

  return {
    basePrompt,
    negativePrompt
  };
}

export function parseSerializedCharacterTags(input: string | null | undefined) {
  return parseSerializedTags(input ?? "[]");
}

export function validateCreateCharacterProfileInput(
  payload: unknown
): CreateCharacterProfileInput {
  const record = asRecord(payload);

  return {
    name: ensureRequiredString(record.name, "name"),
    slug:
      "slug" in record
        ? normalizeRequiredSlug(record.slug, "slug")
        : normalizeRequiredSlug(record.name, "slug"),
    franchise: normalizeOptionalString(record.franchise, "franchise") ?? null,
    category: normalizeOptionalString(record.category, "category") ?? null,
    description: normalizeOptionalString(record.description, "description") ?? null,
    basePrompt: normalizeOptionalString(record.basePrompt, "basePrompt") ?? null,
    negativePrompt:
      normalizeOptionalString(record.negativePrompt, "negativePrompt") ?? null,
    styleNotes: normalizeOptionalString(record.styleNotes, "styleNotes") ?? null,
    defaultVisualStyle:
      normalizeOptionalString(record.defaultVisualStyle, "defaultVisualStyle") ?? null,
    referenceStrength:
      normalizeOptionalStrength(record.referenceStrength, "referenceStrength") ?? 0.75,
    preferredProvider:
      normalizeOptionalString(record.preferredProvider, "preferredProvider") ?? "mock-svg",
    tags: parseTagInput(record.tags)
  };
}

export function validateUpdateCharacterProfileInput(
  payload: unknown
): UpdateCharacterProfileInput {
  const record = asRecord(payload);
  const update: UpdateCharacterProfileInput = {};

  if ("name" in record) {
    update.name = ensureRequiredString(record.name, "name");
  }

  if ("slug" in record) {
    update.slug = normalizeRequiredSlug(record.slug, "slug");
  }

  if ("franchise" in record) {
    update.franchise = normalizeOptionalString(record.franchise, "franchise") ?? null;
  }

  if ("category" in record) {
    update.category = normalizeOptionalString(record.category, "category") ?? null;
  }

  if ("description" in record) {
    update.description =
      normalizeOptionalString(record.description, "description") ?? null;
  }

  if ("basePrompt" in record) {
    update.basePrompt =
      normalizeOptionalString(record.basePrompt, "basePrompt") ?? null;
  }

  if ("negativePrompt" in record) {
    update.negativePrompt =
      normalizeOptionalString(record.negativePrompt, "negativePrompt") ?? null;
  }

  if ("styleNotes" in record) {
    update.styleNotes =
      normalizeOptionalString(record.styleNotes, "styleNotes") ?? null;
  }

  if ("defaultVisualStyle" in record) {
    update.defaultVisualStyle =
      normalizeOptionalString(record.defaultVisualStyle, "defaultVisualStyle") ?? null;
  }

  if ("referenceStrength" in record) {
    update.referenceStrength =
      normalizeOptionalStrength(record.referenceStrength, "referenceStrength") ?? null;
  }

  if ("preferredProvider" in record) {
    update.preferredProvider =
      normalizeOptionalString(record.preferredProvider, "preferredProvider") ?? null;
  }

  if ("tags" in record) {
    update.tags = parseTagInput(record.tags);
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError(
      "At least one character profile field must be provided for update."
    );
  }

  return update;
}

export function validateCreateCharacterReferenceInput(
  payload: unknown
): CreateCharacterReferenceInput {
  const record = asRecord(payload);

  return {
    assetId: normalizeOptionalString(record.assetId, "assetId") ?? null,
    sourcePath: normalizeOptionalString(record.sourcePath, "sourcePath") ?? null,
    title: normalizeOptionalString(record.title, "title") ?? null,
    notes: normalizeOptionalString(record.notes, "notes") ?? null,
    referenceType:
      "referenceType" in record
        ? normalizeReferenceType(record.referenceType)
        : "other",
    strength: normalizeOptionalStrength(record.strength, "strength") ?? 0.75
  };
}

export function validateUpdateCharacterReferenceInput(
  payload: unknown
): UpdateCharacterReferenceInput {
  const record = asRecord(payload);
  const update: UpdateCharacterReferenceInput = {};

  if ("assetId" in record) {
    update.assetId = normalizeOptionalString(record.assetId, "assetId") ?? null;
  }

  if ("sourcePath" in record) {
    update.sourcePath =
      normalizeOptionalString(record.sourcePath, "sourcePath") ?? null;
  }

  if ("title" in record) {
    update.title = normalizeOptionalString(record.title, "title") ?? null;
  }

  if ("notes" in record) {
    update.notes = normalizeOptionalString(record.notes, "notes") ?? null;
  }

  if ("referenceType" in record) {
    const referenceType = normalizeOptionalReferenceType(
      record.referenceType,
      "referenceType"
    );

    if (referenceType) {
      update.referenceType = referenceType;
    }
  }

  if ("strength" in record) {
    update.strength =
      normalizeOptionalStrength(record.strength, "strength") ?? null;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError(
      "At least one character reference field must be provided for update."
    );
  }

  return update;
}
