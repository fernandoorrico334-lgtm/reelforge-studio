import { ValidationError } from "../../../shared/errors.js";

export const reelProductionRunStatuses = [
  "draft",
  "running",
  "completed",
  "failed",
  "partial",
  "cancelled"
] as const;

export type ReelProductionRunStatus =
  (typeof reelProductionRunStatuses)[number];

export const reelProductionRunModes = [
  "dry_run",
  "prepare_only",
  "render"
] as const;

export type ReelProductionRunMode = (typeof reelProductionRunModes)[number];

export const reelProductionStepStatuses = [
  "pending",
  "running",
  "completed",
  "skipped",
  "failed"
] as const;

export type ReelProductionStepStatus =
  (typeof reelProductionStepStatuses)[number];

export interface ReelProductionStep {
  id: string;
  label: string;
  status: ReelProductionStepStatus;
  message: string;
  entityIds: Record<string, string | string[] | null>;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ReelProductionRun {
  id: string;
  videoProjectId: string;
  status: ReelProductionRunStatus;
  mode: ReelProductionRunMode;
  steps: ReelProductionStep[];
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  renderJobId: string | null;
  outputPath: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReelProductionRunInput {
  videoProjectId: string;
  status: ReelProductionRunStatus;
  mode: ReelProductionRunMode;
  steps: ReelProductionStep[];
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  renderJobId: string | null;
  outputPath: string | null;
  metadata: Record<string, unknown> | null;
}

export type UpdateReelProductionRunInput =
  Partial<Omit<CreateReelProductionRunInput, "videoProjectId" | "mode">>;

export interface OneClickProviderStrategy {
  visualProvider?: string | null;
  fallbackVisualProvider?: string | null;
  narrationProvider?: string | null;
}

export interface OneClickDefaults {
  voicePackId?: string | null;
  musicPresetId?: string | null;
  audioMasteringPresetId?: string | null;
  qualityPresetId?: string | null;
  workflowPackId?: string | null;
}

export interface OneClickOptions {
  generateMissingNarration?: boolean;
  generateMissingVisuals?: boolean;
  selectMusic?: boolean;
  buildBeatSyncPlan?: boolean;
  useEditorialMicroclips?: boolean;
  createRenderJob?: boolean;
  runRender?: boolean;
  runWorkerOnce?: boolean;
}

export interface OneClickRunInput {
  mode: ReelProductionRunMode;
  runWorkerOnce: boolean;
  providerStrategy: OneClickProviderStrategy;
  defaults: OneClickDefaults;
  options: OneClickOptions;
}

export interface ReelProductionSceneChecklist {
  sceneId: string;
  order: number;
  title: string;
  narrationReady: boolean;
  visualReady: boolean;
  microclipCount: number;
  effectiveAssetId: string | null;
  effectiveNarrationAssetId: string | null;
  warnings: string[];
}

export interface ReelProductionChecklist {
  projectId: string;
  scenesTotal: number;
  scenesWithNarration: number;
  scenesWithVisual: number;
  scenesWithMusic: number;
  scenesWithMicroclips: number;
  pendingMediaCandidates: number;
  unconfirmedCandidates: number;
  missingNarration: number;
  missingVisuals: number;
  missingMusic: number;
  hasMusic: boolean;
  hasBeatSyncPlan: boolean;
  hasEditingReferencePreset: boolean;
  hasAudioMasteringPreset: boolean;
  renderReady: boolean;
  missingItems: string[];
  scenes: ReelProductionSceneChecklist[];
  warnings: string[];
  nextActions: string[];
}

export interface OneClickRunResponse {
  runId: string;
  status: ReelProductionRunStatus;
  steps: ReelProductionStep[];
  projectId: string;
  renderJobId: string | null;
  outputPath: string | null;
  checklist: ReelProductionChecklist;
  warnings: string[];
  nextActions: string[];
}

function readOptionalRecord(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function readOptionalString(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  return value.trim() || null;
}

function readOptionalBoolean(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new ValidationError(`${fieldName} must be a boolean.`);
  }

  return value;
}

function normalizeMode(value: unknown): ReelProductionRunMode {
  const mode = readOptionalString(value, "mode") ?? "prepare_only";

  if (!reelProductionRunModes.includes(mode as ReelProductionRunMode)) {
    throw new ValidationError(
      `mode must be one of: ${reelProductionRunModes.join(", ")}.`
    );
  }

  return mode as ReelProductionRunMode;
}

export function validateOneClickRunInput(payload: unknown): OneClickRunInput {
  const record = readOptionalRecord(payload, "body");
  const providerStrategy = readOptionalRecord(
    record.providerStrategy,
    "providerStrategy"
  );
  const defaults = readOptionalRecord(record.defaults, "defaults");
  const options = readOptionalRecord(record.options, "options");
  const runWorkerOnce =
    readOptionalBoolean(record.runWorkerOnce, "runWorkerOnce") ??
    readOptionalBoolean(options.runWorkerOnce, "options.runWorkerOnce") ??
    false;

  return {
    mode: normalizeMode(record.mode),
    runWorkerOnce,
    providerStrategy: {
      visualProvider: readOptionalString(
        providerStrategy.visualProvider,
        "providerStrategy.visualProvider"
      ),
      fallbackVisualProvider: readOptionalString(
        providerStrategy.fallbackVisualProvider,
        "providerStrategy.fallbackVisualProvider"
      ),
      narrationProvider: readOptionalString(
        providerStrategy.narrationProvider,
        "providerStrategy.narrationProvider"
      )
    },
    defaults: {
      voicePackId: readOptionalString(defaults.voicePackId, "defaults.voicePackId"),
      musicPresetId: readOptionalString(defaults.musicPresetId, "defaults.musicPresetId"),
      audioMasteringPresetId: readOptionalString(
        defaults.audioMasteringPresetId,
        "defaults.audioMasteringPresetId"
      ),
      qualityPresetId: readOptionalString(
        defaults.qualityPresetId,
        "defaults.qualityPresetId"
      ),
      workflowPackId: readOptionalString(
        defaults.workflowPackId,
        "defaults.workflowPackId"
      )
    },
    options: {
      generateMissingNarration:
        readOptionalBoolean(
          options.generateMissingNarration,
          "options.generateMissingNarration"
        ) ?? true,
      generateMissingVisuals:
        readOptionalBoolean(
          options.generateMissingVisuals,
          "options.generateMissingVisuals"
        ) ?? true,
      selectMusic:
        readOptionalBoolean(options.selectMusic, "options.selectMusic") ?? true,
      buildBeatSyncPlan:
        readOptionalBoolean(
          options.buildBeatSyncPlan,
          "options.buildBeatSyncPlan"
        ) ?? true,
      useEditorialMicroclips:
        readOptionalBoolean(
          options.useEditorialMicroclips,
          "options.useEditorialMicroclips"
        ) ?? true,
      createRenderJob:
        readOptionalBoolean(
          options.createRenderJob,
          "options.createRenderJob"
        ) ?? true,
      runRender: readOptionalBoolean(options.runRender, "options.runRender") ?? false,
      runWorkerOnce
    }
  };
}
