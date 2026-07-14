import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { BeatVisualRequirement } from "./comics-beat-visual-requirements.js";
import type { BeatVerifiedCandidatePool } from "./comics-global-panel-assignment.js";
import {
  computeBeatSpecificFitScore,
  extractLocalPanelEntityIds,
  extractLocalPanelThemeIds,
  normalizeBeatEntityName,
  normalizeBeatThemeName
} from "./comics-beat-panel-requirements.js";
import {
  isPromotionalPanelRegion,
  type LocalComicPanelEvidence,
  type LocalComicPanelIndex,
  validateLocalEvidenceDoesNotInheritParent
} from "./comics-local-panel-index.js";
export type PanelEvidenceType =
  | "direct_evidence"
  | "supporting_visual"
  | "insufficient"
  | "reject";

export type PanelBeatVerification = {
  beatId: string;
  panelId: string;
  evidenceType: PanelEvidenceType;

  verification: {
    requiredEntityVisible: boolean;
    preferredEntityVisible: boolean;
    requiredThemeVisible: boolean;
    requiredActionVisible: boolean;
    preferredRelationshipVisible: boolean;
    forbiddenEntityVisible: boolean;
    promotionalContent: boolean;
  };

  scores: {
    localVisualEvidence: number;
    localTextEvidence: number;
    localThemeRelationship: number;
    beatFit: number;
    visualQuality: number;
    beatSpecificFitScore: number;
    finalScore: number;
  };

  evidence: string[];
  rejectionReasons: string[];
  accepted: boolean;
};

export type PanelRetrievalBeatResult = {
  beatId: string;
  role: string;
  requirement: BeatVisualRequirement;
  recallCandidates: LocalComicPanelEvidence[];
  recallCount: number;
  verifications: PanelBeatVerification[];
  selectedPanel: LocalComicPanelEvidence | null;
  selectedVerification: PanelBeatVerification | null;
  rejectedPanels: Array<{
    panelId: string;
    evidenceType: PanelEvidenceType;
    rejectionReasons: string[];
    finalScore: number;
  }>;
  unsupportedBeat: boolean;
  blockReason: string | null;
};

export type PanelRetrievalReport = {
  generatedAt: string;
  assetDirectory: string | null;
  totalBeats: number;
  supportedBeats: number;
  unsupportedBeats: string[];
  falsePositivesRejected: number;
  beats: PanelRetrievalBeatResult[];
};

export const PANEL_RETRIEVAL_REQUIREMENTS_FILENAME = "variation-b-beat-visual-requirements.json";
export const PANEL_RETRIEVAL_REPORT_FILENAME = "variation-b-panel-retrieval-report.json";
export const PANEL_RETRIEVAL_CONTACT_SHEET_FILENAME = "variation-b-panel-retrieval-contact-sheet.jpg";

const DEFAULT_RECALL_LIMIT = 15;
const PARENT_RECALL_BONUS_MAX = 8;

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

function extractLocalActions(panel: LocalComicPanelEvidence): string[] {
  return panel.localEvidence.actions
    .filter((entry) => entry.confidence >= 0.45)
    .map((entry) => entry.label.toLowerCase());
}

function extractLocalRelationships(panel: LocalComicPanelEvidence): string[] {
  return panel.localEvidence.relationships
    .filter((entry) => entry.confidence >= 0.5)
    .map((entry) => entry.type);
}

function extractLocalTextSignals(panel: LocalComicPanelEvidence): string[] {
  return [
    ...panel.localEvidence.detectedText,
    ...panel.localEvidence.dialogue,
    ...panel.localEvidence.narrationBoxes,
    ...panel.localEvidence.soundEffects
  ].map((value) => value.toLowerCase());
}

function hasThemeHit(panel: LocalComicPanelEvidence, themes: string[]): boolean {
  const localThemes = extractLocalPanelThemeIds(panel);
  const normalized = themes.map(normalizeBeatThemeName);
  return normalized.some((theme) => localThemes.includes(theme));
}

