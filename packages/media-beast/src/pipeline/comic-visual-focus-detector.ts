import type { ComicStoryMinerPanelRef } from "./comic-story-miner.js";
import type { NormalizedComicEvidenceBox } from "./comic-panel-evidence-map.js";

export type ComicVisualFocusType =
  | "character_face"
  | "action_impact"
  | "duo_standoff"
  | "reaction_detail"
  | "wide_context";

export type ComicVisualFocusCandidate = {
  focusId: string;
  type: ComicVisualFocusType;
  box: NormalizedComicEvidenceBox;
  confidence: number;
  priority: number;
  anchorPoint: { x: number; y: number };
  recommendedCameraMove: "snap_zoom" | "slow_push" | "tension_pan" | "reaction_hold" | "context_push";
  reasons: string[];
  warnings: string[];
};

export type ComicVisualFocusReport = {
  detectorId: "comic_visual_focus_detector_v1";
  panelId: string;
  primaryFocus: ComicVisualFocusCandidate;
  candidates: ComicVisualFocusCandidate[];
  focusScore: number;
  hasCharacterFocus: boolean;
  hasActionFocus: boolean;
  hasDuoFocus: boolean;
  warnings: string[];
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function safeBox(box: NormalizedComicEvidenceBox): NormalizedComicEvidenceBox {
  const width = clamp(box.width, 0.24, 0.9);
  const height = clamp(box.height, 0.22, 0.96);
  return {
    x: round(clamp(box.x, 0, 1 - width)),
    y: round(clamp(box.y, 0, 1 - height)),
    width: round(width),
    height: round(height)
  };
}

function anchorFor(box: NormalizedComicEvidenceBox, yBias = 0.48) {
  return {
    x: round(clamp(box.x + box.width / 2, 0.08, 0.92)),
    y: round(clamp(box.y + box.height * yBias, 0.08, 0.92))
  };
}

function makeCandidate(input: {
  panel: ComicStoryMinerPanelRef;
  type: ComicVisualFocusType;
  box: NormalizedComicEvidenceBox;
  confidence: number;
  priority: number;
  camera: ComicVisualFocusCandidate["recommendedCameraMove"];
  reasons: string[];
  warnings?: string[];
  yBias?: number;
}): ComicVisualFocusCandidate {
  const box = safeBox(input.box);
  return {
    focusId: `${input.panel.panelId}:visual_focus:${input.type}`,
    type: input.type,
    box,
    confidence: clampScore(input.confidence),
    priority: input.priority,
    anchorPoint: anchorFor(box, input.yBias ?? 0.48),
    recommendedCameraMove: input.camera,
    reasons: input.reasons,
    warnings: input.warnings ?? []
  };
}

export function detectComicVisualFocus(panel: ComicStoryMinerPanelRef): ComicVisualFocusReport {
  const evidence = panel.visualCropEvidence;
  const counts = evidence.evidenceCounts;
  const confidence = evidence.confidence;
  const cropable = evidence.quality.cropability916Score >= 78;
  const textHeavy = evidence.quality.textHeavyRatio >= 0.34;
  const hasCharacters = counts.characters > 0 || confidence.characters >= 0.58;
  const hasAction = counts.actions > 0 || counts.soundEffects > 0 || confidence.actions >= 0.7;
  const hasDuo = evidence.visualFlags.duoVisible || /duo|conflict|rival|enemy|host|threat/i.test(evidence.strongestRelationshipType ?? "");
  const isReaction = ["reaction", "reveal", "dialogue"].includes(evidence.storyFunction);
  const warnings: string[] = [];
  const candidates: ComicVisualFocusCandidate[] = [];

  candidates.push(makeCandidate({
    panel,
    type: "wide_context",
    box: { x: 0.1, y: 0.03, width: 0.8, height: 0.92 },
    confidence: 54 + confidence.overall * 24 + (cropable ? 6 : 0),
    priority: 42,
    camera: "context_push",
    reasons: [`story_function:${evidence.storyFunction}`, `cropability:${evidence.quality.cropability916Score}`, "always_available_context_focus"],
    warnings: cropable ? [] : ["wide_context_low_cropability"]
  }));

  if (hasCharacters) {
    candidates.push(makeCandidate({
      panel,
      type: isReaction ? "reaction_detail" : "character_face",
      box: {
        x: textHeavy ? 0.2 : 0.24,
        y: textHeavy ? 0.2 : 0.12,
        width: textHeavy ? 0.58 : 0.52,
        height: textHeavy ? 0.58 : 0.62
      },
      confidence: 62 + confidence.characters * 25 + Math.min(10, counts.characters * 4),
      priority: isReaction ? 84 : 76,
      camera: isReaction ? "reaction_hold" : "slow_push",
      yBias: 0.42,
      reasons: [`characters:${counts.characters}`, `character_confidence:${round(confidence.characters)}`, "face_or_body_focus_for_human_reaction"],
      warnings: textHeavy ? ["character_focus_must_avoid_text_regions"] : []
    }));
  }

  if (hasAction) {
    candidates.push(makeCandidate({
      panel,
      type: "action_impact",
      box: {
        x: cropable ? 0.18 : 0.12,
        y: 0.1,
        width: cropable ? 0.64 : 0.76,
        height: 0.76
      },
      confidence: 66 + confidence.actions * 24 + Math.min(12, counts.soundEffects * 5),
      priority: 92,
      camera: "snap_zoom",
      reasons: [`actions:${counts.actions}`, `sfx:${counts.soundEffects}`, `action:${evidence.strongestActionLabel ?? "unknown"}`, "best_retention_punch_focus"],
      warnings: cropable ? [] : ["action_focus_needs_wider_crop"]
    }));
  }

  if (hasDuo) {
    candidates.push(makeCandidate({
      panel,
      type: "duo_standoff",
      box: { x: 0.07, y: 0.07, width: 0.86, height: 0.82 },
      confidence: 64 + confidence.relationships * 22 + (evidence.visualFlags.duoVisible ? 10 : 0),
      priority: 88,
      camera: "tension_pan",
      reasons: [`relationship:${evidence.strongestRelationshipType ?? "unknown"}`, `duo_visible:${evidence.visualFlags.duoVisible}`, "keep_opponents_in_frame"],
      warnings: textHeavy ? ["duo_focus_has_text_interference"] : []
    }));
  }

  if (!hasCharacters) warnings.push("visual_focus:no_character_focus_detected");
  if (!hasAction) warnings.push("visual_focus:no_action_focus_detected");
  if (!hasDuo) warnings.push("visual_focus:no_duo_focus_detected");

  const sorted = candidates.sort((left, right) => (right.priority + right.confidence * 0.35) - (left.priority + left.confidence * 0.35));
  const primaryFocus = sorted[0] ?? makeCandidate({
    panel,
    type: "wide_context",
    box: { x: 0.12, y: 0.05, width: 0.76, height: 0.9 },
    confidence: 50,
    priority: 30,
    camera: "context_push",
    reasons: ["fallback_primary_focus"]
  });
  const focusScore = clampScore(primaryFocus.confidence * 0.72 + primaryFocus.priority * 0.28 - warnings.length * 3);

  return {
    detectorId: "comic_visual_focus_detector_v1",
    panelId: panel.panelId,
    primaryFocus,
    candidates: sorted,
    focusScore,
    hasCharacterFocus: hasCharacters,
    hasActionFocus: hasAction,
    hasDuoFocus: hasDuo,
    warnings
  };
}
