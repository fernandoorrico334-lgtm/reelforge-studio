import { ValidationError } from "../../../shared/errors.js";
import type { ProjectStatus } from "../../projects/domain/project.js";
import {
  audioMasteringPresetIds,
  type AudioMasteringPresetId,
  type AudioQualityReport
} from "@reelforge/audio-engine/mastering";

export const renderJobStatuses = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled"
] as const;

export type RenderJobStatus = (typeof renderJobStatuses)[number];

export const renderJobSteps = [
  "reading_blueprint",
  "generating_subtitles",
  "rendering_scene",
  "concatenating_segments",
  "burning_subtitles",
  "generating_thumbnail",
  "probing_output",
  "completed"
] as const;

export type RenderJobStep = (typeof renderJobSteps)[number];

export const renderModes = ["v1", "cinematic_v2"] as const;

export type RenderMode = (typeof renderModes)[number];

export const renderQualities = ["draft", "standard", "high"] as const;

export type RenderQuality = (typeof renderQualities)[number];

export const defaultRenderMode: RenderMode = "v1";
export const defaultRenderQuality: RenderQuality = "standard";

export interface RenderJobProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  channelId: string;
  format: string;
}

export interface RenderJobMediaLinks {
  mediaUrl: string | null;
  logUrl: string | null;
  thumbnailUrl: string | null;
}

export interface StudioRenderJob extends RenderJobMediaLinks {
  id: string;
  videoProjectId: string;
  status: RenderJobStatus;
  renderMode: RenderMode;
  renderQuality: RenderQuality;
  outputPath: string | null;
  blueprintPath: string | null;
  srtPath: string | null;
  assPath: string | null;
  logPath: string | null;
  errorMessage: string | null;
  progress: number | null;
  currentStep: RenderJobStep | null;
  currentSceneIndex: number | null;
  totalScenes: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  outputDuration: number | null;
  outputCodec: string | null;
  hasAudio: boolean | null;
  audioCodec: string | null;
  audioChannels: number | null;
  audioSampleRate: number | null;
  audioMasteringPresetId: AudioMasteringPresetId | null;
  metadata: RenderJobMetadata | null;
  outputFileSize: number | null;
  thumbnailPath: string | null;
  cancelledAt: string | null;
  retriedFromJobId: string | null;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  videoProject: RenderJobProjectSummary;
}

export interface RenderJobMetadata {
  audioMasteringPresetId: AudioMasteringPresetId;
  audioQualityReport?: AudioQualityReport | null;
  hasEditorialMicroclips?: boolean;
  microclipCount?: number;
  totalMicroclipDurationSeconds?: number;
}

export interface CreateRenderJobInput {
  videoProjectId: string;
  renderMode?: RenderMode;
  renderQuality?: RenderQuality;
  audioMasteringPresetId?: AudioMasteringPresetId | null;
  metadata?: RenderJobMetadata | null;
  attempt?: number;
  retriedFromJobId?: string | null;
}

export interface UpdateRenderJobInput {
  status?: RenderJobStatus;
  renderMode?: RenderMode;
  renderQuality?: RenderQuality;
  outputPath?: string | null;
  blueprintPath?: string | null;
  srtPath?: string | null;
  assPath?: string | null;
  logPath?: string | null;
  errorMessage?: string | null;
  progress?: number | null;
  currentStep?: RenderJobStep | null;
  currentSceneIndex?: number | null;
  totalScenes?: number | null;
  outputWidth?: number | null;
  outputHeight?: number | null;
  outputDuration?: number | null;
  outputCodec?: string | null;
  hasAudio?: boolean | null;
  audioCodec?: string | null;
  audioChannels?: number | null;
  audioSampleRate?: number | null;
  audioMasteringPresetId?: AudioMasteringPresetId | null;
  metadata?: RenderJobMetadata | null;
  outputFileSize?: number | null;
  thumbnailPath?: string | null;
  cancelledAt?: string | null;
  retriedFromJobId?: string | null;
  attempt?: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface CreateRenderJobRequestInput {
  renderMode?: RenderMode;
  renderQuality?: RenderQuality;
  audioMasteringPresetId?: AudioMasteringPresetId;
}

const allowedStatusTransitions: Record<RenderJobStatus, RenderJobStatus[]> = {
  queued: ["processing", "cancelled"],
  processing: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};

export function buildRenderMediaLinks(
  renderJobId: string,
  options: {
    hasOutput: boolean;
    hasLog: boolean;
    hasThumbnail: boolean;
  }
): RenderJobMediaLinks {
  const encodedId = encodeURIComponent(renderJobId);

  return {
    mediaUrl: options.hasOutput ? `/media/renders/${encodedId}` : null,
    logUrl: options.hasLog ? `/media/renders/${encodedId}/log` : null,
    thumbnailUrl: options.hasThumbnail
      ? `/media/renders/${encodedId}/thumbnail`
      : null
  };
}

export function normalizeRenderJobStatus(
  value: unknown,
  fieldName = "status"
): RenderJobStatus {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be one of: ${renderJobStatuses.join(", ")}.`
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!renderJobStatuses.includes(normalized as RenderJobStatus)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${renderJobStatuses.join(", ")}.`
    );
  }

  return normalized as RenderJobStatus;
}