function hasEntityHit(panel: LocalComicPanelEvidence, entities: string[]): boolean {
  const localEntities = extractLocalPanelEntityIds(panel);
  const normalized = entities.map(normalizeBeatEntityName);
  return normalized.some((entity) => localEntities.includes(entity));
}

function hasActionHit(panel: LocalComicPanelEvidence, actions: string[]): boolean {
  const localActions = extractLocalActions(panel);
  return actions.some((action) => localActions.some((local) => local.includes(action)));
}

function hasRelationshipHit(panel: LocalComicPanelEvidence, relationships: string[]): boolean {
  const localRelationships = extractLocalRelationships(panel);
  return relationships.some((relationship) => localRelationships.includes(relationship));
}

function scoreStoryFunctionForRole(panel: LocalComicPanelEvidence, role: string): number {
  const baseRole = role.replace(/_[ab]$/i, "");
  const fn = panel.storyFunction;
  if (baseRole === "hook" && (fn === "relationship" || fn === "action" || fn === "splash")) return 8;
  if (baseRole === "climax" && (fn === "relationship" || fn === "transformation" || fn === "action")) {
    return 8;
  }
  if (baseRole === "context" && (fn === "context" || fn === "dialogue" || fn === "setup")) return 6;
  if (/development|curiosity|tension/.test(baseRole) && fn !== "unknown") return 4;
  return 0;
}

function scoreParentRecallDiscovery(panel: LocalComicPanelEvidence, requirement: BeatVisualRequirement): number {
  let score = 0;
  const parentEntities = panel.parentContext.parentEntities.map(normalizeBeatEntityName);
  const parentTags = panel.parentContext.parentTags.map((tag) => tag.toLowerCase());

  if (requirement.requiredEntities.some((entity) => parentEntities.includes(normalizeBeatEntityName(entity)))) {
    score += 3;
  }
  if (requirement.preferredEntities.some((entity) => parentEntities.includes(normalizeBeatEntityName(entity)))) {
    score += 2;
  }
  if (requirement.requiredThemes.some((theme) => parentTags.includes(theme.toLowerCase()))) {
    score += 2;
  }
  if (panel.parentContext.comicTitle && /venom|simbionte|espiral/i.test(panel.parentContext.comicTitle)) {
    score += 1;
  }

  return clamp(score, 0, PARENT_RECALL_BONUS_MAX);
}

function scoreRecallCandidate(
  panel: LocalComicPanelEvidence,
  requirement: BeatVisualRequirement
): number {
  if (!panel.valid) return -100;

  let score = 0;
  const localEntities = extractLocalPanelEntityIds(panel);
  const localThemes = extractLocalPanelThemeIds(panel);

  for (const entity of requirement.requiredEntities) {
    if (localEntities.includes(normalizeBeatEntityName(entity))) score += 24;
  }
  for (const entity of requirement.preferredEntities) {
    if (localEntities.includes(normalizeBeatEntityName(entity))) score += 10;
  }
  for (const theme of requirement.requiredThemes) {
    if (localThemes.includes(normalizeBeatThemeName(theme))) score += 14;
  }
  for (const theme of requirement.preferredThemes) {
    if (localThemes.includes(normalizeBeatThemeName(theme))) score += 6;
  }
  if (hasActionHit(panel, requirement.preferredActions)) score += 6;
  if (hasRelationshipHit(panel, requirement.preferredRelationships)) score += 12;
  if (panel.localEvidence.detectedText.length > 0 || panel.localEvidence.dialogue.length > 0) score += 4;
  score += scoreStoryFunctionForRole(panel, requirement.role);
  if (panel.sequenceId) score += 2;
  score += Math.round(panel.confidence.overall * 8);
  score += scoreParentRecallDiscovery(panel, requirement);

  if (hasEntityHit(panel, requirement.forbiddenEntities)) score -= 80;
  if (hasThemeHit(panel, requirement.forbiddenThemes)) score -= 40;

  return score;
}

