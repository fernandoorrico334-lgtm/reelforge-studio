import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { BeatVisualRequirement } from "./comics-beat-visual-requirements.js";
import {
  extractLocalPanelEntityIds,
  extractLocalPanelThemeIds,
  normalizeBeatEntityName,
  normalizeBeatThemeName
} from "./comics-beat-panel-requirements.js";
import type { LocalComicPanelEvidence } from "./comics-local-panel-index.js";

export type ComicSelectionFeedbackReason =
  | "correct_entities"
  | "correct_theme"
  | "correct_action"
  | "good_sequence"
  | "wrong_entities"
  | "wrong_theme"
  | "wrong_action"
  | "generic_visual"
  | "promotional"
  | "text_heavy"
  | "bad_crop"
  | "duplicate"
  | "other";

export type ComicSelectionFeedbackDecision = "approved" | "rejected";

export interface ComicSelectionFeedback {
  feedbackId: string;
  comicId: string;
  panelId: string;
  panelImageSha256: string;
  beatRole: string;
  narrationTheme: string;
  requiredEntities: string[];
  requiredRelationships: string[];
  decision: ComicSelectionFeedbackDecision;
  reason: ComicSelectionFeedbackReason;
  notes?: string;
  createdAt: string;
}

export type PanelSelectionFeedbackPattern = {
  patternId: string;
  characterSet: string[];
  relationshipTypes: string[];
  storyFunction: string;
  narrationTheme: string;
  beatRole: string;
};

export type ComicsSelectionFeedbackLedger = {
  version: 1;
  updatedAt: string;
  entries: ComicSelectionFeedback[];
};

export type SelectionFeedbackAdjustmentResult = {
  baseScore: number;
  adjustedScore: number;
  adjustment: number;
  appliedFeedbackIds: string[];
  patternMatches: string[];
  cappedByEvidence: boolean;
  evidenceBlockedPositive: boolean;
  notes: string[];
};

export const DEFAULT_COMICS_SELECTION_FEEDBACK_PATH = join(
  "storage",
  "editorial",
  "comics-selection-feedback.json"
);

export const FEEDBACK_BONUS_CAP = 15;
export const FEEDBACK_PENALTY_CAP = 25;

const APPROVED_REASON_WEIGHT: Partial<Record<ComicSelectionFeedbackReason, number>> = {
  correct_entities: 12,
  correct_theme: 8,
  correct_action: 6,
  good_sequence: 5
};

const REJECTED_REASON_WEIGHT: Partial<Record<ComicSelectionFeedbackReason, number>> = {
  wrong_entities: 22,
  wrong_theme: 18,
  wrong_action: 14,
  generic_visual: 10,
  promotional: 20,
  text_heavy: 12,
  bad_crop: 16,
  duplicate: 8,
  other: 6
};

