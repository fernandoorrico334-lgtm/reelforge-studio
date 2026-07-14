import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { BeatVisualRequirement } from "./comics-beat-visual-requirements.js";
import {
  assignPanelsToBeatsGlobally,
  BEAT_ASSIGNMENT_VALIDATION_CONTACT_SHEET_FILENAME,
  BEAT_ASSIGNMENT_VALIDATION_REPORT_FILENAME,
  computeAssignmentReuseStats,
  GLOBAL_PANEL_SCORE_THRESHOLDS,
  type GlobalBeatSpec,
  type GlobalPanelAssignmentResult
} from "./comics-global-panel-assignment.js";
import {
  findLocalPanelById,
  isOversizedStoryMixedCrop,
  loadLocalComicPanelIndex,
  type ComicPageType,
  type LocalComicPanelEvidence,
  type LocalComicPanelIndex
} from "./comics-local-panel-index.js";
import { buildComicPanelSequences } from "./comics-panel-sequences.js";
import {
  buildVerifiedCandidatePoolsFromRetrieval,
  flattenPanelIndex,
  runPanelRetrievalForBeats
} from "./comics-panel-retrieval.js";

export type PanelCropDiagnostic = {
  panelId: string;
  pageType: ComicPageType;
  cropAreaRatio: number;
  estimatedPanelCount: number;
  estimatedGutterCount: number;
  bounds: LocalComicPanelEvidence["cropBounds"];
  isWholePageFallback: boolean;
  isActualPanelCrop: boolean;
  valid: boolean;
  rejectReason: string | null;
  wholePageFallbackReason: string | null;
  classification: "cover" | "splash" | "story" | "mixed" | "other";
};

export type BeatAssignmentValidationEntry = {
  beatRole: string;
  beatId: string;
  panelId: string | null;
  pageNumber: number | null;
  pageType: ComicPageType | null;
  cropAreaRatio: number | null;
  beatSpecificFitScore: number | null;
  finalScore: number | null;
  reuseCount: number;
  blockReason: string | null;
  panelImagePath: string | null;
};

export type BeatAssignmentValidationResult = {
  generatedAt: string;
  assetDirectory: string;
  indexPath: string;
  contactSheetPath: string | null;
  reportPath: string;
  panelDiagnostics: PanelCropDiagnostic[];
  page4Panel1Diagnostic: PanelCropDiagnostic | null;
  assignments: BeatAssignmentValidationEntry[];
  uniquePanelCount: number;
  maxPanelReuseCount: number;
  continuityScore: number;
  averageBeatSpecificFitScore: number;
  scoresByBeat: Record<string, number>;
  canRender: boolean;
  canPublish: boolean;
  blockReason: string | null;
  globalAssignment: GlobalPanelAssignmentResult;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function escapeDrawtext(value: string): string {
  return value.replace(/[:\\']/g, "\\$&");
}

function buildPanelPageTypeLookup(index: LocalComicPanelIndex): Map<string, ComicPageType> {
  const lookup = new Map<string, ComicPageType>();
  for (const page of index.pages) {
    for (const panel of page.panels) {
      lookup.set(panel.panelId, page.pageType);
    }
  }
  return lookup;
}

export function explainPanelCropClassification(input: {
  panel: LocalComicPanelEvidence;
  pageType: ComicPageType;
  segmentedPanelCount?: number;
}): PanelCropDiagnostic {
  const oversized = isOversizedStoryMixedCrop({
    pageType: input.pageType,
    cropAreaRatio: input.panel.cropAreaRatio
  });
  let wholePageFallbackReason: string | null = null;

  if (input.panel.isWholePageFallback) {
    if (oversized) {
      wholePageFallbackReason = "cropAreaRatio_above_0.70_on_story_or_mixed";
    } else if (input.panel.estimatedGutterCount > 0 || input.panel.estimatedPanelCount > 1) {
      wholePageFallbackReason = "multiple_gutters_or_estimated_panels_in_single_crop";
    } else {
      wholePageFallbackReason = "full_page_bounds_detected";
    }
  } else if (
    (input.segmentedPanelCount ?? 1) > 1 &&
    input.panel.cropAreaRatio > 0.7 &&
    (input.pageType === "story" || input.pageType === "mixed")
  ) {
    wholePageFallbackReason =
      "legacy_exemption_removed:previously_allowed_because_segmentedPanelCount>1";
  }

  const classification: PanelCropDiagnostic["classification"] =
    input.pageType === "cover"
      ? "cover"
      : input.pageType === "splash"
        ? "splash"
        : input.pageType === "mixed"
          ? "mixed"
          : input.pageType === "story"
            ? "story"
            : "other";

  return {
    panelId: input.panel.panelId,
    pageType: input.pageType,
    cropAreaRatio: input.panel.cropAreaRatio,
    estimatedPanelCount: input.panel.estimatedPanelCount,
    estimatedGutterCount: input.panel.estimatedGutterCount,
    bounds: input.panel.cropBounds,
    isWholePageFallback: input.panel.isWholePageFallback,
    isActualPanelCrop: input.panel.isActualPanelCrop,
    valid: input.panel.valid,
    rejectReason: input.panel.rejectReason,
    wholePageFallbackReason,
    classification
  };
}

async function runFfmpeg(ffmpegCommand: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(ffmpegCommand, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export async function renderBeatAssignmentValidationContactSheet(input: {
  entries: BeatAssignmentValidationEntry[];
  outputPath: string;
  ffmpegCommand?: string;
}): Promise<string | null> {
  const usable = input.entries.filter((entry) => entry.panelImagePath && entry.panelId);
  if (usable.length === 0) return null;

  await mkdir(dirname(input.outputPath), { recursive: true });
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";
  const annotatedDir = join(dirname(input.outputPath), `${basename(input.outputPath)}.annotated`);
  await mkdir(annotatedDir, { recursive: true });

  const annotatedPaths: string[] = [];
  for (const [index, entry] of usable.entries()) {
    if (!entry.panelImagePath || !(await fileExists(entry.panelImagePath))) continue;
    const label = escapeDrawtext(
      `${entry.beatRole} | ${entry.panelId} | p${entry.pageNumber ?? "?"} | r${((entry.cropAreaRatio ?? 0) * 100).toFixed(0)}% | ${entry.pageType ?? "?"} | fit${entry.beatSpecificFitScore ?? 0} | reuse${entry.reuseCount}`
    );
    const annotatedPath = join(annotatedDir, `beat-${String(index + 1).padStart(2, "0")}.jpg`);
    await runFfmpeg(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      entry.panelImagePath,
      "-vf",
      `scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=black,drawtext=text='${label}':fontsize=10:fontcolor=white:x=8:y=8:box=1:boxcolor=black@0.55`,
      "-frames:v",
      "1",
      annotatedPath
    ]);
    annotatedPaths.push(annotatedPath);
  }

  if (annotatedPaths.length === 0) return null;

  const listPath = `${input.outputPath}.list.txt`;
  const escaped = annotatedPaths.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, escaped, "utf8");

  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(annotatedPaths.length))));
  const rows = Math.ceil(annotatedPaths.length / columns);
  await runFfmpeg(ffmpegCommand, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-vf",
    `tile=${columns}x${rows}`,
    "-frames:v",
    "1",
    input.outputPath
  ]);

  return resolve(input.outputPath);
}