export function retrievePanelCandidates(input: {
  requirement: BeatVisualRequirement;
  panelIndex: LocalComicPanelEvidence[];
  limit?: number;
}): LocalComicPanelEvidence[] {
  const limit = input.limit ?? DEFAULT_RECALL_LIMIT;
  const ranked = input.panelIndex
    .filter((panel) => panel.valid)
    .map((panel) => ({ panel, recallScore: scoreRecallCandidate(panel, input.requirement) }))
    .filter((entry) => entry.recallScore > 0)
    .sort((left, right) => right.recallScore - left.recallScore);

  const minimum = Math.min(limit, Math.max(10, Math.min(20, ranked.length)));
  return ranked.slice(0, minimum).map((entry) => entry.panel);
}

function isPromotionalPanel(panel: LocalComicPanelEvidence): boolean {
  const promo = isPromotionalPanelRegion({
    title: panel.parentContext.pageTitle ?? panel.parentContext.issueTitle ?? "",
    tags: panel.parentContext.parentTags,
    visual: {
      analyzable: true,
      eligible: false,
      rejectReason: null,
      duoVisualScore: 0,
      visualTags: panel.localEvidence.visualThemes,
      profile: null,
      warnings: []
    }
  });
  if (promo.reject) return true;

  return panel.localEvidence.visualThemes.some((theme) =>
    /catalog|qr|promo|advertisement|visual_catalog_ad/i.test(theme)
  );
}

function classifyEvidenceType(input: {
  requirement: BeatVisualRequirement;
  panel: LocalComicPanelEvidence;
  verification: PanelBeatVerification["verification"];
}): PanelEvidenceType {
  const { requirement, panel, verification } = input;

  if (
    verification.forbiddenEntityVisible ||
    verification.promotionalContent ||
    !panel.valid
  ) {
    return "reject";
  }

  const localEntities = extractLocalPanelEntityIds(panel);
  const hasVenom = localEntities.includes("venom");
  const hasSpiderMan = localEntities.includes("spider-man");
  const hasSymbiote = localEntities.includes("symbiote");
  const hasDuo = hasRelationshipHit(panel, ["duo"]);
  const hasBlackSuit = panel.localEvidence.visualThemes.some((theme) =>
    /black_suit|symbiosis/i.test(theme)
  );

  if (hasDuo && hasVenom && hasSpiderMan) return "direct_evidence";
  if (hasVenom && hasSpiderMan) return "direct_evidence";
  if (requirement.requiredEntities.every((entity) => localEntities.includes(normalizeBeatEntityName(entity)))) {
    if (hasThemeHit(panel, requirement.requiredThemes) || hasDuo) return "direct_evidence";
  }

  if ((hasSymbiote || hasBlackSuit) && hasSpiderMan && !hasVenom) {
    return "supporting_visual";
  }
  if (hasSpiderMan && !hasVenom && requirement.requiredEntities.includes("venom")) {
    return "insufficient";
  }
  if (hasSpiderMan && !hasVenom && !requirement.requiredEntities.includes("venom")) {
    return "supporting_visual";
  }

  if (requirement.directEvidenceRequired) {
    const missingRequiredEntity = requirement.requiredEntities.some(
      (entity) => !localEntities.includes(normalizeBeatEntityName(entity))
    );
    const missingRequiredTheme =
      requirement.requiredThemes.length > 0 && !hasThemeHit(panel, requirement.requiredThemes);
    if (missingRequiredEntity || missingRequiredTheme) return "insufficient";
  }

  if (localEntities.length === 0 && panel.localEvidence.visualThemes.length <= 1) {
    return "insufficient";
  }

  return "supporting_visual";
}

