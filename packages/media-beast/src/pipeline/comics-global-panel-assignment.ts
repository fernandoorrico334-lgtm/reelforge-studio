import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { PanelBeatVerification } from "./comics-panel-retrieval.js";
import {
  findSequenceForPanel,
  scorePairContinuity,
  type ComicPanelSequence
} from "./comics-panel-sequences.js";
import type { LocalComicPanelEvidence } from "./comics-local-panel-index.js";

export const GLOBAL_PANEL_ASSIGNMENT_WEIGHTS: Record<string, number> = {
  hook: 1.4,
  climax: 1.5,
  development_a: 1.0,
  development_b: 1.0,
  context: 0.9,
  curiosity_a: 0.9,
  curiosity_b: 0.9,
  closing: 0.7
};

export const GLOBAL_PANEL_SCORE_THRESHOLDS = {
  hook: 80,
  climax: 80,
  context: 60,
  curiosity: 60,
  development: 60,
  average: 70,
  continuity: 60
} as const;

export const GLOBAL_PANEL_ASSIGNMENT_REPORT_FILENAME = "variation-b-global-panel-assignment.json";
export const GLOBAL_PANEL_ASSIGNMENT_CONTACT_SHEET_FILENAME =
  "variation-b-global-panel-assignment-contact-sheet.jpg";
export const BEAT_ASSIGNMENT_VALIDATION_REPORT_FILENAME =
  "variation-b-beat-assignments-validation.json";
export const BEAT_ASSIGNMENT_VALIDATION_CONTACT_SHEET_FILENAME =
  "variation-b-beat-assignments-contact-sheet.jpg";

export const MIN_UNIQUE_PANEL_COUNT = 5;
export const MAX_PANEL_REUSE_COUNT = 2;

const FILL_BEAT_ORDER = [
  "development_a",
  "development_b",
  "context",
  "curiosity_a",
  "curiosity_b"
] as const;

const SIGNIFICANT_CROP_AREA_DELTA = 0.15;
const SIGNIFICANT_CROP_POSITION_DELTA = 0.12;

export type VerifiedPanelCandidate = {
  panel: LocalComicPanelEvidence;
  verification: PanelBeatVerification;
};

export type BeatVerifiedCandidatePool = {
  beatId: string;
  beatRole: string;
  candidates: VerifiedPanelCandidate[];
};

export type GlobalBeatSpec = {
  beatId: string;
  beatRole: string;
};

export type DevelopmentSequenceReport = {
  panelA: string;
  panelB: string;
  consecutivePages: boolean;
  sameStorySequence: boolean;
  continuityScore: number;
  reason: string;
};

export type GlobalPanelReuseEntry = {
  beatRole: string;
  panelId: string;
  reusedFromBeat: string;
  significantCrop: boolean;
  reason: string;
};

export type GlobalPanelAssignmentEntry = {
  beatRole: string;
  beatId: string;
  panelId: string;
  pageNumber: number;
  finalScore: number;
  beatSpecificFitScore: number;
  weightedScore: number;
  evidenceType: string;
};

export type GlobalPanelRejectedAlternative = {
  beatRole: string;
  panelId: string;
  finalScore: number;
  reason: string;
};

export type BeatPanelScoreMatrixEntry = {
  beatRole: string;
  panelId: string;
  finalScore: number;
  accepted: boolean;
};