export function normalizeOptionalRenderJobStep(
  value: unknown,
  fieldName = "currentStep"
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be one of: ${renderJobSteps.join(", ")}.`
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!renderJobSteps.includes(normalized as RenderJobStep)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${renderJobSteps.join(", ")}.`
    );
  }

  return normalized as RenderJobStep;
}

export function normalizeRenderMode(
  value: unknown,
  fieldName = "renderMode"
): RenderMode {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be one of: ${renderModes.join(", ")}.`
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!renderModes.includes(normalized as RenderMode)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${renderModes.join(", ")}.`
    );
  }

  return normalized as RenderMode;
}

export function normalizeOptionalRenderMode(
  value: unknown,
  fieldName = "renderMode"
) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return normalizeRenderMode(value, fieldName);
}

export function normalizeRenderQuality(
  value: unknown,
  fieldName = "renderQuality"
): RenderQuality {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} must be one of: ${renderQualities.join(", ")}.`
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!renderQualities.includes(normalized as RenderQuality)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${renderQualities.join(", ")}.`
    );
  }

  return normalized as RenderQuality;
}

export function normalizeOptionalRenderQuality(
  value: unknown,
  fieldName = "renderQuality"
) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return normalizeRenderQuality(value, fieldName);
}

export function normalizeOptionalProgress(
  value: unknown,
  fieldName = "progress"
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

export function normalizeOptionalIndex(
  value: unknown,
  fieldName: string
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${fieldName} must be a non-negative integer.`);
  }

  return value;
}

export function normalizeOptionalPositiveNumber(
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

  return value;
}

export function normalizeOptionalString(
  value: unknown,
  fieldName: string
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string.`);
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeOptionalAudioMasteringPresetId(
  value: unknown,
  fieldName = "audioMasteringPresetId"
) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ValidationError(
      `${fieldName} must be one of: ${audioMasteringPresetIds.join(", ")}.`
    );
  }

  const normalized = value
    .trim()
    .replaceAll("-", "_")
    .replaceAll(" ", "_")
    .toLowerCase();

  if (!audioMasteringPresetIds.includes(normalized as AudioMasteringPresetId)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${audioMasteringPresetIds.join(", ")}.`
    );
  }

  return normalized as AudioMasteringPresetId;
}

export function normalizeOptionalAttempt(
  value: unknown,
  fieldName = "attempt"
) {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new ValidationError(`${fieldName} must be an integer greater than 0.`);
  }

  return value;
}

export function validateCreateRenderJobRequestInput(
  value: unknown
): CreateRenderJobRequestInput {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Render job body must be a JSON object.");
  }

  const payload = value as Record<string, unknown>;
  const renderMode = normalizeOptionalRenderMode(payload.renderMode);
  const renderQuality = normalizeOptionalRenderQuality(payload.renderQuality);
  const audioMasteringPresetId = normalizeOptionalAudioMasteringPresetId(
    payload.audioMasteringPresetId
  );

  return {
    ...(renderMode ? { renderMode } : {}),
    ...(renderQuality ? { renderQuality } : {}),
    ...(audioMasteringPresetId ? { audioMasteringPresetId } : {})
  };
}

export function canTransitionRenderJobStatus(
  currentStatus: RenderJobStatus,
  nextStatus: RenderJobStatus
) {
  if (currentStatus === nextStatus) {
    return true;
  }

  return allowedStatusTransitions[currentStatus].includes(nextStatus);
}

export function assertRenderJobStatusTransition(
  currentStatus: RenderJobStatus,
  nextStatus: RenderJobStatus
) {
  if (!canTransitionRenderJobStatus(currentStatus, nextStatus)) {
    throw new ValidationError(
      `Render job status cannot transition from '${currentStatus}' to '${nextStatus}'.`
    );
  }
}

export function canCancelRenderJob(status: RenderJobStatus) {
  return status === "queued" || status === "processing";
}

export function canRetryRenderJob(status: RenderJobStatus) {
  return status === "failed" || status === "cancelled";
}

export function canDeleteRenderJob(status: RenderJobStatus) {
  return status !== "processing";
}