function scoreLocalVisualEvidence(
  panel: LocalComicPanelEvidence,
  requirement: BeatVisualRequirement
): number {
  let score = 0;
  const localEntities = extractLocalPanelEntityIds(panel);

  if (requirement.requiredEntities.length > 0) {
    const ratio =
      requirement.requiredEntities.filter((entity) =>
        localEntities.includes(normalizeBeatEntityName(entity))
      ).length / requirement.requiredEntities.length;
    score += ratio * 55;
  } else {
    score += localEntities.length > 0 ? 35 : 0;
  }

  if (requirement.preferredEntities.length > 0) {
    const ratio =
      requirement.preferredEntities.filter((entity) =>
        localEntities.includes(normalizeBeatEntityName(entity))
      ).length / requirement.preferredEntities.length;
    score += ratio * 25;
  }

  score += Math.round(panel.confidence.characters * 20);
  return clamp(Math.round(score), 0, 100);
}

function scoreLocalTextEvidence(panel: LocalComicPanelEvidence, requirement: BeatVisualRequirement): number {
  const textBlob = extractLocalTextSignals(panel).join(" ");
  if (!textBlob) {
    if (panel.localEvidence.dialogue.length > 0) return 35;
    if (hasEntityHit(panel, requirement.requiredEntities) && panel.confidence.characters >= 0.8) {
      return 50;
    }
    return 10;
  }

  let score = 20;
  for (const entity of [...requirement.requiredEntities, ...requirement.preferredEntities]) {
    if (textBlob.includes(entity.replace(/_/g, " ")) || textBlob.includes(entity)) score += 12;
  }
  for (const theme of [...requirement.requiredThemes, ...requirement.preferredThemes]) {
    if (textBlob.includes(theme)) score += 8;
  }
  score += Math.round(panel.confidence.text * 30);
  return clamp(score, 0, 100);
}

function scoreLocalThemeRelationship(
  panel: LocalComicPanelEvidence,
  requirement: BeatVisualRequirement
): number {
  let score = 0;
  if (requirement.requiredThemes.length > 0) {
    const matched = requirement.requiredThemes.filter((theme) =>
      hasThemeHit(panel, [theme])
    ).length;
    score += (matched / requirement.requiredThemes.length) * 45;
  }
  if (requirement.preferredThemes.length > 0) {
    const matched = requirement.preferredThemes.filter((theme) =>
      hasThemeHit(panel, [theme])
    ).length;
    score += (matched / requirement.preferredThemes.length) * 20;
  }
  if (hasRelationshipHit(panel, requirement.preferredRelationships)) score += 25;
  score += Math.round(panel.confidence.relationships * 10);
  return clamp(score, 0, 100);
}

function scoreBeatFit(
  panel: LocalComicPanelEvidence,
  requirement: BeatVisualRequirement,
  evidenceType: PanelEvidenceType
): number {
  let score = scoreStoryFunctionForRole(panel, requirement.role) * 4;
  if (evidenceType === "direct_evidence") score += 55;
  else if (evidenceType === "supporting_visual") score += 35;
  else if (evidenceType === "insufficient") score += 12;
  else score = 0;

  if (requirement.role === "hook" || requirement.role === "climax") {
    if (panel.storyFunction === "relationship" || panel.storyFunction === "action") score += 10;
  }
  return clamp(score, 0, 100);
}

