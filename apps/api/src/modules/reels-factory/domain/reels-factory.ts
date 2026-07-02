import {
  getReelsFactoryTemplateById,
  type ReelsFactoryNextAction,
  type ReelsFactoryPreview,
  type ReelsFactorySceneDraft,
  type ReelsFactoryTemplate,
  type ReelsFactoryTemplateId
} from "@reelforge/story-engine/reels-factory";
import { ValidationError } from "../../../shared/errors.js";
import type { StudioProject } from "../../projects/domain/project.js";

export interface ReelsFactoryPreviewInput {
  channelId?: string | null;
  topic: string;
  subject: string;
  angle: string;
  templateId: ReelsFactoryTemplateId;
  tone: string;
  durationSeconds: number;
  language: string;
  includeMicroclip: boolean;
}

export interface ReelsFactoryBatchItemInput {
  topic: string;
  subject: string;
  angle: string;
}

export interface ReelsFactoryBatchInput {
  channelId?: string | null;
  items: ReelsFactoryBatchItemInput[];
  templateId: ReelsFactoryTemplateId;
  tone: string;
  durationSeconds: number;
  language: string;
  includeMicroclip: boolean;
}

export interface ReelsFactoryCreateProjectResponse {
  projectId: string;
  title: string;
  scenesCreated: number;
  project: StudioProject;
  preview: ReelsFactoryPreview;
  recommendedNextActions: ReelsFactoryNextAction[];
}

export interface ReelsFactoryBatchProjectResult {
  projectId: string;
  title: string;
  scenesCreated: number;
  topic: string;
}

export interface ReelsFactoryBatchFailure {
  topic: string;
  error: string;
}

export interface ReelsFactoryBatchResponse {
  projects: ReelsFactoryBatchProjectResult[];
  failures: ReelsFactoryBatchFailure[];
  totalCreated: number;
}

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

function readRequiredBoolean(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (typeof value !== "boolean") {
    throw new ValidationError(`${field} must be a boolean.`);
  }

  return value;
}

function readRequiredDuration(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (typeof value !== "number" || Number.isNaN(value) || value < 25 || value > 60) {
    throw new ValidationError(`${field} must be a number between 25 and 60.`);
  }

  return Math.round(value);
}

function readTemplateId(record: Record<string, unknown>, field: string) {
  const value = readRequiredString(record, field);
  const template = getReelsFactoryTemplateById(value);

  if (!template) {
    throw new ValidationError(`${field} must match a known Reels Factory template id.`);
  }

  return template.id;
}

function readBatchItems(record: Record<string, unknown>) {
  const items = record.items;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("items must be a non-empty array.");
  }

  return items.map((item, index) => {
    const entry = asRecord(item);
    const topic = readRequiredString(entry, "topic");
    const subject = readOptionalString(entry, "subject") ?? topic;
    const angle = readOptionalString(entry, "angle") ?? "o ponto que mais pesa";

    if (!subject.trim()) {
      throw new ValidationError(`items[${index}].subject must not be empty when provided.`);
    }

    return {
      topic,
      subject,
      angle
    };
  });
}

export function validateReelsFactoryPreviewInput(
  payload: unknown
): ReelsFactoryPreviewInput {
  const record = asRecord(payload);

  return {
    channelId: readOptionalString(record, "channelId") ?? null,
    topic: readRequiredString(record, "topic"),
    subject: readRequiredString(record, "subject"),
    angle: readRequiredString(record, "angle"),
    templateId: readTemplateId(record, "templateId"),
    tone: readRequiredString(record, "tone"),
    durationSeconds: readRequiredDuration(record, "durationSeconds"),
    language: readRequiredString(record, "language"),
    includeMicroclip: readRequiredBoolean(record, "includeMicroclip")
  };
}

export function validateReelsFactoryBatchInput(
  payload: unknown
): ReelsFactoryBatchInput {
  const record = asRecord(payload);

  return {
    channelId: readOptionalString(record, "channelId") ?? null,
    items: readBatchItems(record),
    templateId: readTemplateId(record, "templateId"),
    tone: readRequiredString(record, "tone"),
    durationSeconds: readRequiredDuration(record, "durationSeconds"),
    language: readRequiredString(record, "language"),
    includeMicroclip: readRequiredBoolean(record, "includeMicroclip")
  };
}

export function buildFactoryChecklistSummary(preview: ReelsFactoryPreview) {
  return {
    scenesCreated: preview.scenes.length,
    durationSeconds: preview.durationSeconds,
    microclipSuggested: preview.includeMicroclip,
    sceneTitles: preview.scenes.map((scene: ReelsFactorySceneDraft) => scene.title)
  };
}

export function assertFactoryTemplate(templateId: string): ReelsFactoryTemplate {
  const template = getReelsFactoryTemplateById(templateId);

  if (!template) {
    throw new ValidationError(`Unknown Reels Factory template '${templateId}'.`);
  }

  return template;
}