const THEME_SCOPE_GROUPS: Record<string, string[]> = {
  symbiosis: ["symbiosis", "partnership", "relationship"],
  partnership: ["partnership", "symbiosis", "relationship"],
  relationship: ["relationship", "partnership", "symbiosis"],
  multiverse: ["multiverse", "crossover", "variant"],
  crossover: ["crossover", "multiverse", "variant"]
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK | constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function hasEntityHit(panel: LocalComicPanelEvidence, entities: string[]): boolean {
  const local = new Set(extractLocalPanelEntityIds(panel));
  return entities.map(normalizeBeatEntityName).some((entity) => local.has(entity));
}

function hasThemeHit(panel: LocalComicPanelEvidence, themes: string[]): boolean {
  const local = new Set(extractLocalPanelThemeIds(panel));
  return themes.map(normalizeBeatThemeName).some((theme) => local.has(theme));
}

function hasRelationshipHit(panel: LocalComicPanelEvidence, relationships: string[]): boolean {
  const local = new Set(panel.localEvidence.relationships.map((entry) => entry.type));
  return relationships.some((relationship) => local.has(relationship as never));
}

export function deriveComicIdFromPanel(panel: LocalComicPanelEvidence): string {
  if (panel.sequenceId) {
    const [prefix] = panel.sequenceId.split(":");
    if (prefix) return prefix;
  }
  const [panelPrefix] = panel.panelId.split(":");
  return panelPrefix ?? panel.panelId;
}

export function derivePanelSelectionFeedbackPattern(input: {
  panel: LocalComicPanelEvidence;
  beatRole: string;
  narrationTheme: string;
}): PanelSelectionFeedbackPattern {
  const characterSet = [...new Set(extractLocalPanelEntityIds(input.panel))].sort();
  const relationshipTypes = [
    ...new Set(input.panel.localEvidence.relationships.map((entry) => entry.type))
  ].sort();
  const patternSeed = JSON.stringify({
    characterSet,
    relationshipTypes,
    storyFunction: input.panel.storyFunction,
    narrationTheme: normalizeBeatThemeName(input.narrationTheme),
    beatRole: input.beatRole
  });
  const patternId = createHash("sha256").update(patternSeed).digest("hex").slice(0, 16);

  return {
    patternId,
    characterSet,
    relationshipTypes,
    storyFunction: input.panel.storyFunction,
    narrationTheme: normalizeBeatThemeName(input.narrationTheme),
    beatRole: input.beatRole
  };
}

export function feedbackThemesApplyToRequirement(
  feedbackTheme: string,
  requirement: BeatVisualRequirement
): boolean {
  const normalizedFeedback = normalizeBeatThemeName(feedbackTheme);
  const requirementThemes = [
    ...requirement.requiredThemes,
    ...requirement.preferredThemes
  ].map(normalizeBeatThemeName);

  if (requirementThemes.includes(normalizedFeedback)) return true;

  const scoped = THEME_SCOPE_GROUPS[normalizedFeedback] ?? [normalizedFeedback];
  return requirementThemes.some((theme) => scoped.includes(theme));
}

export function panelHasRequiredLocalEvidence(
  panel: LocalComicPanelEvidence,
  requirement: BeatVisualRequirement
): boolean {
  if (!panel.valid) return false;
  if (hasEntityHit(panel, requirement.forbiddenEntities)) return false;
  if (hasThemeHit(panel, requirement.forbiddenThemes)) return false;
  if (requirement.directEvidenceRequired && !hasEntityHit(panel, requirement.requiredEntities)) {
    return false;
  }
  if (
    requirement.requiredThemes.length > 0 &&
    !hasThemeHit(panel, requirement.requiredThemes)
  ) {
    return false;
  }
  if (
    requirement.requiredActions.length > 0 &&
    !panel.localEvidence.actions.some((action) =>
      requirement.requiredActions.includes(action.label)
    )
  ) {
    return false;
  }
  return true;
}

function patternOverlapScore(
  pattern: PanelSelectionFeedbackPattern,
  feedback: ComicSelectionFeedback
): number {
  const feedbackEntities = feedback.requiredEntities.map(normalizeBeatEntityName).sort();
  const patternEntities = pattern.characterSet;
  const entityOverlap =
    feedbackEntities.length === 0
      ? 0
      : feedbackEntities.filter((entity) => patternEntities.includes(entity)).length /
        Math.max(feedbackEntities.length, patternEntities.length, 1);

  const feedbackRelationships = feedback.requiredRelationships;
  const relationshipOverlap =
    feedbackRelationships.length === 0
      ? 0
      : feedbackRelationships.filter((relationship) =>
          pattern.relationshipTypes.includes(relationship)
        ).length / Math.max(feedbackRelationships.length, pattern.relationshipTypes.length, 1);

  let score = 0;
  if (feedback.beatRole === pattern.beatRole) score += 0.25;
  if (normalizeBeatThemeName(feedback.narrationTheme) === pattern.narrationTheme) score += 0.25;
  score += entityOverlap * 0.35;
  score += relationshipOverlap * 0.15;
  return score;
}

function isExactPanelFeedback(feedback: ComicSelectionFeedback, panel: LocalComicPanelEvidence): boolean {
  return (
    feedback.panelId === panel.panelId &&
    feedback.panelImageSha256 === panel.panelImageSha256
  );
}

function feedbackMatchesPanelPattern(
  feedback: ComicSelectionFeedback,
  pattern: PanelSelectionFeedbackPattern,
  requirement: BeatVisualRequirement
): { matched: boolean; strength: number; matchType: "exact" | "pattern" | "none" } {
  if (!feedbackThemesApplyToRequirement(feedback.narrationTheme, requirement)) {
    return { matched: false, strength: 0, matchType: "none" };
  }

  if (feedback.beatRole !== pattern.beatRole) {
    return { matched: false, strength: 0, matchType: "none" };
  }

  const overlap = patternOverlapScore(pattern, feedback);
  if (overlap >= 0.55) {
    return { matched: true, strength: overlap, matchType: "pattern" };
  }

  return { matched: false, strength: 0, matchType: "none" };
}

export function applySelectionFeedbackAdjustment(input: {
  panel: LocalComicPanelEvidence;
  requirement: BeatVisualRequirement;
  baseScore: number;
  feedback: ComicSelectionFeedback[];
  narrationTheme?: string;
}): SelectionFeedbackAdjustmentResult {
  const narrationTheme =
    input.narrationTheme ??
    input.requirement.requiredThemes[0] ??
    input.requirement.preferredThemes[0] ??
    "general";

  const pattern = derivePanelSelectionFeedbackPattern({
    panel: input.panel,
    beatRole: input.requirement.role,
    narrationTheme
  });

  const hasEvidence = panelHasRequiredLocalEvidence(input.panel, input.requirement);
  let adjustment = 0;
  const appliedFeedbackIds: string[] = [];
  const patternMatches: string[] = [];
  const notes: string[] = [];
  let evidenceBlockedPositive = false;

  for (const entry of input.feedback) {
    if (isExactPanelFeedback(entry, input.panel)) {
      const weight =
        entry.decision === "approved"
          ? (APPROVED_REASON_WEIGHT[entry.reason] ?? 6)
          : -(REJECTED_REASON_WEIGHT[entry.reason] ?? 8);

      if (weight > 0 && !hasEvidence) {
        evidenceBlockedPositive = true;
        notes.push(`blocked_positive:${entry.feedbackId}:missing_required_evidence`);
        continue;
      }

      adjustment += weight;
      appliedFeedbackIds.push(entry.feedbackId);
      patternMatches.push(`exact:${entry.feedbackId}`);
      continue;
    }

    const match = feedbackMatchesPanelPattern(entry, pattern, input.requirement);
    if (!match.matched) continue;

    const baseWeight =
      entry.decision === "approved"
        ? (APPROVED_REASON_WEIGHT[entry.reason] ?? 5)
        : -(REJECTED_REASON_WEIGHT[entry.reason] ?? 6);

    const scaled = Math.round(baseWeight * match.strength);
    if (scaled > 0 && !hasEvidence) {
      evidenceBlockedPositive = true;
      notes.push(`blocked_positive:${entry.feedbackId}:pattern_missing_required_evidence`);
      continue;
    }

    adjustment += scaled;
    appliedFeedbackIds.push(entry.feedbackId);
    patternMatches.push(`pattern:${pattern.patternId}:${entry.feedbackId}`);
  }

  const cappedAdjustment = clamp(adjustment, -FEEDBACK_PENALTY_CAP, FEEDBACK_BONUS_CAP);
  const cappedByEvidence = adjustment !== cappedAdjustment || evidenceBlockedPositive;

  return {
    baseScore: input.baseScore,
    adjustedScore: clamp(input.baseScore + cappedAdjustment, 0, 100),
    adjustment: cappedAdjustment,
    appliedFeedbackIds,
    patternMatches,
    cappedByEvidence,
    evidenceBlockedPositive,
    notes
  };
}

export function resolveComicsSelectionFeedbackPath(projectRoot?: string): string {
  return join(resolve(projectRoot ?? process.cwd()), DEFAULT_COMICS_SELECTION_FEEDBACK_PATH);
}

export async function loadComicsSelectionFeedbackLedger(
  projectRoot?: string
): Promise<ComicsSelectionFeedbackLedger> {
  const ledgerPath = resolveComicsSelectionFeedbackPath(projectRoot);
  if (!(await fileExists(ledgerPath))) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: []
    };
  }

  const raw = JSON.parse(await readFile(ledgerPath, "utf8")) as ComicsSelectionFeedbackLedger;
  return {
    version: 1,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    entries: Array.isArray(raw.entries) ? raw.entries : []
  };
}