export function verifyPanelCandidateForBeat(input: {
  requirement: BeatVisualRequirement;
  panel: LocalComicPanelEvidence;
}): PanelBeatVerification {
  const { requirement, panel } = input;
  const evidence: string[] = [];
  const rejectionReasons: string[] = [];

  const inheritance = validateLocalEvidenceDoesNotInheritParent(panel);
  if (!inheritance.ok) {
    rejectionReasons.push(...inheritance.violations.map((v) => `inheritance:${v}`));
  }

  if (!panel.valid) {
    rejectionReasons.push(panel.rejectReason ?? "panel_invalid");
  }
  if (panel.rejectReason === "panel_crop_integrity_mismatch") {
    rejectionReasons.push("panel_crop_integrity_mismatch");
  }
  if (panel.cropAreaRatio > 0.7 || panel.isWholePageFallback) {
    rejectionReasons.push("oversized_story_mixed_crop");
  }

  const requiredEntityVisible = hasEntityHit(panel, requirement.requiredEntities);
  const preferredEntityVisible = hasEntityHit(panel, requirement.preferredEntities);
  const requiredThemeVisible = hasThemeHit(panel, requirement.requiredThemes);
  const requiredActionVisible =
    requirement.requiredActions.length === 0 || hasActionHit(panel, requirement.requiredActions);
  const preferredRelationshipVisible = hasRelationshipHit(panel, requirement.preferredRelationships);
  const forbiddenEntityVisible = hasEntityHit(panel, requirement.forbiddenEntities);
  const forbiddenThemeVisible = hasThemeHit(panel, requirement.forbiddenThemes);
  const promotionalContent = isPromotionalPanel(panel);

  const verification = {
    requiredEntityVisible,
    preferredEntityVisible,
    requiredThemeVisible,
    requiredActionVisible,
    preferredRelationshipVisible,
    forbiddenEntityVisible,
    promotionalContent
  };

  if (forbiddenEntityVisible) {
    rejectionReasons.push("forbidden_entity_visible");
    evidence.push("reject:forbidden_entity_local");
  }
  if (forbiddenThemeVisible) {
    rejectionReasons.push("forbidden_theme_visible");
    evidence.push("reject:forbidden_theme_local");
  }
  if (promotionalContent) {
    rejectionReasons.push("promotional_content");
    evidence.push("reject:promotional_content");
  }
  if (requirement.directEvidenceRequired && !requiredEntityVisible) {
    rejectionReasons.push("missing_required_entity");
  }
  if (requirement.requiredThemes.length > 0 && !requiredThemeVisible) {
    rejectionReasons.push("missing_required_theme");
  }
  if (!requiredActionVisible) {
    rejectionReasons.push("missing_required_action");
  }

  const localEntities = extractLocalPanelEntityIds(panel);
  if (
    requirement.requiredEntities.includes("venom") &&
    !localEntities.includes("venom") &&
    panel.parentContext.parentEntities.map(normalizeBeatEntityName).includes("venom")
  ) {
    rejectionReasons.push("venom_only_in_parent_context");
    evidence.push("reject:parent_context_only");
  }

  const evidenceType = classifyEvidenceType({ requirement, panel, verification });

  if (evidenceType === "reject") {
    if (!rejectionReasons.includes("forbidden_entity_visible") && forbiddenEntityVisible) {
      rejectionReasons.push("forbidden_entity_visible");
    }
  }

  const localVisualEvidence = scoreLocalVisualEvidence(panel, requirement);
  const localTextEvidence = scoreLocalTextEvidence(panel, requirement);
  const localThemeRelationship = scoreLocalThemeRelationship(panel, requirement);
  const beatFit = scoreBeatFit(panel, requirement, evidenceType);
  const visualQuality = panel.quality.visualQualityScore;

  const beatSpecificFitScore = computeBeatSpecificFitScore({ panel, requirement });

  let finalScore = Math.round(
    beatSpecificFitScore * 0.45 +
      localVisualEvidence * 0.2 +
      localTextEvidence * 0.1 +
      localThemeRelationship * 0.15 +
      beatFit * 0.05 +
      visualQuality * 0.05
  );

  const highStakes = requirement.role === "hook" || requirement.role === "climax";
  if (highStakes && evidenceType !== "direct_evidence") {
    rejectionReasons.push("high_stakes_requires_direct_evidence");
    finalScore = Math.min(finalScore, 45);
  }
  if (evidenceType === "reject") {
    finalScore = 0;
  }
  if (evidenceType === "insufficient") {
    finalScore = Math.min(finalScore, 50);
    rejectionReasons.push("insufficient_local_evidence");
  }
  if (!requirement.allowSupportingVisual && evidenceType === "supporting_visual") {
    rejectionReasons.push("supporting_visual_not_allowed");
    finalScore = Math.min(finalScore, 55);
  }
  const beatThreshold = requirement.minimumDirectEvidenceScore;
  if (beatSpecificFitScore < beatThreshold) {
    rejectionReasons.push(
      `below_beat_specific_fit:${beatSpecificFitScore}<${beatThreshold}`
    );
  }
  finalScore = Math.max(finalScore, beatSpecificFitScore);

  if (requiredEntityVisible) evidence.push("local_entity:required_hit");
  if (preferredEntityVisible) evidence.push("local_entity:preferred_hit");
  if (requiredThemeVisible) evidence.push("local_theme:required_hit");
  if (preferredRelationshipVisible) evidence.push("local_relationship:preferred_hit");
  evidence.push(`evidence_type:${evidenceType}`);

  const uniqueRejections = [...new Set(rejectionReasons)];
  const hardReject =
    forbiddenEntityVisible ||
    promotionalContent ||
    !panel.valid ||
    panel.cropAreaRatio > 0.7 ||
    panel.isWholePageFallback ||
    panel.rejectReason === "panel_crop_integrity_mismatch" ||
    !inheritance.ok ||
    uniqueRejections.includes("venom_only_in_parent_context");

  const accepted =
    !hardReject &&
    evidenceType !== "reject" &&
    (highStakes ? evidenceType === "direct_evidence" : evidenceType !== "insufficient") &&
    beatSpecificFitScore >= beatThreshold &&
    (requirement.allowSupportingVisual || evidenceType === "direct_evidence");

  return {
    beatId: requirement.beatId,
    panelId: panel.panelId,
    evidenceType,
    verification,
    scores: {
      localVisualEvidence,
      localTextEvidence,
      localThemeRelationship,
      beatFit,
      visualQuality,
      beatSpecificFitScore,
      finalScore
    },
    evidence,
    rejectionReasons: uniqueRejections,
    accepted
  };
}

