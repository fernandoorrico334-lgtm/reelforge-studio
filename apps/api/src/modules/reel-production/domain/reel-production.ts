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

export const oneClickRemixModes = ["legacy", "new", "remix"] as const;

export type OneClickRemixMode = (typeof oneClickRemixModes)[number];

export interface OneClickRunInput {
  mode: ReelProductionRunMode;
  runWorkerOnce: boolean;
  providerStrategy: OneClickProviderStrategy;
  defaults: OneClickDefaults;
  options: OneClickOptions;
  remixMode: OneClickRemixMode;
  inputVideoPath: string | null;
  sourceUrl: string | null;
  targetStyle: string | null;
  intensity: "medium" | "extreme";
  addNarration: boolean;
  durationTarget: number | null;
  newMusicPreset: string | null;
  captionText: string | null;
  beastCandidate: unknown;
  planApproved: boolean;
  rightsConfirmed: boolean;
  approvedRemixAssetIds: string[];
  beastProductionPlan: Record<string, unknown> | null;
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

export interface OneClickBeastProductionSummary {
  remixMode: "new" | "remix";
  planType: "premium_reel" | "video_remix";
  visualVariationCount: number;
  musicPresetId: string;
  masteringPresetId: string;
  voicePackId: string | null;
  requiresManualApproval: true;
  canRenderAutomatically: false;
  canRenderAfterManualApproval: boolean;
}

export interface OneClickRunResponse {
  runId: string;
  status: ReelProductionRunStatus;
  steps: ReelProductionStep[];
  projectId: string;
  renderJobId: string | null;
  outputPath: string | null;
  checklist: ReelProductionChecklist;
  beastPlan: OneClickBeastProductionSummary | null;
  beastProductionPlan: Record<string, unknown> | null;
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

function readStringArray(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array of strings.`);
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function readOptionalPositiveInteger(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function normalizeRemixMode(value: unknown): OneClickRemixMode {
  const mode = readOptionalString(value, "remixMode") ?? "legacy";

  if (!oneClickRemixModes.includes(mode as OneClickRemixMode)) {
    throw new ValidationError(
      `remixMode must be one of: ${oneClickRemixModes.join(", ")}.`
    );
  }

  return mode as OneClickRemixMode;
}

function normalizeIntensity(value: unknown): "medium" | "extreme" {
  const intensity = readOptionalString(value, "intensity") ?? "extreme";

  if (intensity !== "medium" && intensity !== "extreme") {
    throw new ValidationError("intensity must be 'medium' or 'extreme'.");
  }

  return intensity;
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
  const remixMode = normalizeRemixMode(record.remixMode);
  const beastMode = remixMode === "new" || remixMode === "remix";
  const mode = normalizeMode(record.mode);
  const planApproved =
    readOptionalBoolean(record.planApproved, "planApproved") ?? false;
  const rightsConfirmed =
    readOptionalBoolean(record.rightsConfirmed, "rightsConfirmed") ?? false;
  const beastRenderAuthorized =
    beastMode && mode === "render" && planApproved && rightsConfirmed;
  const requestedCreateRenderJob =
    readOptionalBoolean(options.createRenderJob, "options.createRenderJob") ?? true;
  const requestedRunRender =
    readOptionalBoolean(options.runRender, "options.runRender") ??
    readOptionalBoolean(record.runWorkerOnce, "runWorkerOnce") ??
    (beastRenderAuthorized ? true : false);

  return {
    mode,
    runWorkerOnce: beastRenderAuthorized ? requestedRunRender : beastMode ? false : runWorkerOnce,
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
      createRenderJob: beastRenderAuthorized
        ? requestedCreateRenderJob
        : beastMode
          ? false
          : requestedCreateRenderJob,
      runRender: beastRenderAuthorized
        ? requestedRunRender
        : beastMode
          ? false
          : requestedRunRender,
      runWorkerOnce: beastRenderAuthorized ? requestedRunRender : beastMode ? false : runWorkerOnce
    },
    remixMode,
    inputVideoPath: readOptionalString(record.inputVideoPath, "inputVideoPath"),
    sourceUrl: readOptionalString(record.sourceUrl, "sourceUrl"),
    targetStyle: readOptionalString(record.targetStyle, "targetStyle"),
    intensity: normalizeIntensity(record.intensity),
    addNarration:
      readOptionalBoolean(record.addNarration, "addNarration") ?? false,
    durationTarget: readOptionalPositiveInteger(record.durationTarget, "durationTarget"),
    newMusicPreset: readOptionalString(record.newMusicPreset, "newMusicPreset"),
    captionText: readOptionalString(record.captionText, "captionText"),
    beastCandidate: record.beastCandidate ?? record.candidate ?? null,
    planApproved,
    rightsConfirmed,
    approvedRemixAssetIds: readStringArray(
      record.approvedRemixAssetIds,
      "approvedRemixAssetIds"
    ),
    beastProductionPlan:
      record.beastProductionPlan &&
      typeof record.beastProductionPlan === "object" &&
      !Array.isArray(record.beastProductionPlan)
        ? (record.beastProductionPlan as Record<string, unknown>)
        : null
  };
}