export type GlobalPanelAssignmentResult = {
  selectionMode: "global_panel_assignment";
  totalWeightedScore: number;
  continuityBonus: number;
  averageScore: number;
  canPublish: boolean;
  publishBlockReason: string | null;
  developmentSequence: DevelopmentSequenceReport;
  assignments: GlobalPanelAssignmentEntry[];
  rejectedAssignments: Array<{
    beatRole: string;
    panelId: string;
    reason: string;
  }>;
  rejectedAlternatives: GlobalPanelRejectedAlternative[];
  reuse: GlobalPanelReuseEntry[];
  hookReserve: string | null;
  climaxReserve: string | null;
  beatPanelMatrix: BeatPanelScoreMatrixEntry[];
  beatPicks: Map<
    string,
    {
      panel: LocalComicPanelEvidence;
      verification: PanelBeatVerification;
    }
  >;
  greedyBaseline: Map<string, number>;
  warnings: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getBeatWeight(beatRole: string): number {
  return GLOBAL_PANEL_ASSIGNMENT_WEIGHTS[beatRole] ?? 1;
}

function mapBeatRoleForThreshold(beatRole: string): keyof typeof GLOBAL_PANEL_SCORE_THRESHOLDS | "development" {
  if (beatRole.startsWith("curiosity")) return "curiosity";
  if (beatRole.startsWith("development")) return "development";
  if (beatRole === "hook" || beatRole === "climax" || beatRole === "context") return beatRole;
  return "development";
}

function getBeatThreshold(beatRole: string): number {
  const mapped = mapBeatRoleForThreshold(beatRole);
  if (mapped === "development" || mapped === "curiosity") {
    return GLOBAL_PANEL_SCORE_THRESHOLDS[mapped];
  }
  return GLOBAL_PANEL_SCORE_THRESHOLDS[mapped];
}

function cropArea(bounds: LocalComicPanelEvidence["cropBounds"]): number {
  return bounds.width * bounds.height;
}

function cropOverlapRatio(
  left: LocalComicPanelEvidence["cropBounds"],
  right: LocalComicPanelEvidence["cropBounds"]
): number {
  const xOverlap = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const yOverlap = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  const overlapArea = xOverlap * yOverlap;
  const minArea = Math.min(cropArea(left), cropArea(right));
  return minArea === 0 ? 0 : overlapArea / minArea;
}

export function hasSignificantCropDifference(
  left: LocalComicPanelEvidence,
  right: LocalComicPanelEvidence
): boolean {
  if (left.panelImageSha256 === right.panelImageSha256) return false;
  if (left.panelId === right.panelId) return false;
  if (left.sourcePagePath !== right.sourcePagePath) return true;

  const overlap = cropOverlapRatio(left.cropBounds, right.cropBounds);
  if (overlap >= 0.85) return false;

  const leftArea = cropArea(left.cropBounds);
  const rightArea = cropArea(right.cropBounds);
  const areaDelta = Math.abs(leftArea - rightArea) / Math.max(leftArea, rightArea);
  const centerDeltaX =
    Math.abs(left.cropBounds.x + left.cropBounds.width / 2 - (right.cropBounds.x + right.cropBounds.width / 2)) /
    Math.max(left.cropBounds.width, right.cropBounds.width);
  const centerDeltaY =
    Math.abs(left.cropBounds.y + left.cropBounds.height / 2 - (right.cropBounds.y + right.cropBounds.height / 2)) /
    Math.max(left.cropBounds.height, right.cropBounds.height);

  return (
    areaDelta >= SIGNIFICANT_CROP_AREA_DELTA ||
    centerDeltaX >= SIGNIFICANT_CROP_POSITION_DELTA ||
    centerDeltaY >= SIGNIFICANT_CROP_POSITION_DELTA ||
    overlap <= 0.55
  );
}

export function canReusePanelBetweenBeats(input: {
  fromBeat: string;
  toBeat: string;
  fromPanel: LocalComicPanelEvidence;
  toPanel: LocalComicPanelEvidence;
}): { allowed: boolean; significantCrop: boolean; reason: string } {
  if (input.toBeat === "closing" && input.fromBeat === "hook") {
    return {
      allowed: true,
      significantCrop: input.fromPanel.panelId === input.toPanel.panelId,
      reason: "closing_may_reuse_hook"
    };
  }

  if (input.fromPanel.panelId === input.toPanel.panelId) {
    return { allowed: false, significantCrop: false, reason: "same_panel_id" };
  }

  const significantCrop = hasSignificantCropDifference(input.fromPanel, input.toPanel);
  const narrativeShift = input.fromPanel.storyFunction !== input.toPanel.storyFunction;

  if (!significantCrop && !narrativeShift) {
    return { allowed: false, significantCrop: false, reason: "insignificant_crop_reuse" };
  }

  if (!significantCrop) {
    return { allowed: false, significantCrop: false, reason: "same_crop_region" };
  }

  return { allowed: true, significantCrop: true, reason: "significant_crop_difference" };
}

function poolForRole(pools: BeatVerifiedCandidatePool[], beatRole: string): VerifiedPanelCandidate[] {
  return pools.find((pool) => pool.beatRole === beatRole)?.candidates ?? [];
}

function candidateRankingScore(
  candidate: VerifiedPanelCandidate,
  panelUseCount?: Map<string, number>
): number {
  const fit = candidate.verification.scores.beatSpecificFitScore ?? candidate.verification.scores.finalScore;
  const reusePenalty = (panelUseCount?.get(candidate.panel.panelId) ?? 0) * 6;
  return fit - reusePenalty;
}

function topCandidates(
  candidates: VerifiedPanelCandidate[],
  limit: number,
  panelUseCount?: Map<string, number>
): VerifiedPanelCandidate[] {
  return [...candidates]
    .filter((entry) => entry.verification.accepted)
    .sort(
      (left, right) =>
        candidateRankingScore(right, panelUseCount) - candidateRankingScore(left, panelUseCount)
    )
    .slice(0, limit);
}

function buildDevelopmentSequenceReport(
  panelA: LocalComicPanelEvidence | null,
  panelB: LocalComicPanelEvidence | null,
  sequences: ComicPanelSequence[]
): DevelopmentSequenceReport {
  if (!panelA || !panelB) {
    return {
      panelA: panelA?.panelId ?? "",
      panelB: panelB?.panelId ?? "",
      consecutivePages: false,
      sameStorySequence: false,
      continuityScore: 0,
      reason: "missing_development_pair"
    };
  }

  const continuityScore = scorePairContinuity(panelA, panelB, sequences);
  const consecutivePages = Math.abs(panelA.pageNumber - panelB.pageNumber) === 1;
  const sequenceA = findSequenceForPanel(sequences, panelA.panelId);
  const sequenceB = findSequenceForPanel(sequences, panelB.panelId);
  const sameStorySequence = Boolean(
    sequenceA && sequenceB && sequenceA.sequenceId === sequenceB.sequenceId
  );

  let reason = "development_pair";
  if (consecutivePages && sameStorySequence) reason = "consecutive_pages_same_sequence";
  else if (consecutivePages) reason = "consecutive_pages";
  else if (sameStorySequence) reason = "same_story_sequence";
  else if (continuityScore < GLOBAL_PANEL_SCORE_THRESHOLDS.continuity) reason = "random_page_jump_penalty";

  return {
    panelA: panelA.panelId,
    panelB: panelB.panelId,
    consecutivePages,
    sameStorySequence,
    continuityScore,
    reason
  };
}

export function computeAssignmentReuseStats(assignments: GlobalPanelAssignmentEntry[]): {
  uniquePanelCount: number;
  maxPanelReuseCount: number;
  reuseByPanelId: Record<string, number>;
} {
  const reuseByPanelId: Record<string, number> = {};
  for (const assignment of assignments) {
    reuseByPanelId[assignment.panelId] = (reuseByPanelId[assignment.panelId] ?? 0) + 1;
  }
  const counts = Object.values(reuseByPanelId);
  return {
    uniquePanelCount: counts.length,
    maxPanelReuseCount: counts.length > 0 ? Math.max(...counts) : 0,
    reuseByPanelId
  };
}

function evaluateCanPublish(input: {
  assignments: GlobalPanelAssignmentEntry[];
  developmentSequence: DevelopmentSequenceReport;
  expectedBeatCount?: number;
}): { canPublish: boolean; publishBlockReason: string | null } {
  if (input.assignments.length === 0) {
    return { canPublish: false, publishBlockReason: "no_assignments" };
  }

  const expectedBeatCount = input.expectedBeatCount ?? 8;
  if (input.assignments.length < expectedBeatCount) {
    return {
      canPublish: false,
      publishBlockReason: `incomplete_assignments:${input.assignments.length}<${expectedBeatCount}`
    };
  }

  const reuseStats = computeAssignmentReuseStats(input.assignments);
  if (reuseStats.uniquePanelCount < MIN_UNIQUE_PANEL_COUNT) {
    return {
      canPublish: false,
      publishBlockReason: `unique_panel_count_below_${MIN_UNIQUE_PANEL_COUNT}:${reuseStats.uniquePanelCount}`
    };
  }
  if (reuseStats.maxPanelReuseCount > MAX_PANEL_REUSE_COUNT) {
    return {
      canPublish: false,
      publishBlockReason: `max_panel_reuse_exceeded:${reuseStats.maxPanelReuseCount}>${MAX_PANEL_REUSE_COUNT}`
    };
  }

  const scores = input.assignments.map((entry) => entry.beatSpecificFitScore);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  for (const assignment of input.assignments) {
    const threshold = getBeatThreshold(assignment.beatRole);
    if (assignment.beatSpecificFitScore < threshold) {
      return {
        canPublish: false,
        publishBlockReason: `beat_below_threshold:${assignment.beatRole}:${assignment.beatSpecificFitScore}<${threshold}`
      };
    }
  }

  if (average < GLOBAL_PANEL_SCORE_THRESHOLDS.average) {
    return {
      canPublish: false,
      publishBlockReason: `average_below_threshold:${average.toFixed(1)}<${GLOBAL_PANEL_SCORE_THRESHOLDS.average}`
    };
  }

  if (input.developmentSequence.continuityScore < GLOBAL_PANEL_SCORE_THRESHOLDS.continuity) {
    return {
      canPublish: false,
      publishBlockReason: `development_continuity_below_threshold:${input.developmentSequence.continuityScore}<${GLOBAL_PANEL_SCORE_THRESHOLDS.continuity}`
    };
  }

  if (
    input.developmentSequence.panelA &&
    input.developmentSequence.panelB &&
    input.developmentSequence.panelA === input.developmentSequence.panelB
  ) {
    return { canPublish: false, publishBlockReason: "development_pair_must_differ" };
  }

  return { canPublish: true, publishBlockReason: null };
}

function buildGreedyBaseline(pools: BeatVerifiedCandidatePool[]): Map<string, number> {
  const baseline = new Map<string, number>();
  for (const pool of pools) {
    const best = topCandidates(pool.candidates, 1)[0];
    baseline.set(pool.beatRole, best?.verification.scores.finalScore ?? 0);
  }
  return baseline;
}

function buildBeatPanelMatrix(pools: BeatVerifiedCandidatePool[]): BeatPanelScoreMatrixEntry[] {
  const matrix: BeatPanelScoreMatrixEntry[] = [];
  for (const pool of pools) {
    for (const candidate of pool.candidates) {
      matrix.push({
        beatRole: pool.beatRole,
        panelId: candidate.panel.panelId,
        finalScore: candidate.verification.scores.finalScore,
        accepted: candidate.verification.accepted
      });
    }
  }
  return matrix;
}

type AssignmentState = {
  picks: Map<string, VerifiedPanelCandidate>;
  panelUseCount: Map<string, number>;
  reuse: GlobalPanelReuseEntry[];
  rejectedAlternatives: GlobalPanelRejectedAlternative[];
  warnings: string[];
};

function tryAssignCandidate(
  state: AssignmentState,
  beatRole: string,
  candidate: VerifiedPanelCandidate,
  sequences: ComicPanelSequence[],
  options?: { allowReuseFrom?: string; reuseFromBeat?: string }
): { ok: boolean; continuityBonus: number; reason?: string } {
  const panelId = candidate.panel.panelId;
  const currentUse = state.panelUseCount.get(panelId) ?? 0;

  if (beatRole === "development_b") {
    const developmentA = state.picks.get("development_a");
    if (developmentA && developmentA.panel.panelId === panelId) {
      return { ok: false, continuityBonus: 0, reason: "development_pair_must_differ" };
    }
  }

  if (!(options?.allowReuseFrom && options.reuseFromBeat)) {
    if (currentUse >= MAX_PANEL_REUSE_COUNT) {
      return { ok: false, continuityBonus: 0, reason: "panel_reuse_limit" };
    }
  }

  if (options?.allowReuseFrom && options.reuseFromBeat) {
    const fromPick = state.picks.get(options.reuseFromBeat);
    if (!fromPick) return { ok: false, continuityBonus: 0, reason: "missing_reuse_source" };
    const reuse = canReusePanelBetweenBeats({
      fromBeat: options.reuseFromBeat,
      toBeat: beatRole,
      fromPanel: fromPick.panel,
      toPanel: candidate.panel
    });
    if (!reuse.allowed) {
      return { ok: false, continuityBonus: 0, reason: reuse.reason };
    }
    state.reuse.push({
      beatRole,
      panelId,
      reusedFromBeat: options.reuseFromBeat,
      significantCrop: reuse.significantCrop,
      reason: reuse.reason
    });
  }

  let continuityBonus = 0;
  const developmentA = state.picks.get("development_a");
  if (beatRole === "development_b" && developmentA) {
    continuityBonus = scorePairContinuity(developmentA.panel, candidate.panel, sequences) * 0.2;
    if (Math.abs(developmentA.panel.pageNumber - candidate.panel.pageNumber) > 2) {
      return { ok: false, continuityBonus: 0, reason: "development_random_page_jump" };
    }
  }

  state.picks.set(beatRole, candidate);
  state.panelUseCount.set(panelId, currentUse + 1);
  return { ok: true, continuityBonus };
}

function scoreAssignmentState(
  state: AssignmentState,
  sequences: ComicPanelSequence[]
): {
  totalWeightedScore: number;
  continuityBonus: number;
  developmentSequence: DevelopmentSequenceReport;
} {
  let totalWeightedScore = 0;
  let continuityBonus = 0;

  for (const [beatRole, pick] of state.picks.entries()) {
    totalWeightedScore += pick.verification.scores.finalScore * getBeatWeight(beatRole);
  }

  const developmentSequence = buildDevelopmentSequenceReport(
    state.picks.get("development_a")?.panel ?? null,
    state.picks.get("development_b")?.panel ?? null,
    sequences
  );

  continuityBonus += developmentSequence.continuityScore * 0.25;
  if (developmentSequence.consecutivePages) continuityBonus += 8;
  if (developmentSequence.sameStorySequence) continuityBonus += 10;

  const hook = state.picks.get("hook")?.panel;
  const climax = state.picks.get("climax")?.panel;
  if (hook && climax && hook.panelId !== climax.panelId) {
    continuityBonus += scorePairContinuity(hook, climax, sequences) * 0.08;
  }

  return { totalWeightedScore, continuityBonus, developmentSequence };
}

export function assignPanelsToBeatsGlobally(input: {
  beats: GlobalBeatSpec[];
  verifiedCandidates: BeatVerifiedCandidatePool[];
  sequences: ComicPanelSequence[];
}): GlobalPanelAssignmentResult {
  const warnings: string[] = [];
  const greedyBaseline = buildGreedyBaseline(input.verifiedCandidates);
  const beatPanelMatrix = buildBeatPanelMatrix(input.verifiedCandidates);

  const hookPool = topCandidates(poolForRole(input.verifiedCandidates, "hook"), 6);
  const climaxPool = topCandidates(poolForRole(input.verifiedCandidates, "climax"), 6);

  let bestState: AssignmentState | null = null;
  let bestScore = -Infinity;
  let bestContinuityBonus = 0;
  let bestDevelopmentSequence: DevelopmentSequenceReport = {
    panelA: "",
    panelB: "",
    consecutivePages: false,
    sameStorySequence: false,
    continuityScore: 0,
    reason: "unassigned"
  };

  const hookOptions = hookPool.length > 0 ? hookPool : topCandidates(poolForRole(input.verifiedCandidates, "hook"), 1);
  const climaxOptions =
    climaxPool.length > 0 ? climaxPool : topCandidates(poolForRole(input.verifiedCandidates, "climax"), 1);

  for (const hookCandidate of hookOptions) {
    for (const climaxCandidate of climaxOptions) {
      if (hookCandidate.panel.panelId === climaxCandidate.panel.panelId) continue;

      const state: AssignmentState = {
        picks: new Map(),
        panelUseCount: new Map(),
        reuse: [],
        rejectedAlternatives: [],
        warnings: []
      };

      const hookAssign = tryAssignCandidate(state, "hook", hookCandidate, input.sequences);
      if (!hookAssign.ok) continue;
      const climaxAssign = tryAssignCandidate(state, "climax", climaxCandidate, input.sequences);
      if (!climaxAssign.ok) continue;

      for (const beatRole of FILL_BEAT_ORDER) {
        const pool = topCandidates(
          poolForRole(input.verifiedCandidates, beatRole),
          16,
          state.panelUseCount
        );
        let assigned = false;

        for (const candidate of pool) {
          const result = tryAssignCandidate(state, beatRole, candidate, input.sequences);
          if (!result.ok) {
            state.rejectedAlternatives.push({
              beatRole,
              panelId: candidate.panel.panelId,
              finalScore: candidate.verification.scores.finalScore,
              reason: result.reason ?? "assign_failed"
            });
            continue;
          }
          assigned = true;
          break;
        }

        if (!assigned) {
          state.warnings.push(`unassigned_beat:${beatRole}`);
        }
      }

      const hookPick = state.picks.get("hook");
      if (hookPick) {
        const closingAssign = tryAssignCandidate(state, "closing", hookPick, input.sequences, {
          allowReuseFrom: "hook",
          reuseFromBeat: "hook"
        });
        if (!closingAssign.ok) {
          state.warnings.push(`closing_reuse_failed:${closingAssign.reason ?? "unknown"}`);
        }
      }

      const scored = scoreAssignmentState(state, input.sequences);
      let objective = scored.totalWeightedScore + scored.continuityBonus;

      const hookScore =
        state.picks.get("hook")?.verification.scores.beatSpecificFitScore ?? 0;
      const climaxScore =
        state.picks.get("climax")?.verification.scores.beatSpecificFitScore ?? 0;
      const uniquePanels = new Set(
        [...state.picks.values()].map((pick) => pick.panel.panelId)
      ).size;
      objective += uniquePanels * 4;
      if (hookScore < GLOBAL_PANEL_SCORE_THRESHOLDS.hook) objective -= 500;
      if (climaxScore < GLOBAL_PANEL_SCORE_THRESHOLDS.climax) objective -= 500;

      if (objective > bestScore) {
        bestScore = objective;
        bestState = state;
        bestContinuityBonus = scored.continuityBonus;
        bestDevelopmentSequence = scored.developmentSequence;
      }
    }
  }

  if (!bestState) {
    return {
      selectionMode: "global_panel_assignment",
      totalWeightedScore: 0,
      continuityBonus: 0,
      averageScore: 0,
      canPublish: false,
      publishBlockReason: "unsupported_global_assignment",
      developmentSequence: bestDevelopmentSequence,
      assignments: [],
      rejectedAssignments: [],
      rejectedAlternatives: [],
      reuse: [],
      hookReserve: null,
      climaxReserve: null,
      beatPanelMatrix,
      beatPicks: new Map(),
      greedyBaseline,
      warnings: [...warnings, "no_valid_global_assignment"]
    };
  }

  const assignments: GlobalPanelAssignmentEntry[] = [];
  const beatPicks = new Map<string, { panel: LocalComicPanelEvidence; verification: PanelBeatVerification }>();

  for (const beat of input.beats) {
    const pick = bestState.picks.get(beat.beatRole);
    if (!pick) continue;
    beatPicks.set(beat.beatRole, { panel: pick.panel, verification: pick.verification });
    assignments.push({
      beatRole: beat.beatRole,
      beatId: beat.beatId,
      panelId: pick.panel.panelId,
      pageNumber: pick.panel.pageNumber,
      finalScore: pick.verification.scores.finalScore,
      beatSpecificFitScore: pick.verification.scores.beatSpecificFitScore,
      weightedScore: Number(
        (pick.verification.scores.beatSpecificFitScore * getBeatWeight(beat.beatRole)).toFixed(2)
      ),
      evidenceType: pick.verification.evidenceType
    });
  }

  const averageScore =
    assignments.length > 0
      ? Number(
          (
            assignments.reduce((sum, entry) => sum + entry.beatSpecificFitScore, 0) /
            assignments.length
          ).toFixed(2)
        )
      : 0;

  const publish = evaluateCanPublish({
    assignments,
    developmentSequence: bestDevelopmentSequence,
    expectedBeatCount: input.beats.length
  });

  const rejectedAssignments = [...bestState.warnings]
    .filter((warning) => warning.startsWith("unassigned_beat:"))
    .map((warning) => ({
      beatRole: warning.split(":")[1] ?? "unknown",
      panelId: "",
      reason: warning
    }));

  return {
    selectionMode: "global_panel_assignment",
    totalWeightedScore: Number(bestScore.toFixed(2)),
    continuityBonus: Number(bestContinuityBonus.toFixed(2)),
    averageScore,
    canPublish: publish.canPublish,
    publishBlockReason: publish.publishBlockReason,
    developmentSequence: bestDevelopmentSequence,
    assignments,
    rejectedAssignments,
    rejectedAlternatives: bestState.rejectedAlternatives,
    reuse: bestState.reuse,
    hookReserve: bestState.picks.get("hook")?.panel.panelId ?? null,
    climaxReserve: bestState.picks.get("climax")?.panel.panelId ?? null,
    beatPanelMatrix,
    beatPicks,
    greedyBaseline,
    warnings: [...warnings, ...bestState.warnings]
  };
}

export function assignPanelsToBeatsGreedy(input: {
  beats: GlobalBeatSpec[];
  verifiedCandidates: BeatVerifiedCandidatePool[];
}): Map<string, VerifiedPanelCandidate> {
  const picks = new Map<string, VerifiedPanelCandidate>();
  const used = new Set<string>();

  const ordered = [...input.beats].sort(
    (left, right) => getBeatWeight(right.beatRole) - getBeatWeight(left.beatRole)
  );

  for (const beat of ordered) {
    const pool = poolForRole(input.verifiedCandidates, beat.beatRole);
    const ranked = topCandidates(pool, pool.length);
    const hit = ranked.find((candidate) => !used.has(candidate.panel.panelId));
    if (!hit) continue;
    picks.set(beat.beatRole, hit);
    used.add(hit.panel.panelId);
  }

  return picks;
}

export function buildVerifiedCandidatePoolsFromMatrix(input: {
  beats: GlobalBeatSpec[];
  matrix: BeatPanelScoreMatrixEntry[];
  panelsById: Map<string, LocalComicPanelEvidence>;
  verificationsByBeatPanel: Map<string, PanelBeatVerification>;
}): BeatVerifiedCandidatePool[] {
  return input.beats.map((beat) => {
    const entries = input.matrix.filter((entry) => entry.beatRole === beat.beatRole && entry.accepted);
    const candidates: VerifiedPanelCandidate[] = [];
    for (const entry of entries) {
      const panel = input.panelsById.get(entry.panelId);
      const verification = input.verificationsByBeatPanel.get(`${beat.beatRole}:${entry.panelId}`);
      if (!panel || !verification) continue;
      candidates.push({ panel, verification });
    }
    return { beatId: beat.beatId, beatRole: beat.beatRole, candidates };
  });
}

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

export async function renderGlobalPanelAssignmentContactSheet(input: {
  result: GlobalPanelAssignmentResult;
  outputPath: string;
  ffmpegCommand?: string;
}): Promise<string | null> {
  const entries: Array<{ panelPath: string; label: string }> = [];

  for (const assignment of input.result.assignments) {
    const pick = input.result.beatPicks.get(assignment.beatRole);
    if (!pick) continue;
    const label = escapeDrawtext(
      `${assignment.beatRole} | ${assignment.panelId} | p${assignment.pageNumber} | s${assignment.finalScore} | ${assignment.evidenceType}`
    );
    entries.push({ panelPath: pick.panel.panelImagePath, label });
  }

  if (entries.length === 0) return null;

  await mkdir(dirname(input.outputPath), { recursive: true });
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";
  const annotatedDir = join(dirname(input.outputPath), `${basename(input.outputPath)}.annotated`);
  await mkdir(annotatedDir, { recursive: true });

  const annotatedPaths: string[] = [];
  for (const [index, entry] of entries.entries()) {
    if (!(await fileExists(entry.panelPath))) continue;
    const annotatedPath = join(annotatedDir, `global-${String(index + 1).padStart(2, "0")}.jpg`);
    await runFfmpeg(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      entry.panelPath,
      "-vf",
      `scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=black,drawtext=text='${entry.label}':fontsize=10:fontcolor=white:x=8:y=8:box=1:boxcolor=black@0.55`,
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

export async function saveGlobalPanelAssignmentReport(input: {
  result: GlobalPanelAssignmentResult;
  projectRoot: string;
  ffmpegCommand?: string;
}): Promise<{
  reportPath: string;
  contactSheetPath: string | null;
}> {
  const tmpDir = join(resolve(input.projectRoot), "tmp");
  await mkdir(tmpDir, { recursive: true });
  const reportPath = join(tmpDir, GLOBAL_PANEL_ASSIGNMENT_REPORT_FILENAME);
  const contactSheetTarget = join(tmpDir, GLOBAL_PANEL_ASSIGNMENT_CONTACT_SHEET_FILENAME);

  const serializable = {
    ...input.result,
    beatPicks: [...input.result.beatPicks.entries()].map(([beatRole, pick]) => ({
      beatRole,
      panelId: pick.panel.panelId,
      pageNumber: pick.panel.pageNumber,
      finalScore: pick.verification.scores.finalScore,
      evidenceType: pick.verification.evidenceType
    })),
    greedyBaseline: [...input.result.greedyBaseline.entries()]
  };

  await writeFile(reportPath, JSON.stringify(serializable, null, 2), "utf8");
  const contactSheetPath = await renderGlobalPanelAssignmentContactSheet({
    result: input.result,
    outputPath: contactSheetTarget,
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  return { reportPath, contactSheetPath };
}