export function selectPanelForBeat(input: {
  requirement: BeatVisualRequirement;
  panelIndex: LocalComicPanelEvidence[];
  recallLimit?: number;
}): PanelRetrievalBeatResult {
  const recallCandidates = retrievePanelCandidates({
    requirement: input.requirement,
    panelIndex: input.panelIndex,
    ...(input.recallLimit !== undefined ? { limit: input.recallLimit } : {})
  });

  const verifications = recallCandidates.map((panel) =>
    verifyPanelCandidateForBeat({ requirement: input.requirement, panel })
  );

  const accepted = verifications
    .filter((entry) => entry.accepted)
    .sort(
      (left, right) =>
        right.scores.beatSpecificFitScore - left.scores.beatSpecificFitScore ||
        right.scores.finalScore - left.scores.finalScore
    );

  const selectedVerification = accepted[0] ?? null;
  const selectedPanel =
    selectedVerification
      ? recallCandidates.find((panel) => panel.panelId === selectedVerification.panelId) ?? null
      : null;

  const rejectedPanels = verifications
    .filter((entry) => !entry.accepted)
    .map((entry) => ({
      panelId: entry.panelId,
      evidenceType: entry.evidenceType,
      rejectionReasons: entry.rejectionReasons,
      finalScore: entry.scores.finalScore
    }));

  const unsupportedBeat = selectedPanel === null;

  return {
    beatId: input.requirement.beatId,
    role: input.requirement.role,
    requirement: input.requirement,
    recallCandidates,
    recallCount: recallCandidates.length,
    verifications,
    selectedPanel,
    selectedVerification,
    rejectedPanels,
    unsupportedBeat,
    blockReason: unsupportedBeat ? "unsupported_beat_no_accepted_panel" : null
  };
}

export function buildVerifiedCandidatePoolsFromRetrieval(
  report: PanelRetrievalReport
): BeatVerifiedCandidatePool[] {
  return report.beats.map((beat) => ({
    beatId: beat.beatId,
    beatRole: beat.role,
    candidates: beat.verifications
      .filter((verification) => verification.accepted)
      .map((verification) => {
        const panel =
          beat.recallCandidates.find((candidate) => candidate.panelId === verification.panelId) ??
          beat.selectedPanel;
        return panel ? { panel, verification } : null;
      })
      .filter((entry): entry is { panel: LocalComicPanelEvidence; verification: PanelBeatVerification } =>
        Boolean(entry)
      )
  }));
}