export async function saveComicsSelectionFeedbackLedger(
  ledger: ComicsSelectionFeedbackLedger,
  projectRoot?: string
): Promise<string> {
  const ledgerPath = resolveComicsSelectionFeedbackPath(projectRoot);
  await mkdir(dirname(ledgerPath), { recursive: true });
  const payload: ComicsSelectionFeedbackLedger = {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: ledger.entries
  };
  await writeFile(ledgerPath, JSON.stringify(payload, null, 2), "utf8");
  return ledgerPath;
}

export async function appendComicsSelectionFeedback(
  entry: Omit<ComicSelectionFeedback, "feedbackId" | "createdAt"> & {
    feedbackId?: string;
    createdAt?: string;
  },
  projectRoot?: string
): Promise<{ entry: ComicSelectionFeedback; ledgerPath: string }> {
  const ledger = await loadComicsSelectionFeedbackLedger(projectRoot);
  const record: ComicSelectionFeedback = {
    feedbackId: entry.feedbackId ?? randomUUID(),
    comicId: entry.comicId,
    panelId: entry.panelId,
    panelImageSha256: entry.panelImageSha256,
    beatRole: entry.beatRole,
    narrationTheme: normalizeBeatThemeName(entry.narrationTheme),
    requiredEntities: entry.requiredEntities.map(normalizeBeatEntityName),
    requiredRelationships: entry.requiredRelationships,
    decision: entry.decision,
    reason: entry.reason,
    ...(entry.notes ? { notes: entry.notes } : {}),
    createdAt: entry.createdAt ?? new Date().toISOString()
  };

  ledger.entries.push(record);
  const ledgerPath = await saveComicsSelectionFeedbackLedger(ledger, projectRoot);
  return { entry: record, ledgerPath };
}