export async function validateAndAssignIndexedBeatPanels(input: {
  index: LocalComicPanelIndex;
  indexPath: string;
  requirements: BeatVisualRequirement[];
  beats: GlobalBeatSpec[];
  projectRoot: string;
  ffmpegCommand?: string;
}): Promise<BeatAssignmentValidationResult> {
  const pageTypeLookup = buildPanelPageTypeLookup(input.index);
  const panels = flattenPanelIndex(input.index).filter((panel) => panel.valid);
  const sequences = buildComicPanelSequences(panels);

  const panelDiagnostics = flattenPanelIndex(input.index).map((panel) =>
    explainPanelCropClassification({
      panel,
      pageType: pageTypeLookup.get(panel.panelId) ?? "unknown"
    })
  );

  const page4Panel1 = findLocalPanelById(input.index, "user-remix-asset-bd624296f938:page4:panel1");
  const page4Panel1Diagnostic = page4Panel1
    ? (() => {
        const sourcePage = input.index.pages.find((page) =>
          page.panels.some((panel) => panel.panelId === page4Panel1.panelId)
        );
        return explainPanelCropClassification({
          panel: page4Panel1,
          pageType: pageTypeLookup.get(page4Panel1.panelId) ?? "story",
          ...(sourcePage ? { segmentedPanelCount: sourcePage.panels.length } : {})
        });
      })()
    : null;

  const retrieval = runPanelRetrievalForBeats({
    requirements: input.requirements,
    panelIndex: panels
  });

  const verifiedPools = buildVerifiedCandidatePoolsFromRetrieval(retrieval);
  const globalAssignment = assignPanelsToBeatsGlobally({
    beats: input.beats,
    verifiedCandidates: verifiedPools,
    sequences
  });

  const reuseStats = computeAssignmentReuseStats(globalAssignment.assignments);
  const reuseByPanelId = reuseStats.reuseByPanelId;

  const assignments: BeatAssignmentValidationEntry[] = input.beats.map((beat) => {
    const assigned = globalAssignment.assignments.find((entry) => entry.beatRole === beat.beatRole);
    if (!assigned) {
      return {
        beatRole: beat.beatRole,
        beatId: beat.beatId,
        panelId: null,
        pageNumber: null,
        pageType: null,
        cropAreaRatio: null,
        beatSpecificFitScore: null,
        finalScore: null,
        reuseCount: 0,
        blockReason: "unassigned",
        panelImagePath: null
      };
    }

    const panel = findLocalPanelById(input.index, assigned.panelId);
    return {
      beatRole: beat.beatRole,
      beatId: beat.beatId,
      panelId: assigned.panelId,
      pageNumber: assigned.pageNumber,
      pageType: panel ? (pageTypeLookup.get(panel.panelId) ?? null) : null,
      cropAreaRatio: panel?.cropAreaRatio ?? null,
      beatSpecificFitScore: assigned.beatSpecificFitScore,
      finalScore: assigned.finalScore,
      reuseCount: reuseByPanelId[assigned.panelId] ?? 0,
      blockReason: null,
      panelImagePath: panel?.panelImagePath ?? null
    };
  });

  const scoresByBeat: Record<string, number> = {};
  for (const entry of assignments) {
    if (entry.beatSpecificFitScore !== null) {
      scoresByBeat[entry.beatRole] = entry.beatSpecificFitScore;
    }
  }

  const assignedScores = assignments
    .map((entry) => entry.beatSpecificFitScore)
    .filter((score): score is number => score !== null);
  const averageBeatSpecificFitScore =
    assignedScores.length > 0
      ? Number((assignedScores.reduce((sum, score) => sum + score, 0) / assignedScores.length).toFixed(2))
      : 0;

  const canRender =
    assignments.length === input.beats.length &&
    assignments.every((entry) => entry.panelId !== null) &&
    panels.length >= 5;

  const canPublish = globalAssignment.canPublish && canRender;
  const blockReason = canPublish
    ? null
    : globalAssignment.publishBlockReason ??
      (assignments.some((entry) => entry.panelId === null) ? "incomplete_beat_assignments" : "validation_failed");

  const tmpDir = join(resolve(input.projectRoot), "tmp");
  await mkdir(tmpDir, { recursive: true });
  const reportPath = join(tmpDir, BEAT_ASSIGNMENT_VALIDATION_REPORT_FILENAME);
  const contactSheetTarget = join(tmpDir, BEAT_ASSIGNMENT_VALIDATION_CONTACT_SHEET_FILENAME);

  const contactSheetPath = await renderBeatAssignmentValidationContactSheet({
    entries: assignments,
    outputPath: contactSheetTarget,
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  const result: BeatAssignmentValidationResult = {
    generatedAt: new Date().toISOString(),
    assetDirectory: input.index.assetDirectory,
    indexPath: input.indexPath,
    contactSheetPath,
    reportPath,
    panelDiagnostics,
    page4Panel1Diagnostic,
    assignments,
    uniquePanelCount: reuseStats.uniquePanelCount,
    maxPanelReuseCount: reuseStats.maxPanelReuseCount,
    continuityScore: globalAssignment.developmentSequence.continuityScore,
    averageBeatSpecificFitScore,
    scoresByBeat,
    canRender,
    canPublish,
    blockReason,
    globalAssignment
  };

  const serializable = {
    ...result,
    globalAssignment: {
      ...result.globalAssignment,
      beatPicks: [...result.globalAssignment.beatPicks.entries()].map(([beatRole, pick]) => ({
        beatRole,
        panelId: pick.panel.panelId,
        beatSpecificFitScore: pick.verification.scores.beatSpecificFitScore,
        finalScore: pick.verification.scores.finalScore
      })),
      greedyBaseline: [...result.globalAssignment.greedyBaseline.entries()]
    },
    thresholds: GLOBAL_PANEL_SCORE_THRESHOLDS
  };

  await writeFile(reportPath, JSON.stringify(serializable, null, 2), "utf8");

  return result;
}

export async function runBeatAssignmentValidationFromAssetDirectory(input: {
  assetDirectory: string;
  projectRoot: string;
  requirements: BeatVisualRequirement[];
  beats: GlobalBeatSpec[];
  ffmpegCommand?: string;
  forceReindex?: boolean;
}): Promise<BeatAssignmentValidationResult> {
  const assetDirectory = resolve(input.assetDirectory);
  const indexPath = join(assetDirectory, ".comics-local-panel-index.json");

  let index = await loadLocalComicPanelIndex(assetDirectory);
  if (!index || input.forceReindex) {
    throw new Error(
      index
        ? "force_reindex_requested_run_upsert_first"
        : `missing_local_panel_index:${indexPath}`
    );
  }

  return validateAndAssignIndexedBeatPanels({
    index,
    indexPath,
    requirements: input.requirements,
    beats: input.beats,
    projectRoot: input.projectRoot,
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });
}