export function runPanelRetrievalForBeats(input: {
  requirements: BeatVisualRequirement[];
  panelIndex: LocalComicPanelEvidence[];
  recallLimit?: number;
}): PanelRetrievalReport {
  const beats = input.requirements.map((requirement) =>
    selectPanelForBeat({
      requirement,
      panelIndex: input.panelIndex,
      ...(input.recallLimit !== undefined ? { limit: input.recallLimit } : {})
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    assetDirectory: null,
    totalBeats: beats.length,
    supportedBeats: beats.filter((beat) => !beat.unsupportedBeat).length,
    unsupportedBeats: beats.filter((beat) => beat.unsupportedBeat).map((beat) => beat.beatId),
    falsePositivesRejected: beats.reduce((sum, beat) => sum + beat.rejectedPanels.length, 0),
    beats
  };
}

export function flattenPanelIndex(index: LocalComicPanelIndex): LocalComicPanelEvidence[] {
  return index.pages.flatMap((page) => page.panels);
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

export async function renderPanelRetrievalContactSheet(input: {
  report: PanelRetrievalReport;
  outputPath: string;
  ffmpegCommand?: string;
}): Promise<string | null> {
  const entries: Array<{ panel: LocalComicPanelEvidence; label: string }> = [];

  for (const beat of input.report.beats) {
    if (!beat.selectedPanel || !beat.selectedVerification) continue;
    const panel = beat.selectedPanel;
    const verification = beat.selectedVerification;
    const chars = extractLocalPanelEntityIds(panel).join("+") || "none";
    const label = escapeDrawtext(
      `${beat.role} | ${beat.beatId} | ${panel.panelId} | p${panel.pageNumber}#${panel.panelNumber} | ${chars} | ${verification.evidenceType} | s${verification.scores.finalScore} | ${panel.panelImageSha256.slice(0, 8)}`
    );
    entries.push({ panel, label });
  }

  if (entries.length === 0) return null;

  await mkdir(dirname(input.outputPath), { recursive: true });
  const ffmpegCommand = input.ffmpegCommand ?? "ffmpeg";
  const annotatedDir = join(dirname(input.outputPath), `${basename(input.outputPath)}.annotated`);
  await mkdir(annotatedDir, { recursive: true });

  const annotatedPaths: string[] = [];
  for (const [index, entry] of entries.entries()) {
    if (!(await fileExists(entry.panel.panelImagePath))) continue;
    const annotatedPath = join(annotatedDir, `retrieval-${String(index + 1).padStart(2, "0")}.jpg`);
    await runFfmpeg(ffmpegCommand, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      entry.panel.panelImagePath,
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

export async function savePanelRetrievalReports(input: {
  requirements: BeatVisualRequirement[];
  report: PanelRetrievalReport;
  projectRoot: string;
  ffmpegCommand?: string;
}): Promise<{
  requirementsPath: string;
  reportPath: string;
  contactSheetPath: string | null;
}> {
  const tmpDir = join(resolve(input.projectRoot), "tmp");
  await mkdir(tmpDir, { recursive: true });

  const requirementsPath = join(tmpDir, PANEL_RETRIEVAL_REQUIREMENTS_FILENAME);
  const reportPath = join(tmpDir, PANEL_RETRIEVAL_REPORT_FILENAME);
  const contactSheetTarget = join(tmpDir, PANEL_RETRIEVAL_CONTACT_SHEET_FILENAME);

  await writeFile(requirementsPath, JSON.stringify(input.requirements, null, 2), "utf8");
  await writeFile(reportPath, JSON.stringify(input.report, null, 2), "utf8");

  const contactSheetPath = await renderPanelRetrievalContactSheet({
    report: input.report,
    outputPath: contactSheetTarget,
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  return { requirementsPath, reportPath, contactSheetPath };
}

export async function runPanelRetrievalPipeline(input: {
  requirements: BeatVisualRequirement[];
  index: LocalComicPanelIndex;
  projectRoot: string;
  recallLimit?: number;
  ffmpegCommand?: string;
}): Promise<{
  report: PanelRetrievalReport;
  requirementsPath: string;
  reportPath: string;
  contactSheetPath: string | null;
}> {
  const panels = flattenPanelIndex(input.index);
  const report = runPanelRetrievalForBeats({
    requirements: input.requirements,
    panelIndex: panels,
    ...(input.recallLimit !== undefined ? { limit: input.recallLimit } : {})
  });
  report.assetDirectory = input.index.assetDirectory;

  const saved = await savePanelRetrievalReports({
    requirements: input.requirements,
    report,
    projectRoot: input.projectRoot,
    ...(input.ffmpegCommand ? { ffmpegCommand: input.ffmpegCommand } : {})
  });

  return { report, ...saved };
}

export function buildMockPanel(overrides: Partial<LocalComicPanelEvidence> & { panelId: string }): LocalComicPanelEvidence {
  const base: LocalComicPanelEvidence = {
    panelId: overrides.panelId,
    pageNumber: overrides.pageNumber ?? 1,
    panelNumber: overrides.panelNumber ?? 1,
    readingOrder: overrides.readingOrder ?? 1,
    sourcePagePath: overrides.sourcePagePath ?? "/tmp/page.jpg",
    panelImagePath: overrides.panelImagePath ?? `/tmp/crops/${overrides.panelId}.jpg`,
    panelImageSha256: overrides.panelImageSha256 ?? "a".repeat(64),
    cropBounds: overrides.cropBounds ?? { x: 0, y: 0, width: 1000, height: 1500 },
    parentContext: overrides.parentContext ?? {
      comicTitle: "Espiral Mortal",
      issueTitle: "Venom page",
      pageTitle: "Venom page",
      parentTags: ["venom"],
      parentEntities: ["venom", "spider-man"]
    },
    localEvidence: overrides.localEvidence ?? {
      characters: [],
      actions: [],
      relationships: [],
      detectedText: [],
      dialogue: [],
      narrationBoxes: [],
      soundEffects: [],
      visualThemes: [],
      objects: [],
      locations: []
    },
    storyFunction: overrides.storyFunction ?? "unknown",
    sequenceId: overrides.sequenceId ?? null,
    previousPanelId: overrides.previousPanelId ?? null,
    nextPanelId: overrides.nextPanelId ?? null,
    valid: overrides.valid ?? true,
    rejectReason: overrides.rejectReason ?? null,
    quality: overrides.quality ?? {
      visualQualityScore: 75,
      cropability916Score: 80,
      textHeavyRatio: 0.1
    },
    confidence: overrides.confidence ?? {
      segmentation: 0.8,
      characters: 0.8,
      actions: 0.7,
      relationships: 0.8,
      text: 0.2,
      overall: 0.8
    },
    warnings: overrides.warnings ?? [],
    cropAreaRatio: overrides.cropAreaRatio ?? 0.25,
    estimatedPanelCount: overrides.estimatedPanelCount ?? 1,
    estimatedGutterCount: overrides.estimatedGutterCount ?? 0,
    isWholePageFallback: overrides.isWholePageFallback ?? false,
    isActualPanelCrop: overrides.isActualPanelCrop ?? true,
    visualFlags: overrides.visualFlags ?? {
      venomVisible: false,
      spiderManVisible: false,
      blackSuitVisible: false,
      symbioteVisible: false,
      duoVisible: false,
      doctorStrangeVisible: false,
      unrelatedCharacterVisible: false
    },
    evidenceTier: overrides.evidenceTier ?? "direct_evidence"
  };
  return { ...base, ...overrides };
}