export function buildComicsSelectionFeedbackReport(ledger: ComicsSelectionFeedbackLedger): {
  totalEntries: number;
  approvedCount: number;
  rejectedCount: number;
  byTheme: Record<string, { approved: number; rejected: number }>;
  byBeatRole: Record<string, { approved: number; rejected: number }>;
  byReason: Record<string, number>;
  recentEntries: ComicSelectionFeedback[];
} {
  const byTheme: Record<string, { approved: number; rejected: number }> = {};
  const byBeatRole: Record<string, { approved: number; rejected: number }> = {};
  const byReason: Record<string, number> = {};

  for (const entry of ledger.entries) {
    const theme = normalizeBeatThemeName(entry.narrationTheme);
    const themeBucket = byTheme[theme] ?? { approved: 0, rejected: 0 };
    themeBucket[entry.decision] += 1;
    byTheme[theme] = themeBucket;

    const beatBucket = byBeatRole[entry.beatRole] ?? { approved: 0, rejected: 0 };
    beatBucket[entry.decision] += 1;
    byBeatRole[entry.beatRole] = beatBucket;

    byReason[entry.reason] = (byReason[entry.reason] ?? 0) + 1;
  }

  return {
    totalEntries: ledger.entries.length,
    approvedCount: ledger.entries.filter((entry) => entry.decision === "approved").length,
    rejectedCount: ledger.entries.filter((entry) => entry.decision === "rejected").length,
    byTheme,
    byBeatRole,
    byReason,
    recentEntries: [...ledger.entries]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 12)
  };
}